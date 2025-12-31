/**
 * ExtensionFilter.js
 * Simplified: Basic request filtering only (no tagging/classification)
 */

const crypto = require('crypto');

class ExtensionFilter {
  // Static file extensions that should never be logged
  static IGNORE_EXTENSIONS = new Set([
    'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp',     // Images
    'css',                                            // Stylesheets
    'woff', 'woff2', 'ttf', 'eot', 'otf',            // Fonts
    'mp4', 'mp3', 'webm', 'ogg', 'm4a', 'aac', 'flac', // Media
    'ico', 'map',                                     // Icons, sourcemaps
    'zip', 'tar', 'gz', '7z', 'rar',                 // Archives
    'pdf', 'doc', 'docx', 'xls', 'xlsx'              // Documents
  ]);

  // Telemetry/tracking patterns for obvious filtering
  static NOISE_PATTERNS = [
    /\/xjs\//,
    /\/_\/js\//,
    /\/collect/,
    /\/log\?/,
    /\$rpc\/google\.internal/,
    /\/gen_204/,
    /\/fp_204/,
    /\/complete\/search/,
    /\/js\//,
    /\/css\//,
    /\/images?\//,
    /\/static\//,
    /\/assets\//,
    /\/fonts?\//
  ];

  /**
   * First-pass check: Should this request be completely ignored?
   * Returns true if request should be filtered out immediately
   */
  static shouldIgnore(method, hostname, normalizedPath) {
    // Check static file extension
    const ext = normalizedPath.split('.').pop().toLowerCase();
    if (this.IGNORE_EXTENSIONS.has(ext)) {
      return true;
    }

    // Check obvious noise patterns
    if (this.NOISE_PATTERNS.some((pattern) => pattern.test(normalizedPath))) {
      return true;
    }

    return false;
  }

  /**
   * Generate SHA-256 fingerprint from method + hostname + normalizedPath
   * Used for deduplication
   */
  static generateFingerprint(method, hostname, normalizedPath) {
    const combined = `${method}:${hostname}:${normalizedPath}`;
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  /**
   * Extract root domain for clustering
   */
  static getRootDomain(hostname) {
    const parts = hostname.split('.');
    if (parts.length <= 2) return hostname;
    return parts.slice(-2).join('.');
  }
}

module.exports = ExtensionFilter;
