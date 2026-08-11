const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const Code = require('../models/Code');
const { PRESET_CODES } = require('../constants/presetCodes');
const { sendPushNotification } = require('../utils/notifications');

/**
 * Manually populate preset codes into the message object.
 * Preset codes are not DB records so cannot be populated via Mongoose.
 * Mutates msgObj in-place and returns it.
 */
const populatePresetCodeObj = (msgObj) => {
  const applyPreset = (obj) => {
    if (obj && obj.presetCodeId && typeof obj.presetCodeId === 'string' && obj.presetCodeId.startsWith('preset-')) {
      const idx = parseInt(obj.presetCodeId.split('-')[1], 10);
      const preset = PRESET_CODES[idx];
      if (preset) {
        obj.codeId = {
          _id: obj.presetCodeId,
          name: preset.name,
          color: preset.color,
          meaning: preset.meaning,
        };
      }
    }
  };
  applyPreset(msgObj);
  if (msgObj.replyTo) applyPreset(msgObj.replyTo);
  return msgObj;
};

// @desc    Start new conversation OR navigate to existing one (1-on-1)
// @route   POST /api/conversations
// @access  Private
const startConversation = asyncHandler(async (req, res) => {
  const { recipientId, text, codeId, replyTo, mediaType, mediaUrl, mediaData, fileName, fileSize, fileMimeType } = req.body;
  const senderId = req.user._id;

  if (!recipientId && !req.body.participants) {
    res.status(400);
    throw new Error('Recipient is required');
  }

  const recipient = await User.findById(recipientId);
  if (!recipient && recipientId) {
    res.status(404);
    throw new Error('Recipient not found');
  }

  // Find existing 1-on-1 conversation
  let conversation = await Conversation.findOne({
    participants: { $all: [senderId, recipientId], $size: 2 },
  });

  const conversationAlreadyExists = !!conversation;

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [senderId, recipientId],
    });
  }

  // If conversation already existed and no message/code content was provided,
  // just navigate to it without sending a redundant "Hi!" message.
  if (conversationAlreadyExists && !text && !codeId && !mediaUrl && !mediaData) {
    await conversation.populate('participants', 'username profilePicture');
    return res.status(200).json({ conversation, message: null });
  }

  // Require message content only if we actually intend to send a message
  if (!text && !mediaUrl && !mediaData && !codeId) {
    res.status(400);
    throw new Error('Message content is required');
  }

  const isPreset = codeId && typeof codeId === 'string' && codeId.startsWith('preset-');
  const validCodeId = !isPreset && codeId && mongoose.Types.ObjectId.isValid(codeId) ? codeId : null;
  const validReplyTo = replyTo && mongoose.Types.ObjectId.isValid(replyTo) ? replyTo : null;

  // Handle media data
  let bufferData = null;
  if (mediaData) {
    bufferData = Buffer.from(mediaData, 'base64');
  }

  const message = new Message({
    conversationId: conversation._id,
    sender: senderId,
    text: text || '',
    codeId: validCodeId,
    presetCodeId: isPreset ? codeId : undefined,
    replyTo: validReplyTo,
    mediaType: mediaType || 'none',
    mediaUrl: mediaUrl || '',
    mediaData: bufferData,
    fileName: fileName || '',
    fileSize: fileSize || 0,
    fileMimeType: fileMimeType || '',
    readBy: [senderId],
  });

  if (message.mediaData && !mediaUrl) {
    message.mediaUrl = `/api/conversations/messages/${message._id}/media`;
  }

  await message.save();

  // Populate the sender, codeId, and replyTo fields before sending the message in the response
  await message.populate([
    { path: 'sender', select: 'username profilePicture' },
    { path: 'codeId' },
    {
      path: 'replyTo',
      select: '-mediaData',
      populate: [
        { path: 'sender', select: 'username profilePicture' },
        { path: 'codeId' }
      ]
    }
  ]);

  // Explicitly update lastMessage and updatedAt to force sorting to work
  conversation.lastMessage = message._id;
  conversation.updatedAt = new Date();
  await conversation.save();

  // For real-time response, strip binary data and inject preset code info
  let socketMessage = message.toObject();
  delete socketMessage.mediaData;
  socketMessage = populatePresetCodeObj(socketMessage);

  // Emit socket event to ALL participants (including sender for sync)
  const io = req.app.get('io');

  // Emit to all participants (including the sender for conversation list sync)
  conversation.participants.forEach(participantId => {
    io.to(participantId.toString()).emit('new_message', {
      conversationId: conversation._id,
      message: socketMessage
    });
  });

  // Send push notification to recipient
  sendPushNotification(
    recipientId,
    `New message from ${req.user.username}`,
    mediaType && mediaType !== 'none' ? `Sent an ${mediaType}` : text,
    { conversationId: conversation._id }
  );

  // Propagate custom code to recipient (not needed for presets — they're universal)
  if (validCodeId) {
    await propagateCode(validCodeId, recipientId);
  }

  res.status(201).json({
    conversation,
    message: socketMessage,
  });
});

