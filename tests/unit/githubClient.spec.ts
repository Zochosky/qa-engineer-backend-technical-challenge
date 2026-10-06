import { expect, test } from '@playwright/test';
import { getAllOpenPullRequests } from '../../src/api/githubClient';
import { createRequestStub } from '../helpers/requestStub';

// Only HTTP responses are stubbed; the real client's pagination, validation and error handling run here.
const firstPageUrl = 'https://api.github.com/repos/appwrite/appwrite/pulls?page=1&per_page=100&state=open';
const secondPageUrl = 'https://api.github.com/repos/appwrite/appwrite/pulls?page=2&per_page=100&state=open';

test('GitHub client follows the next link and returns both pages, including drafts', async () => {
  const firstPullRequest = { id: 101, state: 'open', draft: false };
  const secondPullRequest = { id: 102, state: 'open', draft: true };
  const { request, requestedUrls } = createRequestStub([
    {
      // A short page is not the end of the dataset when a next link exists.
      body: [firstPullRequest],
      headers: { link: `<${secondPageUrl}>; rel="next"` },
    },
    {
      body: [secondPullRequest],
      headers: { link: `<${firstPageUrl}>; rel="prev"` },
    },
  ]);

  const pullRequests = await getAllOpenPullRequests(request, 'appwrite', 'appwrite');

  expect(pullRequests).toEqual([firstPullRequest, secondPullRequest]);
  expect(requestedUrls).toEqual([firstPageUrl, secondPageUrl]);
});

test('GitHub client rejects page two with HTTP 429 without returning partial data or retrying', async () => {
  const { request, requestedUrls } = createRequestStub([
    {
      body: [{ id: 101, state: 'open', draft: false }],
      headers: { link: `<${secondPageUrl}>; rel="next"` },
    },
    {
      body: { message: 'API rate limit exceeded' },
      status: 429,
      statusText: 'Too Many Requests',
      headers: { 'retry-after': '60' },
    },
  ]);

  await expect(getAllOpenPullRequests(request, 'appwrite', 'appwrite')).rejects.toThrow(
    new Error(
      `Page 2, GET ${secondPageUrl}: expected HTTP 200, received 429 Too Many Requests; retry-after=60`,
    ),
  );
  expect(requestedUrls).toEqual([firstPageUrl, secondPageUrl]);
});

test('GitHub client rejects page two with HTTP 403 and reports rate-limit details without retrying', async () => {
  const { request, requestedUrls } = createRequestStub([
    {
      body: [{ id: 101, state: 'open', draft: false }],
      headers: { link: `<${secondPageUrl}>; rel="next"` },
    },
    {
      body: { message: 'API rate limit exceeded' },
      status: 403,
      statusText: 'Forbidden',
      headers: {
        'x-ratelimit-limit': '60',
        'x-ratelimit-remaining': '0',
        // A fixed timestamp makes the reset-time diagnostic independent of the current clock.
        'x-ratelimit-reset': '1700000000',
      },
    },
  ]);

  await expect(getAllOpenPullRequests(request, 'appwrite', 'appwrite')).rejects.toThrow(
    new Error(
      `Page 2, GET ${secondPageUrl}: expected HTTP 200, received 403 Forbidden; ` +
      'x-ratelimit-limit=60; x-ratelimit-remaining=0; x-ratelimit-reset=1700000000; ' +
      'reset time=2023-11-14T22:13:20.000Z',
    ),
  );
  expect(requestedUrls).toEqual([firstPageUrl, secondPageUrl]);
});

test('GitHub client rejects HTTP 403 without inventing missing rate-limit details or retrying', async () => {
  const { request, requestedUrls } = createRequestStub([
    {
      body: { message: 'Resource not accessible by integration' },
      status: 403,
      statusText: 'Forbidden',
    },
  ]);

  await expect(getAllOpenPullRequests(request, 'appwrite', 'appwrite')).rejects.toThrow(
    new Error(`Page 1, GET ${firstPageUrl}: expected HTTP 200, received 403 Forbidden`),
  );
  expect(requestedUrls).toEqual([firstPageUrl]);
});

test('GitHub client stops a pagination cycle before requesting the same page again', async () => {
  const { request, requestedUrls } = createRequestStub([
    {
      body: [{ id: 101, state: 'open', draft: false }],
      headers: { link: `<${secondPageUrl}>; rel="next"` },
    },
    {
      body: [{ id: 102, state: 'open', draft: false }],
      headers: { link: `<${firstPageUrl}>; rel="next"` },
    },
  ]);

  await expect(getAllOpenPullRequests(request, 'appwrite', 'appwrite')).rejects.toThrow(
    new Error(`Page 3, GET ${firstPageUrl}: repeated pagination URL`),
  );
  expect(requestedUrls).toEqual([firstPageUrl, secondPageUrl]);
});

test('GitHub client rejects a repeated PR ID across pages even when its fields change', async () => {
  const { request, requestedUrls } = createRequestStub([
    {
      body: [{ id: 101, state: 'open', draft: false }],
      headers: { link: `<${secondPageUrl}>; rel="next"` },
    },
    {
      body: [
        { id: 102, state: 'open', draft: false },
        { id: 101, state: 'open', draft: true },
      ],
    },
  ]);

  await expect(getAllOpenPullRequests(request, 'appwrite', 'appwrite')).rejects.toThrow(
    new Error(
      `Page 2, GET ${secondPageUrl}: duplicate pull request ID 101; first seen on page 1, repeated on page 2`,
    ),
  );
  expect(requestedUrls).toEqual([firstPageUrl, secondPageUrl]);
});

test('GitHub client follows next when a Link has multiple relation types', async () => {
  const firstPullRequest = { id: 101, state: 'open', draft: false };
  const secondPullRequest = { id: 102, state: 'open', draft: false };
  const { request, requestedUrls } = createRequestStub([
    {
      body: [firstPullRequest],
      // Regression: matching the entire rel value previously stopped pagination at this link.
      headers: { link: `<${secondPageUrl}>; rel="next last"` },
    },
    {
      body: [secondPullRequest],
    },
  ]);

  const pullRequests = await getAllOpenPullRequests(request, 'appwrite', 'appwrite');

  expect(pullRequests).toEqual([firstPullRequest, secondPullRequest]);
  expect(requestedUrls).toEqual([firstPageUrl, secondPageUrl]);
});
