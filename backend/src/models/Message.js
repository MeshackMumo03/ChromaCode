const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  text: {
    type: String,
  },
  codeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Code',
  },
  mediaType: {
    type: String,
    enum: ['none', 'image', 'voice', 'document', 'sticker', 'video', 'audio', 'gif'],
    default: 'none',
  },
  mediaUrl: {
    type: String,
  },
  mediaData: {
    type: Buffer,
  },
  fileName: {
    type: String,
  },
  fileSize: {
    type: Number,
  },
  fileMimeType: {
    type: String,
  },
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent',
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Message', MessageSchema);
