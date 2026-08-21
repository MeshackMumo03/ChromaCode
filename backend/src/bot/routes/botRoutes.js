const express = require('express');
const router = express.Router();
const { recordSignal, getSignals, getAnalytics } = require('../controllers/botController');
const protect = require('../../middleware/authMiddleware');

// Verify the shared bot token sent by Py-bot
const botAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (!token || token !== process.env.CHROMACODE_BOT_TOKEN) {
    res.status(401);
    throw new Error('Not authorized, invalid bot token');
  }

  next();
};

// Bot endpoint to post signals - requires CHROMACODE_BOT_TOKEN
router.post('/signals', botAuth, recordSignal);

// Data retrieval endpoints - require a logged-in user
router.get('/signals', protect, getSignals);
router.get('/analytics', protect, getAnalytics);

module.exports = router;
