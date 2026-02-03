const mongoose = require('mongoose');

const HistoryItemSchema = mongoose.Schema(
  {
    code: {
      name: { type: String, required: true },
      meaning: { type: String, required: true },
      color: { type: String, required: true },
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('HistoryItem', HistoryItemSchema);
