const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/dbconnection');
const config = require('../config/config');

const socialLogin = async (req, res) => {
    try {
        const { email, name, provider, providerId, avatarUrl } = req.body;

        if (!email || !name || !provider || !providerId) {
            return res.status(400).json({
                success: false,
                message: 'Email, name, provider, and providerId are required'
            });
        }

        // Check if user exists with this email
        let user;
        const userQuery = 'SELECT * FROM users WHERE email = $1 AND is_active = true';
        const userResult = await db.query(userQuery, [email]);

        if (userResult.rows.length === 0) {
            // Create new user for social login
            const insertUserQuery = `
                INSERT INTO users (email, name, provider, provider_id, avatar_url, is_verified, is_active)
                VALUES ($1, $2, $3, $4, $5, true, true)
                RETURNING *
            `;
            const newUserResult = await db.query(insertUserQuery, [email, name, provider, providerId, avatarUrl]);
            user = newUserResult.rows[0];

            // Initialize user credits (1000 trial credits for new users)
            await db.query(`
                INSERT INTO user_credits (user_uuid, credits_balance, is_trial, trial_credits_given)
                VALUES ($1, 1000, true, true)
                ON CONFLICT (user_uuid) DO NOTHING
            `, [user.uuid]);

            // Add credit transaction record
            await db.query(`
                INSERT INTO credit_transactions (user_uuid, transaction_type, amount, balance_after, action_type, description)
                VALUES ($1, 'credit', 1000, 1000, 'trial', 'Welcome bonus - 1000 trial credits')
            `, [user.uuid]);
        } else {
            user = userResult.rows[0];

            // Update user with social login info if needed
            if (user.provider === 'local' || user.provider_id !== providerId) {
                const updateUserQuery = `
                    UPDATE users SET provider = $1, provider_id = $2, avatar_url = $3, name = $4
                    WHERE uuid = $5
                    RETURNING *
                `;
                const updatedUserResult = await db.query(updateUserQuery, [provider, providerId, avatarUrl, name, user.uuid]);
                user = updatedUserResult.rows[0];
            }

            // Ensure user has credits initialized (for existing users)
            const creditsCheck = await db.query('SELECT 1 FROM user_credits WHERE user_uuid = $1', [user.uuid]);
            if (creditsCheck.rows.length === 0) {
                await db.query(`
                    INSERT INTO user_credits (user_uuid, credits_balance, is_trial, trial_credits_given)
                    VALUES ($1, 1000, true, true)
                `, [user.uuid]);
                await db.query(`
                    INSERT INTO credit_transactions (user_uuid, transaction_type, amount, balance_after, action_type, description)
                    VALUES ($1, 'credit', 1000, 1000, 'trial', 'Welcome bonus - 1000 trial credits')
                `, [user.uuid]);
            }
        }

        // Generate JWT token
        const payload = {
            uuid: user.uuid,
            email: user.email,
            name: user.name
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
            message: 'Social login successful',
            data: {
                token,
                user: {
                    uuid: user.uuid,
                    email: user.email,
                    name: user.name,
                    provider: user.provider,
                    avatarUrl: user.avatar_url,
                    is_verified: user.is_verified
                }
            }
        });

    } catch (error) {
        console.error('Social login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

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

        // Ensure user has credits initialized
        const creditsCheck = await db.query('SELECT 1 FROM user_credits WHERE user_uuid = $1', [user.uuid]);
        if (creditsCheck.rows.length === 0) {
            await db.query(`
                INSERT INTO user_credits (user_uuid, credits_balance, is_trial, trial_credits_given)
                VALUES ($1, 1000, true, true)
            `, [user.uuid]);
            await db.query(`
                INSERT INTO credit_transactions (user_uuid, transaction_type, amount, balance_after, action_type, description)
                VALUES ($1, 'credit', 1000, 1000, 'trial', 'Welcome bonus - 1000 trial credits')
            `, [user.uuid]);
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

module.exports = { login, socialLogin };