// @desc    Create a group chat
// @route   POST /api/conversations/group
// @access  Private
const createGroupChat = asyncHandler(async (req, res) => {
  const { participants, name } = req.body;

  if (!participants || !name || participants.length < 1) {
    res.status(400);
    throw new Error('Please provide a group name and at least one other participant');
  }

  // Add current user to participants if not already included
  const allParticipants = [...new Set([...participants, req.user._id.toString()])];

  const conversation = await Conversation.create({
    participants: allParticipants,
    name,
    isGroup: true,
    groupAdmin: req.user._id,
  });

  const populatedConversation = await Conversation.findById(conversation._id).populate(
    'participants',
    'username profilePicture'
  );

  res.status(201).json(populatedConversation);
});

// @desc    Get all conversations for a user
// @route   GET /api/conversations
// @access  Private
const getConversations = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const conversations = await Conversation.find({ participants: userId })
    .populate('participants', 'username profilePicture')
    .populate({
      path: 'lastMessage',
      select: '-mediaData', // Heavily exclude binary data here
      populate: { path: 'codeId' }
    })
    .sort({ updatedAt: -1 })
    .lean(); // Return plain JS objects for speed

  // Add unread count for each conversation
  const conversationsWithUnread = await Promise.all(conversations.map(async (conv) => {
    const unreadCount = await Message.countDocuments({
      conversationId: conv._id,
      readBy: { $ne: userId }
    });
    
    conv.unreadCount = unreadCount;
    return conv;
  }));

  res.json(conversationsWithUnread);
});

// @desc    Get a single conversation with paginated messages
// @route   GET /api/conversations/:id?page=1&limit=20
// @access  Private
const getConversation = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const conversation = await Conversation.findById(req.params.id).populate(
    'participants',
    'username profilePicture'
  ).lean();

  if (
    !conversation ||
    !conversation.participants.some(p => p._id.toString() === req.user._id.toString())
  ) {
    res.status(404);
    throw new Error('Conversation not found');
  }

  const messages = await Message.find({ conversationId: req.params.id })
    .select('-mediaData')
    .populate('sender', 'username profilePicture')
    .populate('codeId')
    .populate({
      path: 'replyTo',
      select: '-mediaData',
      populate: [
        { path: 'sender', select: 'username profilePicture' },
        { path: 'codeId' }
      ]
    })
    .sort({ createdAt: -1 }) // Get newest first for pagination
    .skip(skip)
    .limit(limit)
    .lean();

  // Inject preset code details for any message that uses a preset
  const populatedMessages = messages.map(msg => populatePresetCodeObj(msg));

  // Return messages in chronological order for the frontend
  res.json({ 
    conversation, 
    messages: populatedMessages.reverse(),
    hasMore: messages.length === limit
  });
});

