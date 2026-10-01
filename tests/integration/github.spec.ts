import { expect, test } from '@playwright/test';
import { getAllOpenPullRequests } from '../../src/api/githubClient';
import { countOpenNonDraftPullRequests } from '../../src/domain/pullRequests';

test('Count open non-draft pull requests across all GitHub pages', async ({ request }) => {
  test.setTimeout(120_000);

  const pullRequests = await test.step('Fetch and validate all pages', async () => {
    return getAllOpenPullRequests({
      get: (url, options) => test.step(
        `Fetch page ${new URL(url).searchParams.get('page')}`,
        () => request.get(url, options),
      ),
    }, 'appwrite', 'appwrite');
  });

  await test.step('Verify that all returned pull requests are open', async () => {
    const nonOpenPullRequests = pullRequests.filter((pullRequest) => pullRequest.state !== 'open');
    expect(
      nonOpenPullRequests,
      'The state=open request must not return closed pull requests',
    ).toEqual([]);
  });

  const count = countOpenNonDraftPullRequests(pullRequests);
  const draftCount = pullRequests.filter((pullRequest) => pullRequest.draft).length;
  const summary = `Count open non-draft PRs: ${count} (${pullRequests.length} fetched, ${draftCount} drafts)`;
  await test.step(summary, async () => {
    // All records were verified as open, so only drafts should be excluded.
    expect(count, 'The total must exclude every draft pull request')
      .toBe(pullRequests.length - draftCount);
  });
});
