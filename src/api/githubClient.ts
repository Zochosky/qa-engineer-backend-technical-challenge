import type { APIRequestContext } from '@playwright/test';

export async function getOpenPullRequestsPage(
  request: APIRequestContext,
  owner: string,
  repository: string,
): Promise<unknown> {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/pulls`;
  const response = await request.get(url, {
    params: { state: 'open', per_page: 100, page: 1 },
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10',
    },
    timeout: 15_000,
  });

  if (response.status() !== 200) {
    throw new Error(
      `GET ${response.url()}: expected HTTP 200, received ${response.status()} ${response.statusText()}`,
    );
  }

  try {
    return await response.json();
  } catch (cause) {
    throw new Error(`GET ${response.url()}: response is not valid JSON`, { cause });
  }
}
