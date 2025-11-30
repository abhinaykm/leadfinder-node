require('dotenv').config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const dns = require('dns');

// Force IPv4 DNS resolution globally (works in Node.js 17+)
try {
    dns.setDefaultResultOrder('ipv4first');
    console.log("DNS resolution set to IPv4-first");
} catch (err) {
    console.warn("setDefaultResultOrder not available, using default DNS resolution");
}

const app = express();
app.use(cors());
app.use(express.json());

// 1. Debugging: Log (masked) config on startup to ensure Render Env vars are loaded
console.log("Attempting DB Connection with:");
console.log("Host:", process.env.DB_HOST || "Using Hardcoded Fallback (Not Recommended)");
console.log("User:", process.env.DB_USER || "Using Hardcoded Fallback");
console.log("Node version:", process.version);
// Never log the actual password!

const pool = new Pool({
    host: process.env.DB_HOST || 'ep-proud-hill-a1125h95-pooler.ap-southeast-1.aws.neon.tech',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'neondb_owner',
    password: process.env.DB_PASSWORD || 'npg_oBWeUht6XH5d',
    database: process.env.DB_DATABASE || 'buzzhive',
    ssl: {
        rejectUnauthorized: false
    },
    connectionTimeoutMillis: 5000
});

console.log("Database pool initialized");

// Health check for Render
app.get("/buzzhivenode/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

// TEST ROUTES
app.get("/buzzhivenode/test", (req, res) => {
    res.send("Server Running on Render ✔");
});

// DB TEST ROUTE
app.get("/buzzhivenode/dbtest", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");
        res.json({ success: true, message: "DB Connected", time: result.rows[0].now });
    } catch (err) {
        console.error("DB Connection Error:", err); // This will show in Render Logs
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Server started on PORT:", PORT);
});