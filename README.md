# Create T3 App

This is a [T3 Stack](https://create.t3.gg/) project bootstrapped with `create-t3-app`.

## Authentication and Convex

The app uses Better Auth for authentication and syncs calculator state to Convex
after sign-in. Signed-out usage remains local to the browser.

### Data storage and sign-in merge

- While signed out, scenarios and settings are stored in browser
  `localStorage` only.
- While signed in, data is synchronized through Convex using separate
  `userSettings`, `financingScenarios`, `credits`, `liquidityScenarios`, and
  `liquidityItems` tables.
- If browser data is present during sign-in, the app opens a review dialog
  before changing anything. It lists every local financing and liquidity
  scenario as either new or already present in Convex.
- The user can explicitly import the new scenarios or discard all local data.
  Duplicate scenarios are never imported again.
- The generated `Basis` financing and liquidity scenarios are not import
  candidates. If no additional local scenarios exist, the review dialog is
  skipped.
- After the user makes that choice, the app removes its browser storage so
  Convex is the only source of truth while signed in.
- Imported scenarios keep the cloud versions and add genuinely different local
  versions as additional scenarios named `... (lokal importiert)`.
- Convex stores an account-specific SHA-256 import fingerprint, making this
  import idempotent across refreshes and devices.
- Convex also compares the actual calculator values, credits, and liquidity
  items. Renamed scenarios with otherwise identical content are shown as
  duplicates.
- If the same scenario changed both locally and on another device, both
  versions are preserved instead of silently overwriting the local version.

1. Use Node.js 20.9 or newer.
2. Copy `.env.example` to `.env` and configure the app environment.

   Convex reads `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`, and
   `NEXT_PUBLIC_CONVEX_SITE_URL` from `.env` via `pnpm convex:dev`.

3. Set the Better Auth environment variables on the Convex deployment:

   ```bash
   pnpm convex env set SITE_URL http://localhost:3011
   pnpm convex env set TRUSTED_ORIGINS http://localhost:3011,http://127.0.0.1:3011,http://192.168.178.27:3011,http://10.100.100.3:3011
   pnpm convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
   ```

4. Start Convex in the first terminal:

   ```bash
   pnpm convex:dev
   ```

5. Start Next.js in a second terminal:

   ```bash
   pnpm dev
   ```

Open `http://localhost:3011`.

## Coolify production

The new `.github/workflows/deploy.yml` follows the JR apps' deployment model:
GitHub Actions builds Next.js, packages a standalone Node runtime, tests that
image and pushes it to private GHCR. Coolify only pulls and starts the image.
No installation, compilation or Docker build runs on the production server.
The existing Nixpacks configuration is retained only for rollback during cutover;
it is not used by the new pipeline.

### GitHub configuration

Create a `production` environment restricted to `main`, with these variables:

- `NEXT_PUBLIC_CONVEX_URL`: existing production `https://<deployment>.convex.cloud`.
- `NEXT_PUBLIC_CONVEX_SITE_URL`: matching `https://<deployment>.convex.site`.
- `NEXT_PUBLIC_POSTHOG_KEY`: existing public PostHog project key.
- `NEXT_PUBLIC_POSTHOG_HOST`: `https://eu.i.posthog.com`.
- `COOLIFY_URL`: public HTTPS Coolify origin, without `/api/v1`.
- `COOLIFY_APP_UUID`: the Docker Image application selected for this app.

Add these secrets to that environment:

- `CONVEX_DEPLOY_KEY`: production deploy key for the existing Convex deployment.
- `COOLIFY_API_TOKEN`: dedicated CI read/write token.
- `COOLIFY_DEPLOY_TOKEN`: separate deploy-only token.

The existing JR CI credentials in `~/.config/jr-app/ci.env` can be reused.
Do not upload the broader setup token to GitHub. The deploy script validates
that the production key matches both public Convex URLs and that Coolify is
configured for the expected GHCR image in `dockerimage` mode.

The reusable CI workflow runs `pnpm typecheck`, `pnpm test:unit` and
`pnpm test:e2e`, plus a production image smoke test. Configure the repository
secret `E2E_OPENAI_API_KEY` for the existing live Copilot E2E test, preferably
with a restricted test key. It is passed only to the E2E step. Fork PRs do not
receive this secret and cannot run the live model test successfully.
The E2E launcher uses an isolated anonymous local Convex backend without a
Convex cloud login. No production backend is used for tests.

### One-time cutover from Nixpacks

1. Record the existing Coolify app's domain, runtime variables and rollback
   settings. Preserve the existing Convex deployment and Better Auth secret.
2. Disable the old app's automatic Git deployments **before merging** the new
   workflow, so a push cannot also trigger a server build.
3. Prepare a Coolify **Docker Image** application for
   `ghcr.io/bayerju/zinsrechner`, with container port `3000` and health check
   `/healthz`. Do not start it before its first image exists. If a replacement
   application is necessary, initially use a temporary domain and preserve the
   old application for rollback; transfer the production domain at cutover.
4. Preserve runtime settings in Coolify, particularly `OPENAI_API_KEY`,
   `OPENAI_MODEL`, `COPILOT_EXTRA_SYSTEM_PROMPT`, `DOCUMENT_EXTRACT_URL` and
   `DOCUMENT_EXTRACT_TOKEN` when configured. Also retain the matching public
   Convex URLs. Build-time `NEXT_PUBLIC_*` values come from GitHub and require
   a rebuild to change. Never pass server secrets into the frontend build.
5. Confirm the deployment server's Docker login can pull this private GHCR
   package as Coolify's SSH user. Existing JR apps use the same registry, but
   check the Zinsrechner's selected server rather than assuming it is the same.
6. Set the repository variable `DEPLOY_ENABLED=true` after preparation. Merge
   to `main` or dispatch **Deploy production** on `main`. Verify the package is
   private and associated with this repository, the workflow finishes, and
   authentication, Copilot streaming and document upload work on the live app.

The workflow stays disabled until explicitly enabled. Its image is tagged
`sha-<full-commit-sha>`; the exact locally tested image is pushed without a
second Docker build. Convex deploy runs only after image publication and a
successful Coolify preflight. Coolify deployment failures and timeouts fail
the workflow; accepting a deployment request is not treated as success.

BuildKit cache lives in GitHub Actions. The server still stores runtime images
and retained rollback images. Existing server build caches are not removed by
this migration; review shared-server usage before cleaning them separately.
Frontend rollback selects a previous image tag/digest and does not roll back
Convex functions or data, so backend releases must remain backward-compatible.

### Runtime image verification

```bash
pnpm build
node scripts/prepare-runtime.mjs
docker build -t zinsrechner:test .
node scripts/smoke-image.mjs zinsrechner:test
```

Run container/runtime checks inside the assigned Coast when working locally;
GitHub-hosted CI runs the commands directly. The image smoke test checks health,
deep links, JS/public assets, document conversion, Copilot discovery, the
non-root user and absence of env files/build cache. It uses no model API key
and does not substitute for authenticated browser E2E tests.

## What's next? How do I make an app with this?

We try to keep this project as simple as possible, so you can start with just the scaffolding we set up for you, and add additional things later when they become necessary.

If you are not familiar with the different technologies used in this project, please refer to the respective docs. If you still are in the wind, please join our [Discord](https://t3.gg/discord) and ask for help.

- [Next.js](https://nextjs.org)
- [NextAuth.js](https://next-auth.js.org)
- [Drizzle](https://orm.drizzle.team)
- [Tailwind CSS](https://tailwindcss.com)

## Learn More

To learn more about the [T3 Stack](https://create.t3.gg/), take a look at the following resources:

- [Documentation](https://create.t3.gg/)
- [Learn the T3 Stack](https://create.t3.gg/en/faq#what-learning-resources-are-currently-available) — Check out these awesome tutorials

You can check out the [create-t3-app GitHub repository](https://github.com/t3-oss/create-t3-app) — your feedback and contributions are welcome!

## How do I deploy this?

Follow our deployment guides for [Vercel](https://create.t3.gg/en/deployment/vercel), [Netlify](https://create.t3.gg/en/deployment/netlify) and [Docker](https://create.t3.gg/en/deployment/docker) for more information.
