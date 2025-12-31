/**
 * FingerprintEngine.js
 * Fingerprinting, deduplication, and smart caching of request endpoints
 */

class FingerprintEngine {
  constructor(config) {
    this.config = config;
    this.sessionFingerprints = new Map(); // fingerprint -> { firstSeen, count }
    this.requestBuffer = new Map();        // requestId -> request details
  }

  /**
   * Generate SHA-256 fingerprint from request components
   * Used for deduplication and tracking
   * @async
   * @returns {string} hex digest
   */
  async generateFingerprint(method, hostname, normalizedPath) {
    const combined = `${method}:${hostname}:${normalizedPath}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(combined);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Check if fingerprint should trigger an update to the server
   * Implements threshold logic to avoid sending duplicates
   * @returns {boolean} true if update should be sent
   */
  shouldSendUpdate(fingerprint) {
    const cached = this.sessionFingerprints.get(fingerprint);
    if (!cached) return true; // New fingerprint, send it

    // Send if we've seen it N times (threshold)
    return cached.count >= this.config.FINGERPRINT_THRESHOLD;
  }

  /**
   * Update fingerprint cache with new occurrence
   */
  updateFingerprint(fingerprint) {
    if (!this.sessionFingerprints.has(fingerprint)) {
      this.sessionFingerprints.set(fingerprint, {
        firstSeen: Date.now(),
        count: 1
      });
    } else {
      const cached = this.sessionFingerprints.get(fingerprint);
      cached.count++;
    }

    // Garbage collection: remove old entries
    this.pruneOldFingerprints();
  }

  /**
   * Remove old fingerprints from cache to prevent memory bloat
   */
  pruneOldFingerprints() {
    const maxFingerprints = this.config.SESSION_FINGERPRINT_LIMIT;
    if (this.sessionFingerprints.size > maxFingerprints) {
      // Sort by firstSeen, keep newest, remove oldest
      const entries = Array.from(this.sessionFingerprints.entries())
        .sort((a, b) => b[1].firstSeen - a[1].firstSeen)
        .slice(0, maxFingerprints);
      
      this.sessionFingerprints.clear();
      entries.forEach(([fp, data]) => {
        this.sessionFingerprints.set(fp, data);
      });
    }
  }

  /**
   * Add request to buffer for correlation with response
   */
  bufferRequest(requestId, details) {
    this.requestBuffer.set(requestId, {
      ...details,
      timestamp: Date.now()
    });
  }

  /**
   * Retrieve request from buffer
   */
  getBufferedRequest(requestId) {
    return this.requestBuffer.get(requestId);
  }

  /**
   * Remove request from buffer (after processing)
   */
  removeBufferedRequest(requestId) {
    this.requestBuffer.delete(requestId);
  }

  /**
   * Clean up old requests from buffer (TTL-based)
   */
  cleanupBuffer() {
    const now = Date.now();
    const ttl = this.config.REQUEST_BUFFER_TTL;

    for (const [requestId, req] of this.requestBuffer) {
      if (now - req.timestamp > ttl) {
        this.requestBuffer.delete(requestId);
      }
    }
  }

  /**
   * Start periodic cleanup of request buffer
   */
  startCleanup() {
    setInterval(() => {
      this.cleanupBuffer();
    }, this.config.BUFFER_CLEANUP_INTERVAL);
  }

  /**
   * Get cache stats for debugging
   */
  getStats() {
    return {
      fingerprintsCached: this.sessionFingerprints.size,
      bufferedRequests: this.requestBuffer.size,
      oldestBufferedRequest: this.requestBuffer.size > 0
        ? Math.min(...Array.from(this.requestBuffer.values()).map(r => r.timestamp))
        : null
    };
  }
}

// Make available globally for service worker
self.FingerprintEngine = FingerprintEngine;

// Also export for Node/module context
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FingerprintEngine;
}
