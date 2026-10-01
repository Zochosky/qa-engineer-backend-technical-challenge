import type { APIRequestContext } from '@playwright/test';
import { pullRequestsSchema, type PullRequest } from '../schemas/pullRequest.schema';

function getNextPage(linkHeader: string | undefined, context: string): string | undefined {
  if (!linkHeader) return undefined;
  let nextPage: string | undefined;
  for (const link of linkHeader.split(',')) {
    const match = link.trim().match(/^<([^>]+)>;\s*rel="([^"]+)"$/);
    // A malformed header must not be mistaken for the end of the dataset.
    if (!match) throw new Error(`${context}: invalid GitHub Link header: ${linkHeader}`);
    if (match[2] === 'next') {
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
  const response = await request.get(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10',
    },
    timeout: 15_000,
  }).catch((cause: unknown) => {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`${context}: request failed: ${reason}`, { cause });
  });
  if (response.status() !== 200) {
    const details: string[] = [];
    // A 403 can also mean a permission error; report headers without assuming the cause.
    if (response.status() === 403 || response.status() === 429) {
      const headers = response.headers();
      for (const name of ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset', 'retry-after']) {
        if (headers[name] !== undefined) details.push(`${name}=${headers[name]}`);
      }
      const reset = headers['x-ratelimit-reset'];
      if (reset && /^\d+$/.test(reset)) {
        const resetDate = new Date(Number(reset) * 1000);
        if (Number.isFinite(resetDate.getTime())) details.push(`reset time=${resetDate.toISOString()}`);
      }
    }
    throw new Error(
      `${context}: expected HTTP 200, received ${response.status()} ${response.statusText()}` +
      (details.length ? `; ${details.join('; ')}` : ''),
    );
  }

  const body: unknown = await response.json().catch((cause: unknown) => {
    throw new Error(`${context}: response is not valid JSON`, { cause });
  });
  const validation = pullRequestsSchema.safeParse(body);
  if (!validation.success) {
    throw new Error(`${context}: invalid pull request response\n${validation.error.message}`);
  }

  return {
    pullRequests: validation.data,
    nextUrl: getNextPage(response.headers().link, context),
  };
}

export async function getAllOpenPullRequests(
  request: Pick<APIRequestContext, 'get'>,
  owner: string,
  repository: string,
): Promise<PullRequest[]> {
  let nextUrl: string | undefined =
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/pulls?state=open&per_page=100&page=1`;
  const pullRequests: PullRequest[] = [];
  const visitedPages = new Set<string>();
  const firstPageById = new Map<number, number>();
  let pageNumber = 0;

  while (nextUrl) {
    pageNumber++;
    let pageUrl: URL;
    try {
      pageUrl = new URL(nextUrl);
    } catch (cause) {
      throw new Error(`Page ${pageNumber}: invalid pagination URL: ${nextUrl}`, { cause });
    }
    if (pageUrl.origin !== 'https://api.github.com' || pageUrl.username || pageUrl.password) {
      throw new Error(`Page ${pageNumber}: unexpected GitHub pagination URL: ${nextUrl}`);
    }
    // Parameter order and fragments must not let the same page bypass loop detection.
    pageUrl.searchParams.sort();
    pageUrl.hash = '';
    const url = pageUrl.href;
    const context = `Page ${pageNumber}, GET ${url}`;
    if (visitedPages.has(url)) throw new Error(`${context}: repeated pagination URL`);
    visitedPages.add(url);

    const page = await fetchValidatedPage(request, url, pageNumber);

    for (const pullRequest of page.pullRequests) {
      const firstPage = firstPageById.get(pullRequest.id);
      // Silently removing duplicates could hide pagination drift and an incomplete dataset.
      if (firstPage !== undefined) {
        throw new Error(
          `${context}: duplicate pull request ID ${pullRequest.id}; ` +
          `first seen on page ${firstPage}, repeated on page ${pageNumber}`,
        );
      }
      firstPageById.set(pullRequest.id, pageNumber);
      pullRequests.push(pullRequest);
    }
    // Only Link determines whether another page exists, not the number of records.
    nextUrl = page.nextUrl;
  }

  // Return only after every page succeeds; a partial list would produce a misleading count.
  return pullRequests;
}
