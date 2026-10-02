import { expect, test } from '@playwright/test';
import { validateMiddlewareRules } from '../../src/domain/middlewareRules';
import { middlewareResponseSchema } from '../../src/schemas/middlewareResponse.schema';
import middlewareResponse from '../fixtures/middleware-response.json';

test('Middleware response from the challenge satisfies the business rules', async () => {
  const response = await test.step('Validate middleware response structure', () => {
    return middlewareResponseSchema.parse(middlewareResponse);
  });

  await test.step('Validate declared count and high-priority draft rule', () => {
    expect(() => validateMiddlewareRules(response)).not.toThrow();
  });
});

test('Middleware response rejects a declared count that differs from the array length', () => {
  const response = middlewareResponseSchema.parse({
    ...middlewareResponse,
    total_open_prs: 2,
  });

  expect(() => validateMiddlewareRules(response)).toThrow(
    new Error('total_open_prs mismatch: declared 2, actual 1'),
  );
});

test('Middleware response rejects a high-priority draft after a valid PR', () => {
  const response = middlewareResponseSchema.parse({
    ...middlewareResponse,
    total_open_prs: 2,
    pull_requests: [
      ...middlewareResponse.pull_requests,
      {
        id: 1025,
        labels: ['high-priority'],
        meta: { is_draft: true },
      },
    ],
  });

  expect(() => validateMiddlewareRules(response)).toThrow(
    new Error('PR 1025: high-priority pull request must not be a draft'),
  );
});

test('Middleware response accepts a draft without the high-priority label', () => {
  const response = middlewareResponseSchema.parse({
    ...middlewareResponse,
    pull_requests: [
      {
        id: 1024,
        labels: ['backend'],
        meta: { is_draft: true },
      },
    ],
  });

  expect(() => validateMiddlewareRules(response)).not.toThrow();
});

test('Middleware response accepts an empty list with a declared count of zero', () => {
  const response = middlewareResponseSchema.parse({
    ...middlewareResponse,
    total_open_prs: 0,
    pull_requests: [],
  });

  expect(() => validateMiddlewareRules(response)).not.toThrow();
});
