# QA Engineer Backend Technical Challenge

A backend testing exercise covering GitHub pull request counting and middleware response validation.

## Requirements

- Node.js 24
- npm

## Setup

```sh
npm ci
npm run typecheck
```

## Run the test

```sh
npm test
```

After the test run finishes, Playwright generates an HTML report in `playwright-report/` with results, steps, timings and failure details. Open the latest report with:

```sh
npm run report
```

Generated reports are ignored by Git.

## Architecture

TypeScript provides static checks, Playwright Test runs the API test and generates reports, and Zod validates external data at runtime. No browser installation is needed.

- `src/api/githubClient.ts` handles HTTP requests and pagination, returning validated data only after all pages succeed. It accepts the repository owner and name so it can be reused for other GitHub repositories.
- `src/schemas/pullRequest.schema.ts` defines the fields needed for counting and derives the TypeScript type from the same schema to avoid maintaining two separate definitions.
- `tests/integration/github.spec.ts` defines the live scenario, assertions and report steps. Reporting stays in the test rather than the API client.

This separation allows request handling, validation rules and test expectations to change independently.

## Pagination and validation

The client requests `state=open` with up to 100 PRs per page and follows `rel="next"` in GitHub's `Link` header until it is absent. It does not infer the next page from the number of returned records.

Every page must return HTTP 200 and valid JSON. Zod checks a positive integer `id`, a `state` of `open` or `closed`, and a boolean `draft`. The test separately verifies that the `state=open` filter was respected. Values are not normalized; for example, `OPEN` does not satisfy the schema.

Request failures, invalid responses, repeated page URLs and duplicate PR IDs stop the operation instead of producing a partial or potentially misleading result. Duplicate detection covers both a single page and different pages. Errors include the page and request URL; duplicate errors identify both occurrences' pages.

## Assumptions and limitations

- An empty list is valid. The live test does not assert a fixed number of PRs.
- Validation covers fields needed by the business rule, not the entire GitHub response. Additional fields are accepted and omitted from the parsed result.
- The Link parser currently supports the format used in GitHub's pagination examples; it is not a general-purpose parser for every valid Link header variant.
- GitHub data can change between requests. Following all pages does not provide an atomic snapshot, and duplicate detection cannot reveal every omission caused by concurrent changes.
- The test requires internet access and uses unauthenticated requests, so GitHub availability and API rate limits can cause failures. Requests have a 15-second timeout; the test has a 120-second timeout. No automatic retries are configured.
- The current suite contains one live integration test. It does not reproducibly exercise every error-handling branch.

## Current scope

Part 1 currently fetches and validates all pages of open PRs. Drafts remain in the returned list; counting open, non-draft PRs is not implemented yet. Part 2 (middleware business rules) and GitHub Actions are also pending.
