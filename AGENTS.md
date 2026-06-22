<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## Validation

Agents must run these checks after code changes when feasible, and report any
check that could not be run with the reason:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`

Pull requests run the same validation in GitHub Actions. Keep the PR pipeline in
sync with this list when validation requirements change.

Playwright E2E tests include approved screenshot baselines stored in the repo.
If a UI change is intentional, update those baselines with
`pnpm test:e2e:update-screenshots` and review the changed PNG files before
committing.
