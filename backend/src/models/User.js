const mongoose = require('mongoose');

const UserSchema = mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      validate: {
        validator: (email) => {
          if (typeof email !== 'string' || email.length > 254 || /\s/.test(email)) return false;
          const parts = email.split('@');
          if (parts.length !== 2) return false;
          const [local, domain] = parts;
          if (!local || local.length > 64 || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return false;
          if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
          const labels = domain.split('.');
          return labels.length >= 2 && labels.every((label) =>
            label.length > 0 && label.length <= 63 && /^[A-Za-z0-9-]+$/.test(label)
            && !label.startsWith('-') && !label.endsWith('-'));
        },
        message: 'Please fill a valid email address',
      },
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    profilePicture: {
      type: String,
      default: 'https://www.gravatar.com/avatar/?d=mp', // Default gravatar
    },
    banner: {
      type: String,
      default: '', // Empty string means the client renders the default themed gradient banner
    },
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    friendRequests: [
      {
        from: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        status: {
          type: String,
          enum: ['pending'],
          default: 'pending',
        },
      },
    ],
    pushToken: {
      type: String,
      default: '',
    },
    blockedUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    isVerified: {
      type: Boolean,
      default: true, // Default to true for existing users
    },
    verificationCode: {
      type: String,
    },
    verificationCodeSentAt: {
      type: Date,
    },
    resetPasswordCode: {
      type: String,
    },
    resetPasswordExpires: {
      type: Date,
    },
    isGoogleUser: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('User', UserSchema);
