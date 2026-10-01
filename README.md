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

## GitHub Actions

The `GitHub API check` workflow supports manual runs from the Actions tab once published on the default branch. The optional 30-minute schedule is commented out and inactive.

The workflow installs Node.js from `.nvmrc`, checks types, runs the live GitHub test, and saves its HTML report for 7 days. API requests use the automatic workflow token; no personal token is required. Local runs remain unauthenticated unless `GITHUB_API_TOKEN` is set.

After the tests finish, `reporters/github-summary.ts` displays the current counts directly in the Actions run summary through `GITHUB_STEP_SUMMARY`. The test supplies structured counters in an annotation; no extra API requests or step-title parsing are needed. Failed runs do not publish counts as confirmed results. A summary-writing error fails the run. Locally, the reporter does nothing unless `GITHUB_STEP_SUMMARY` is set.

The HTML report still contains detailed steps and counts. Results are not automatically compared between runs; a change in PR counts is not a test failure.

## Architecture

TypeScript provides static checks, Playwright Test runs the API test and generates reports, and Zod validates external data at runtime. No browser installation is needed.

- `src/api/githubClient.ts` separates fetching and validating a single page from following pagination links and checking for duplicates. It returns data only after all pages succeed and accepts the repository owner and name for reuse.
- `src/schemas/pullRequest.schema.ts` defines the fields needed for counting and derives the TypeScript type from the same schema to avoid maintaining two separate definitions.
- `src/domain/pullRequests.ts` counts only open, non-draft PRs. This pure function is independent of HTTP and reporting and does not modify its input.
- `tests/integration/github.spec.ts` defines the live scenario, assertions and report steps. Reporting stays in the test rather than the API client.

This separation allows request handling, validation rules and test expectations to change independently.

## Pagination and validation

The client requests `state=open` with up to 100 PRs per page and follows `rel="next"` in GitHub's `Link` header until it is absent. It does not infer the next page from the number of returned records.

Every page must return HTTP 200 and valid JSON. Zod checks a positive integer `id`, a `state` of `open` or `closed`, and a boolean `draft`. The test separately verifies that the `state=open` filter was respected. Values are not normalized; for example, `OPEN` does not satisfy the schema.

After fetching, the business rule counts PRs with `state === 'open'` and `draft === false`. The report's counting step shows the result, total fetched and drafts excluded. Since the test has verified that all records are open, it checks that the count equals the number fetched minus the number of drafts. This consistency check uses the same dataset; it is not an independent source of the repository's total.

Request failures, invalid responses, repeated page URLs and duplicate PR IDs stop the operation instead of producing a partial or potentially misleading result. Duplicate detection covers both a single page and different pages. Errors include the page and request URL; duplicate errors identify both occurrences' pages.

For HTTP 403 or 429, errors also include available rate-limit and retry headers, with the reset timestamp translated to UTC. A 403 is not automatically classified as a rate-limit failure, and no automatic retry is performed.

## Assumptions and limitations

- An empty list is valid. The live test does not assert a fixed number of PRs.
- Validation covers fields needed by the business rule, not the entire GitHub response. Additional fields are accepted and omitted from the parsed result.
- The Link parser currently supports the format used in GitHub's pagination examples; it is not a general-purpose parser for every valid Link header variant.
- GitHub data can change between requests. Following all pages does not provide an atomic snapshot, and duplicate detection cannot reveal every omission caused by concurrent changes.
- The test requires internet access. GitHub availability and API rate limits can cause failures, even with the optional token. Requests have a 15-second timeout; the test has a 120-second timeout. No automatic retries are configured.
- The current suite contains one live integration test. It does not reproducibly exercise every error-handling branch.

## Current scope

Part 1 fetches and validates all pages of open PRs and counts those that are not drafts. A manual GitHub Actions workflow is prepared; scheduled execution is disabled. Part 2 (middleware business rules) is pending.
