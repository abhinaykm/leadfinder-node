require('dotenv').config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const dns = require('dns');

try {
    dns.setDefaultResultOrder('ipv4first');
    console.log("✓ DNS resolution set to IPv4-first");
} catch (err) {
    console.warn("⚠ setDefaultResultOrder not available, using default DNS resolution");
}

const app = express();
app.use(cors());
app.use(express.json());

// FORCE Aiven Cloud credentials (ignore environment variables on shared hosting)
const FORCE_AIVEN = true; // Set to false to use env vars

const dbConfig = FORCE_AIVEN ? {
    host: "gorilla-gorilla.i.aivencloud.com",
    port: 20109,
    user: "avnadmin",
    password: "AVNS_7mBC8K--9QHE6VIeXLA",
    database: "defaultdb"
} : {
    host: process.env.DB_HOST || "gorilla-gorilla.i.aivencloud.com",
    port: process.env.DB_PORT || 20109,
    user: process.env.DB_USER || "avnadmin",
    password: process.env.DB_PASSWORD || "AVNS_7mBC8K--9QHE6VIeXLA",
    database: process.env.DB_DATABASE || "defaultdb"
};

const connectionString = process.env.DATABASE_URL ||
    `postgresql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;

console.log("Connection string (masked):", connectionString.replace(/:[^:@]+@/, ':****@'));

const pool = new Pool({
    connectionString: connectionString,
    ssl: {
        rejectUnauthorized: false,
        ca: `-----BEGIN CERTIFICATE-----
MIIEUDCCArigAwIBAgIUHl/isioIv3A090KPryj6tcrYhI8wDQYJKoZIhvcNAQEM
BQAwQDE+MDwGA1UEAww1MTM1OTQ5MGMtYzg3MS00ZDk3LThmZDItYWRmNjlhZGIw
ZmZkIEdFTiAxIFByb2plY3QgQ0EwHhcNMjUxMTA4MTI0MTM4WhcNMzUxMTA2MTI0
MTM4WjBAMT4wPAYDVQQDDDUxMzU5NDkwYy1jODcxLTRkOTctOGZkMi1hZGY2OWFk
YjBmZmQgR0VOIDEgUHJvamVjdCBDQTCCAaIwDQYJKoZIhvcNAQEBBQADggGPADCC
AYoCggGBAM+uFDkIAoJ2hpc8QDltyfUGxSGNyf83pH0OLvL4CimPJHloMTMrHvid
k3QLuq3hVYmQ/Ps681v6L+DlfAb3m5FsCfmlS1CX4VZqA3HwuC5OxObiuPIac/sQ
fr7KDJlHV+HtfJoQQPFleNenMi/D0rEYmNlLgf5srRWPU5Xpom6MFxaKQIU5pL0Y
2LLFnLe+edFx+DV+tx07HgpCrLJhFiikx9Wo3b+71adjnIOE5LCSDM+GMEIimKKC
JaUUERDVy2QPppuT3vAxjD1md5JSdEUsiXmolJ2vcp5nuy8sLDHbkQMBsL/+UXp0
/9t0P9sz9Bx462yqK6d5aPNHpObDFe3EwvXeE52gbksv9lTHOSCvJNwBV/jgKv47
L0Ee687E1ts5oYrHD97sis0XsESdacRCp0op++1YH79yq55ecQvR0hSsG8mKDCvA
CSOmgSnU6+iGPxRTWi74UwtSVMORcWq5bDaYxwhXE89es7M5zfcLURtTn8z9Iy6B
jpJGNhoGBwIDAQABo0IwQDAdBgNVHQ4EFgQUAFLT3nFThjhGigYoMLizjBE0fR0w
EgYDVR0TAQH/BAgwBgEB/wIBADALBgNVHQ8EBAMCAQYwDQYJKoZIhvcNAQEMBQAD
ggGBAEt/fIdPhFEHCYERdJLHC0Co9Gb+6wgF8/RSR8XBzrOz5bXstPkM0Rk5HQkf
gkCuLDVBFrpV3w+FfI7GjMG6vocR/+mWaYur41IAXKBKo6KqWpGvVxGAA5w622Wk
1YRi29DTfDe7SZi/YW93hPGs3jDdQSMugXhTjeWGgbnwU9bvcrSrRKk7iEAMCVFn
p5jmGO/nl3qQNTQRxV87IK1Kx2PdhOB0KIUTGQEVv3P1n/IaZ9kBjkLTlP6n1+fe
xNbPkvA8D46kdmkOolVcVlTyBnO470uW2hnN7aedS0+j+21ojnhhcnk8QBcxJUA5
fzjpJ5omsnAPUN6a11E6OQwa4rIDm65E+TH9vx5ZFWiMlc0Z/flShPtLr6eR58kq
Ash5QPJ2lRYSqgg7RFTbN7Uu4tgj0xlhrQbnvDxgMLvtkZqkecV/hI3iMlRrW53g
NY4OrW33sSh2PE1ymC8bhxurwEW5DEPPe+Ko2VwZROyI3eT5Sr0x/9De9IuNmawP
0k31Bw==
-----END CERTIFICATE-----`,
    },

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