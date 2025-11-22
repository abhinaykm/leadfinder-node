const db = require('../config/dbconnection');
const axios = require('axios');
const config = require('../config/config');

// Get user's API keys status (not the actual keys for security)
const getApiKeysStatus = async (req, res) => {
    try {
        const userUuid = req.user.uuid;

        const result = await db.query(`
            SELECT
                use_own_keys,
                google_api_key IS NOT NULL as has_google_key,
                openai_api_key IS NOT NULL as has_openai_key,
                keys_valid,
                keys_last_checked
            FROM user_credits
            WHERE user_uuid = $1
        `, [userUuid]);

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                data: {
                    use_own_keys: false,
                    has_google_key: false,
                    has_openai_key: false,
                    keys_valid: false,
                    keys_last_checked: null
                }
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Get API keys status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch API keys status'
        });
    }
};

// Validate Google API key
const validateGoogleApiKey = async (apiKey) => {
    try {
        // Test with a simple geocoding request
        const response = await axios.get(
            `https://maps.googleapis.com/maps/api/geocode/json?address=test&key=${apiKey}`
        );
        return response.data.status !== 'REQUEST_DENIED';
    } catch (error) {
        console.error('Google API key validation error:', error.message);
        return false;
    }
};

// Validate OpenAI API key
const validateOpenAiApiKey = async (apiKey) => {
    try {
        const response = await axios.get('https://api.openai.com/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });
        return response.status === 200;
    } catch (error) {
        console.error('OpenAI API key validation error:', error.message);
        return false;
    }
};

// Save/Update API keys
const saveApiKeys = async (req, res) => {
    try {
        const userUuid = req.user.uuid;
        const { googleApiKey, openaiApiKey, enableByok } = req.body;

        // Validate keys if provided
        let googleValid = true;
        let openaiValid = true;

        if (googleApiKey) {
            googleValid = await validateGoogleApiKey(googleApiKey);
            if (!googleValid) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid Google API key'
                });
            }
        }

        if (openaiApiKey) {
            openaiValid = await validateOpenAiApiKey(openaiApiKey);
            if (!openaiValid) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid OpenAI API key'
                });
            }
        }

        // Update user credentials
        const keysValid = (googleApiKey ? googleValid : true) && (openaiApiKey ? openaiValid : true);

        const result = await db.query(`
            UPDATE user_credits
            SET
                google_api_key = COALESCE($2, google_api_key),
                openai_api_key = COALESCE($3, openai_api_key),
                use_own_keys = $4,
                keys_valid = $5,
                keys_last_checked = NOW(),
                updated_at = NOW()
            WHERE user_uuid = $1
            RETURNING
                use_own_keys,
                google_api_key IS NOT NULL as has_google_key,
                openai_api_key IS NOT NULL as has_openai_key,
                keys_valid,
                keys_last_checked
        `, [userUuid, googleApiKey || null, openaiApiKey || null, enableByok || false, keysValid]);

        res.json({
            success: true,
            message: 'API keys saved successfully',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Save API keys error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save API keys'
        });
    }
};

// Remove API keys
const removeApiKeys = async (req, res) => {
    try {
        const userUuid = req.user.uuid;
        const { keyType } = req.body; // 'google', 'openai', or 'all'

        let updateQuery = '';
        if (keyType === 'google') {
            updateQuery = 'google_api_key = NULL';
        } else if (keyType === 'openai') {
            updateQuery = 'openai_api_key = NULL';
        } else {
            updateQuery = 'google_api_key = NULL, openai_api_key = NULL, use_own_keys = false';
        }

        await db.query(`
            UPDATE user_credits
            SET ${updateQuery}, keys_valid = false, updated_at = NOW()
            WHERE user_uuid = $1
        `, [userUuid]);

        res.json({
            success: true,
            message: 'API keys removed successfully'
        });

    } catch (error) {
        console.error('Remove API keys error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove API keys'
        });
    }
};

