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
