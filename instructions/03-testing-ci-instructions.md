# Testing & CI Instructions

## Local Validation Commands
- `npm run test:all`
- `npm run test:all:coverage:summary`

## Expected Results
- All tests pass.
- Coverage artifacts are refreshed in `coverage/`:
  - `coverage-report.txt`
  - `coverage-report-clean.txt`
  - `coverage-summary.txt`

## CI Workflow Expectations
- Workflow file: `.github/workflows/ci.yml`
- Triggers:
  - push to `main`
  - pull_request to `main`
  - scheduled run (daily)
  - manual dispatch

## CI Failure Quick Checks
1. Confirm lockfile exists (`package-lock.json`).
2. Confirm workflow uses correct Node version.
3. Re-run workflow on latest `main` commit.
4. Check artifact upload step for `coverage/` outputs.

## Done Criteria for Test-Related Changes
- New/updated tests included when behavior changes.
- No existing test regressions.
- Coverage command completes successfully.
