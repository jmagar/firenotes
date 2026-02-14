/**
 * URL utility functions.
 */

/**
 * SEC-04: Private/internal IP ranges that should be blocked for SSRF protection.
 *
 * Covers RFC 1918, RFC 4193, loopback, link-local, and cloud metadata endpoints.
 */
const BLOCKED_IP_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  { pattern: /^127\./, description: 'loopback (127.x.x.x)' },
  { pattern: /^10\./, description: 'private (10.x.x.x)' },
  {
    pattern: /^172\.(1[6-9]|2\d|3[01])\./,
    description: 'private (172.16-31.x.x)',
  },
  { pattern: /^192\.168\./, description: 'private (192.168.x.x)' },
  { pattern: /^169\.254\./, description: 'link-local (169.254.x.x)' },
  { pattern: /^0\./, description: 'current network (0.x.x.x)' },
  { pattern: /^::1$/, description: 'IPv6 loopback' },
  { pattern: /^fc00:/i, description: 'IPv6 unique local' },
  { pattern: /^fd/i, description: 'IPv6 unique local' },
  { pattern: /^fe80:/i, description: 'IPv6 link-local' },
];

/** Hostnames commonly used for cloud metadata services */
const BLOCKED_HOSTNAMES = new Set([
  'metadata.google.internal',
  'metadata.google',
  'metadata',
]);

/**
 * SEC-04: Check if a URL targets an internal/private address.
 *
 * Returns a description of the issue if the URL is unsafe, or null if it's safe.
 * Does NOT resolve DNS -- checks the literal hostname/IP in the URL.
 */
export function checkUrlSafety(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'Invalid URL format';
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block cloud metadata endpoints
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return `Blocked hostname: ${hostname} (cloud metadata endpoint)`;
  }

  // Block the AWS/Azure metadata IP directly
  if (hostname === '169.254.169.254') {
    return 'Blocked: cloud metadata endpoint (169.254.169.254)';
  }

  // Strip IPv6 brackets for pattern matching
  const cleanHost = hostname.replace(/^\[|\]$/g, '');

  // Check against blocked IP patterns
  for (const { pattern, description } of BLOCKED_IP_PATTERNS) {
    if (pattern.test(cleanHost)) {
      return `Blocked: ${description}`;
    }
  }

  // Block localhost variants
  if (hostname === 'localhost' || hostname === 'localhost.localdomain') {
    return 'Blocked: localhost';
  }

  return null;
}

/**
 * SEC-04: Warn if a URL targets an internal address.
 *
 * Returns true if the URL is safe, false if it targets an internal address.
 * Logs a warning to stderr when the URL is blocked.
 */
export function warnIfInternalUrl(url: string): boolean {
  const issue = checkUrlSafety(url);
  if (issue) {
    console.error(`Warning: URL may target an internal resource: ${issue}`);
    console.error(`  URL: ${url}`);
    console.error(
      '  Use --allow-internal to bypass this check if intentional.'
    );
    return false;
  }
  return true;
}

/**
 * Check if a string looks like a URL (with or without protocol).
 */
export function isUrl(str: string): boolean {
  // If it has a protocol, validate it.
  if (/^https?:\/\//i.test(str)) {
    try {
      const url = new URL(str);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  // Check if it looks like a domain (has dots and valid characters).
  // Exclude common commands and flags.
  if (str.includes('.') && !str.startsWith('-') && !str.includes(' ')) {
    const domainPattern =
      /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}(\/.*)?$/;
    return domainPattern.test(str);
  }

  return false;
}

/**
 * Normalize URL by adding https:// if missing.
 */
export function normalizeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  return `https://${url}`;
}

/**
 * Extract hostname/domain from URL text.
 *
 * Returns "unknown" when parsing fails.
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}
