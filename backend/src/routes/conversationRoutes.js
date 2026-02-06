const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');
const authMiddleware = require('../middleware/authMiddleware'); // Import entire authMiddleware object

router.route('/').post(authMiddleware.protect, conversationController.startConversation).get(authMiddleware.protect, conversationController.getConversations);
router.route('/:id').get(authMiddleware.protect, conversationController.getConversation);
router.route('/:id/messages').post(authMiddleware.protect, conversationController.sendMessage);

module.exports = router;