// @desc    Send a message in a conversation
// @route   POST /api/conversations/:id/messages
// @access  Private
const sendMessage = asyncHandler(async (req, res) => {
  const { text, codeId, replyTo, mediaType, mediaUrl, mediaData, fileName, fileSize, fileMimeType } = req.body;
  const senderId = req.user._id;
  const conversationId = req.params.id;

  if (!text && !mediaUrl && !mediaData) {
    res.status(400);
    throw new Error('Message content is required');
  }

  const conversation = await Conversation.findById(conversationId).populate('participants', 'blockedUsers');

  if (
    !conversation ||
    !conversation.participants.some(p => p._id.equals(senderId))
  ) {
    res.status(404);
    throw new Error('Conversation not found');
  }

  // Check if any other participant has blocked the sender
  const isBlocked = conversation.participants.some(p => 
    p.blockedUsers && p.blockedUsers.includes(senderId)
  );

  if (isBlocked) {
    res.status(403);
    throw new Error('You cannot send messages to this conversation because you are blocked.');
  }

  const isPreset = codeId && typeof codeId === 'string' && codeId.startsWith('preset-');
  const validCodeId = !isPreset && codeId && mongoose.Types.ObjectId.isValid(codeId) ? codeId : null;
  const validReplyTo = replyTo && mongoose.Types.ObjectId.isValid(replyTo) ? replyTo : null;

  // If mediaData is provided in Base64 (from frontend), convert to Buffer
  let bufferData = null;
  if (mediaData) {
    bufferData = Buffer.from(mediaData, 'base64');
  }

  const message = new Message({
    conversationId,
    sender: senderId,
    text: text || '',
    codeId: validCodeId,
    presetCodeId: isPreset ? codeId : undefined,
    replyTo: validReplyTo,
    mediaType: mediaType || 'none',
    mediaUrl: mediaUrl || '',
    mediaData: bufferData,
    fileName: fileName || '',
    fileSize: fileSize || 0,
    fileMimeType: fileMimeType || '',
    readBy: [senderId],
  });

  if (message.mediaData && !mediaUrl) {
    message.mediaUrl = `/api/conversations/messages/${message._id}/media`;
  }

  await message.save();

  // Populate the sender, codeId, and replyTo fields before sending the message in the response
  await message.populate([
    { path: 'sender', select: 'username profilePicture' },
    { path: 'codeId' },
    {
      path: 'replyTo',
      select: '-mediaData',
      populate: [
        { path: 'sender', select: 'username profilePicture' },
        { path: 'codeId' }
      ]
    }
  ]);

  // For real-time response, strip binary data and inject preset code info
  let socketMessage = message.toObject();
  delete socketMessage.mediaData;
  socketMessage = populatePresetCodeObj(socketMessage);

  // Explicitly update lastMessage and updatedAt to force sorting to work
  conversation.lastMessage = message._id;
  conversation.updatedAt = new Date();
  await conversation.save();

  // Emit socket event to ALL participants (including sender for sync)
  const io = req.app.get('io');
  
  conversation.participants.forEach(participantId => {
    io.to(participantId.toString()).emit('new_message', {
      conversationId: conversation._id,
      message: socketMessage
    });
  });

  // Send push notification to other participants
  const recipients = conversation.participants.filter(p => p.toString() !== senderId.toString());
  
  recipients.forEach(recipientId => {
    const notificationText = mediaType && mediaType !== 'none' 
      ? `Sent an ${mediaType}` 
      : text;

    sendPushNotification(
      recipientId,
      conversation.isGroup ? `${conversation.name}: ${req.user.username}` : `New message from ${req.user.username}`,
      notificationText,
      { conversationId: conversation._id }
    );

    // Propagate custom code to all recipients
    if (codeId) {
      propagateCode(codeId, recipientId);
    }
  });

  res.status(201).json(socketMessage);
});

// @desc    Upload message media
// @route   POST /api/conversations/upload
// @access  Private
const uploadMessageMedia = asyncHandler(async (req, res) => {
  console.log('--- uploadMessageMedia start ---');
  if (!req.file) {
    console.log('uploadMessageMedia: No file provided');
    res.status(400);
    throw new Error('Please upload a file');
  }

  console.log(`uploadMessageMedia: Received file ${req.file.originalname} (${req.file.size} bytes)`);

  const responseData = { 
    // multer-storage-cloudinary puts the permanent hosted URL on req.file.path
    mediaUrl: req.file.path,
    fileName: req.file.originalname,
    fileSize: req.file.size,
    fileMimeType: req.file.mimetype,
  };

  console.log('uploadMessageMedia: Sending response:', responseData);
  res.json(responseData);
});

// @desc    Get message media from MongoDB
// @route   GET /api/conversations/messages/:id/media
// @access  Private
const getMessageMedia = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.id);

  if (!message || !message.mediaData) {
    res.status(404);
    throw new Error('Media not found');
  }

  // Security check: is the user part of this conversation?
  const conversation = await Conversation.findById(message.conversationId);
  if (!conversation.participants.some(p => p.equals(req.user._id))) {
    res.status(403);
    throw new Error('Not authorized to access this media');
  }

  res.set('Content-Type', message.fileMimeType || 'application/octet-stream');
  res.send(message.mediaData);
});

