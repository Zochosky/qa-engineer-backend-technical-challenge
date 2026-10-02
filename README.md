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

## Run the tests

```sh
npm test
```

To run only the middleware tests, without calling GitHub:

```sh
npm test -- tests/unit/middleware.spec.ts
```

After the test run finishes, Playwright generates an HTML report in `playwright-report/` with results, steps, timings and failure details. Open the latest report with:

```sh
npm run report
```

Generated reports are ignored by Git.

## GitHub Actions

The `PR MONITOR` workflow runs every hour at minute 17 (UTC), every day, on the default branch. Manual runs remain available from the Actions tab. GitHub may delay scheduled runs; the schedule is not an exact-time guarantee.

To stop automatic runs while keeping manual execution, remove the `schedule` block from `.github/workflows/github-api.yml` and push the change to the default branch. To pause the entire workflow immediately, use Actions → PR MONITOR → workflow options → Disable workflow.

The workflow installs Node.js from `.nvmrc`, checks types, runs the live GitHub test, and saves its HTML report for 7 days. API requests use the automatic workflow token; no personal token is required. Local runs remain unauthenticated unless `GITHUB_API_TOKEN` is set.

After the tests finish, `reporters/github-summary.ts` displays the current counts directly in the Actions run summary through `GITHUB_STEP_SUMMARY`. The test supplies structured counters in an annotation; no extra API requests or step-title parsing are needed. Failed runs do not publish counts as confirmed results. A summary-writing error fails the run. Locally, the reporter does nothing unless `GITHUB_STEP_SUMMARY` is set.

The HTML report still contains detailed steps and counts. Results are not automatically compared between runs; a change in PR counts is not a test failure.

The `UNIT TESTS` workflow runs on pushes to `main`, pull requests targeting `main`, and manual dispatch. It uses Node.js from `.nvmrc`, installs dependencies with `npm ci`, checks types, and runs `npm test -- tests/unit`. Tests do not call GitHub's API or require an API token.

The unit test job has a 5-minute timeout. A newer run cancels an earlier run for the same branch or pull request. Generated HTML reports are saved as the `unit-test-report` artifact for 7 days, including after test failures; cancelled runs skip the upload.

## Architecture

TypeScript provides static checks, Playwright Test runs the tests and generates reports, and Zod validates external data at runtime. No browser installation is needed.

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
- The live GitHub test requires internet access. GitHub availability and API rate limits can cause failures, even with the optional token. Requests have a 15-second timeout; the test has a 120-second timeout. No automatic retries are configured.
- The current suite contains one live integration test. It does not reproducibly exercise every error-handling branch.

## Current scope

Part 1 fetches and validates all pages of open PRs and counts those that are not drafts. GitHub Actions supports hourly and manual execution.

Part 2 validates the supplied middleware fixture with Zod, then checks the declared count and the high-priority draft rule in `src/domain/middlewareRules.ts`. The count covers the entire array, as specified in Part 2; Part 1 filtering is not applied. The function reports the first violation with declared/actual counts or the offending PR ID.

### Middleware test coverage

The seven tests in `tests/unit/middleware.spec.ts` use the supplied fixture and controlled variations, without calling a middleware service. Zod checks the fields used by the rules and error messages before business validation runs.

| Case | Input | Expected result |
| --- | --- | --- |
| Provided PDF response | One high-priority, non-draft PR; declared count `1` | Accept |
| Declared count too high | One PR; declared count `2` | Reject with declared and actual counts |
| Declared count too low | One PR; declared count `0` | Reject with declared and actual counts |
| High-priority draft | Valid first PR, then a draft with labels `["backend", "high-priority"]`; declared count `2` | Reject with the second PR's ID; checks beyond the first PR and first label |
| Draft without high-priority | One draft with the `backend` label; declared count `1` | Accept; Part 2 allows this draft and includes it in the array count |
| Multiple valid PRs | Two non-draft PRs, one with high-priority and one without; declared count `2` | Accept both combinations in one response |
| Empty response | Empty array; declared count `0` | Accept |

Negative cases pass only when the validator throws the expected error message. Together, the cases cover both directions of count mismatch and all four combinations of high-priority label presence and draft status.
