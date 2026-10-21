import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { APIError } from "better-auth/api";

import { PASSWORD_MIN_LENGTH } from "@/config/constants";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { EmailService } from "@/features/email/services/email.service";
import { sendInBackground } from "@/features/email/services/send-in-background";
import { normalizeIndianMobile, PHONE_ERROR } from "@/features/auth/domain/phone";

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
    // No session until the emailed code is entered. This was off, so signup
    // logged the person straight in and the code was never asked for — 29 of
    // the first 30 accounts never verified. Sign-in now refuses an unverified
    // address with EMAIL_NOT_VERIFIED, which the login page turns into the
    // code step.
    requireEmailVerification: true,
    sendResetPassword: async ({ user }) => {
      authLogger.info({ userId: user.id, email: user.email }, "Password reset email triggered");
      sendInBackground("password-reset", () =>
        EmailService.sendPasswordResetEmail({ to: user.email, name: user.name })
      );
    },
  },
  user: {
    additionalFields: {
      phone: { type: "string", required: true, input: true },
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    // A returning unverified user gets a fresh code at the password step.
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    // After the response: Better Auth holds the signup response until this
    // returns, and SMTP can take several seconds. Never a bare `void` — on
    // Vercel that send is killed when the response goes out.
    sendVerificationEmail: async ({ user }) => {
      authLogger.info({ userId: user.id, email: user.email }, "Verification email triggered");
      sendInBackground("verification", () =>
        EmailService.sendVerificationEmail({ to: user.email, name: user.name })
      );
    },
  },
  databaseHooks: {
    session: {
      create: {
        // An account an admin deleted has no way back in, even with a cookie
        // or a password reset in flight. It is told nothing: to the person
        // the account simply no longer exists.
        before: async (session) => {
          const owner = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { deletedAt: true },
          });
          return owner?.deletedAt ? false : undefined;
        },
      },
    },
    user: {
      create: {
        before: async (user) => {
          const phone = normalizeIndianMobile((user as { phone?: string }).phone);
          if (!phone) throw new APIError("BAD_REQUEST", { message: PHONE_ERROR });
          return { data: { ...user, phone } };
        },
        after: async (user) => {
          authLogger.info(
            { userId: user.id, email: user.email },
            "New user registered: syncing marketing & welcome flow"
          );

          // 1. Send Welcome & 30-Day Free Trial Email
          sendInBackground("welcome", () =>
            EmailService.sendWelcomeTrialEmail({ to: user.email, name: user.name })
          );

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
              // A person signing up again after their account was deleted
              // starts subscribed, like any new signup.
              update: {
                name: user.name,
                userId: user.id,
                planSlug: "free_trial",
                status: "SUBSCRIBED",
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
