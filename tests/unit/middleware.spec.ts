import { expect, test } from '@playwright/test';
import { validateMiddlewareRules } from '../../src/domain/middlewareRules';
import { middlewareResponseSchema, type MiddlewareResponse } from '../../src/schemas/middlewareResponse.schema';
import middlewareResponse from '../fixtures/middleware-response.json';

test('Middleware response from the challenge satisfies the business rules', async () => {
  const testData: MiddlewareResponse = structuredClone(middlewareResponse);

  const response = await test.step('Validate middleware response structure', () => {
    return middlewareResponseSchema.parse(testData);
  });

  await test.step('Validate declared count and high-priority draft rule', () => {
    expect(() => validateMiddlewareRules(response)).not.toThrow();
  });
});

test('Middleware response rejects a declared count larger than the array length', () => {
  const testData: MiddlewareResponse = structuredClone(middlewareResponse);
  testData.total_open_prs = 2;

  const response = middlewareResponseSchema.parse(testData);

  expect(() => validateMiddlewareRules(response)).toThrow(
    new Error('total_open_prs mismatch: declared 2, actual 1'),
  );
});

test('Middleware response rejects a declared count smaller than the array length', () => {
  const testData: MiddlewareResponse = structuredClone(middlewareResponse);
  testData.total_open_prs = 0;

  const response = middlewareResponseSchema.parse(testData);

  expect(() => validateMiddlewareRules(response)).toThrow(
    new Error('total_open_prs mismatch: declared 0, actual 1'),
  );
});

test('Middleware response rejects a high-priority draft after a valid PR', () => {
  const testData: MiddlewareResponse = structuredClone(middlewareResponse);
  testData.total_open_prs = 2;
  testData.pull_requests.push({
    id: 1025,
    labels: ['backend', 'high-priority'],
    meta: { is_draft: true },
  });

  const response = middlewareResponseSchema.parse(testData);

  expect(() => validateMiddlewareRules(response)).toThrow(
    new Error('PR 1025: high-priority pull request must not be a draft'),
  );
});

test('Middleware response accepts a draft without the high-priority label', () => {
  const testData: MiddlewareResponse = structuredClone(middlewareResponse);
  testData.pull_requests = [
    {
      id: 1024,
      labels: ['backend'],
      meta: { is_draft: true },
    },
  ];

  const response = middlewareResponseSchema.parse(testData);

  expect(() => validateMiddlewareRules(response)).not.toThrow();
});

test('Middleware response accepts multiple valid PRs, including a non-draft without high-priority', () => {
  const testData: MiddlewareResponse = structuredClone(middlewareResponse);
  testData.total_open_prs = 2;
  testData.pull_requests.push({
    id: 1025,
    labels: ['backend'],
    meta: { is_draft: false },
  });

  const response = middlewareResponseSchema.parse(testData);

  expect(() => validateMiddlewareRules(response)).not.toThrow();
});

test('Middleware response accepts an empty list with a declared count of zero', () => {
  const testData: MiddlewareResponse = structuredClone(middlewareResponse);
  testData.total_open_prs = 0;
  testData.pull_requests = [];

  const response = middlewareResponseSchema.parse(testData);

  expect(() => validateMiddlewareRules(response)).not.toThrow();
});
