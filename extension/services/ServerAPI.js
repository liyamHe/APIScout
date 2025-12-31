/**
 * ServerAPI.js
 * API client for communicating with the backend server
 * Handles request logging, fingerprint uploads, and data synchronization
 */

class ServerAPI {
  constructor(config) {
    this.config = config;
    this.retryQueue = [];
    this.isOnline = true; // Service workers assume online
    this.setupNetworkListeners();
  }

  /**
   * Setup online/offline event listeners for retry logic
   * Adapted for service worker context (no window object)
   */
  setupNetworkListeners() {
    // Service workers don't have window, so we skip network listeners
    // Service workers are background scripts with reliable connectivity
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.processRetryQueue();
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
      });
    }
  }

  /**
   * Upload a single log entry to the server
   * @async
   * @param {Object} logEntry - The log data to upload
   * @returns {boolean} true if successful
   */
  async uploadLog(logEntry) {
    if (!this.isOnline) {
      this.retryQueue.push(logEntry);
      return false;
    }

    try {
      const url = `${this.config.SERVER.BASE_URL}${this.config.SERVER.ENDPOINTS.LOGS}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Extension-Id': chrome.runtime.id
        },
        body: JSON.stringify(logEntry),
        timeout: this.config.REQUEST_TIMEOUT
      });

      if (!response.ok) {
        console.warn(`Server returned ${response.status} for log upload`);
        if (response.status >= 500 || response.status === 429) {
          // Server error or rate limited, retry later
          this.retryQueue.push(logEntry);
        }
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error uploading log:', error);
      // Network error, add to retry queue
      this.retryQueue.push(logEntry);
      return false;
    }
  }

  /**
   * Batch upload multiple logs in a single request
   * @async
   * @param {Array} logs - Array of log entries
   * @returns {boolean} true if all successful
   */
  async batchUpload(logs) {
    if (!this.isOnline) {
      this.retryQueue.push(...logs);
      return false;
    }

    try {
      const url = `${this.config.SERVER.BASE_URL}${this.config.SERVER.ENDPOINTS.LOGS}/batch`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Extension-Id': chrome.runtime.id
        },
        body: JSON.stringify({ logs }),
        timeout: this.config.REQUEST_TIMEOUT
      });

      if (!response.ok) {
        console.warn(`Server returned ${response.status} for batch upload`);
        this.retryQueue.push(...logs);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in batch upload:', error);
      this.retryQueue.push(...logs);
      return false;
    }
  }

  /**
   * Upload fingerprint data for deduplication
   * @async
   * @param {string} fingerprint - The fingerprint hash
   * @param {Object} metadata - Fingerprint metadata
   * @returns {boolean} success status
   */
  async uploadFingerprint(fingerprint, metadata) {
    if (!this.isOnline) return false;

    try {
      const response = await fetch(`${this.config.SERVER_URL}/fingerprints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Extension-Id': chrome.runtime.id
        },
        body: JSON.stringify({ fingerprint, metadata }),
        timeout: this.config.REQUEST_TIMEOUT
      });

      return response.ok;
    } catch (error) {
      console.error('Error uploading fingerprint:', error);
      return false;
    }
  }

  /**
   * Fetch global noise data from server
   * @async
   * @returns {Object} noise skeleton data
   */
  async fetchGlobalNoise() {
    if (!this.isOnline) return null;

    try {
      const response = await fetch(`${this.config.SERVER_URL}/noise`, {
        method: 'GET',
        headers: {
          'X-Extension-Id': chrome.runtime.id
        },
        timeout: this.config.REQUEST_TIMEOUT
      });

      if (!response.ok) return null;

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching global noise:', error);
      return null;
    }
  }

  /**
   * Search logs on the server
   * @async
   * @param {string} query - Search query
   * @param {Object} filters - Filter criteria
   * @returns {Array} Search results
   */
  async searchLogs(query, filters = {}) {
    if (!this.isOnline) return [];

    try {
      const params = new URLSearchParams({
        q: query,
        ...filters
      });

      const response = await fetch(
        `${this.config.SERVER_URL}/search?${params}`,
        {
          method: 'GET',
          headers: {
            'X-Extension-Id': chrome.runtime.id
          },
          timeout: this.config.REQUEST_TIMEOUT
        }
      );

      if (!response.ok) return [];

      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Error searching logs:', error);
      return [];
    }
  }

  /**
   * Get server health status
   * @async
   * @returns {boolean} true if server is reachable
   */
  async checkHealth() {
    if (!this.isOnline) return false;

    try {
      const url = `${this.config.SERVER.BASE_URL}/api/health`;
      const response = await fetch(url, {
        method: 'GET',
        timeout: 5000
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Process retry queue when connection is restored
   * @private
   */
  async processRetryQueue() {
    if (this.retryQueue.length === 0) return;

    const logsToRetry = [...this.retryQueue];
    this.retryQueue = [];

    // Batch upload retried logs
    const success = await this.batchUpload(logsToRetry);
    
    if (!success) {
      // Re-add to queue if still failed
      this.retryQueue.push(...logsToRetry);
    }
  }

  /**
   * Get current retry queue size
   */
  getRetryQueueSize() {
    return this.retryQueue.length;
  }

  /**
   * Manually trigger retry queue processing
   * @async
   */
  async retryFailedUploads() {
    return this.processRetryQueue();
  }
}

// Make available globally for service worker
self.ServerAPI = ServerAPI;

// Also export for Node/module context
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ServerAPI;
}
