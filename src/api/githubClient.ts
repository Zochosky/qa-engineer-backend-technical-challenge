import type { APIRequestContext } from '@playwright/test';
import { pullRequestsSchema, type PullRequest } from '../schemas/pullRequest.schema';

function getNextPage(linkHeader: string | undefined, context: string): string | undefined {
  if (!linkHeader) return undefined;
  let nextPage: string | undefined;
  for (const link of linkHeader.split(',')) {
    const match = link.trim().match(/^<([^>]+)>;\s*rel="([^"]+)"$/);
    // A malformed header must not be mistaken for the end of the dataset.
    if (!match) throw new Error(`${context}: invalid GitHub Link header: ${linkHeader}`);
    // A link can identify the same page as both next and last.
    const relations = match[2]?.split(/\s+/) ?? [];
    if (relations.includes('next')) {
      if (nextPage) throw new Error(`${context}: multiple next links in GitHub Link header`);
      nextPage = match[1];
    }
  }
  return nextPage;
}

async function fetchValidatedPage(
  request: Pick<APIRequestContext, 'get'>,
  url: string,
  pageNumber: number,
) {
  const context = `Page ${pageNumber}, GET ${url}`;
  const token = process.env.GITHUB_API_TOKEN;
  const response = await request.get(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    timeout: 15_000,
  });

  if (response.status() !== 200) {
    throw new Error(
      `${context}: expected HTTP 200, received ${response.status()} ${response.statusText()}`,
    );
  }

  return {
    pullRequests: pullRequestsSchema.parse(await response.json()),
    nextUrl: getNextPage(response.headers().link, context),
  };
}

/**
 * Fetches pull requests with state=open, including drafts.
 * Follows rel="next" links to fetch and validate each page.
 * Stops with an error if a response or pagination URL is invalid,
 * pages are out of sequence, or a duplicate PR ID is found.
 * Returns the collected records only after all pages succeed.
 *
 * @example
 * const pullRequests = await getAllOpenPullRequests(request, 'appwrite', 'appwrite');
 */
export async function getAllOpenPullRequests(
  request: Pick<APIRequestContext, 'get'>,
  owner: string,
  repository: string,
): Promise<PullRequest[]> {
  let nextUrl: string | undefined =
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/pulls?state=open&per_page=100&page=1`;

  const pullRequests: PullRequest[] = [];
  const seenIds = new Set<number>();
  let pageNumber = 1;

  while (nextUrl) {
    const pageUrl = new URL(nextUrl);
    const context = `Page ${pageNumber}, GET ${nextUrl}`;
    if (pageUrl.origin !== 'https://api.github.com') {
      throw new Error(`${context}: unexpected pagination URL`);
    }

    // Expect pages 1, 2, 3... regardless of whether the path uses a repository name or ID.
    const pages = pageUrl.searchParams.getAll('page');
    if (pages.length !== 1 || pages[0] !== String(pageNumber)) {
      throw new Error(`${context}: expected pagination page ${pageNumber}`);
    }

    const page = await fetchValidatedPage(request, nextUrl, pageNumber);
    for (const pullRequest of page.pullRequests) {
      if (seenIds.has(pullRequest.id)) {
        throw new Error(`${context}: duplicate pull request ID ${pullRequest.id}`);
      }
      seenIds.add(pullRequest.id);
      pullRequests.push(pullRequest);
    }
    // Only Link determines whether another page exists, not the number of records.
    nextUrl = page.nextUrl;
    pageNumber++;
  }

  // Return only after every page succeeds; a partial list would produce a misleading count.
  return pullRequests;
}
