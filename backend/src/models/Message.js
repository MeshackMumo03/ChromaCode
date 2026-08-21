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
    maxlength: [10000, 'Message text cannot exceed 10000 characters'],
  },
  codeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Code',
  },
  presetCodeId: {
    type: String,
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
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
    select: false,
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
  reactions: [{
    emoji: {
      type: String,
      maxlength: [16, 'Emoji reaction cannot exceed 16 characters'],
      validate: {
        validator: function(v) {
          // Must not be an empty string or just whitespace
          return v && v.trim().length > 0;
        },
        message: 'Emoji reaction cannot be empty',
      },
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
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

MessageSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', MessageSchema);
