/**
 * routes/healthRoutes.js
 * Health check and status routes
 */

const express = require('express');
const router = express.Router();

/**
 * Initialize routes with logStore dependency
 */
function initializeRoutes(logStore) {
  /**
   * GET /api/health - Server status
   */
  router.get('/', (req, res) => {
    res.json({
      success: true,
      status: 'healthy',
      totalLogs: logStore.count(),
      timestamp: Date.now()
    });
  });

  return router;
}

module.exports = initializeRoutes;
