const jwt = require('jsonwebtoken');
const db = require('../config/dbconnection');
const config = require('../config/config');

const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Access token is required'
            });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Verify JWT token
        const decoded = jwt.verify(token, config.JWT_SECRET);

        // Check if token exists in database and is active
        const tokenQuery = `
            SELECT t.*, u.email, u.is_active as user_active, u.is_verified
            FROM tokens t
            JOIN users u ON t.user_uuid = u.uuid
            WHERE t.token = $1 AND t.is_active = true AND t.expires_at > NOW()
        `;

        const tokenResult = await db.query(tokenQuery, [token]);

        if (tokenResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }

        const tokenData = tokenResult.rows[0];

        // Check if user is still active and verified
        if (!tokenData.user_active || !tokenData.is_verified) {
            return res.status(401).json({
                success: false,
                message: 'User account is inactive or not verified'
            });
        }

        // Add user info to request object
        req.user = {
            uuid: decoded.uuid,
            email: decoded.email
        };

        next();

    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token has expired'
            });
        }

        console.error('Token verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = verifyToken;