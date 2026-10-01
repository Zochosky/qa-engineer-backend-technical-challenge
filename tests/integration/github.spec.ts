import { expect, test } from '@playwright/test';
import { getOpenPullRequestsPage } from '../../src/api/githubClient';
import { pullRequestsSchema } from '../../src/schemas/pullRequest.schema';

test('GitHub returns a valid first page of open pull requests', async ({ request }) => {
  const body = await getOpenPullRequestsPage(request, 'appwrite', 'appwrite');
  const validation = pullRequestsSchema.safeParse(body);

  if (!validation.success) {
    throw new Error(`Invalid GitHub pull request response:\n${validation.error.message}`);
  }

  const nonOpenPullRequests = validation.data.filter((pullRequest) => pullRequest.state !== 'open');
  expect(
    nonOpenPullRequests,
    'The state=open request must not return closed pull requests',
  ).toEqual([]);

  console.info(
    `appwrite/appwrite | page=1 | received=${validation.data.length} PRs | schema=valid | non-open=0`,
  );
});
