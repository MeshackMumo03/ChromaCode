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
  const { recipientId, text, codeId } = req.body;
  const senderId = req.user._id;

  if (!recipientId || !text) {
    res.status(400);
    throw new Error('Recipient and text are required');
  }

  const recipient = await User.findById(recipientId);
  if (!recipient) {
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

  const message = await Message.create({
    conversationId: conversation._id,
    sender: senderId,
    text,
    codeId: validCodeId,
  });

  // Ensure the message is fully populated before emitting
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
  const connectedUsers = req.app.get('connectedUsers');
  
  conversation.participants.forEach(participantId => {
    const socketId = connectedUsers.get(participantId.toString());
    if (socketId) {
      io.to(socketId).emit('new_message', {
        conversationId: conversation._id,
        message: message
      });
    }
  });

  // Send push notification to recipient
  sendPushNotification(
    recipientId,
    `New message from ${req.user.username}`,
    text,
    { conversationId: conversation._id }
  );

  // Propagate custom code to recipient
  if (codeId) {
    await propagateCode(codeId, recipientId);
  }

  res.status(201).json({
    conversation,
    message,
  });
});

// @desc    Get all conversations for a user
// @route   GET /api/conversations
// @access  Private
const getConversations = asyncHandler(async (req, res) => {
  const conversations = await Conversation.find({ participants: req.user._id })
    .populate('participants', 'username profilePicture')
    .populate({
      path: 'lastMessage',
      populate: { path: 'codeId' }
    })
    .sort({ updatedAt: -1 });

  res.json(conversations);
});

// @desc    Get a single conversation with all its messages
// @route   GET /api/conversations/:id
// @access  Private
const getConversation = asyncHandler(async (req, res) => {
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
    .populate('codeId');

  res.json({ conversation, messages });
});

// @desc    Send a message in a conversation
// @route   POST /api/conversations/:id/messages
// // @access  Private
const sendMessage = asyncHandler(async (req, res) => {
  const { text, codeId } = req.body;
  const senderId = req.user._id;
  const conversationId = req.params.id;

  if (!text) {
    res.status(400);
    throw new Error('Message text is required');
  }

  const conversation = await Conversation.findById(conversationId);

  if (
    !conversation ||
    !conversation.participants.some(p => p._id.equals(senderId))
  ) {
    res.status(404);
    throw new Error('Conversation not found');
  }

  const validCodeId = codeId && mongoose.Types.ObjectId.isValid(codeId) ? codeId : null;

  const message = await Message.create({
    conversationId,
    sender: senderId,
    text,
    codeId: validCodeId,
  });

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
  const connectedUsers = req.app.get('connectedUsers');

  conversation.participants.forEach(participantId => {
    const socketId = connectedUsers.get(participantId.toString());
    if (socketId) {
      io.to(socketId).emit('new_message', {
        conversationId: conversation._id,
        message: message
      });
    }
  });

  // Send push notification to the other participant
  const recipientId = conversation.participants.find(p => p.toString() !== senderId.toString());
  console.log(`sendMessage: sender=${senderId}, recipientId=${recipientId}, codeId=${codeId}`);
  
  if (recipientId) {
    sendPushNotification(
      recipientId,
      `New message from ${req.user.username}`,
      text,
      { conversationId: conversation._id }
    );
  }

  // Propagate custom code to recipient
  if (codeId && recipientId) {
    await propagateCode(codeId, recipientId);
  }

  res.status(201).json(message);
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