// Helper to share code with recipient
const propagateCode = async (codeId, recipientId) => {
  if (!codeId || !recipientId) return;
  
  try {
    let originalCode;

    // Handle preset codes (e.g. "preset-0")
    if (typeof codeId === 'string' && codeId.startsWith('preset-')) {
      const presetIndex = parseInt(codeId.split('-')[1]);
      const preset = PRESET_CODES[presetIndex];
      if (!preset) return;

      // Check if this preset already exists as a shared/custom code in DB by name
      originalCode = await Code.findOne({ name: preset.name, user: { $exists: true } });
      
      // If no DB record exists for this preset, we don't need to propagate 
      // because presets are already in every user's library by default.
      if (!originalCode) {
        console.log(`Preset code ${preset.name} is already available to all users.`);
        return;
      }
    } else {
      if (!mongoose.Types.ObjectId.isValid(codeId)) return;
      originalCode = await Code.findById(codeId);
    }

    if (!originalCode) return; 

    // If the recipient is already the owner or already in sharedWith, skip
    if (originalCode.user.toString() === recipientId.toString()) return;
    
    const isAlreadyShared = originalCode.sharedWith.some(id => id.toString() === recipientId.toString());
    if (isAlreadyShared) {
      console.log(`ℹ️ Code ${originalCode.name} already shared with ${recipientId}`);
      return;
    }

    // Add recipient to shared list
    originalCode.sharedWith.push(recipientId);
    await originalCode.save();
    
    console.log(`✅ Code ${originalCode.name} shared with user ${recipientId}`);
  } catch (error) {
    console.error('❌ Error sharing code:', error);
  }
};

// @desc    Update a group chat (name, participants, or groupImage)
// @route   PUT /api/conversations/:id/group
// @access  Private
const updateGroupChat = asyncHandler(async (req, res) => {
  const { name, participants, groupImage } = req.body;
  console.log(`updateGroupChat: id=${req.params.id}, name=${name}, hasImage=${!!groupImage}`);
  
  const conversation = await Conversation.findById(req.params.id);

  if (!conversation || !conversation.isGroup) {
    console.log('updateGroupChat: Group not found');
    res.status(404);
    throw new Error('Group chat not found');
  }

  // Only admin can update
  if (conversation.groupAdmin.toString() !== req.user._id.toString()) {
    console.log(`updateGroupChat: User ${req.user._id} is not admin ${conversation.groupAdmin}`);
    res.status(403);
    throw new Error('Only the group admin can update settings');
  }

  if (name) conversation.name = name;
  if (groupImage !== undefined) conversation.groupImage = groupImage;
  if (participants) {
    const updatedParticipants = [...new Set([...participants, req.user._id.toString()])];
    conversation.participants = updatedParticipants;
  }

  await conversation.save();
  const updated = await Conversation.findById(conversation._id).populate('participants', 'username profilePicture');
  
  console.log('updateGroupChat: Success');
  res.json(updated);
});

// @desc    Leave a group chat
// @route   DELETE /api/conversations/:id/leave
// @access  Private
const leaveGroupChat = asyncHandler(async (req, res) => {
  console.log(`leaveGroupChat: id=${req.params.id}, user=${req.user._id}`);
  const conversation = await Conversation.findById(req.params.id);

  if (!conversation || !conversation.isGroup) {
    res.status(404);
    throw new Error('Group chat not found');
  }

  // Remove the user
  conversation.participants = conversation.participants.filter(
    p => p.toString() !== req.user._id.toString()
  );

  // If the admin leaves, assign a new admin if there are still members
  if (conversation.groupAdmin.toString() === req.user._id.toString()) {
    if (conversation.participants.length > 0) {
      conversation.groupAdmin = conversation.participants[0];
    }
  }

  // If no one is left, delete the group
  if (conversation.participants.length === 0) {
    await Conversation.findByIdAndDelete(req.params.id);
    console.log('leaveGroupChat: Group dissolved');
    return res.json({ message: 'Group dissolved' });
  }

  await conversation.save();
  console.log('leaveGroupChat: Success');
  res.json({ message: 'Successfully left the group' });
});

