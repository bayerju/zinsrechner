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

# Coast Runtime

This project uses Coasts - containerized runtimes for running services, tests,
and other runtime commands. The filesystem is shared between the host and the
container, so file edits on either side are visible to both immediately.

If `coast` is not on PATH in a non-interactive shell, use
`/home/julian/.coast/bin/coast`.

## Discovery

Before the first runtime command in a session, run:

  coast lookup

This prints the instance name, ports, and example commands. Use the instance
name from the output for all subsequent commands.

## What runs where

The filesystem is shared, so only use `coast exec` for things that need the
container runtime. Everything else runs directly on the host.

Use `coast exec` for:
- Tests that need running services (unit tests that are integrated with services
  or dbs, integration tests, API tests)
- Service restarts or compose operations
- Anything that talks to databases, caches, or other container services

Run directly on the host:
- Linting, typechecking, formatting
- Git operations
- Playwright and browser tests; run the browser on the host, pointed at the
  Coast dynamic port URL from `coast lookup` or `coast ports`
- Installing host-side dependencies
- File search, code generation, static analysis

Example:

  coast exec <instance> -- sh -c "cd <dir> && npm test"
  coast exec <instance> --service <service>
  npm run lint
  BASE_URL=http://localhost:62217 npx playwright test

## Runtime feedback

  coast ps <instance>
  coast logs <instance> --service <service>
  coast logs <instance> --service <service> --tail 50

## Post-change test URL

After every code change, make sure the Coast environment for the current
checkout is running before the final response:

1. Run `coast lookup`.
2. If a matching Coast exists but is stopped, start it with `coast start
   <instance>`.
3. If no matching Coast exists, run `coast ls` and prefer assigning an existing
   unassigned Coast to the current worktree with `coast assign <instance> -w
   <worktree>`. If no suitable Coast exists, run `coast build` if needed and
   create one with `coast run <name> -w <worktree>`.
4. Read the `web` dynamic port from `coast lookup` or `coast ports
   <instance>`.
5. Find the host LAN IP on the `10.100.100.x` network:

   `ip -4 addr show | awk '/inet 10\.100\.100\./ { sub("/.*", "", $2); print $2; exit }'`

6. When feasible, verify the app responds with `curl -fsSI
   http://localhost:<web-dynamic-port>`.
7. In the final response after code changes, include `Test URL:
   http://<10.100.100.x>:<web-dynamic-port>` so the user can test the change.
   If no `10.100.100.x` address is available, say that explicitly and include
   the localhost URL instead.

## Creating and assigning Coasts

If `coast lookup` returns no match, run `coast ls` to see what exists.

If an unassigned Coast is already running for this project, prefer assigning
your worktree to it rather than creating a new one:

  coast assign <existing> -w <worktree>

An already occupied Coast can also be reassigned with `coast assign`, but check
with the user first because that will disrupt the current slot.

If no Coast is running, ask the user before creating one because Coasts can be
memory intensive:

  coast run <name> -w <worktree>

A project must be built before instances can be created. If `coast run` fails
because no build exists, run `coast build` first.

## Coastfile setup

If the project does not have a Coastfile yet, or if you need to modify the
Coastfile, read the Coastfile docs first:

  coast docs --path coastfiles/README.md

## When confused

Before guessing about Coast behavior, explore the docs:

  coast docs
  coast docs --path concepts_and_terminology/RUN.md
  coast docs --path concepts_and_terminology/ASSIGN.md
  coast docs --path concepts_and_terminology/BUILDS.md
  coast search-docs "your question here"

## Troubleshooting

If you run into issues with harness configuration, read the troubleshooting
section of the relevant harness doc:

  coast docs --path harnesses/CODEX.md
  coast docs --path harnesses/T3_CODE.md

## Rules

- Always run `coast lookup` before your first runtime command in a session.
- Use `coast exec` only for things that need the container runtime.
- Use `coast exec --service <service>` when you need to run inside an
  app/service container.
- Run linting, typechecking, formatting, and git on the host directly.
- Use `coast docs` or `coast search-docs` before guessing about Coast behavior.
- Do not run services directly on the host when the project expects Coast.
