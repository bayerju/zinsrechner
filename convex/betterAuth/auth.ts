import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import type { GenericCtx } from "@convex-dev/better-auth/utils";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { components } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import authConfig from "../auth.config";

export const authComponent = createClient<DataModel>(components.betterAuth);

function trustedOrigins() {
  return [
    process.env.SITE_URL,
    ...(process.env.TRUSTED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ].filter((origin): origin is string => Boolean(origin));
}

export const createAuthOptions = (ctx: GenericCtx<DataModel>) =>
  ({
    appName: "JRZinsrechner",
    baseURL: process.env.SITE_URL,
    trustedOrigins: trustedOrigins(),
    secret: process.env.BETTER_AUTH_SECRET,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [convex({ authConfig })],
  }) satisfies BetterAuthOptions;

export const options = createAuthOptions({} as GenericCtx<DataModel>);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth(createAuthOptions(ctx));
};
