const db = require('../config/dbconnection');

// =====================================================
// CAMPAIGN GROUPS
// =====================================================

// Get all campaign groups
const getCampaignGroups = async (req, res) => {
    try {
        const userUuid = req.user.uuid;

        const result = await db.query(`
            SELECT
                cg.*,
                COUNT(c.id) as campaigns_count,
                COALESCE(SUM(c.leads_count), 0) as total_leads
            FROM campaign_groups cg
            LEFT JOIN campaigns c ON cg.uuid = c.group_uuid AND c.is_active = true
            WHERE cg.user_uuid = $1 AND cg.is_active = true
            GROUP BY cg.id
            ORDER BY cg.sort_order ASC, cg.created_at DESC
        `, [userUuid]);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Get campaign groups error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch campaign groups'
        });
    }
};

// Create campaign group
const createCampaignGroup = async (req, res) => {
    try {
        const userUuid = req.user.uuid;
        const { name, description, color, icon } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Group name is required'
            });
        }

        const result = await db.query(`
            INSERT INTO campaign_groups (user_uuid, name, description, color, icon)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [userUuid, name, description, color || '#3B82F6', icon || 'folder']);

        res.status(201).json({
            success: true,
            message: 'Campaign group created successfully',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Create campaign group error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create campaign group'
        });
    }
};

// Update campaign group
const updateCampaignGroup = async (req, res) => {
    try {
        const userUuid = req.user.uuid;
        const { groupUuid } = req.params;
        const { name, description, color, icon, sort_order } = req.body;

        const result = await db.query(`
            UPDATE campaign_groups
            SET
                name = COALESCE($3, name),
                description = COALESCE($4, description),
                color = COALESCE($5, color),
                icon = COALESCE($6, icon),
                sort_order = COALESCE($7, sort_order),
                updated_at = NOW()
            WHERE uuid = $1 AND user_uuid = $2
            RETURNING *
        `, [groupUuid, userUuid, name, description, color, icon, sort_order]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Campaign group not found'
            });
        }

        res.json({
            success: true,
            message: 'Campaign group updated successfully',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Update campaign group error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update campaign group'
        });
    }
};

// Delete campaign group
const deleteCampaignGroup = async (req, res) => {
    try {
        const userUuid = req.user.uuid;
        const { groupUuid } = req.params;

        // Soft delete - set is_active to false
        const result = await db.query(`
            UPDATE campaign_groups
            SET is_active = false, updated_at = NOW()
            WHERE uuid = $1 AND user_uuid = $2
            RETURNING *
        `, [groupUuid, userUuid]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Campaign group not found'
            });
        }

        // Remove group association from campaigns
        await db.query(`
            UPDATE campaigns SET group_uuid = NULL WHERE group_uuid = $1
        `, [groupUuid]);

        res.json({
            success: true,
            message: 'Campaign group deleted successfully'
        });

    } catch (error) {
        console.error('Delete campaign group error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete campaign group'
        });
    }
};

// =====================================================
// CAMPAIGNS
// =====================================================

// Get all campaigns
const getCampaigns = async (req, res) => {
    try {
        const userUuid = req.user.uuid;
        const { groupUuid, status } = req.query;

        let query = `
            SELECT
                c.*,
                cg.name as group_name,
                cg.color as group_color
            FROM campaigns c
            LEFT JOIN campaign_groups cg ON c.group_uuid = cg.uuid
            WHERE c.user_uuid = $1 AND c.is_active = true
        `;
        const params = [userUuid];

        if (groupUuid) {
            params.push(groupUuid);
            query += ` AND c.group_uuid = $${params.length}`;
        }

        if (status) {
            params.push(status);
            query += ` AND c.status = $${params.length}`;
        }

        query += ` ORDER BY c.created_at DESC`;

        const result = await db.query(query, params);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Get campaigns error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch campaigns'
        });
    }
};

// Get single campaign with leads
const getCampaign = async (req, res) => {
    try {
        const userUuid = req.user.uuid;
        const { campaignUuid } = req.params;

        const campaignResult = await db.query(`
            SELECT
                c.*,
                cg.name as group_name,
                cg.color as group_color
            FROM campaigns c
            LEFT JOIN campaign_groups cg ON c.group_uuid = cg.uuid
            WHERE c.uuid = $1 AND c.user_uuid = $2
        `, [campaignUuid, userUuid]);

        if (campaignResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Campaign not found'
            });
        }

        res.json({
            success: true,
            data: campaignResult.rows[0]
        });

    } catch (error) {
        console.error('Get campaign error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch campaign'
        });
    }
};

// Create campaign
const createCampaign = async (req, res) => {
    try {
        const userUuid = req.user.uuid;
        const { name, description, groupUuid, color, tags } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Campaign name is required'
            });
        }

        const result = await db.query(`
            INSERT INTO campaigns (user_uuid, group_uuid, name, description, color, tags)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [userUuid, groupUuid || null, name, description, color || '#10B981', tags ? JSON.stringify(tags) : null]);

        res.status(201).json({
            success: true,
            message: 'Campaign created successfully',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Create campaign error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create campaign'
        });
    }
};

