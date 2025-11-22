const express = require('express');
const router = express.Router();

// Controllers
const { login, socialLogin } = require('../controller/login');
const { saveSearchHistory, getSearchHistory } = require('../controller/search');
const { geocodeLocation, searchNearbyPlaces, getPlaceDetails } = require('../controller/google-proxy');
const { analyzeSeo, getSeoReport, getAllReports } = require('../controller/seo-analysis');
const { captureScreenshot } = require('../controller/screenshot');
const verifyToken = require('../controller/verify-token');

// New Controllers
const {
    getUserCredits,
    getCreditHistory,
    getCreditCostsAPI,
    getUsageStats,
    checkCredits
} = require('../controller/credits');

const {
    getPlans,
    getPlanBySlug,
    getUserSubscription,
    subscribeToPlan,
    cancelSubscription,
    getPaymentHistory,
    buyCredits
} = require('../controller/plans');

const {
    getApiKeysStatus,
    saveApiKeys,
    removeApiKeys,
    verifyAndSwitch,
    toggleByok
} = require('../controller/byok');

const {
    getCampaignGroups,
    createCampaignGroup,
    updateCampaignGroup,
    deleteCampaignGroup,
    getCampaigns,
    getCampaign,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    getCampaignLeads,
    getAllSavedLeads,
    saveLead,
    saveMultipleLeads,
    updateLead,
    deleteLead,
    moveLeads,
    toggleFavorite
} = require('../controller/campaigns');

const {
    generateProposal,
    generateEmail,
    generateCustomContent,
    getDocuments,
    getDocument,
    updateDocument,
    deleteDocument,
    getTemplates,
    createTemplate
} = require('../controller/ai-tools');

// =====================================================
// PUBLIC ROUTES (No authentication required)
// =====================================================

// Authentication routes
router.route("/login").post(login);
router.route("/social-login").post(socialLogin);

// Plans (public)
router.route("/plans").get(getPlans);
router.route("/plans/:slug").get(getPlanBySlug);

// Credit costs (public)
router.route("/credit-costs").get(getCreditCostsAPI);

// =====================================================
// PROTECTED ROUTES (Authentication required)
// =====================================================

// ----- Credits & Billing -----
router.route("/credits").get(verifyToken, getUserCredits);
router.route("/credits/history").get(verifyToken, getCreditHistory);
router.route("/credits/usage-stats").get(verifyToken, getUsageStats);
router.route("/credits/buy").post(verifyToken, buyCredits);

// ----- Subscription -----
router.route("/subscription").get(verifyToken, getUserSubscription);
router.route("/subscription/subscribe").post(verifyToken, subscribeToPlan);
router.route("/subscription/cancel").post(verifyToken, cancelSubscription);
router.route("/payments/history").get(verifyToken, getPaymentHistory);

// ----- BYOK (Bring Your Own Keys) -----
router.route("/api-keys/status").get(verifyToken, getApiKeysStatus);
router.route("/api-keys").post(verifyToken, saveApiKeys);
router.route("/api-keys/remove").post(verifyToken, removeApiKeys);
router.route("/api-keys/verify").post(verifyToken, verifyAndSwitch);
router.route("/api-keys/toggle-byok").post(verifyToken, toggleByok);

// ----- Campaign Groups -----
router.route("/campaign-groups")
    .get(verifyToken, getCampaignGroups)
    .post(verifyToken, createCampaignGroup);

router.route("/campaign-groups/:groupUuid")
    .put(verifyToken, updateCampaignGroup)
    .delete(verifyToken, deleteCampaignGroup);

// ----- Campaigns -----
router.route("/campaigns")
    .get(verifyToken, getCampaigns)
    .post(verifyToken, createCampaign);

router.route("/campaigns/:campaignUuid")
    .get(verifyToken, getCampaign)
    .put(verifyToken, updateCampaign)
    .delete(verifyToken, deleteCampaign);

router.route("/campaigns/:campaignUuid/leads")
    .get(verifyToken, getCampaignLeads);

// ----- Leads -----
router.route("/leads")
    .get(verifyToken, getAllSavedLeads)
    .post(verifyToken, saveLead);

router.route("/leads/bulk")
    .post(verifyToken, saveMultipleLeads);

router.route("/leads/move")
    .post(verifyToken, moveLeads);

