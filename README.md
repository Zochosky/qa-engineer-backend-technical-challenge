# QA Engineer Backend Technical Challenge

- **Part 1:** One live integration test fetches all pages of open PRs from `appwrite/appwrite`, validates the response fields and counts non-draft PRs.
- **Part 2:** Seven unit tests validate the supplied middleware response and variations of it against the two business rules.

## Setup

Requires Node.js 24 (specified in `.nvmrc`) and npm. Run commands from the repository root:

```sh
npm ci
```

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | Check TypeScript types |
| `npm test` | Run all tests, including live GitHub API requests |
| `npm test -- tests/unit` | Run Part 2 without external API calls |
| `npm test -- tests/integration` | Run Part 1 against current GitHub data |
| `npm run report` | Open the latest HTML report |

No browser installation is needed. Live API requests are unauthenticated unless `GITHUB_API_TOKEN` is set.

## Architecture

Playwright provides HTTP requests and one test runner with shared reporting for both parts. TypeScript checks types during development; Zod validates input data at runtime and supplies inferred types.

- `src/api/`: GitHub requests, page validation, pagination and duplicate detection.
- `src/schemas/`: Fields required by the GitHub and middleware validation rules.
- `src/domain/`: PR counting and middleware rules as pure functions, independent of HTTP and reporting.
- `tests/integration/` and `tests/unit/`: Scenarios and assertions. `tests/fixtures/` contains the middleware example from the challenge.
- `reporters/`: GitHub Actions count summary, generated after tests finish.

## Pagination and business rules

### Part 1

The client requests `state=open` with `per_page=100` and follows `rel="next"` in GitHub's `Link` header until it is absent. Only the header determines whether another page exists.

Every page must return HTTP 200 and valid JSON. Zod validates a positive integer `id`, a `state` of `open` or `closed`, and a boolean `draft`. The test verifies that all returned PRs are open. The counting function includes only `state === 'open'` and `draft === false`.

Invalid responses, repeated page URLs and duplicate IDs within or across pages stop the operation. Errors identify the page and URL; duplicates also identify the ID and both occurrences' pages. HTTP 403 and 429 errors include available rate-limit headers. Data is returned only after every page succeeds.

### Part 2

After schema validation, the middleware function checks:

- `pull_requests.length` equals `total_open_prs`.
- A PR with the `high-priority` label has `is_draft === false`.

The count covers the entire array, including drafts. Part 1 filtering is not applied. The first violation throws an error with declared and actual counts or the offending PR ID.

## Middleware test coverage

The tests use the supplied JSON fixture and controlled variations:

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

## CI and reports

| Workflow | Trigger | Tests |
| --- | --- | --- |
| [PR MONITOR](.github/workflows/github-api.yml) | Hourly at minute 17 UTC on the default branch; manual runs | Live GitHub integration |
| [UNIT TESTS](.github/workflows/unit-tests.yml) | Push to `main`, PR targeting `main`, manual runs | Middleware unit tests |

Both workflows check types and retain generated HTML reports for 7 days, including after test failures. Cancelled runs skip the report upload. Artifacts are named `playwright-report` and `unit-test-report`, respectively.

The live workflow uses GitHub's automatic token and shows open, draft and non-draft counts in the run summary after a successful run. Results are not compared between runs. Locally, `npm run report` opens the generated `playwright-report/`, which is ignored by Git.

Scheduled runs may be delayed. To pause the monitor, use Actions -> PR MONITOR -> workflow options -> Disable workflow. The unit job has a 5-minute timeout and cancels superseded runs for the same branch or PR.

## Assumptions and limitations

- Empty arrays are valid. The live test does not expect a fixed PR count.
- Schemas cover fields needed by the rules and diagnostics, not the complete response contracts. Additional fields are accepted and omitted from parsed results; values are not normalized.
- The Link parser supports GitHub's documented format, not every possible Link header variant.
- GitHub data can change between requests. Pagination does not provide an atomic snapshot, and duplicate detection cannot reveal every omission caused by concurrent changes.
- The live count assertion checks consistency within the fetched dataset; it does not independently confirm the repository's total.
- Live tests require internet access and can fail due to availability or rate limits. Each request has a 15-second timeout and the live test a 120-second timeout. No automatic retries are configured.
- The live test does not reproducibly exercise every API error-handling branch. Middleware tests validate the local rules using fixtures, without calling a middleware service.
