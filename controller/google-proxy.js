const axios = require('axios');
const config = require('../config/config');
const { deductCredits } = require('./credits');
const { getUserApiKey, markKeysInvalid } = require('./byok');

const GOOGLE_PLACES_BASE_URL = 'https://maps.googleapis.com/maps/api/place';
const GEOCODING_BASE_URL = 'https://maps.googleapis.com/maps/api/geocode';

// Helper to get API key (user's own or system)
const getGoogleApiKey = async (userUuid) => {
    if (userUuid) {
        const keyInfo = await getUserApiKey(userUuid, 'google');
        return keyInfo;
    }
    return { key: config.GOOGLE_PLACES_API_KEY, isUserKey: false };
};

const geocodeLocation = async (req, res) => {
    try {
        const { address } = req.query;

        if (!address) {
            return res.status(400).json({
                success: false,
                message: 'Address parameter is required'
            });
        }

        // Get appropriate API key
        const { key: apiKey, isUserKey } = await getGoogleApiKey(req.user?.uuid);

        const params = {
            address: address,
            key: apiKey
        };

        const response = await axios.get(`${GEOCODING_BASE_URL}/json`, { params });

        // Check for API key errors
        if (response.data.status === 'REQUEST_DENIED' && isUserKey) {
            await markKeysInvalid(req.user.uuid);
            return res.status(401).json({
                success: false,
                message: 'Your Google API key is invalid. Please update it in settings.',
                keyInvalid: true
            });
        }

        res.status(200).json(response.data);

    } catch (error) {
        console.error('Geocoding API error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to geocode location',
            error: error.message
        });
    }
};

const searchNearbyPlaces = async (req, res) => {
    try {
        const { location, radius, keyword, type = 'establishment' } = req.query;

        if (!location || !radius || !keyword) {
            return res.status(400).json({
                success: false,
                message: 'Location, radius, and keyword parameters are required'
            });
        }

        // Get appropriate API key
        const { key: apiKey, isUserKey } = await getGoogleApiKey(req.user?.uuid);

        // Deduct credits (middleware already checked, this actually deducts)
        if (req.user && !isUserKey) {
            const creditResult = await deductCredits(req.user.uuid, 'google_search', null, {
                keyword,
                location,
                radius
            });

            if (!creditResult.success) {
                return res.status(403).json({
                    success: false,
                    message: creditResult.error,
                    creditsRequired: creditResult.creditsRequired,
                    currentBalance: creditResult.currentBalance
                });
            }
        }

        const params = {
            location: location,
            radius: radius,
            keyword: keyword,
            type: type,
            key: apiKey
        };

        const response = await axios.get(`${GOOGLE_PLACES_BASE_URL}/nearbysearch/json`, { params });

        // Check for API key errors
        if (response.data.status === 'REQUEST_DENIED' && isUserKey) {
            await markKeysInvalid(req.user.uuid);
            return res.status(401).json({
                success: false,
                message: 'Your Google API key is invalid. Please update it in settings.',
                keyInvalid: true
            });
        }

        // Add credit info to response if user is authenticated
        const responseData = {
            ...response.data,
            _meta: {
                usingOwnKey: isUserKey,
                creditsDeducted: isUserKey ? 0 : 10
            }
        };

        res.status(200).json(responseData);

    } catch (error) {
        console.error('Places API error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search nearby places',
            error: error.message
        });
    }
};

const getPlaceDetails = async (req, res) => {
    try {
        const { place_id, fields = 'formatted_phone_number,website,rating,user_ratings_total,url,opening_hours' } = req.query;

        if (!place_id) {
            return res.status(400).json({
                success: false,
                message: 'Place ID parameter is required'
            });
        }

        // Get appropriate API key
        const { key: apiKey, isUserKey } = await getGoogleApiKey(req.user?.uuid);

        const params = {
            place_id: place_id,
            fields: fields,
            key: apiKey
        };

        const response = await axios.get(`${GOOGLE_PLACES_BASE_URL}/details/json`, { params });

        // Check for API key errors
        if (response.data.status === 'REQUEST_DENIED' && isUserKey) {
            await markKeysInvalid(req.user.uuid);
            return res.status(401).json({
                success: false,
                message: 'Your Google API key is invalid. Please update it in settings.',
                keyInvalid: true
            });
        }

        res.status(200).json(response.data);

    } catch (error) {
        console.error('Place details API error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get place details',
            error: error.message
        });
    }
};

module.exports = {
    geocodeLocation,
    searchNearbyPlaces,
    getPlaceDetails
};
