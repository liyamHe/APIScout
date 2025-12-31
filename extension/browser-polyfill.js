/**
 * browser-polyfill.js
 * Compatibility layer for Chrome and Firefox extensions
 * Ensures chrome.* namespace works in both browsers
 */

// Create a unified API namespace that works in both Chrome and Firefox
if (typeof chrome === 'undefined' || !chrome.runtime) {
  if (typeof browser !== 'undefined') {
    // Firefox: Alias browser to chrome
    window.chrome = browser;
  }
}

// Export for use in modular contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.chrome;
}
