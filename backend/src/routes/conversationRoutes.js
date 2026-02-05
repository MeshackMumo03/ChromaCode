const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');
const protect = require('../middleware/authMiddleware');

router.route('/').post(protect, conversationController.startConversation).get(protect, conversationController.getConversations);
router.route('/:id').get(protect, conversationController.getConversation);
router.route('/:id/messages').post(protect, conversationController.sendMessage);

module.exports = router;
