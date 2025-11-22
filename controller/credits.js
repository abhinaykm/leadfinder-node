const db = require('../config/dbconnection');

// Get credit costs from database
const getCreditCosts = async () => {
    const result = await db.query('SELECT action_type, credits_required FROM credit_costs WHERE is_active = true');
    const costs = {};
    result.rows.forEach(row => {
        costs[row.action_type] = row.credits_required;
    });
    return costs;
};

// Get user's credit balance and info
const getUserCredits = async (req, res) => {
    try {
        const userUuid = req.user.uuid;

        const query = `
            SELECT
                uc.*,
                u.name,
                u.email,
                (SELECT COUNT(*) FROM credit_transactions WHERE user_uuid = $1) as total_transactions
            FROM user_credits uc
            JOIN users u ON uc.user_uuid = u.uuid
            WHERE uc.user_uuid = $1
        `;

        const result = await db.query(query, [userUuid]);

        if (result.rows.length === 0) {
            // Initialize credits for user if not exists
            const initQuery = `
                INSERT INTO user_credits (user_uuid, credits_balance, is_trial, trial_credits_given)
                VALUES ($1, 1000, true, true)
                RETURNING *
            `;
            const initResult = await db.query(initQuery, [userUuid]);

            // Add transaction record
            await db.query(`
                INSERT INTO credit_transactions (user_uuid, transaction_type, amount, balance_after, action_type, description)
                VALUES ($1, 'credit', 1000, 1000, 'trial', 'Welcome bonus - 1000 trial credits')
            `, [userUuid]);

            return res.json({
                success: true,
                data: {
                    ...initResult.rows[0],
                    total_transactions: 1
                }
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Get user credits error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch credit information'
        });
    }
};

// Get credit transaction history
const getCreditHistory = async (req, res) => {
    try {
        const userUuid = req.user.uuid;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const actionType = req.query.action_type;

        let query = `
            SELECT * FROM credit_transactions
            WHERE user_uuid = $1
        `;
        const params = [userUuid];

        if (actionType) {
            query += ` AND action_type = $2`;
            params.push(actionType);
        }

        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await db.query(query, params);

        // Get total count
        let countQuery = `SELECT COUNT(*) FROM credit_transactions WHERE user_uuid = $1`;
        const countParams = [userUuid];
        if (actionType) {
            countQuery += ` AND action_type = $2`;
            countParams.push(actionType);
        }
        const countResult = await db.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Get credit history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch credit history'
        });
    }
};

