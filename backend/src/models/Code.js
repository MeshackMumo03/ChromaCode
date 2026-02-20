const mongoose = require('mongoose');

const codeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  color: {
    type: String,
    required: true,
  },
  meaning: {
    type: String,
    required: true,
  },
  sharedWith: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
});

// Ensure that each user can only have one code with a given name
codeSchema.index({ user: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Code', codeSchema);
