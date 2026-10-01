import { expect, test } from '@playwright/test';
import { getAllOpenPullRequests } from '../../src/api/githubClient';

test('GitHub returns valid open pull requests across all pages', async ({ request }) => {
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
});
