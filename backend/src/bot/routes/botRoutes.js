const express = require('express');
const router = express.Router();
const { recordSignal, getSignals, getAnalytics } = require('../controllers/botController');

// Public/Bot endpoint to post signals
router.post('/signals', recordSignal);

// Data retrieval endpoints
router.get('/signals', getSignals);
router.get('/analytics', getAnalytics);

module.exports = router;
