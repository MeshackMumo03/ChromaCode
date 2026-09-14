const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
router.use(rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many code requests, please try again shortly' },
}));
const codeController = require('../controllers/codeController'); // Import entire controller
const authMiddleware = require('../middleware/authMiddleware'); // Import entire authMiddleware object

router.route('/')
    .get(codeController.getCodes)
    .post(codeController.createCode);
router.route('/:id')
    .put(codeController.updateCode)
    .delete(codeController.deleteCode);

module.exports = router;