// Update campaign
const updateCampaign = async (req, res) => {
    try {
        const userUuid = req.user.uuid;
        const { campaignUuid } = req.params;
        const { name, description, groupUuid, status, color, tags } = req.body;

        const result = await db.query(`
            UPDATE campaigns
            SET
                name = COALESCE($3, name),
                description = COALESCE($4, description),
                group_uuid = COALESCE($5, group_uuid),
                status = COALESCE($6, status),
                color = COALESCE($7, color),
                tags = COALESCE($8, tags),
                updated_at = NOW()
            WHERE uuid = $1 AND user_uuid = $2
            RETURNING *
        `, [campaignUuid, userUuid, name, description, groupUuid, status, color, tags ? JSON.stringify(tags) : null]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Campaign not found'
            });
        }

        res.json({
            success: true,
            message: 'Campaign updated successfully',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Update campaign error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update campaign'
        });
    }
};

// Delete campaign
const deleteCampaign = async (req, res) => {
    try {
        const userUuid = req.user.uuid;
        const { campaignUuid } = req.params;

        const result = await db.query(`
            UPDATE campaigns
            SET is_active = false, updated_at = NOW()
            WHERE uuid = $1 AND user_uuid = $2
            RETURNING *
        `, [campaignUuid, userUuid]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Campaign not found'
            });
        }

        res.json({
            success: true,
            message: 'Campaign deleted successfully'
        });

    } catch (error) {
        console.error('Delete campaign error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete campaign'
        });
    }
};

// =====================================================
// SAVED LEADS
// =====================================================

// Get leads for a campaign
const getCampaignLeads = async (req, res) => {
    try {
        const userUuid = req.user.uuid;
        const { campaignUuid } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const { status, search, favorite } = req.query;

        let query = `
            SELECT * FROM saved_leads
            WHERE user_uuid = $1 AND campaign_uuid = $2
        `;
        const params = [userUuid, campaignUuid];

        if (status) {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }

        if (favorite === 'true') {
            query += ` AND is_favorite = true`;
        }

        if (search) {
            params.push(`%${search}%`);
            query += ` AND (business_name ILIKE $${params.length} OR address ILIKE $${params.length} OR email ILIKE $${params.length})`;
        }

        query += ` ORDER BY is_favorite DESC, created_at DESC`;
        query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await db.query(query, params);

        // Get total count
        let countQuery = `SELECT COUNT(*) FROM saved_leads WHERE user_uuid = $1 AND campaign_uuid = $2`;
        const countParams = [userUuid, campaignUuid];
        if (status) {
            countParams.push(status);
            countQuery += ` AND status = $${countParams.length}`;
        }
        const countResult = await db.query(countQuery, countParams);

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
        console.error('Get campaign leads error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch leads'
        });
    }
};

