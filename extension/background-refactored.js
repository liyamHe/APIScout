/**
 * background.js (Refactored)
 * Chrome/Firefox Extension Service Worker - Orchestration Layer
 * 
 * This file handles webRequest interception and delegates processing to modular components.
 * All business logic has been extracted into separate modules for maintainability and testability.
 * 
 * Cross-browser compatibility: Works with Chrome (chrome.*) and Firefox (browser.*)
 */

// Browser API polyfill - ensures chrome.* works in both Chrome and Firefox
const BrowserAPI = (typeof chrome !== 'undefined' && chrome.runtime) 
  ? chrome 
  : (typeof browser !== 'undefined' ? browser : null);

if (!BrowserAPI) {
  console.error('[APIScout] Browser API not available - extension cannot run');
  throw new Error('APIScout requires Chrome or Firefox');
}

// Create global chrome reference for compatibility
if (typeof chrome === 'undefined') {
  window.chrome = BrowserAPI;
}

// Load dependencies using importScripts (the only way to load modules in service workers)
importScripts(
  'config/Config.js',
  'services/FingerprintEngine.js',
  'services/ExtensionStorage.js',
  'services/ServerAPI.js',
  'services/RequestProcessor.js'
);

// Modules are now available as global objects
let config, requestProcessor, fingerprintEngine, storage, serverAPI;

// Runtime state
let isInitialized = false;
let stats = {
  requestsProcessed: 0,
  logsUploaded: 0,
  errors: 0
};

/**
 * Initialize extension on first load
 * Load persisted data from storage and start cleanup routines
 */
async function initialize() {
  try {
    console.log('[APIScout] Initializing extension...');
    
    // Use global objects loaded via importScripts
    // CONFIG, FingerprintEngine, ExtensionStorage, ServerAPI, RequestProcessor are now global
    config = self.CONFIG;
    requestProcessor = new self.RequestProcessor(config);
    fingerprintEngine = new self.FingerprintEngine(config);
    storage = new self.ExtensionStorage(config);
    serverAPI = new self.ServerAPI(config);
    
    // Start periodic cleanup of request buffer
    fingerprintEngine.startCleanup();
    
    // Verify server connectivity
    const serverHealthy = await serverAPI.checkHealth();
    if (!serverHealthy) {
      console.warn('[APIScout] Backend server unreachable, running in offline mode');
    }
    
    isInitialized = true;
    console.log('[APIScout] Initialization complete');
  } catch (error) {
    console.error('[APIScout] Initialization failed:', error);
    stats.errors++;
  }
}

/**
 * Main request handler - orchestrates processing pipeline
 */
