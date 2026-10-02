import { expect, test } from '@playwright/test';
import { middlewareResponseSchema } from '../../src/schemas/middlewareResponse.schema';
import middlewareResponse from '../fixtures/middleware-response.json';

test('Middleware response from the challenge matches the required structure', () => {
  const validation = middlewareResponseSchema.safeParse(middlewareResponse);

  expect(
    validation.success,
    `Invalid middleware response:\n${validation.error?.message ?? ''}`,
  ).toBe(true);
});
