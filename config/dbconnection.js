const { Pool } = require('pg');
const config = require('../config/config');

// Only use SSL for remote databases (not localhost)
const isLocalhost = config.DB_HOST === 'localhost' || config.DB_HOST === '127.0.0.1';

const sslConfig = isLocalhost ? false : {
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
};

const pool = new Pool({
   host: "gorilla-gorilla.i.aivencloud.com",
    port: 20109,
    user: "avnadmin",
    password: "AVNS_7mBC8K--9QHE6VIeXLA",
    database: "defaultdb",
    ssl: sslConfig,
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};