router.route("/leads/:leadUuid")
    .put(verifyToken, updateLead)
    .delete(verifyToken, deleteLead);

router.route("/leads/:leadUuid/favorite")
    .post(verifyToken, toggleFavorite);

// ----- AI Writing Tools -----
router.route("/ai/proposal").post(verifyToken, generateProposal);
router.route("/ai/email").post(verifyToken, generateEmail);
router.route("/ai/custom").post(verifyToken, generateCustomContent);

router.route("/ai/documents")
    .get(verifyToken, getDocuments);

router.route("/ai/documents/:documentUuid")
    .get(verifyToken, getDocument)
    .put(verifyToken, updateDocument)
    .delete(verifyToken, deleteDocument);

router.route("/ai/templates")
    .get(verifyToken, getTemplates)
    .post(verifyToken, createTemplate);

// ----- Search History (existing, now with auth) -----
router.route("/save-search-history").post(verifyToken, saveSearchHistory);
router.route("/search-history").get(verifyToken, getSearchHistory);

// ----- Google API Proxy (with credit check) -----
// Geocode is public (no credits needed), nearby search requires auth + credits
router.route("/google/geocode").get(geocodeLocation);
router.route("/google/places/nearby").get(verifyToken, checkCredits('google_search'), searchNearbyPlaces);
router.route("/google/places/details").get(verifyToken, getPlaceDetails);

// ----- SEO Analysis (with credit check) -----
router.route("/seo/analyze").post(verifyToken, checkCredits('seo_analysis'), analyzeSeo);
router.route("/seo/report/:reportId").get(verifyToken, getSeoReport);
router.route("/seo/reports").get(verifyToken, getAllReports);

// ----- Screenshot -----
router.route("/screenshot").get(verifyToken, captureScreenshot);

// ----- User Profile -----
router.route("/profile").get(verifyToken, async (req, res) => {
    const db = require('../config/dbconnection');
    try {
        const result = await db.query(`
            SELECT
                u.uuid, u.name, u.email, u.avatar_url, u.provider,
                u.is_verified, u.created_at,
                uc.credits_balance, uc.credits_used, uc.is_trial,
                uc.use_own_keys, uc.keys_valid
            FROM users u
            LEFT JOIN user_credits uc ON u.uuid = uc.user_uuid
            WHERE u.uuid = $1
        `, [req.user.uuid]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch profile'
        });
    }
});

// ----- Dashboard Stats -----
router.route("/dashboard/stats").get(verifyToken, async (req, res) => {
    const db = require('../config/dbconnection');
    try {
        const userUuid = req.user.uuid;

        // Get various counts
        const [credits, campaigns, leads, documents, searches] = await Promise.all([
            db.query('SELECT credits_balance, credits_used FROM user_credits WHERE user_uuid = $1', [userUuid]),
            db.query('SELECT COUNT(*) FROM campaigns WHERE user_uuid = $1 AND is_active = true', [userUuid]),
            db.query('SELECT COUNT(*) FROM saved_leads WHERE user_uuid = $1', [userUuid]),
            db.query('SELECT COUNT(*) FROM ai_documents WHERE user_uuid = $1', [userUuid]),
            db.query('SELECT COUNT(*) FROM searches WHERE user_uuid = $1', [userUuid])
        ]);

        // Recent activity
        const recentActivity = await db.query(`
            SELECT
                'search' as type, query as title, created_at
            FROM searches WHERE user_uuid = $1
            UNION ALL
            SELECT
                'lead' as type, business_name as title, created_at
            FROM saved_leads WHERE user_uuid = $1
            UNION ALL
            SELECT
                document_type as type, title, created_at
            FROM ai_documents WHERE user_uuid = $1
            ORDER BY created_at DESC
            LIMIT 10
        `, [userUuid]);

        res.json({
            success: true,
            data: {
                credits: credits.rows[0] || { credits_balance: 0, credits_used: 0 },
                counts: {
                    campaigns: parseInt(campaigns.rows[0].count),
                    leads: parseInt(leads.rows[0].count),
                    documents: parseInt(documents.rows[0].count),
                    searches: parseInt(searches.rows[0].count)
                },
                recentActivity: recentActivity.rows
            }
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard stats'
        });
    }
});

module.exports = router;
