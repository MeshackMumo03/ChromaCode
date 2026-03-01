const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController'); // Import entire controller
const protect = require('../middleware/authMiddleware'); // Import protect function

router.route('/register').post(userController.registerUser);
router.post('/login', userController.loginUser);

router.get('/search', protect, userController.searchUsers);
router.get('/friend-requests', protect, userController.getFriendRequests);
router.get('/friends', protect, userController.getFriends);
router.post('/friend-request', protect, userController.sendFriendRequest);
router.post('/friend-request/accept', protect, userController.acceptFriendRequest);
router.post('/friend-request/decline', protect, userController.declineFriendRequest);
router.put('/push-token', protect, userController.updatePushToken);

router.get('/', protect, userController.getUsers);
router
  .route('/profile')
  .get(protect, userController.getUserProfile)
  .put(protect, userController.updateUserProfile)
  .delete(protect, userController.deleteUserProfile);

module.exports = router;