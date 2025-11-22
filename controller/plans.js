const db = require('../config/dbconnection');
const { addCredits } = require('./credits');

// Get all available plans
const getPlans = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT
                uuid, name, slug, description, credits, price, currency,
                billing_period, features, sort_order
            FROM plans
            WHERE is_active = true
            ORDER BY sort_order ASC
        `);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Get plans error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch plans'
        });
    }
};

// Get single plan by slug
const getPlanBySlug = async (req, res) => {
    try {
        const { slug } = req.params;

        const result = await db.query(`
            SELECT * FROM plans WHERE slug = $1 AND is_active = true
        `, [slug]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Plan not found'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Get plan error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch plan'
        });
    }
};

// Get user's current subscription
const getUserSubscription = async (req, res) => {
    try {
        const userUuid = req.user.uuid;

        const result = await db.query(`
            SELECT
                s.*,
                p.name as plan_name,
                p.slug as plan_slug,
                p.credits as plan_credits,
                p.price as plan_price,
                p.features as plan_features
            FROM subscriptions s
            JOIN plans p ON s.plan_uuid = p.uuid
            WHERE s.user_uuid = $1 AND s.status = 'active'
            ORDER BY s.created_at DESC
            LIMIT 1
        `, [userUuid]);

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                data: null,
                message: 'No active subscription'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Get subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch subscription'
        });
    }
};

// Subscribe to a plan (simplified - integrate with payment gateway)
const subscribeToPlan = async (req, res) => {
    const client = await db.pool.connect();

    try {
        const userUuid = req.user.uuid;
        const { planSlug, paymentDetails } = req.body;

        await client.query('BEGIN');

        // Get plan details
        const planResult = await client.query(
            'SELECT * FROM plans WHERE slug = $1 AND is_active = true',
            [planSlug]
        );

        if (planResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: 'Plan not found'
            });
        }

        const plan = planResult.rows[0];

        // Check for existing active subscription
        const existingResult = await client.query(
            'SELECT * FROM subscriptions WHERE user_uuid = $1 AND status = $2',
            [userUuid, 'active']
        );

        if (existingResult.rows.length > 0) {
            // Cancel existing subscription
            await client.query(
                'UPDATE subscriptions SET status = $1, cancelled_at = NOW(), updated_at = NOW() WHERE user_uuid = $2 AND status = $3',
                ['cancelled', userUuid, 'active']
            );
        }

        // Calculate period
        const now = new Date();
        const periodEnd = new Date();
        if (plan.billing_period === 'yearly') {
            periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        } else {
            periodEnd.setMonth(periodEnd.getMonth() + 1);
        }

        // Create subscription
        const subscriptionResult = await client.query(`
            INSERT INTO subscriptions
            (user_uuid, plan_uuid, status, current_period_start, current_period_end, metadata)
            VALUES ($1, $2, 'active', $3, $4, $5)
            RETURNING *
        `, [userUuid, plan.uuid, now, periodEnd, JSON.stringify(paymentDetails || {})]);

        // Record payment (simplified - integrate with actual payment)
        await client.query(`
            INSERT INTO payments
            (user_uuid, subscription_uuid, amount, currency, status, payment_method, metadata)
            VALUES ($1, $2, $3, $4, 'completed', $5, $6)
        `, [
            userUuid,
            subscriptionResult.rows[0].uuid,
            plan.price,
            plan.currency,
            paymentDetails?.method || 'card',
            JSON.stringify(paymentDetails || {})
        ]);

        // Add credits to user's balance
        await addCredits(
            userUuid,
            plan.credits,
            'subscription',
            `${plan.name} plan subscription - ${plan.credits} credits`
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            message: `Successfully subscribed to ${plan.name} plan`,
            data: {
                subscription: subscriptionResult.rows[0],
                creditsAdded: plan.credits
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Subscribe to plan error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process subscription'
        });
    } finally {
        client.release();
    }
};

// Cancel subscription
const cancelSubscription = async (req, res) => {
    try {
        const userUuid = req.user.uuid;
        const { cancelAtPeriodEnd } = req.body;

        const result = await db.query(`
            UPDATE subscriptions
            SET
                status = CASE WHEN $2 = true THEN status ELSE 'cancelled' END,
                cancel_at_period_end = $2,
                cancelled_at = CASE WHEN $2 = true THEN NULL ELSE NOW() END,
                updated_at = NOW()
            WHERE user_uuid = $1 AND status = 'active'
            RETURNING *
        `, [userUuid, cancelAtPeriodEnd || false]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No active subscription found'
            });
        }

        res.json({
            success: true,
            message: cancelAtPeriodEnd
                ? 'Subscription will be cancelled at the end of the billing period'
                : 'Subscription cancelled successfully',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel subscription'
        });
    }
};

// Get payment history
const getPaymentHistory = async (req, res) => {
    try {
        const userUuid = req.user.uuid;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const result = await db.query(`
            SELECT
                p.*,
                pl.name as plan_name
            FROM payments p
            LEFT JOIN subscriptions s ON p.subscription_uuid = s.uuid
            LEFT JOIN plans pl ON s.plan_uuid = pl.uuid
            WHERE p.user_uuid = $1
            ORDER BY p.created_at DESC
            LIMIT $2 OFFSET $3
        `, [userUuid, limit, offset]);

        const countResult = await db.query(
            'SELECT COUNT(*) FROM payments WHERE user_uuid = $1',
            [userUuid]
        );

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                page,
                limit,
                total: parseInt(countResult.rows[0].count),
                totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
            }
        });

    } catch (error) {
        console.error('Get payment history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment history'
        });
    }
};

// Buy credits (one-time purchase)
const buyCredits = async (req, res) => {
    try {
        const userUuid = req.user.uuid;
        const { credits, paymentDetails } = req.body;

        if (!credits || credits < 100) {
            return res.status(400).json({
                success: false,
                message: 'Minimum purchase is 100 credits'
            });
        }

        // Calculate price ($1 per 100 credits as example)
        const price = (credits / 100) * 1;

        // Record payment
        await db.query(`
            INSERT INTO payments
            (user_uuid, amount, currency, status, payment_method, metadata)
            VALUES ($1, $2, 'USD', 'completed', $3, $4)
        `, [userUuid, price, paymentDetails?.method || 'card', JSON.stringify({ credits, ...paymentDetails })]);

        // Add credits
        const result = await addCredits(
            userUuid,
            credits,
            'purchase',
            `Purchased ${credits} credits`
        );

        res.json({
            success: true,
            message: `Successfully purchased ${credits} credits`,
            data: result
        });

    } catch (error) {
        console.error('Buy credits error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process credit purchase'
        });
    }
};

module.exports = {
    getPlans,
    getPlanBySlug,
    getUserSubscription,
    subscribeToPlan,
    cancelSubscription,
    getPaymentHistory,
    buyCredits
};
