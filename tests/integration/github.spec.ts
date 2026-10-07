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

  const nonDraftCount = countOpenNonDraftPullRequests(pullRequests);

  const fetchedCount = pullRequests.length;
  const draftPullRequests = pullRequests.filter((pr) => pr.draft);
  const draftCount = draftPullRequests.length;
  const expectedNonDraftCount = fetchedCount - draftCount;

  const summary =
    `Count open non-draft PRs: ${nonDraftCount} ` +
    `(${fetchedCount} fetched, ${draftCount} drafts)`;

  await test.step(summary, async () => {
    expect(
      nonDraftCount,
      'The total must exclude every draft pull request',
    ).toBe(expectedNonDraftCount);
  });

  const counts = {
    fetched: fetchedCount,
    drafts: draftCount,
    nonDrafts: nonDraftCount,
  };

  testInfo.annotations.push({
    type: '_pr-counts',
    description: JSON.stringify(counts),
  });
});
