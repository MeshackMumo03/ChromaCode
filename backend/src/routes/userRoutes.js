const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController'); // Import entire controller
const protect = require('../middleware/authMiddleware'); // Import protect function

router.route('/register').post(userController.registerUser);
router.post('/login', userController.loginUser);

router.get('/', protect, userController.getUsers); // Removed protect
router
  .route('/profile')
  .get(protect, userController.getUserProfile)
  .put(protect, userController.updateUserProfile)
  .delete(protect, userController.deleteUserProfile);

router.get('/search', protect, userController.searchUsers);
router.post('/add-friend', protect, userController.addFriend);
router.get('/friends', protect, userController.getFriends);
router.put('/push-token', protect, userController.updatePushToken);

module.exports = router;