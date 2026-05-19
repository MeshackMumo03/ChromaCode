const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const Code = require('../models/Code');
const { PRESET_CODES } = require('../constants/presetCodes');
const { sendPushNotification } = require('../utils/notifications');

// @desc    Start new conversation
// @route   POST /api/conversations
// @access  Private
const startConversation = asyncHandler(async (req, res) => {
  const { recipientId, text, codeId, mediaType, mediaUrl, mediaData, fileName, fileSize, fileMimeType } = req.body;
  const senderId = req.user._id;

  if (!recipientId && !req.body.participants) {
    res.status(400);
    throw new Error('Recipient is required');
  }

  if (!text && !mediaUrl && !mediaData) {
    res.status(400);
    throw new Error('Message content is required');
  }

  const recipient = await User.findById(recipientId);
  if (!recipient && recipientId) {
    res.status(404);
    throw new Error('Recipient not found');
  }

  let conversation = await Conversation.findOne({
    participants: { $all: [senderId, recipientId], $size: 2 },
  });

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [senderId, recipientId],
    });
  }

  const validCodeId = codeId && mongoose.Types.ObjectId.isValid(codeId) ? codeId : null;

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
    mediaType: mediaType || 'none',
    mediaUrl: mediaUrl || '',
    mediaData: bufferData,
    fileName: fileName || '',
    fileSize: fileSize || 0,
    fileMimeType: fileMimeType || '',
    readBy: [senderId],
  });

  if (message.mediaData) {
    message.mediaUrl = `/api/conversations/messages/${message._id}/media`;
  }

  await message.save();

  // Populate the sender and codeId fields before sending the message in the response
  await message.populate([
    { path: 'sender', select: 'username profilePicture' },
    { path: 'codeId' }
  ]);

  // Explicitly update lastMessage and updatedAt to force sorting to work
  conversation.lastMessage = message._id;
  conversation.updatedAt = new Date();
  await conversation.save();

  // Emit socket event
  const io = req.app.get('io');
  
  // For real-time response, we don't want to send the entire buffer back if it's large
  const socketMessage = message.toObject();
  delete socketMessage.mediaData;

  // Emit to all participants except the sender
  conversation.participants.forEach(participantId => {
    if (participantId.toString() !== senderId.toString()) {
      io.to(participantId.toString()).emit('new_message', {
        conversationId: conversation._id,
        message: socketMessage
      });
    }
  });

  // Send push notification to recipient
  sendPushNotification(
    recipientId,
    `New message from ${req.user.username}`,
    mediaType && mediaType !== 'none' ? `Sent an ${mediaType}` : text,
    { conversationId: conversation._id }
  );

  // Propagate custom code to recipient
  if (codeId) {
    await propagateCode(codeId, recipientId);
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
      populate: { path: 'codeId' }
    })
    .sort({ updatedAt: -1 });

  // Add unread count for each conversation
  const conversationsWithUnread = await Promise.all(conversations.map(async (conv) => {
    const unreadCount = await Message.countDocuments({
      conversationId: conv._id,
      readBy: { $ne: userId }
    });
    
    // Convert Mongoose doc to plain object to add virtual field
    const convObj = conv.toObject();
    convObj.unreadCount = unreadCount;
    return convObj;
  }));

  res.json(conversationsWithUnread);
});

// @desc    Get a single conversation with paginated messages
// @route   GET /api/conversations/:id?page=1&limit=50
// @access  Private
const getConversation = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const skip = (page - 1) * limit;

  const conversation = await Conversation.findById(req.params.id).populate(
    'participants',
    'username profilePicture'
  );

  if (
    !conversation ||
    !conversation.participants.some(p => p._id.toString() === req.user._id.toString())
  ) {
    res.status(404);
    throw new Error('Conversation not found');
  }

  const messages = await Message.find({ conversationId: req.params.id })
    .populate('sender', 'username profilePicture')
    .populate('codeId')
    .sort({ createdAt: -1 }) // Get newest first for pagination
    .skip(skip)
    .limit(limit);

  // Return messages in chronological order for the frontend
  res.json({ 
    conversation, 
    messages: messages.reverse(),
    hasMore: messages.length === limit
  });
});

// @desc    Send a message in a conversation
// @route   POST /api/conversations/:id/messages
// // @access  Private
const sendMessage = asyncHandler(async (req, res) => {
  const { text, codeId, mediaType, mediaUrl, mediaData, fileName, fileSize, fileMimeType } = req.body;
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

  const validCodeId = codeId && mongoose.Types.ObjectId.isValid(codeId) ? codeId : null;

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
    mediaType: mediaType || 'none',
    mediaUrl: mediaUrl || '',
    mediaData: bufferData,
    fileName: fileName || '',
    fileSize: fileSize || 0,
    fileMimeType: fileMimeType || '',
    readBy: [senderId],
  });

  if (message.mediaData) {
    message.mediaUrl = `/api/conversations/messages/${message._id}/media`;
  }

  await message.save();

  // Populate the sender and codeId fields before sending the message in the response
  await message.populate([
    { path: 'sender', select: 'username profilePicture' },
    { path: 'codeId' }
  ]);

  // For real-time response, we don't want to send the entire buffer back if it's large
  const socketMessage = message.toObject();
  delete socketMessage.mediaData;

  // Explicitly update lastMessage and updatedAt to force sorting to work
  conversation.lastMessage = message._id;
  conversation.updatedAt = new Date();
  await conversation.save();

  // Emit socket event
  const io = req.app.get('io');
  
  conversation.participants.forEach(participantId => {
    if (participantId.toString() !== senderId.toString()) {
      io.to(participantId.toString()).emit('new_message', {
        conversationId: conversation._id,
        message: socketMessage
      });
    }
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
  if (!req.file) {
    res.status(400);
    throw new Error('Please upload a file');
  }

  // Return the data directly to be saved in the sendMessage call
  // We return the buffer as a base64 string for the client to hold temporarily
  res.json({ 
    mediaData: req.file.buffer.toString('base64'),
    fileName: req.file.originalname,
    fileSize: req.file.size,
    fileMimeType: req.file.mimetype,
  });
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

module.exports = {
  startConversation,
  createGroupChat,
  getConversations,
  getConversation,
  sendMessage,
  updateGroupChat,
  leaveGroupChat,
  deleteGroupChat,
  markMessagesAsRead,
  uploadMessageMedia,
  getMessageMedia,
};
