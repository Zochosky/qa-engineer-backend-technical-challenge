import type { MiddlewareResponse } from '../schemas/middlewareResponse.schema';

/**
 * Validates two business rules:
 * - The pull_requests count must match total_open_prs.
 * - Pull requests labeled "high-priority" must not be drafts.
 *
 * Throws an error with the mismatched counts or the offending PR ID.
 */
export function validateMiddlewareRules(response: MiddlewareResponse): void {
  // Drafts are included because the declared count covers the entire array.
  const actualCount = response.pull_requests.length;

  if (actualCount !== response.total_open_prs) {
    throw new Error(
      `total_open_prs mismatch: declared ${response.total_open_prs}, actual ${actualCount}`,
    );
  }

  for (const pullRequest of response.pull_requests) {
    if (pullRequest.labels.includes('high-priority') && pullRequest.meta.is_draft) {
      throw new Error(
        `PR ${pullRequest.id}: high-priority pull request must not be a draft`,
      );
    }
  }
}