// Get all saved leads (across all campaigns)
const getAllSavedLeads = async (req, res) => {
    try {
        const userUuid = req.user.uuid;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const { status, search, campaignUuid } = req.query;

        let query = `
            SELECT
                sl.*,
                c.name as campaign_name,
                c.color as campaign_color
            FROM saved_leads sl
            LEFT JOIN campaigns c ON sl.campaign_uuid = c.uuid
            WHERE sl.user_uuid = $1
        `;
        const params = [userUuid];

        if (campaignUuid) {
            params.push(campaignUuid);
            query += ` AND sl.campaign_uuid = $${params.length}`;
        }

        if (status) {
            params.push(status);
            query += ` AND sl.status = $${params.length}`;
        }

        if (search) {
            params.push(`%${search}%`);
            query += ` AND (sl.business_name ILIKE $${params.length} OR sl.address ILIKE $${params.length})`;
        }

        query += ` ORDER BY sl.is_favorite DESC, sl.created_at DESC`;
        query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await db.query(query, params);

        // Get total
        const countResult = await db.query(
            'SELECT COUNT(*) FROM saved_leads WHERE user_uuid = $1',
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
        console.error('Get all saved leads error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch leads'
        });
    }
};

// Save lead to campaign
const saveLead = async (req, res) => {
    try {
        const userUuid = req.user.uuid;
        const {
            campaignUuid,
            searchUuid,
            placeId,
            businessName,
            address,
            phone,
            website,
            email,
            rating,
            totalRatings,
            businessType,
            latitude,
            longitude,
            openingHours,
            photos,
            notes,
            tags
        } = req.body;

        if (!businessName) {
            return res.status(400).json({
                success: false,
                message: 'Business name is required'
            });
        }

        // Check if lead already exists in the campaign
        if (campaignUuid && placeId) {
            const existingLead = await db.query(`
                SELECT uuid FROM saved_leads
                WHERE user_uuid = $1 AND campaign_uuid = $2 AND place_id = $3
            `, [userUuid, campaignUuid, placeId]);

            if (existingLead.rows.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'Lead already exists in this campaign'
                });
            }
        }

        const result = await db.query(`
            INSERT INTO saved_leads (
                user_uuid, campaign_uuid, search_uuid, place_id, business_name,
                address, phone, website, email, rating, total_ratings,
                business_type, latitude, longitude, opening_hours, photos, notes, tags
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            RETURNING *
        `, [
            userUuid, campaignUuid || null, searchUuid || null, placeId, businessName,
            address, phone, website, email, rating, totalRatings,
            businessType, latitude, longitude,
            openingHours ? JSON.stringify(openingHours) : null,
            photos ? JSON.stringify(photos) : null,
            notes,
            tags ? JSON.stringify(tags) : null
        ]);

        res.status(201).json({
            success: true,
            message: 'Lead saved successfully',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Save lead error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save lead'
        });
    }
};

// Save multiple leads at once
const saveMultipleLeads = async (req, res) => {
    const client = await db.pool.connect();

    try {
        const userUuid = req.user.uuid;
        const { campaignUuid, leads } = req.body;

        if (!leads || !Array.isArray(leads) || leads.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Leads array is required'
            });
        }

        await client.query('BEGIN');

        const savedLeads = [];
        const skippedLeads = [];

        for (const lead of leads) {
            // Check for duplicates
            if (campaignUuid && lead.placeId) {
                const existing = await client.query(`
                    SELECT uuid FROM saved_leads
                    WHERE user_uuid = $1 AND campaign_uuid = $2 AND place_id = $3
                `, [userUuid, campaignUuid, lead.placeId]);

                if (existing.rows.length > 0) {
                    skippedLeads.push({ ...lead, reason: 'Already exists' });
                    continue;
                }
            }

            const result = await client.query(`
                INSERT INTO saved_leads (
                    user_uuid, campaign_uuid, place_id, business_name,
                    address, phone, website, email, rating, total_ratings,
                    business_type, latitude, longitude
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING *
            `, [
                userUuid, campaignUuid || null, lead.placeId, lead.businessName,
                lead.address, lead.phone, lead.website, lead.email,
                lead.rating, lead.totalRatings, lead.businessType,
                lead.latitude, lead.longitude
            ]);

            savedLeads.push(result.rows[0]);
        }

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            message: `${savedLeads.length} leads saved, ${skippedLeads.length} skipped`,
            data: {
                saved: savedLeads,
                skipped: skippedLeads
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Save multiple leads error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save leads'
        });
    } finally {
        client.release();
    }
};

