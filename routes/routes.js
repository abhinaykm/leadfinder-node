const express = require('express');
const router = express.Router();
const { login, socialLogin } = require('../controller/login');
const { saveSearchHistory, getSearchHistory } = require('../controller/search');
const { geocodeLocation, searchNearbyPlaces, getPlaceDetails } = require('../controller/google-proxy');
const { analyzeSeo, getSeoReport, getAllReports } = require('../controller/seo-analysis');
const { captureScreenshot } = require('../controller/screenshot');
const verifyToken = require('../controller/verify-token');

// Authentication routes
router.route("/login").post(login);
router.route("/social-login").post(socialLogin);

// Search routes
router.route("/save-search-history").post(saveSearchHistory);
router.route("/search-history").get(getSearchHistory);

// Google API proxy routes
router.route("/google/geocode").get(geocodeLocation);
router.route("/google/places/nearby").get(searchNearbyPlaces);
router.route("/google/places/details").get(getPlaceDetails);

// SEO Analysis routes
router.route("/seo/analyze").post(analyzeSeo);
router.route("/seo/report/:reportId").get(getSeoReport);
router.route("/seo/reports").get(getAllReports);

// Screenshot route
router.route("/screenshot").get(captureScreenshot);

// Protected routes (add more as needed)
// Example: router.route("/profile").get(verifyToken, getUserProfile);

module.exports = router;