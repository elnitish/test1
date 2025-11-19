const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');
const fs = require('fs');
const visaRoutes = require('./expressRoutes');

const app = express();
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 443;
const USE_HTTPS = process.env.USE_HTTPS === 'true';

// SSL Certificate paths (update these with your actual paths)
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || '/etc/letsencrypt/live/your-domain.com/privkey.pem';
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || '/etc/letsencrypt/live/your-domain.com/fullchain.pem';

// Middleware - CORS configuration matching server.js
app.use(cors({
    origin: [
        "https://booking.visad.co.uk",
        "https://visad.co.uk",
        "http://localhost:3000",
        "https://vault.visad.co.uk"
    ],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "Session-Key", "Accept"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Routes
app.use('/api/visa', visaRoutes);

// Root endpoint - matching server.js pattern
app.get('/', (req, res) => {
    res.json({
        service: 'Schengen Visa PDF Filler (Python)',
        version: '1.0.0',
        status: 'running',
        protocol: USE_HTTPS ? 'https' : 'http',
        endpoints: {
            fillForm: 'POST /api/visa/fill-form',
            validateData: 'POST /api/visa/validate-data',
            health: 'GET /api/visa/health'
        }
    });
});

// Health check endpoint - matching server.js pattern
app.get('/health', (_req, res) => {
    res.json({ ok: true });
});

// Version endpoint - matching server.js pattern
app.get('/version', (req, res) => {
    res.json({ version: "1.0.0" });
});

// Error handling - improved with better logging
app.use((err, req, res, next) => {
    console.error(`[ERROR] ${new Date().toISOString()}:`, err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Not found',
        message: `Route ${req.method} ${req.path} not found`
    });
});

// Start server with HTTPS or HTTP
if (USE_HTTPS) {
    // HTTPS Server
    try {
        const httpsOptions = {
            key: fs.readFileSync(SSL_KEY_PATH),
            cert: fs.readFileSync(SSL_CERT_PATH)
        };

        https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
            console.log('\n' + '='.repeat(70));
            console.log('🚀 Schengen Visa PDF Filler API (Python Backend - HTTPS)');
            console.log('='.repeat(70));
            console.log(`🔒 HTTPS Server running on: https://localhost:${HTTPS_PORT}`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log('\n🔗 Available Endpoints:');
            console.log(`   POST   /api/visa/fill-form      - Generate filled PDF`);
            console.log(`   POST   /api/visa/validate-data  - Validate user data`);
            console.log(`   GET    /api/visa/health         - Check Python status`);
            console.log(`   GET    /health                  - Server health check`);
            console.log(`   GET    /version                 - API version`);
            console.log('\n🔐 CORS Enabled for:');
            console.log('   - https://booking.visad.co.uk');
            console.log('   - https://visad.co.uk');
            console.log('   - https://vault.visad.co.uk');
            console.log('   - http://localhost:3000');
            console.log('='.repeat(70));
            console.log('✅ HTTPS Server is ready and listening for requests!\n');
        });

        // Optional: HTTP to HTTPS redirect server
        if (process.env.HTTP_REDIRECT === 'true') {
            http.createServer((req, res) => {
                res.writeHead(301, { "Location": `https://${req.headers.host}${req.url}` });
                res.end();
            }).listen(PORT, () => {
                console.log(`🔄 HTTP Redirect Server running on port ${PORT} -> HTTPS ${HTTPS_PORT}`);
            });
        }

    } catch (error) {
        console.error('❌ Failed to start HTTPS server:', error.message);
        console.log('💡 Falling back to HTTP mode...');

        // Fallback to HTTP
        http.createServer(app).listen(PORT, () => {
            console.log(`📡 HTTP Server (fallback) running on: http://localhost:${PORT}`);
        });
    }
} else {
    // HTTP Server (default)
    http.createServer(app).listen(PORT, () => {
        console.log('\n' + '='.repeat(70));
        console.log('🚀 Schengen Visa PDF Filler API (Python Backend)');
        console.log('='.repeat(70));
        console.log(`📡 Server running on: http://localhost:${PORT}`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log('\n🔗 Available Endpoints:');
        console.log(`   POST   /api/visa/fill-form      - Generate filled PDF`);
        console.log(`   POST   /api/visa/validate-data  - Validate user data`);
        console.log(`   GET    /api/visa/health         - Check Python status`);
        console.log(`   GET    /health                  - Server health check`);
        console.log(`   GET    /version                 - API version`);
        console.log('\n🔐 CORS Enabled for:');
        console.log('   - https://booking.visad.co.uk');
        console.log('   - https://visad.co.uk');
        console.log('   - https://vault.visad.co.uk');
        console.log('   - http://localhost:3000');
        console.log('='.repeat(70));
        console.log('✅ Server is ready and listening for requests!\n');
    });
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\nSIGINT received, shutting down...');
    process.exit(0);
});

module.exports = app;
