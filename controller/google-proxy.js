const axios = require('axios');

// You should move this to config file or environment variable
const GOOGLE_PLACES_API_KEY = 'AIzaSyByYZvVBTq0qD-ynXHUXHslwJlIP0ZZ6Is';
const GOOGLE_PLACES_BASE_URL = 'https://maps.googleapis.com/maps/api/place';
const GEOCODING_BASE_URL = 'https://maps.googleapis.com/maps/api/geocode';

const geocodeLocation = async (req, res) => {
    try {
        const { address } = req.query;

        if (!address) {
            return res.status(400).json({
                success: false,
                message: 'Address parameter is required'
            });
        }

        const params = {
            address: address,
            key: GOOGLE_PLACES_API_KEY
        };

        const response = await axios.get(`${GEOCODING_BASE_URL}/json`, { params });

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

        const params = {
            location: location,
            radius: radius,
            keyword: keyword,
            type: type,
            key: GOOGLE_PLACES_API_KEY
        };

        const response = await axios.get(`${GOOGLE_PLACES_BASE_URL}/nearbysearch/json`, { params });

        res.status(200).json(response.data);

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
        const { place_id, fields = 'formatted_phone_number,website,rating,user_ratings_total,url' } = req.query;

        if (!place_id) {
            return res.status(400).json({
                success: false,
                message: 'Place ID parameter is required'
            });
        }

        const params = {
            place_id: place_id,
            fields: fields,
            key: GOOGLE_PLACES_API_KEY
        };

        const response = await axios.get(`${GOOGLE_PLACES_BASE_URL}/details/json`, { params });

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