async function handleWebRequest(details, statusCode) {
  try {
    if (!isInitialized) {
      await initialize();
    }

    stats.requestsProcessed++;

    // STAGE 1: Filter static files and media (early return)
    if (requestProcessor.shouldIgnoreRequest(details.url, details.type)) {
      return;
    }

    // STAGE 2: Parse and validate URL
    let url, hostname;
    try {
      url = new URL(details.url);
      hostname = url.hostname;
    } catch (e) {
      console.warn('[APIScout] Invalid URL:', details.url);
      stats.errors++;
      return;
    }

    // STAGE 3: Sanitize and normalize path
    const normalizedPath = requestProcessor.getNormalizedPath(details.url);
    if (!normalizedPath) {
      return;
    }

    // STAGE 4: Determine context (first-party vs third-party)
    let initiator = null;
    try {
      initiator = details.initiator 
        ? new URL(details.initiator).hostname 
        : (details.documentUrl ? new URL(details.documentUrl).hostname : null);
    } catch (e) {
      // Invalid initiator URL
    }

    const isPrimaryContext = initiator && (
      hostname === initiator || 
      requestProcessor.isSameDomain(hostname, initiator)
    );

    // STAGE 5: Classify request (tags, criticality, score)
    const classification = requestProcessor.classifyRequest(
      details.method || 'GET',
      normalizedPath,
      hostname,
      statusCode,
      isPrimaryContext
    );

    // STAGE 6: Generate fingerprint for deduplication
    const fingerprint = await fingerprintEngine.generateFingerprint(
      details.method || 'GET',
      hostname,
      normalizedPath
    );

    // STAGE 7: Check if fingerprint already sent recently
    fingerprintEngine.updateFingerprint(fingerprint);
    
    if (!fingerprintEngine.shouldSendUpdate(fingerprint)) {
      console.log(`[APIScout] Fingerprint ${fingerprint.substring(0, 8)}... cached, skipping upload`);
      return;
    }

    // STAGE 8: Build log object
    const logObject = {
      hostname,
      method: details.method || 'GET',
      normalizedPath,
      queryKeys: normalizedPath.includes('?') 
        ? normalizedPath.split('?')[1].split('&').map(p => p.split('=')[0]) 
        : [],
      statusCode,
      statusCodes: [statusCode],
      timestamp: Date.now(),
      ready_for_analysis: true,
      score: classification.score,
      isPrimaryContext,
      tags: classification.tags,
      isCritical: classification.isCritical,
      resourceType: classification.resourceType,
      fingerprint
    };

    // STAGE 9: Send to server via API client
    const uploadSuccess = await serverAPI.uploadLog(logObject);
    if (uploadSuccess) {
      stats.logsUploaded++;
      console.log(`[APIScout] ✓ Logged: ${details.method} ${hostname}${normalizedPath}`);
    } else {
      console.warn(`[APIScout] ✗ Failed to upload: ${details.method} ${hostname}${normalizedPath}`);
      stats.errors++;
    }

  } catch (error) {
    console.error('[APIScout] Error in handleWebRequest:', error);
    stats.errors++;
  }
}

/**
 * Register webRequest listeners
 * Monitor all HTTP requests and classify them
 * Compatible with both Chrome and Firefox
 */
function setupWebRequestListeners() {
  try {
    if (!chrome || !chrome.webRequest || !chrome.webRequest.onCompleted) {
      console.warn('[APIScout] webRequest API not available - falling back gracefully');
      return;
    }

    // Listen for completed requests
    chrome.webRequest.onCompleted.addListener(
      (details) => {
        handleWebRequest(details, details.statusCode);
      },
      { urls: ["<all_urls>"] }
    );

    // Listen for failed requests (statusCode will be 0)
    chrome.webRequest.onErrorOccurred.addListener(
      (details) => {
        handleWebRequest(details, 0);
      },
      { urls: ["<all_urls>"] }
    );

    console.log('[APIScout] WebRequest listeners registered');
  } catch (error) {
    console.error('[APIScout] Failed to setup webRequest listeners:', error);
    stats.errors++;
  }
}

/**
 * Get extension statistics
 * Useful for debugging and monitoring
 */
function getStats() {
  const fingerprintStats = fingerprintEngine.getStats();
  return {
    runtime: {
      initialized: isInitialized,
      requestsProcessed: stats.requestsProcessed,
      logsUploaded: stats.logsUploaded,
      errors: stats.errors
    },
    fingerprinting: fingerprintStats,
    retryQueue: serverAPI.getRetryQueueSize()
  };
}

/**
 * Clear all extension data
 * Used for resetting state, useful for testing
 */
async function clearAllData() {
  try {
    await storage.clear();
    fingerprintEngine.sessionFingerprints.clear();
    fingerprintEngine.requestBuffer.clear();
    stats = { requestsProcessed: 0, logsUploaded: 0, errors: 0 };
    console.log('[APIScout] All data cleared');
  } catch (error) {
    console.error('[APIScout] Error clearing data:', error);
  }
}

// Initialize service worker on startup
initialize();

// Setup listeners when extension starts
setupWebRequestListeners();

console.log('[APIScout] Background service worker loaded');
