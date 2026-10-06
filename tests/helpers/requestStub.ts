import type { APIRequestContext, APIResponse } from '@playwright/test';

type StubResponse = {
  body: unknown;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
};

export function createRequestStub(responses: StubResponse[]) {
  const requestedUrls: string[] = [];
  const request: Pick<APIRequestContext, 'get'> = {
    async get(url) {
      const response = responses[requestedUrls.length];
      requestedUrls.push(url);
      if (!response) throw new Error(`Unexpected GET request: ${url}`);

      const apiResponse: Pick<APIResponse, 'status' | 'statusText' | 'headers' | 'json'> = {
        status: () => response.status ?? 200,
        statusText: () => response.statusText ?? 'OK',
        headers: () => response.headers ?? {},
        json: async () => response.body,
      };

      // The stub implements only the response methods used by the GitHub client.
      return apiResponse as APIResponse;
    },
  };

  return { request, requestedUrls };
}
