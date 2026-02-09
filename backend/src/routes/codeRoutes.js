const express = require('express');
const router = express.Router();
const codeController = require('../controllers/codeController'); // Import entire controller
const authMiddleware = require('../middleware/authMiddleware'); // Import entire authMiddleware object

router.route('/')
    .get(codeController.getCodes)
    .post(codeController.createCode);
router.route('/:id')
    .put(codeController.updateCode)
    .delete(codeController.deleteCode);

module.exports = router;
