import { test, type APIRequestContext } from '@playwright/test';

type RequestClient = Pick<APIRequestContext, 'get'>;

/**
 * Runs each GET request through the original client and adds a report step.
 * Example: https://api.github.com/repos/appwrite/appwrite/pulls?page=2
 * appears in the report as "Fetch page 2".
 */
export function createRequestWithPageSteps(client: RequestClient): RequestClient {
  return {
    get(url, options) {
      const pageNumber = new URL(url).searchParams.get('page');

      return test.step(
        `Fetch page ${pageNumber}`,
        () => client.get(url, options),
      );
    },
  };
}