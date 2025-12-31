/**
 * Config.js
 * Centralized configuration for the APIScout extension
 */

const CONFIG = {
  // Server configuration
  SERVER: {
    BASE_URL: 'http://localhost:3000', // Backend server URL
    ENDPOINTS: {
      LOGS: '/api/logs',
      LOGS_SEARCH: '/api/logs/search',
      AGGREGATES: '/api/aggregates',
      GRAPH: '/api/graph'
    }
  },

  // Static file extensions to ignore
  IGNORE_EXTENSIONS: new Set([
    'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp',     // Images
    'css',                                            // Stylesheets
    'woff', 'woff2', 'ttf', 'eot',                   // Fonts
    'mp4', 'mp3', 'webm', 'ogg',                     // Media
    'ico', 'map'                                      // Icons & sourcemaps
  ]),

  // Resource types to ignore (from webRequest API)
  IGNORE_RESOURCE_TYPES: new Set([
    'image', 'font', 'stylesheet', 'media'
  ]),

  // Action words indicating business logic
  ACTION_WORDS: [
    'login', 'auth', 'user', 'checkout', 'order',
    'signup', 'payment', 'api', 'api', 'profile',
    'account', 'transaction', 'purchase'
  ],

  // Known utility APIs to suppress (unless error)
  SUPPRESSED_UTILITIES: new Set([
    'challenges.cloudflare.com',
    'global.console.aws.amazon.com'
  ]),

  // Thresholds
  FINGERPRINT_THRESHOLD: 1,
  REQUEST_BUFFER_TTL: 60000,      // 60 seconds
  BUFFER_CLEANUP_INTERVAL: 300000, // 5 minutes
  SESSION_FINGERPRINT_LIMIT: 1000,

  // Noise detection
  NOISE: {
    PATH_SKELETONS_WEIGHT: 2,     // How many skeletons before marked noisy
    SAME_DOMAIN_THRESHOLD: 3       // Requests to same domain threshold
  }
};

// Make available globally for service worker
self.CONFIG = CONFIG;

// Also export for Node/module context
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
