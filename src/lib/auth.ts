import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { PASSWORD_MIN_LENGTH } from "@/config/constants";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import prisma from "@/lib/prisma";

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
    sendResetPassword: async ({ user, url }) => {
      authLogger.info({ userId: user.id, email: user.email }, "Password reset requested");
      authLogger.info({ resetUrl: url }, "Password reset URL (dev mode)");
    },
  },
  emailVerification: {
    sendOnSignUp: false,
    autoSignInAfterVerification: true,
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
