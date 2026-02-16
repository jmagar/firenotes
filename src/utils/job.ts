/**
 * Utility functions for job ID detection and validation
 */

/**
 * Check if a string looks like a UUID/job ID
 * Axon job IDs are UUIDs (e.g., "550e8400-e29b-41d4-a716-446655440000")
 */
export function isJobId(str: string): boolean {
  // Match any UUID format (v1-v7) — self-hosted backend uses UUID v7
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(str);
}

/**
 * Check if a string is a valid URL
 */
export function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract job ID from a string that could be a raw ID or a URL containing an ID
 * Supports both raw UUIDs and URLs like https://api.firecrawl.dev/v1/extract/550e8400-...
 *
 * @param input - Raw job ID or URL containing job ID
 * @returns Normalized job ID
 */
export function normalizeJobId(input: string): string {
  // Already a job ID - return as-is
  if (isJobId(input)) {
    return input;
  }

  // Try to extract from URL
  if (isValidUrl(input)) {
    const url = new URL(input);
    const pathSegments = url.pathname.split('/').filter(Boolean);

    // Find a UUID in the path segments
    for (const segment of pathSegments) {
      if (isJobId(segment)) {
        return segment;
      }
    }
  }

  // Not a URL or no job ID found - return as-is and let caller validate
  return input;
}
