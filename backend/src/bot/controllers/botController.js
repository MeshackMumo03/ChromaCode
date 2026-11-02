const asyncHandler = require('express-async-handler');
const { createHash, timingSafeEqual } = require('node:crypto');
const BotSignal = require('../models/BotSignal');

const sha256 = (value) => createHash('sha256').update(value).digest();

// Only Py-bot, holding CHROMACODE_BOT_TOKEN, may use these routes. With no token
// configured they stay closed.
const requireBotToken = (req, res, next) => {
  const expected = process.env.CHROMACODE_BOT_TOKEN;
  const [scheme, supplied] = (req.headers.authorization || '').split(' ');
  if (!expected || scheme !== 'Bearer' || !supplied
    || !timingSafeEqual(sha256(supplied), sha256(expected))) {
    return res.status(401).json({ message: 'Not authorized' });
  }
  return next();
};

// @desc    Record a new bot signal from Py-bot
// @route   POST /api/bot/signals
// @access  Bot token
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
  requireBotToken,
};
