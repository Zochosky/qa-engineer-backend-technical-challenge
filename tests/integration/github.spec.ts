import { expect, test } from '@playwright/test';
import { getAllOpenPullRequests } from '../../src/api/githubClient';
import { countOpenNonDraftPullRequests } from '../../src/domain/pullRequests';
import { createRequestWithPageSteps } from '../helpers/requestWithPageSteps';

test('Count open non-draft pull requests across all GitHub pages', { tag: '@github-api' }, async ({ request }, testInfo) => {
  const requestWithSteps = createRequestWithPageSteps(request);
  const pullRequests = await test.step(
    'Fetch and validate all pages',
    () => getAllOpenPullRequests(requestWithSteps, 'appwrite', 'appwrite'),
  );

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
    expect(count, 'The total must exclude every draft pull request')
      .toBe(pullRequests.length - draftCount);
  });

  testInfo.annotations.push({
    type: '_pr-counts',
    description: JSON.stringify({ fetched: pullRequests.length, drafts: draftCount, nonDrafts: count }),
  });
});
