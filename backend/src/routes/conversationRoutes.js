const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');
const authMiddleware = require('../middleware/authMiddleware'); // Import entire authMiddleware object

router.route('/').post(conversationController.startConversation).get(conversationController.getConversations);
router.route('/:id').get(conversationController.getConversation);
router.route('/:id/messages').post(conversationController.sendMessage);

module.exports = router;
