/**
 * routes/logRoutes.js
 * API routes for log management
 */

const express = require('express');
const router = express.Router();
const ExtensionFilter = require('../utils/ExtensionFilter');

const MAX_LOG_LIMIT = 500; // guardrail to prevent DOS

/**
 * Simple search matching: supports partial hostname, exact method, path segments
 */
function matchesSearch(log, query) {
  if (!query || query.trim() === '') return true;
  
  const q = query.toLowerCase();
  const hostMatch = (log.hostname || '').toLowerCase().includes(q);
  const methodMatch = (log.method || '').toLowerCase() === q;
  const pathMatch = (log.normalizedPath || '').toLowerCase().includes(q);
  
  return hostMatch || methodMatch || pathMatch;
}

/**
 * Initialize routes with logStore dependency
 */
function initializeRoutes(logStore) {
  /**
   * POST /api/logs - Receive a new log entry from the extension
   */
  router.post('/', (req, res) => {
    const { hostname, method, normalizedPath, queryKeys, statusCodes, discoveryCount, timestamp } = req.body;
    
    // Minimal validation
    if (!hostname || !method || !normalizedPath) {
      return res.status(400).json({ error: 'Missing required fields: hostname, method, normalizedPath' });
    }

    // Ignore localhost and local API calls (case-insensitive, handle ports)
    const hostnameLower = hostname.toLowerCase();
    if (hostnameLower.includes('localhost') || hostnameLower.includes('127.0.0.1') || hostnameLower.includes('[::1]') || hostnameLower === '0.0.0.0') {
      return res.status(200).json({ success: true, ignored: true });
    }

    // Check if should be ignored
    if (ExtensionFilter.shouldIgnore(method, hostname, normalizedPath)) {
      return res.status(200).json({ success: true, ignored: true });
    }

    // Generate fingerprint for deduplication
    const fingerprint = ExtensionFilter.generateFingerprint(method, hostname, normalizedPath);
    const now = Date.now();

    // Check if already logged
    const existingLog = logStore.getByFingerprint(fingerprint);
    
    if (existingLog) {
      // Update existing entry
      existingLog.discoveryCount = (existingLog.discoveryCount || 1) + (discoveryCount || 1);
      existingLog.timestamp = timestamp || now;
      
      if (statusCodes && Array.isArray(statusCodes)) {
        for (const code of statusCodes) {
          if (!existingLog.statusCodes.includes(code)) {
            existingLog.statusCodes.push(code);
          }
        }
      }

      // Debug log removed - was spamming console
      // console.log(`[Update] ${fingerprint.substring(0, 8)}... (Count: ${existingLog.discoveryCount})`);
    } else {
      // New entry - store only essential fields
      const logEntry = {
        fingerprint,
        hostname,
        method,
        normalizedPath,
        queryKeys: queryKeys || [],
        statusCodes: statusCodes || [],
        discoveryCount: discoveryCount || 1,
        timestamp: timestamp || now
      };

      logStore.add(logEntry);
      console.log(`[New] ${fingerprint.substring(0, 8)}... for ${method} ${hostname}${normalizedPath}`);
    }

    // Debounced save
    logStore.scheduleAsyncSave();

    res.status(200).json({ success: true, fingerprint });
  });

  /**
   * GET /api/logs - Retrieve logs with search and simple filtering
   */
  router.get('/', (req, res) => {
    const limit = Math.max(1, Math.min(MAX_LOG_LIMIT, parseInt(req.query.limit, 10) || 100));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

    // Get all logs
    let logs = logStore.getAll();

    // Apply search
    const searchQuery = req.query.q || '';
    if (searchQuery) {
      logs = logs.filter((l) => matchesSearch(l, searchQuery));
    }

    // Filter by method if specified
    if (req.query.method) {
      const methodFilter = req.query.method.toUpperCase();
      logs = logs.filter((l) => l.method === methodFilter);
    }

    // Hide common assets if requested
    if (req.query.hideAssets === 'true') {
      const assetExtensions = ['.js', '.css', '.png', '.jpg', '.gif', '.svg', '.woff', '.woff2', '.ttf'];
      logs = logs.filter((l) => {
        const path = (l.normalizedPath || '').toLowerCase();
        return !assetExtensions.some((ext) => path.endsWith(ext));
      });
    }

    // Sort by discovery count descending
    logs.sort((a, b) => (b.discoveryCount || 1) - (a.discoveryCount || 1));

    // Paginate
    const totalCount = logs.length;
    const sliced = logs.slice(offset, offset + limit);
    const totalDiscoveries = logs.reduce((sum, log) => sum + (log.discoveryCount || 1), 0);

    res.json({
      success: true,
      count: sliced.length,
      total: totalCount,
      totalDiscoveries,
      deduplicationRatio: sliced.length > 0 ? (totalDiscoveries / sliced.length).toFixed(2) : 0,
      limit,
      offset,
      logs: sliced
    });
  });

  /**
   * DELETE /api/logs - Clear all logs
   */
  router.delete('/', (req, res) => {
    logStore.clear();
    logStore.saveNow();
    console.log('[Logs cleared]');
    res.json({ success: true });
  });

  return router;
}

module.exports = initializeRoutes;
