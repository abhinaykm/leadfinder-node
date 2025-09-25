const { Pool } = require('pg');
const config = require('../config/config');

const pool = new Pool({
    host: config.DB_HOST,
    port: config.DB_PORT,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: config.DB_DATABASE,  
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};