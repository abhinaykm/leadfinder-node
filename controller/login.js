const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/dbconnection');
const config = require('../config/config');

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Check if user exists
        const userQuery = 'SELECT * FROM users WHERE email = $1 AND is_active = true';
        const userResult = await db.query(userQuery, [email]);

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        const user = userResult.rows[0];

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check if user is verified
        if (!user.is_verified) {
            return res.status(401).json({
                success: false,
                message: 'Please verify your email before logging in'
            });
        }

        // Generate JWT token
        const payload = {
            uuid: user.uuid,
            email: user.email
        };

        const token = jwt.sign(payload, config.JWT_SECRET, { expiresIn: '24h' });

        // Store token in database
        const tokenQuery = `
            INSERT INTO tokens (user_uuid, token, token_type, expires_at)
            VALUES ($1, $2, $3, $4)
            RETURNING uuid
        `;
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        await db.query(tokenQuery, [user.uuid, token, 'auth', expiresAt]);

        // Return success response
        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                token,
                user: {
                    uuid: user.uuid,
                    email: user.email,
                    name: user.name,
                    is_verified: user.is_verified
                }
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = { login };