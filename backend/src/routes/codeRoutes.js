const express = require('express');
const router = express.Router();
const codeController = require('../controllers/codeController'); // Import entire controller
const authMiddleware = require('../middleware/authMiddleware'); // Import entire authMiddleware object

router.route('/')
    .get(authMiddleware.protect, codeController.getCodes)
    .post(authMiddleware.protect, codeController.createCode);
router.route('/:id')
    .put(authMiddleware.protect, codeController.updateCode)
    .delete(authMiddleware.protect, codeController.deleteCode);

module.exports = router;