// Deduct credits for an action
const deductCredits = async (userUuid, actionType, referenceUuid = null, metadata = null) => {
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // Get credit cost for action
        const costResult = await client.query(
            'SELECT credits_required FROM credit_costs WHERE action_type = $1 AND is_active = true',
            [actionType]
        );

        if (costResult.rows.length === 0) {
            throw new Error(`Unknown action type: ${actionType}`);
        }

        const creditsRequired = costResult.rows[0].credits_required;

        // Check user's current balance and BYOK status
        const balanceResult = await client.query(
            'SELECT credits_balance, use_own_keys, keys_valid FROM user_credits WHERE user_uuid = $1 FOR UPDATE',
            [userUuid]
        );

        if (balanceResult.rows.length === 0) {
            throw new Error('User credits not found');
        }

        const userCredits = balanceResult.rows[0];

        // If user is using their own valid keys, no credit deduction needed
        if (userCredits.use_own_keys && userCredits.keys_valid) {
            await client.query('COMMIT');
            return {
                success: true,
                creditsDeducted: 0,
                newBalance: userCredits.credits_balance,
                usingOwnKeys: true
            };
        }

        // Check if user has enough credits
        if (userCredits.credits_balance < creditsRequired) {
            await client.query('ROLLBACK');
            return {
                success: false,
                error: 'Insufficient credits',
                creditsRequired,
                currentBalance: userCredits.credits_balance
            };
        }

        // Deduct credits
        const newBalance = userCredits.credits_balance - creditsRequired;
        await client.query(
            'UPDATE user_credits SET credits_balance = $1, credits_used = credits_used + $2, updated_at = NOW() WHERE user_uuid = $3',
            [newBalance, creditsRequired, userUuid]
        );

        // Record transaction
        await client.query(`
            INSERT INTO credit_transactions
            (user_uuid, transaction_type, amount, balance_after, action_type, reference_uuid, metadata)
            VALUES ($1, 'debit', $2, $3, $4, $5, $6)
        `, [userUuid, creditsRequired, newBalance, actionType, referenceUuid, metadata ? JSON.stringify(metadata) : null]);

        await client.query('COMMIT');

        return {
            success: true,
            creditsDeducted: creditsRequired,
            newBalance,
            usingOwnKeys: false
        };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// Add credits (for purchases, refunds, etc.)
const addCredits = async (userUuid, amount, actionType, description, metadata = null) => {
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // Get current balance
        const balanceResult = await client.query(
            'SELECT credits_balance FROM user_credits WHERE user_uuid = $1 FOR UPDATE',
            [userUuid]
        );

        if (balanceResult.rows.length === 0) {
            throw new Error('User credits not found');
        }

        const newBalance = balanceResult.rows[0].credits_balance + amount;

        // Update balance
        await client.query(
            'UPDATE user_credits SET credits_balance = $1, is_trial = false, updated_at = NOW() WHERE user_uuid = $2',
            [newBalance, userUuid]
        );

        // Record transaction
        await client.query(`
            INSERT INTO credit_transactions
            (user_uuid, transaction_type, amount, balance_after, action_type, description, metadata)
            VALUES ($1, 'credit', $2, $3, $4, $5, $6)
        `, [userUuid, amount, newBalance, actionType, description, metadata ? JSON.stringify(metadata) : null]);

        await client.query('COMMIT');

        return {
            success: true,
            creditsAdded: amount,
            newBalance
        };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// Check if user can perform action (middleware helper)
const canPerformAction = async (userUuid, actionType) => {
    // Check BYOK status first
    const byokResult = await db.query(
        'SELECT use_own_keys, keys_valid, credits_balance FROM user_credits WHERE user_uuid = $1',
        [userUuid]
    );

    if (byokResult.rows.length === 0) {
        return { canPerform: false, reason: 'User credits not initialized' };
    }

    const userCredits = byokResult.rows[0];

    // If using own valid keys, always allow
    if (userCredits.use_own_keys && userCredits.keys_valid) {
        return { canPerform: true, usingOwnKeys: true };
    }

    // Check credit cost
    const costResult = await db.query(
        'SELECT credits_required FROM credit_costs WHERE action_type = $1 AND is_active = true',
        [actionType]
    );

    if (costResult.rows.length === 0) {
        return { canPerform: false, reason: 'Unknown action type' };
    }

    const creditsRequired = costResult.rows[0].credits_required;

    if (userCredits.credits_balance < creditsRequired) {
        return {
            canPerform: false,
            reason: 'Insufficient credits',
            creditsRequired,
            currentBalance: userCredits.credits_balance
        };
    }

    return { canPerform: true, creditsRequired, currentBalance: userCredits.credits_balance };
};

// Middleware to check credits before action
const checkCredits = (actionType) => {
    return async (req, res, next) => {
        try {
            const result = await canPerformAction(req.user.uuid, actionType);

            if (!result.canPerform) {
                return res.status(403).json({
                    success: false,
                    message: result.reason,
                    creditsRequired: result.creditsRequired,
                    currentBalance: result.currentBalance
                });
            }

            req.creditCheck = result;
            next();

        } catch (error) {
            console.error('Credit check error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to verify credits'
            });
        }
    };
};

// Get credit costs
const getCreditCostsAPI = async (req, res) => {
    try {
        const result = await db.query(
            'SELECT action_type, credits_required, description FROM credit_costs WHERE is_active = true ORDER BY credits_required'
        );

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Get credit costs error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch credit costs'
        });
    }
};

// Get usage statistics
const getUsageStats = async (req, res) => {
    try {
        const userUuid = req.user.uuid;
        const days = parseInt(req.query.days) || 30;

        // Get usage by action type
        const usageByType = await db.query(`
            SELECT
                action_type,
                COUNT(*) as count,
                SUM(amount) as total_credits
            FROM credit_transactions
            WHERE user_uuid = $1
            AND transaction_type = 'debit'
            AND created_at >= NOW() - INTERVAL '${days} days'
            GROUP BY action_type
            ORDER BY total_credits DESC
        `, [userUuid]);

        // Get daily usage
        const dailyUsage = await db.query(`
            SELECT
                DATE(created_at) as date,
                SUM(CASE WHEN transaction_type = 'debit' THEN amount ELSE 0 END) as debits,
                SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE 0 END) as credits
            FROM credit_transactions
            WHERE user_uuid = $1
            AND created_at >= NOW() - INTERVAL '${days} days'
            GROUP BY DATE(created_at)
            ORDER BY date
        `, [userUuid]);

        res.json({
            success: true,
            data: {
                byActionType: usageByType.rows,
                dailyUsage: dailyUsage.rows,
                period: `${days} days`
            }
        });

    } catch (error) {
        console.error('Get usage stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch usage statistics'
        });
    }
};

module.exports = {
    getUserCredits,
    getCreditHistory,
    deductCredits,
    addCredits,
    canPerformAction,
    checkCredits,
    getCreditCostsAPI,
    getUsageStats,
    getCreditCosts
};
