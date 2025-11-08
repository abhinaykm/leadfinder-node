const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const config = require('./config/config');
const routes = require('./routes/routes');
const db = require('./config/dbconnection');

const app = express();

// CORS Configuration
const corsOptions = {
    origin: [
        'https://buzzhive.nobrainautomation.com',
        'http://localhost:4200',
        'http://localhost:4000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400 // 24 hours
};

// Middleware
app.use(cors(corsOptions));
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

// Debug middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    console.log('Origin:', req.headers.origin);
    next();
});

// Routes
app.use('/api', routes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
});

const start = async () => {
    try {
        // Test database connection
        await db.query('SELECT NOW()');
        console.log('Database connected successfully');

        // Start server
        const server = app.listen(config.PORT, () => {
            console.log(`Server started on port ${config.PORT}`);
            console.log(`API available at: http://localhost:${config.PORT}/api/login`);
        });

        // Handle server shutdown gracefully
        process.on('SIGTERM', () => {
            console.log('SIGTERM received, shutting down gracefully');
            server.close(() => {
                console.log('Process terminated');
            });
        });

    } catch (error) {
        console.error('Error starting server:', error);
        process.exit(1);
    }
};

start();