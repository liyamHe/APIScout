const express = require('express');
const cors = require('cors');
const path = require('path');

// Import modular components
const LogStore = require('./models/LogStore');
const logRoutes = require('./routes/logRoutes');
const healthRoutes = require('./routes/healthRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize the data layer
const logStore = new LogStore(path.join(__dirname, 'logs.json'));

// CORS configuration - Allow extension requests from Chrome/Firefox
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman, or extensions)
    // Chrome extensions have origin: chrome-extension://[id]
    // Firefox extensions have origin: moz-extension://[id]
    if (!origin || 
        origin.startsWith('chrome-extension://') || 
        origin.startsWith('moz-extension://') ||
        origin.startsWith('http://localhost') ||
        origin.startsWith('http://127.0.0.1')) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for development - restrict in production
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Extension-Id']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static('public'));

// Mount routes
app.use('/api/logs', logRoutes(logStore));
app.use('/api/health', healthRoutes(logStore));

/**
 * GET / - Serve the main dashboard
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'react-dashboard.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`APIScout backend running on port ${PORT}`);
});
