const db = require('../config/dbconnection');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

const saveSearchHistory = async (req, res) => {
    try {
        const { keyword, location, radius, results_count, searched_by, searched_at, leads } = req.body;

        if (!keyword || !location || !radius) {
            return res.status(400).json({
                success: false,
                message: 'Keyword, location, and radius are required'
            });
        }

        // Get user UUID from JWT token if available
        let userUuid = null;
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            try {
                const decoded = jwt.verify(token, config.JWT_SECRET);
                userUuid = decoded.uuid;
            } catch (tokenError) {
                console.warn('Invalid token provided:', tokenError.message);
                // Continue without user association
            }
        }

        // If no valid user, we can still save the search but without user association
        // or return an error - depending on your business logic
        if (!userUuid) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required to save search history'
            });
        }

        // Check if user exists and is active
        const userQuery = 'SELECT uuid FROM users WHERE uuid = $1 AND is_active = true';
        const userResult = await db.query(userQuery, [userUuid]);

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid user'
            });
        }

        // Insert search history
        const insertQuery = `
            INSERT INTO searches (user_uuid, query, latitude, longitude, address, radius, category, results, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING uuid, created_at
        `;

        // Store full search results including the actual business leads
        const searchResults = {
            keyword,
            location,
            results_count: results_count || 0,
            searched_by: searched_by || 'unknown',
            searched_at: searched_at || new Date(),
            leads: leads || [] // Store actual business leads data
        };

        const values = [
            userUuid,
            keyword,
            null, // latitude - can be added later with geocoding
            null, // longitude - can be added later with geocoding
            location,
            radius,
            'business_leads', // category
            JSON.stringify(searchResults),
            new Date()
        ];

        const result = await db.query(insertQuery, values);

        res.status(200).json({
            success: true,
            message: 'Search history saved successfully',
            data: {
                searchId: result.rows[0].uuid,
                savedAt: result.rows[0].created_at
            }
        });

    } catch (error) {
        console.error('Save search history error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getSearchHistory = async (req, res) => {
    try {
        // Get user UUID from JWT token
        let userUuid = null;
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            try {
                const decoded = jwt.verify(token, config.JWT_SECRET);
                userUuid = decoded.uuid;
            } catch (tokenError) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid token'
                });
            }
        } else {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        // Get total count
        const countQuery = 'SELECT COUNT(*) FROM searches WHERE user_uuid = $1';
        const countResult = await db.query(countQuery, [userUuid]);
        const totalRecords = parseInt(countResult.rows[0].count);

        // Get search history for user with pagination
        const historyQuery = `
            SELECT uuid, query, address, radius, category, results, created_at, latitude, longitude
            FROM searches
            WHERE user_uuid = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
        `;

        const historyResult = await db.query(historyQuery, [userUuid, limit, offset]);

        const searchHistory = historyResult.rows.map(row => ({
            id: row.uuid,
            keyword: row.query,
            location: row.address,
            radius: row.radius,
            category: row.category,
            results: row.results,
            latitude: row.latitude,
            longitude: row.longitude,
            created_at: row.created_at
        }));

        res.status(200).json({
            success: true,
            message: 'Search history retrieved successfully',
            data: {
                searches: searchHistory,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(totalRecords / limit),
                    totalRecords: totalRecords,
                    limit: limit
                }
            }
        });

    } catch (error) {
        console.error('Get search history error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = { saveSearchHistory, getSearchHistory };