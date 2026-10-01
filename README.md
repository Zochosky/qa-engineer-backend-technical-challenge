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

The test fetches the first page of pull requests from `appwrite/appwrite` with `state=open`. It checks HTTP 200, validates `id`, `state` and `draft` using Zod, and verifies that all returned PRs are open. Additional response fields and an empty list are accepted.

HTTP communication, response schemas and test assertions are kept in separate files under `src/api`, `src/schemas` and `tests/integration`.

The test requires internet access and is subject to GitHub availability and API rate limits. No browser installation is needed. Pagination and counting non-draft PRs are not implemented yet.
