const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController'); // Import entire controller
const protect = require('../middleware/authMiddleware');

router.route('/register').post(userController.registerUser);
router.post('/login', userController.loginUser);
console.log('protect in userRoutes:', protect);
console.log('userController.getUsers in userRoutes:', userController.getUsers);
router.get('/', protect, userController.getUsers); // Removed protect
router
  .route('/profile')
  .get(protect, userController.getUserProfile)
  .put(protect, userController.updateUserProfile)
  .delete(protect, userController.deleteUserProfile);

router.get('/search', protect, userController.searchUsers);
router.post('/add-friend', protect, userController.addFriend);
router.get('/friends', protect, userController.getFriends);

module.exports = router;