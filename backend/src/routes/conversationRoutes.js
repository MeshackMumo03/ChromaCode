const express = require('express');
const router = express.Router();
const { 
  startConversation, 
  getConversations, 
  createGroupChat, 
  getConversation, 
  sendMessage,
  updateGroupChat,
  leaveGroupChat,
  deleteGroupChat
} = require('../controllers/conversationController');

router.route('/')
  .post(startConversation)
  .get(getConversations);

router.post('/group', createGroupChat);

router.get('/:id', getConversation);
router.put('/:id/group', updateGroupChat);
router.delete('/:id/leave', leaveGroupChat);
router.delete('/:id', deleteGroupChat);

router.post('/:id/messages', sendMessage);

module.exports = router;
