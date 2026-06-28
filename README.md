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
2. Add the local environment variables to `.env`:

   ```env
   DATABASE_URL="file:./db.sqlite"
   ```

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

Use this build command in Coolify:

```bash
pnpm build:coolify
```

Set these Coolify environment variables:

```env
DATABASE_URL=postgres://...
NEXT_PUBLIC_CONVEX_URL=https://<prod-deployment>.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://<prod-deployment>.convex.site
NEXT_PUBLIC_POSTHOG_KEY=...
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

Set this Coolify environment variable as a build variable:

```env
CONVEX_DEPLOY_KEY=...
```

Set these once on the Convex production deployment:

```bash
pnpm convex env set --prod SITE_URL https://your-domain.example
pnpm convex env set --prod TRUSTED_ORIGINS https://your-domain.example
openssl rand -base64 32 | pnpm convex env set --prod BETTER_AUTH_SECRET
```

## What's next? How do I make an app with this?

We try to keep this project as simple as possible, so you can start with just the scaffolding we set up for you, and add additional things later when they become necessary.

If you are not familiar with the different technologies used in this project, please refer to the respective docs. If you still are in the wind, please join our [Discord](https://t3.gg/discord) and ask for help.

- [Next.js](https://nextjs.org)
- [NextAuth.js](https://next-auth.js.org)
- [Prisma](https://prisma.io)
- [Drizzle](https://orm.drizzle.team)
- [Tailwind CSS](https://tailwindcss.com)
- [tRPC](https://trpc.io)

## Learn More

To learn more about the [T3 Stack](https://create.t3.gg/), take a look at the following resources:

- [Documentation](https://create.t3.gg/)
- [Learn the T3 Stack](https://create.t3.gg/en/faq#what-learning-resources-are-currently-available) — Check out these awesome tutorials

You can check out the [create-t3-app GitHub repository](https://github.com/t3-oss/create-t3-app) — your feedback and contributions are welcome!

## How do I deploy this?

Follow our deployment guides for [Vercel](https://create.t3.gg/en/deployment/vercel), [Netlify](https://create.t3.gg/en/deployment/netlify) and [Docker](https://create.t3.gg/en/deployment/docker) for more information.
