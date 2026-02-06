const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController'); // Import entire controller
const authMiddleware = require('../middleware/authMiddleware'); // Import entire authMiddleware object

router.route('/register').post(userController.registerUser);
router.post('/login', userController.loginUser);

router.get('/', authMiddleware.protect, userController.getUsers); // Removed protect
router
  .route('/profile')
  .get(authMiddleware.protect, userController.getUserProfile)
  .put(authMiddleware.protect, userController.updateUserProfile)
  .delete(authMiddleware.protect, userController.deleteUserProfile);

router.get('/search', authMiddleware.protect, userController.searchUsers);
router.post('/add-friend', authMiddleware.protect, userController.addFriend);
router.get('/friends', authMiddleware.protect, userController.getFriends);

module.exports = router;