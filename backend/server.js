const app = require('./app'); // Require the configured app
require('dotenv').config(); // Optional: load .env here too (in case server.js is run directly)

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Optional: Graceful shutdown handling (good practice for production)
process.on('SIGTERM', () => {
    console.log('SIGTERM received: Closing server...');
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received: Closing server...');
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});