/**
 * LogStore.js
 * Simple data layer: In-memory log storage with file persistence
 * Stores only: hostname, method, normalizedPath, queryKeys, statusCodes, timestamp, discoveryCount
 */

const fs = require('fs');
const path = require('path');

class LogStore {
  constructor(logsFilePath = path.join(__dirname, 'logs.json')) {
    this.logsFile = logsFilePath;
    this.logs = [];
    this.fingerprintIndex = new Map();
    this.saveScheduled = false;
    this.savePending = false;
    this.SAVE_DEBOUNCE_MS = 5000;
    
    this.load();
  }

  /**
   * Load logs from disk file
   * Auto-creates logs.json if missing (for fresh deployments)
   */
  load() {
    try {
      if (fs.existsSync(this.logsFile)) {
        const data = JSON.parse(fs.readFileSync(this.logsFile, 'utf8'));
        this.logs = Array.isArray(data) ? data : [];
        
        // Rebuild fingerprint index
        this.logs.forEach((log, index) => {
          if (log.fingerprint) {
            this.fingerprintIndex.set(log.fingerprint, index);
          }
        });
        
        console.log(`[LogStore] Loaded ${this.logs.length} logs`);
      } else {
        // File doesn't exist - create with empty array (new deployment)
        console.log('[LogStore] logs.json not found, creating new file');
        this.logs = [];
        this.fingerprintIndex.clear();
        this.saveSync(); // Initialize with empty array
      }
    } catch (error) {
      console.error('[LogStore] Error loading logs:', error.message);
      this.logs = [];
      this.fingerprintIndex.clear();
      // Attempt to create new file with empty data
      try {
        this.saveSync();
      } catch (saveErr) {
        console.error('[LogStore] Failed to initialize logs.json:', saveErr.message);
      }
    }
  }

  /**
   * Schedule asynchronous save with debouncing
   * If save is already scheduled, this is a no-op
   */
  scheduleAsyncSave() {
    if (this.saveScheduled) {
      this.savePending = true; // Mark that another save is needed after current one
      return;
    }
    
    this.saveScheduled = true;
    
    setTimeout(() => {
      this.saveScheduled = false;
      
      // Perform the save
      try {
        fs.writeFileSync(this.logsFile, JSON.stringify(this.logs, null, 2));
      } catch (error) {
        console.error('[LogStore] Error saving logs:', error.message);
      }
      
      // If more changes came in during save, schedule another save
      if (this.savePending) {
        this.savePending = false;
        this.scheduleAsyncSave();
      }
    }, this.SAVE_DEBOUNCE_MS);
  }

  /**
   * Synchronously save logs to disk (used during initialization)
   */
  saveSync() {
    try {
      fs.writeFileSync(this.logsFile, JSON.stringify(this.logs, null, 2));
    } catch (error) {
      console.error('[LogStore] Error saving logs synchronously:', error.message);
      throw error;
    }
  }

  /**
   * Add or update a log entry
   * Returns { isNew, fingerprint, entry }
   */
  add(logEntry) {
    const fingerprint = logEntry.fingerprint;
    
    if (this.fingerprintIndex.has(fingerprint)) {
      // Update existing entry
      const index = this.fingerprintIndex.get(fingerprint);
      const existingLog = this.logs[index];
      
      // Merge properties
      Object.assign(existingLog, logEntry);
      existingLog.lastPatched = Date.now();
      
      this.savePending = true; // Mark for save
      return { isNew: false, fingerprint, entry: existingLog };
    } else {
      // New entry
      logEntry.receivedAt = Date.now();
      this.logs.push(logEntry);
      this.fingerprintIndex.set(fingerprint, this.logs.length - 1);
      
      this.savePending = true; // Mark for save
      return { isNew: true, fingerprint, entry: logEntry };
    }
  }

  /**
   * Get all logs (returns immutable copy)
   */
  getAll() {
    return [...this.logs];
  }

  /**
   * Get a single log by fingerprint
   */
  getByFingerprint(fingerprint) {
    const index = this.fingerprintIndex.get(fingerprint);
    return index !== undefined ? this.logs[index] : null;
  }

  /**
   * Get logs by filter (used for queries)
   */
  getFiltered(filterFn) {
    return this.logs.filter(filterFn);
  }

  /**
   * Update a log entry in place
   */
  update(fingerprint, updates) {
    const index = this.fingerprintIndex.get(fingerprint);
    if (index !== undefined) {
      Object.assign(this.logs[index], updates);
      this.savePending = true;
      return this.logs[index];
    }
    return null;
  }

  /**
   * Clear all logs
   */
  clear() {
    this.logs = [];
    this.fingerprintIndex.clear();
    this.savePending = true;
  }

  /**
   * Get total number of logs
   */
  count() {
    return this.logs.length;
  }

  /**
   * Get scout reputation (removed - simplified)
   */
  getScoutReputation(scoutId) {
    return 50; // Neutral score
  }

  /**
   * Update scout reputation (removed - simplified)
   */
  setScoutReputation(scoutId, score) {
    // No-op in simplified version
  }

  /**
   * Increase scout reputation (removed - simplified)
   */
  increaseScoutReputation(scoutId, amount = 5) {
    // No-op in simplified version
  }

  /**
   * Force synchronous save (for critical operations)
   */
  saveNow() {
    try {
      fs.writeFileSync(this.logsFile, JSON.stringify(this.logs, null, 2));
      this.saveScheduled = false;
      this.savePending = false;
    } catch (error) {
      console.error('[LogStore] Error in saveNow():', error.message);
    }
  }
}

module.exports = LogStore;
