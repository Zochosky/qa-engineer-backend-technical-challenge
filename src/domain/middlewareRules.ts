import type { MiddlewareResponse } from '../schemas/middlewareResponse.schema';

export function validateMiddlewareRules(response: MiddlewareResponse): void {
  // Part 2 compares the entire array with the declared count, without Part 1 filtering.
  const actualCount = response.pull_requests.length;
  if (actualCount !== response.total_open_prs) {
    throw new Error(
      `total_open_prs mismatch: declared ${response.total_open_prs}, actual ${actualCount}`,
    );
  }

  for (const pullRequest of response.pull_requests) {
    if (pullRequest.labels.includes('high-priority') && pullRequest.meta.is_draft) {
      throw new Error(`PR ${pullRequest.id}: high-priority pull request must not be a draft`);
    }
  }
}
