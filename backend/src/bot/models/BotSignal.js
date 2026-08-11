const mongoose = require('mongoose');

const BotSignalSchema = new mongoose.Schema({
  signalText: {
    type: String,
    required: true,
  },
  parsed: {
    target_multiplier: Number,
    recommended_stake: Number,
    valid: Boolean,
  },
  executionResult: {
    status: String,
    stake: Number,
    target_multiplier: Number,
    message: String,
    reason: String,
  },
  analyticsSummary: {
    total_signals: Number,
    executed_bets: Number,
    skipped_bets: Number,
    wins: Number,
    losses: Number,
    win_rate_percent: Number,
    net_profit: Number,
    roi_percent: Number,
    max_drawdown: Number,
    longest_losing_streak: Number,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('BotSignal', BotSignalSchema);
