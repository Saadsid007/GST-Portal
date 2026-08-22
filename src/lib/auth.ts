import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { PASSWORD_MIN_LENGTH } from "@/config/constants";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { EmailService } from "@/features/email/services/email.service";

const authLogger = createLogger({ module: "auth" });

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    requireEmailVerification: false,
    sendResetPassword: async ({ user }) => {
      authLogger.info({ userId: user.id, email: user.email }, "Password reset email triggered");
      await EmailService.sendPasswordResetEmail({
        to: user.email,
        name: user.name,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user }) => {
      authLogger.info({ userId: user.id, email: user.email }, "Verification email triggered");
      await EmailService.sendVerificationEmail({
        to: user.email,
        name: user.name,
      });
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          authLogger.info({ userId: user.id, email: user.email }, "New user registered: syncing marketing & welcome flow");

          // 1. Send Welcome & 30-Day Free Trial Email
          void EmailService.sendWelcomeTrialEmail({
            to: user.email,
            name: user.name,
          });

          // 2. Auto-sync user into Marketing Audience
          try {
            await prisma.marketingSubscriber.upsert({
              where: { email: user.email },
              create: {
                email: user.email,
                name: user.name,
                userId: user.id,
                source: "SIGNUP",
                status: "SUBSCRIBED",
                planSlug: "free_trial",
                tags: ["trial_active", "new_user"],
              },
              update: {
                name: user.name,
                userId: user.id,
                planSlug: "free_trial",
              },
            });
          } catch (err) {
            authLogger.error({ error: err }, "Failed to auto-sync marketing audience on signup");
          }
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