// @desc    Delete a group chat
// @route   DELETE /api/conversations/:id
// @access  Private
const deleteGroupChat = asyncHandler(async (req, res) => {
  console.log(`deleteGroupChat: id=${req.params.id}, user=${req.user._id}`);
  const conversation = await Conversation.findById(req.params.id);

  if (!conversation || !conversation.isGroup) {
    res.status(404);
    throw new Error('Group chat not found');
  }

  if (conversation.groupAdmin.toString() !== req.user._id.toString()) {
    console.log(`deleteGroupChat: User ${req.user._id} is not admin ${conversation.groupAdmin}`);
    res.status(403);
    throw new Error('Only the admin can delete the group');
  }

  await Conversation.findByIdAndDelete(req.params.id);
  await Message.deleteMany({ conversationId: req.params.id });

  console.log('deleteGroupChat: Success');
  res.json({ message: 'Group chat deleted successfully' });
});

// @desc    Mark all messages in a conversation as read
// @route   PUT /api/conversations/:id/read
// @access  Private
const markMessagesAsRead = asyncHandler(async (req, res) => {
  const conversationId = req.params.id;
  const userId = req.user._id;

  await Message.updateMany(
    { conversationId, readBy: { $ne: userId } },
    { 
      $addToSet: { readBy: userId },
      status: 'read' 
    }
  );

  // Emit socket event for real-time status update
  const io = req.app.get('io');
  const conversation = await Conversation.findById(conversationId);
  const connectedUsers = req.app.get('connectedUsers');

  conversation.participants.forEach(participantId => {
    io.to(participantId.toString()).emit('messages_read', { conversationId, readerId: userId });
  });

  res.json({ message: 'Messages marked as read' });
});

// @desc    Delete a message
// @route   DELETE /api/conversations/:id/messages/:messageId
// @access  Private
const deleteMessage = asyncHandler(async (req, res) => {
  const { id, messageId } = req.params;
  const userId = req.user._id;

  const message = await Message.findById(messageId);
  if (!message) {
    res.status(404);
    throw new Error('Message not found');
  }

  // Only allow sender to delete
  if (message.sender.toString() !== userId.toString()) {
    res.status(401);
    throw new Error('User not authorized to delete this message');
  }

  await message.deleteOne();

  // Notify other participants via socket
  const io = req.app.get('io');
  io.to(id).emit('message_deleted', { conversationId: id, messageId });

  res.json({ message: 'Message deleted' });
});

// @desc    Add a reaction to a message
// @route   POST /api/conversations/:id/messages/:messageId/reactions
// @access  Private
const addReaction = asyncHandler(async (req, res) => {
  const { id, messageId } = req.params;
  const { emoji } = req.body;
  const userId = req.user._id;

  const message = await Message.findById(messageId);
  if (!message) {
    res.status(404);
    throw new Error('Message not found');
  }

  // Remove existing reaction from this user if any
  message.reactions = message.reactions.filter(r => r.userId.toString() !== userId.toString());
  
  // Add new reaction
  message.reactions.push({ emoji, userId });
  await message.save();

  // Notify participants
  const io = req.app.get('io');
  io.to(id).emit('message_reaction', { conversationId: id, messageId, reactions: message.reactions });

  res.json(message.reactions);
});

// @desc    Remove a reaction from a message
// @route   DELETE /api/conversations/:id/messages/:messageId/reactions
// @access  Private
const removeReaction = asyncHandler(async (req, res) => {
  const { id, messageId } = req.params;
  const userId = req.user._id;

  const message = await Message.findById(messageId);
  if (!message) {
    res.status(404);
    throw new Error('Message not found');
  }

  message.reactions = message.reactions.filter(r => r.userId.toString() !== userId.toString());
  await message.save();

  // Notify participants
  const io = req.app.get('io');
  io.to(id).emit('message_reaction', { conversationId: id, messageId, reactions: message.reactions });

  res.json(message.reactions);
});

module.exports = {
  startConversation,
  createGroupChat,
  getConversations,
  getConversation,
  sendMessage,
  deleteMessage,
  addReaction,
  removeReaction,
  updateGroupChat,
  leaveGroupChat,
  deleteGroupChat,
  markMessagesAsRead,
  uploadMessageMedia,
  getMessageMedia,
};
