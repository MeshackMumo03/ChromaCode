const asyncHandler = require('express-async-handler');
const BotSignal = require('../models/BotSignal');

// @desc    Record a new bot signal from Py-bot
// @route   POST /api/bot/signals
// @access  Public / Protected
const recordSignal = asyncHandler(async (req, res) => {
  const { signalText, parsed, executionResult, analyticsSummary } = req.body;

  if (!signalText) {
    res.status(400);
    throw new Error('signalText is required');
  }

  const newSignal = await BotSignal.create({
    signalText,
    parsed,
    executionResult,
    analyticsSummary,
  });

  // Broadcast to connected frontend clients via Socket.IO
  const io = req.app.get('io');
  if (io) {
    io.emit('bot_signal_received', newSignal);
  }

  res.status(201).json(newSignal);
});

// @desc    Get recent signals logged by Py-bot
// @route   GET /api/bot/signals
// @access  Private
const getSignals = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const signals = await BotSignal.find()
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await BotSignal.countDocuments();

  res.json({
    signals,
    page,
    pages: Math.ceil(total / limit),
    total,
  });
});

// @desc    Get latest analytics summary from Py-bot
// @route   GET /api/bot/analytics
// @access  Private
const getAnalytics = asyncHandler(async (req, res) => {
  const latestSignal = await BotSignal.findOne()
    .sort({ createdAt: -1 })
    .select('analyticsSummary createdAt')
    .lean();

  if (!latestSignal || !latestSignal.analyticsSummary) {
    return res.json({
      analyticsSummary: {
        total_signals: 0,
        executed_bets: 0,
        skipped_bets: 0,
        wins: 0,
        losses: 0,
        win_rate_percent: 0,
        net_profit: 0,
        roi_percent: 0,
        max_drawdown: 0,
        longest_losing_streak: 0,
      },
      lastUpdated: null,
    });
  }

  res.json({
    analyticsSummary: latestSignal.analyticsSummary,
    lastUpdated: latestSignal.createdAt,
  });
});

module.exports = {
  recordSignal,
  getSignals,
  getAnalytics,
};
