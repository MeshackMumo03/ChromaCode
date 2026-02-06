const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('express-async-handler'); // Add this line

const protect = asyncHandler(async (req, res, next) => {
    console.log('--- protect middleware entered ---');
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        console.log('Authorization header present.');
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];
            console.log('Token extracted:', token ? 'YES' : 'NO');

            // Verify token
            console.log('JWT_SECRET available:', process.env.JWT_SECRET ? 'YES' : 'NO');
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log('Token decoded:', decoded ? 'YES' : 'NO', 'User ID:', decoded.id);

            // Get user from token
            req.user = await User.findById(decoded.id).select('-password');
            console.log('req.user set:', req.user ? 'YES' : 'NO');

            next();
        } catch (error) {
            console.error('Error in protect middleware:', error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    } else {
        console.log('Authorization header NOT present or malformed.');
    }

    if (!token) {
        console.log('No token found after processing. Sending 401.');
        res.status(401).json({ message: 'Not authorized, no token' });
    }
});

module.exports = protect;