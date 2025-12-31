/**
 * ExtensionStorage.js
 * Abstraction layer for Chrome storage API
 * Handles persistence of noise skeletons, fingerprints, and other data
 */

class ExtensionStorage {
  constructor(config) {
    this.config = config;
  }

  /**
   * Save global noise skeleton data
   * @param {Map} noiseMap - map of domain -> noise skeleton
   * @async
   */
  async saveGlobalNoise(noiseMap) {
    const data = {};
    for (const [domain, skeleton] of noiseMap) {
      data[domain] = JSON.stringify(skeleton);
    }
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ 'globalNoiseSkeletons': data }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Load global noise skeleton data
   * @async
   * @returns {Map} map of domain -> noise skeleton
   */
  async loadGlobalNoise() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['globalNoiseSkeletons'], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        
        const noiseMap = new Map();
        if (result.globalNoiseSkeletons) {
          for (const [domain, skeletonStr] of Object.entries(result.globalNoiseSkeletons)) {
            try {
              noiseMap.set(domain, JSON.parse(skeletonStr));
            } catch (e) {
              console.warn(`Failed to parse noise skeleton for ${domain}:`, e);
            }
          }
        }
        resolve(noiseMap);
      });
    });
  }

  /**
   * Save session fingerprints
   * @param {Map} fingerprintMap - map of fingerprint -> { count, firstSeen }
   * @async
   */
  async saveSessionFingerprints(fingerprintMap) {
    const data = {};
    for (const [fp, info] of fingerprintMap) {
      data[fp] = JSON.stringify(info);
    }
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ 'sessionFingerprints': data }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Load session fingerprints
   * @async
   * @returns {Map} map of fingerprint -> { count, firstSeen }
   */
  async loadSessionFingerprints() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['sessionFingerprints'], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        
        const fingerprintMap = new Map();
        if (result.sessionFingerprints) {
          for (const [fp, infoStr] of Object.entries(result.sessionFingerprints)) {
            try {
              fingerprintMap.set(fp, JSON.parse(infoStr));
            } catch (e) {
              console.warn(`Failed to parse fingerprint info for ${fp}:`, e);
            }
          }
        }
        resolve(fingerprintMap);
      });
    });
  }

  /**
   * Save endpoint statistics
   * @param {Map} statsMap - map of endpoint -> { count, tags, methods, heat }
   * @async
   */
  async saveEndpointStats(statsMap) {
    const data = {};
    for (const [endpoint, stats] of statsMap) {
      data[endpoint] = JSON.stringify(stats);
    }
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ 'endpointStatistics': data }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Load endpoint statistics
   * @async
   * @returns {Map} map of endpoint -> { count, tags, methods, heat }
   */
  async loadEndpointStats() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['endpointStatistics'], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        
        const statsMap = new Map();
        if (result.endpointStatistics) {
          for (const [endpoint, statsStr] of Object.entries(result.endpointStatistics)) {
            try {
              statsMap.set(endpoint, JSON.parse(statsStr));
            } catch (e) {
              console.warn(`Failed to parse stats for ${endpoint}:`, e);
            }
          }
        }
        resolve(statsMap);
      });
    });
  }

  /**
   * Save a single key-value pair
   * @async
   */
  async set(key, value) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Load a single key
   * @async
   * @returns {any} value or null if not found
   */
  async get(key) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result[key] || null);
        }
      });
    });
  }

  /**
   * Remove a key
   * @async
   */
  async remove(key) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove([key], () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Clear all stored data
   * @async
   */
  async clear() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get storage usage stats
   * @async
   */
  async getStats() {
    return new Promise((resolve) => {
      chrome.storage.local.getBytesInUse(null, (bytes) => {
        resolve({
          bytesUsed: bytes,
          bytesAvailable: chrome.storage.local.QUOTA_BYTES
        });
      });
    });
  }
}

// Make available globally for service worker
self.ExtensionStorage = ExtensionStorage;

// Also export for Node/module context
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExtensionStorage;
}
