/**
 * RequestProcessor.js
 * Request filtering, categorization, and basic processing
 * Handles: Static file filtering, request classification, tag assignment
 */

class RequestProcessor {
  constructor(config) {
    this.config = config;
  }

  /**
   * Check if a request should be completely ignored
   * @returns {boolean} true if request should be ignored
   */
  shouldIgnoreRequest(url, resourceType) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      
      // Ignore localhost and local development servers (prevents logging the dashboard itself)
      if (hostname.includes('localhost') || hostname.includes('127.0.0.1') || hostname === '[::1]') {
        return true;
      }
    } catch (e) {
      // Continue with other checks
    }

    // Check resource type first (faster than URL parsing)
    if (resourceType && this.config.IGNORE_RESOURCE_TYPES.has(resourceType)) {
      return true;
    }

    // Check URL extension
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();
      const ext = pathname.split('.').pop();

      if (this.config.IGNORE_EXTENSIONS.has(ext)) {
        return true;
      }
    } catch (e) {
      // Invalid URL, don't ignore
    }

    return false;
  }

  /**
   * Extract root domain from hostname
   * @returns {string} root domain (e.g., "example.com" from "api.example.com")
   */
  getRootDomain(hostname) {
    const parts = hostname.split('.');
    if (parts.length <= 2) return hostname;
    return parts.slice(-2).join('.');
  }

  /**
   * Check if two hostnames are on the same root domain
   * @returns {boolean} true if same root domain
   */
  isSameDomain(hostname1, hostname2) {
    return this.getRootDomain(hostname1) === this.getRootDomain(hostname2);
  }

  /**
   * Create a path skeleton for noise pattern matching
   * Replaces alphanumeric segments with 'X' for pattern matching
   * @returns {string} skeleton pattern
   */
  createSkeleton(path) {
    return path.replace(/[a-zA-Z0-9_-]+/g, 'X');
  }

  /**
   * Sanitize URL for logging (remove query params, etc.)
   * @returns {object} sanitized URL components
   */
  sanitizeUrl(urlString) {
    try {
      const url = new URL(urlString);
      const sanitizedParams = Array.from(url.searchParams.entries())
        .map(([key, value]) => ({ key, value: value.substring(0, 20) }));

      return {
        hostname: url.hostname,
        pathname: url.pathname,
        query: sanitizedParams,
        full: url.toString().substring(0, 255)
      };
    } catch (e) {
      console.error('[RequestProcessor] Failed to parse URL:', e);
      return {
        hostname: 'unknown',
        pathname: '',
        query: [],
        full: ''
      };
    }
  }

  /**
   * Extract normalized path (remove query/hash, lowercase)
   * @returns {string} normalized path
   */
  getNormalizedPath(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.toLowerCase();
    } catch (e) {
      return '';
    }
  }

  /**
   * Check if hostname is suppressed utility
   * @returns {boolean} true if suppressed
   */
  isSuppressedUtility(hostname) {
    return this.config.SUPPRESSED_UTILITIES.has(hostname.toLowerCase());
  }

  /**
   * Check if path contains action words indicating business logic
   * @returns {boolean} true if action words found
   */
  hasActionWords(path) {
    if (!path || typeof path !== 'string') return false;
    const pathLower = path.toLowerCase();
    return this.config.ACTION_WORDS.some(word => pathLower.includes(word));
  }

  /**
   * Check if HTTP method is state-changing
   * @returns {boolean} true if POST/PUT/DELETE/PATCH
   */
  isStateChangingMethod(method) {
    const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    return method && stateChangingMethods.includes(method.toUpperCase());
  }

  /**
   * Assign tags based on request characteristics
   * @returns {array} array of tag strings
   */
  assignTags(details, statusCode) {
    const tags = [];
    const hostname = details.hostname || '';
    const path = details.normalizedPath || '';
    const method = details.method || '';

    // Error indicator
    if (statusCode && String(statusCode).startsWith('5')) {
      tags.push('server-error');
    }

    // Authentication-related endpoints
    if (/login|logout|signin|signup|auth|session/i.test(path)) {
      tags.push('authentication');
    }

    // API endpoints (common path patterns)
    if (/\/api\/|\/v\d+\/|\/graphql/i.test(path)) {
      tags.push('api-endpoint');
    }

    // State-changing operations
    if (this.isStateChangingMethod(method)) {
      tags.push('state-change');
    }

    // Infrastructure/analytics
    if (/analytics|tracking|telemetry|beacon|pixel|metric/i.test(path)) {
      tags.push('infrastructure');
    }

    return tags;
  }

  /**
   * Classify request and assign tags, criticality score, etc.
   * @returns {object} classification object with tags, score, critical flag
   */
  classifyRequest(method, normalizedPath, hostname, statusCode, isPrimaryContext) {
    const tags = [];
    const path = normalizedPath ? String(normalizedPath) : '';

    // Error indicator
    if (statusCode && String(statusCode).startsWith('5')) {
      tags.push('server-error');
    }
    if (statusCode && String(statusCode).startsWith('4')) {
      tags.push('client-error');
    }

    // Authentication-related endpoints
    if (/login|logout|signin|signup|auth|session/i.test(path)) {
      tags.push('authentication');
    }

    // API endpoints (common path patterns)
    if (/\/api\/|\/v\d+\/|\/graphql/i.test(path)) {
      tags.push('api-endpoint');
    }

    // State-changing operations
    if (this.isStateChangingMethod(method)) {
      tags.push('state-change');
    }

    // Infrastructure/analytics
    if (/analytics|tracking|telemetry|beacon|pixel|metric/i.test(path)) {
      tags.push('infrastructure');
    }

    // Business logic indicators
    if (this.hasActionWords(path)) {
      tags.push('business-logic');
    }

    // Primary context (same domain as initiator)
    if (isPrimaryContext) {
      tags.push('primary-context');
    } else {
      tags.push('cross-origin');
    }

    // Calculate criticality score (0-100)
    let score = 0;
    if (this.isStateChangingMethod(method)) score += 30;
    if (this.hasActionWords(path)) score += 25;
    if (tags.includes('authentication')) score += 20;
    if (tags.includes('api-endpoint')) score += 15;
    if (statusCode && String(statusCode).startsWith('5')) score += 10;
    
    return {
      tags,
      score,
      critical: score >= 50
    };
  }
}

// Make available globally for service worker
self.RequestProcessor = RequestProcessor;

// Also export for Node/module context
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RequestProcessor;
}
