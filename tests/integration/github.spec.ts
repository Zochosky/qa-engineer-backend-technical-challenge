import { expect, test } from '@playwright/test';
import { getOpenPullRequestsPage } from '../../src/api/githubClient';
import { pullRequestsSchema } from '../../src/schemas/pullRequest.schema';

test('GitHub returns a valid first page of open pull requests', async ({ request }) => {
  const body = await test.step('Fetch the first page of open pull requests', async () => {
    return getOpenPullRequestsPage(request, 'appwrite', 'appwrite');
  });

  const pullRequests = await test.step('Validate the response schema', async () => {
    const validation = pullRequestsSchema.safeParse(body);

    if (!validation.success) {
      throw new Error(`Invalid GitHub pull request response:\n${validation.error.message}`);
    }

    return validation.data;
  });

  await test.step('Verify that all returned pull requests are open', async () => {
    const nonOpenPullRequests = pullRequests.filter((pullRequest) => pullRequest.state !== 'open');
    expect(
      nonOpenPullRequests,
      'The state=open request must not return closed pull requests',
    ).toEqual([]);
  });

});