// Verify keys and auto-switch if invalid
const verifyAndSwitch = async (req, res) => {
    try {
        const userUuid = req.user.uuid;

        const result = await db.query(`
            SELECT google_api_key, openai_api_key, use_own_keys
            FROM user_credits
            WHERE user_uuid = $1
        `, [userUuid]);

        if (result.rows.length === 0 || !result.rows[0].use_own_keys) {
            return res.json({
                success: true,
                data: { usingOwnKeys: false, keysValid: false }
            });
        }

        const { google_api_key, openai_api_key } = result.rows[0];

        // Verify both keys
        const googleValid = google_api_key ? await validateGoogleApiKey(google_api_key) : true;
        const openaiValid = openai_api_key ? await validateOpenAiApiKey(openai_api_key) : true;
        const allValid = googleValid && openaiValid;

        // Update status
        await db.query(`
            UPDATE user_credits
            SET
                keys_valid = $2,
                use_own_keys = CASE WHEN $2 = false THEN false ELSE use_own_keys END,
                keys_last_checked = NOW(),
                updated_at = NOW()
            WHERE user_uuid = $1
        `, [userUuid, allValid]);

        res.json({
            success: true,
            data: {
                usingOwnKeys: allValid,
                keysValid: allValid,
                googleValid,
                openaiValid,
                switchedToCredits: !allValid
            },
            message: !allValid
                ? 'Your API keys are invalid. Switched to credit-based system.'
                : 'API keys are valid'
        });

    } catch (error) {
        console.error('Verify and switch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify API keys'
        });
    }
};

// Get user's API key for use (internal function)
const getUserApiKey = async (userUuid, keyType) => {
    try {
        const result = await db.query(`
            SELECT google_api_key, openai_api_key, use_own_keys, keys_valid
            FROM user_credits
            WHERE user_uuid = $1
        `, [userUuid]);

        if (result.rows.length === 0 || !result.rows[0].use_own_keys || !result.rows[0].keys_valid) {
            // Return system API key
            if (keyType === 'google') {
                return { key: config.GOOGLE_PLACES_API_KEY, isUserKey: false };
            } else if (keyType === 'openai') {
                return { key: config.OPENAI_API_KEY, isUserKey: false };
            }
        }

        const userKey = keyType === 'google'
            ? result.rows[0].google_api_key
            : result.rows[0].openai_api_key;

        if (userKey) {
            return { key: userKey, isUserKey: true };
        }

        // Fallback to system key
        if (keyType === 'google') {
            return { key: config.GOOGLE_PLACES_API_KEY, isUserKey: false };
        } else {
            return { key: config.OPENAI_API_KEY, isUserKey: false };
        }

    } catch (error) {
        console.error('Get user API key error:', error);
        // Fallback to system key on error
        if (keyType === 'google') {
            return { key: config.GOOGLE_PLACES_API_KEY, isUserKey: false };
        } else {
            return { key: config.OPENAI_API_KEY, isUserKey: false };
        }
    }
};

// Mark user's keys as invalid (called when API call fails)
const markKeysInvalid = async (userUuid) => {
    try {
        await db.query(`
            UPDATE user_credits
            SET keys_valid = false, use_own_keys = false, updated_at = NOW()
            WHERE user_uuid = $1
        `, [userUuid]);
    } catch (error) {
        console.error('Mark keys invalid error:', error);
    }
};

// Toggle BYOK mode
const toggleByok = async (req, res) => {
    try {
        const userUuid = req.user.uuid;
        const { enable } = req.body;

        // Check if user has keys before enabling
        if (enable) {
            const keyCheck = await db.query(`
                SELECT google_api_key, openai_api_key
                FROM user_credits
                WHERE user_uuid = $1
            `, [userUuid]);

            if (keyCheck.rows.length === 0 ||
                (!keyCheck.rows[0].google_api_key && !keyCheck.rows[0].openai_api_key)) {
                return res.status(400).json({
                    success: false,
                    message: 'Please add at least one API key before enabling BYOK mode'
                });
            }

            // Verify keys are valid
            const { google_api_key, openai_api_key } = keyCheck.rows[0];
            let keysValid = true;

            if (google_api_key) {
                keysValid = keysValid && await validateGoogleApiKey(google_api_key);
            }
            if (openai_api_key) {
                keysValid = keysValid && await validateOpenAiApiKey(openai_api_key);
            }

            if (!keysValid) {
                return res.status(400).json({
                    success: false,
                    message: 'Your API keys are invalid. Please update them.'
                });
            }
        }

        const result = await db.query(`
            UPDATE user_credits
            SET use_own_keys = $2, keys_valid = $2, updated_at = NOW()
            WHERE user_uuid = $1
            RETURNING use_own_keys, keys_valid
        `, [userUuid, enable]);

        res.json({
            success: true,
            message: enable ? 'BYOK mode enabled - credit system disabled' : 'Switched to credit-based system',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Toggle BYOK error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle BYOK mode'
        });
    }
};

module.exports = {
    getApiKeysStatus,
    saveApiKeys,
    removeApiKeys,
    verifyAndSwitch,
    getUserApiKey,
    markKeysInvalid,
    toggleByok,
    validateGoogleApiKey,
    validateOpenAiApiKey
};
