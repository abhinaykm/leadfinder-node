require('dotenv').config();

module.exports = {
    // Server
    PORT: process.env.PORT || 3000,

    // Database
    DB_HOST: process.env.DB_HOST || "localhost",
    DB_PORT: process.env.DB_PORT || 5432,
    DB_USER: process.env.DB_USER || 'postgres',
    DB_PASSWORD: process.env.DB_PASSWORD || 'pgadmin',
    DB_DATABASE: process.env.DB_DATABASE || 'gorilla',

    // JWT
    JWT_SECRET: process.env.JWT_SECRET || 'abhinay',

    // Mail Configuration
    MAIL_HOST: process.env.MAIL_HOST || "smtp.gmail.com",
    MAIL_PORT: process.env.MAIL_PORT || 587,
    MAIL_SECURE: process.env.MAIL_SECURE === 'true',
    MAIL_USER: process.env.MAIL_USER,
    MAIL_PASSWORD: process.env.MAIL_PASSWORD,
    MAIL_FROM_NAME: process.env.MAIL_FROM_NAME || "Abhinay",

    // Google Places API
    GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY,

    // OpenAI API
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
};
