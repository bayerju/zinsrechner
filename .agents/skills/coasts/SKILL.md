---
name: coasts
description: Inspect and control Coast instances for the current checkout. Use
  when the user says "/coasts", asks to assign or reassign a Coast, wants to
  run commands or read logs in the matching Coast, wants to create a new Coast,
  or explicitly asks to open Coast UI.
---

# Coasts

Use the Coast CLI directly. Do not add wrappers.

If `coast` is not on PATH in a non-interactive shell, use
`/home/julian/.coast/bin/coast`.

## Orient Yourself

Start by exploring the CLI and docs:

  coast
  coast docs
  coast search-docs "your question"

When anything about Coast behavior is unclear, read the docs before guessing:

  coast docs --path concepts_and_terminology/RUN.md
  coast docs --path concepts_and_terminology/BUILDS.md
  coast docs --path concepts_and_terminology/ASSIGN.md
  coast docs --path concepts_and_terminology/PORTS.md
  coast docs --path coastfiles/README.md

## Quick Start

Route requests into one of these modes:

1. **Use Coast** - run `coast lookup`, then use `coast exec`, `coast ps`, or
   `coast logs` with the matching instance.
2. **Create or Assign** - run `coast ls`, then `coast run` to create a new
   Coast or `coast assign` to repoint an existing one.
3. **Open UI** - run `coast ui`.

## What Runs Where

The host and the Coast share the filesystem. Only use `coast exec` for things
that need running services inside the container.

Use `coast exec` for:
- Integration tests, API tests, anything that needs databases or services
- Service restarts, compose operations
- Commands that talk to container-only processes

Run on the host:
- Linting (`eslint`, `rubocop`, `golangci-lint`)
- Typechecking (`tsc --noEmit`, `go vet`)
- Formatting (`prettier`, `gofmt`)
- Git operations
- Playwright and browser tests; run the browser on the host, pointed at the
  Coast dynamic port URL from `coast lookup` or `coast ports`. If the Coast is
  checked out, the canonical port works too, but prefer the dynamic port unless
  the user says otherwise. Do not run Playwright inside the Coast via
  `coast exec`.
- Static analysis, code generation
- Package installs (`npm install`, `pip install`)

Example - Playwright hits the frontend through the dynamic port:

  coast ports <instance>
  BASE_URL=http://localhost:62217 npx playwright test

## Create and Assign

When `coast lookup` returns no match:

1. Run `coast ls` to see available slots.
2. Prefer `coast run <name> -w <worktree>` to create and assign in one step.
3. If no build exists yet, run `coast build` first.
4. After creating, rerun `coast lookup` to confirm.

When you want to switch an existing Coast to a different worktree:

  coast assign <name> -w <worktree>

That also works for an already assigned or checked-out Coast, but ask the user
first before reassigning an occupied slot.

## Coastfile Setup

If the project needs a new or modified Coastfile, read the docs first:

  coast docs --path coastfiles/README.md

The Coastfile docs cover compose setup, ports, volumes, secrets, shared
services, bare services, and inheritance.

## Safety Rules

- Run `coast lookup` before taking action and again after any topology change.
- Ask before `coast assign`, `coast unassign`, or `coast checkout` if it would
  disrupt an existing slot.
- Prefer creating a new Coast over reusing a checked-out or already-assigned
  one unless the user explicitly wants the existing slot to be reassigned.
- Use `coast docs` or `coast search-docs` before guessing.
