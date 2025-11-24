require('dotenv').config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

// DB CONFIG - Supabase PostgreSQL
const pool = new Pool({
    host: process.env.DB_HOST || "db.speiewcctfjngucgwekx.supabase.co",
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "buzzhive@amit123@!",
    database: process.env.DB_DATABASE || "postgres",
    ssl: {
        rejectUnauthorized: false
    }
});

// Health check for Render
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

// TEST ROUTES
app.get("/test", (req, res) => {
    res.send("Server Running on Render ✔");
});

// DB TEST ROUTE
app.get("/dbtest", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");
        res.json({ success: true, message: "DB Connected", time: result.rows[0].now });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Server started on PORT:", PORT);
});