// Update lead
const updateLead = async (req, res) => {
    try {
        const userUuid = req.user.uuid;
        const { leadUuid } = req.params;
        const {
            campaignUuid, status, notes, tags, email, phone,
            customFields, isFavorite
        } = req.body;

        const result = await db.query(`
            UPDATE saved_leads
            SET
                campaign_uuid = COALESCE($3, campaign_uuid),
                status = COALESCE($4, status),
                notes = COALESCE($5, notes),
                tags = COALESCE($6, tags),
                email = COALESCE($7, email),
                phone = COALESCE($8, phone),
                custom_fields = COALESCE($9, custom_fields),
                is_favorite = COALESCE($10, is_favorite),
                updated_at = NOW()
            WHERE uuid = $1 AND user_uuid = $2
            RETURNING *
        `, [
            leadUuid, userUuid, campaignUuid, status, notes,
            tags ? JSON.stringify(tags) : null, email, phone,
            customFields ? JSON.stringify(customFields) : null, isFavorite
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Lead not found'
            });
        }

        res.json({
            success: true,
            message: 'Lead updated successfully',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Update lead error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update lead'
        });
    }
};

// Delete lead
const deleteLead = async (req, res) => {
    try {
        const userUuid = req.user.uuid;
        const { leadUuid } = req.params;

        const result = await db.query(`
            DELETE FROM saved_leads
            WHERE uuid = $1 AND user_uuid = $2
            RETURNING *
        `, [leadUuid, userUuid]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Lead not found'
            });
        }

        res.json({
            success: true,
            message: 'Lead deleted successfully'
        });

    } catch (error) {
        console.error('Delete lead error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete lead'
        });
    }
};

// Move leads between campaigns
const moveLeads = async (req, res) => {
    try {
        const userUuid = req.user.uuid;
        const { leadUuids, targetCampaignUuid } = req.body;

        if (!leadUuids || !Array.isArray(leadUuids) || leadUuids.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Lead UUIDs array is required'
            });
        }

        const result = await db.query(`
            UPDATE saved_leads
            SET campaign_uuid = $3, updated_at = NOW()
            WHERE uuid = ANY($1) AND user_uuid = $2
            RETURNING *
        `, [leadUuids, userUuid, targetCampaignUuid || null]);

        res.json({
            success: true,
            message: `${result.rows.length} leads moved successfully`,
            data: result.rows
        });

    } catch (error) {
        console.error('Move leads error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to move leads'
        });
    }
};

// Toggle favorite
const toggleFavorite = async (req, res) => {
    try {
        const userUuid = req.user.uuid;
        const { leadUuid } = req.params;

        const result = await db.query(`
            UPDATE saved_leads
            SET is_favorite = NOT is_favorite, updated_at = NOW()
            WHERE uuid = $1 AND user_uuid = $2
            RETURNING *
        `, [leadUuid, userUuid]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Lead not found'
            });
        }

        res.json({
            success: true,
            message: result.rows[0].is_favorite ? 'Added to favorites' : 'Removed from favorites',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Toggle favorite error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle favorite'
        });
    }
};

module.exports = {
    // Campaign Groups
    getCampaignGroups,
    createCampaignGroup,
    updateCampaignGroup,
    deleteCampaignGroup,
    // Campaigns
    getCampaigns,
    getCampaign,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    // Leads
    getCampaignLeads,
    getAllSavedLeads,
    saveLead,
    saveMultipleLeads,
    updateLead,
    deleteLead,
    moveLeads,
    toggleFavorite
};
