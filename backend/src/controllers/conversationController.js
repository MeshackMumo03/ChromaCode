const asyncHandler = require('express-async-handler');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

// @desc    Start new conversation
// @route   POST /api/conversations
// @access  Private
const startConversation = asyncHandler(async (req, res) => {
  const { recipientId, text } = req.body;
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

  const message = await Message.create({
    conversationId: conversation._id,
    sender: senderId,
    text,
  });

  conversation.lastMessage = message._id;
  await conversation.save();

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
    .populate('lastMessage');

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

  const messages = await Message.find({ conversationId: req.params.id }).populate(
    'sender',
    'username profilePicture'
  );

  res.json({ conversation, messages });
});

// @desc    Send a message in a conversation
// @route   POST /api/conversations/:id/messages
// // @access  Private
const sendMessage = asyncHandler(async (req, res) => {
  const { text } = req.body;
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

  const message = await Message.create({
    conversationId,
    sender: senderId,
    text,
  });

  // Populate the sender field before sending the message in the response
  await message.populate('sender', 'username profilePicture');

  conversation.lastMessage = message._id;
  await conversation.save();

  res.status(201).json(message);
});

module.exports = {
  startConversation,
  getConversations,
  getConversation,
  sendMessage,
};
