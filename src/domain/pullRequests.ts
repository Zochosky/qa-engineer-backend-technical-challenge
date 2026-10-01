import type { PullRequest } from '../schemas/pullRequest.schema';

export function countOpenNonDraftPullRequests(pullRequests: readonly PullRequest[]): number {
  // Check both conditions so the rule also works with data not filtered by GitHub.
  return pullRequests.filter((pullRequest) => pullRequest.state === 'open' && !pullRequest.draft).length;
}
