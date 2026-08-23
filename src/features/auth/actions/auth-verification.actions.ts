"use server";

import prisma from "@/lib/prisma";
import { EmailService } from "@/features/email/services/email.service";
import { createLogger } from "@/lib/logger";
import { PASSWORD_MIN_LENGTH } from "@/config/constants";
// Hashing MUST go through Better Auth's own primitives: its sign-in verifier
// derives keys with scrypt(N=16384, r=16, p=1) over an NFKC-normalised password.
// Node's scryptSync defaults use r=8, so hand-rolled hashes never verify at login.
import {
  hashPassword as authHashPassword,
  verifyPassword as authVerifyPassword,
} from "better-auth/crypto";
import { z } from "zod";
import crypto from "crypto";

const logger = createLogger({ module: "auth-verification-actions" });

const RequestVerificationSchema = z.object({
  email: z.string().email(),
});

const VerifyEmailOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().min(6).max(6),
});

const RequestPasswordResetSchema = z.object({
  email: z.string().email(),
});

const ResetPasswordSchema = z.object({
  email: z.string().email(),
  otp: z.string().min(6).max(6),
  newPassword: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`),
});

/**
 * Server Action: Request an email verification OTP code.
 * OTP is generated and hashed server-side.
 */
export async function requestEmailVerificationAction(input: {
  email: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { email } = RequestVerificationSchema.parse(input);
    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return { success: false, error: "Account not found with this email." };
    }

    if (user.emailVerified) {
      return { success: true }; // Already verified
    }

    await EmailService.sendVerificationEmail({
      to: normalizedEmail,
      name: user.name,
    });

    logger.info({ email: normalizedEmail }, "Email verification OTP dispatched");
    return { success: true };
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : err },
      "Failed to request email verification"
    );
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to send verification email.",
    };
  }
}

/**
 * Server Action: Verify Email OTP code and mark account as verified.
 */
export async function verifyEmailOtpAction(input: {
  email: string;
  otp: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { email, otp } = VerifyEmailOtpSchema.parse(input);
    const normalizedEmail = email.toLowerCase().trim();

    const isValid = await EmailService.verifyOtp(normalizedEmail, "EMAIL_VERIFICATION", otp);

    if (!isValid) {
      return {
        success: false,
        error: "Invalid or expired verification code. Please request a new one.",
      };
    }

    // Update user in database
    await prisma.user.update({
      where: { email: normalizedEmail },
      data: { emailVerified: true },
    });

    // Also update marketing subscriber status if present
    await prisma.marketingSubscriber.updateMany({
      where: { email: normalizedEmail },
      data: { status: "SUBSCRIBED" },
    });

    logger.info({ email: normalizedEmail }, "User email successfully verified via OTP");
    return { success: true };
  } catch (err) {
    logger.error({ error: err instanceof Error ? err.message : err }, "Failed to verify email OTP");
    return {
      success: false,
      error: err instanceof Error ? err.message : "Verification failed.",
    };
  }
}

/**
 * Server Action: Request Password Reset OTP / Link.
 */
export async function requestPasswordResetAction(input: {
  email: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { email } = RequestPasswordResetSchema.parse(input);
    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // To prevent email enumeration attacks, always return success even if user does not exist
    if (!user) {
      return { success: true };
    }

    // Dispatch in the background: SMTP delivery can take tens of seconds on
    // constrained networks, and the response must never block on it.
    void EmailService.sendPasswordResetEmail({
      to: normalizedEmail,
      name: user.name,
    }).then((result) => {
      if (result.success) {
        logger.info({ email: normalizedEmail }, "Password reset OTP dispatched");
      } else {
        logger.error(
          { email: normalizedEmail, error: result.error },
          "Password reset OTP failed to dispatch"
        );
      }
    });

    return { success: true };
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : err },
      "Failed to request password reset"
    );
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to send password reset email.",
    };
  }
}

/**
 * Server Action: Verify OTP and reset password.
 */
export async function verifyAndResetPasswordAction(input: {
  email: string;
  otp: string;
  newPassword: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { email, otp, newPassword } = ResetPasswordSchema.parse(input);
    const normalizedEmail = email.toLowerCase().trim();

    const isValid = await EmailService.verifyOtp(normalizedEmail, "PASSWORD_RESET", otp);

    if (!isValid) {
      return {
        success: false,
        error: "Invalid or expired verification code. Please request a new one.",
      };
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { accounts: true },
    });

    if (!user) {
      return { success: false, error: "User account not found." };
    }

    const credentialAccount = user.accounts.find(
      (a) => a.providerId === "credential" || a.providerId === "email"
    );

    // Reject no-op resets before touching anything so the user keeps their
    // working password. Deliberately runs after OTP consumption — checking
    // earlier would hand an unauthenticated caller a current-password oracle.
    if (
      credentialAccount?.password &&
      (await authVerifyPassword({ hash: credentialAccount.password, password: newPassword }))
    ) {
      return {
        success: false,
        error: "Your new password must be different from your current password.",
      };
    }

    // Hash with Better Auth's own primitive so its login verifier accepts it.
    const formattedPasswordHash = await authHashPassword(newPassword);

    if (credentialAccount) {
      await prisma.account.update({
        where: { id: credentialAccount.id },
        data: { password: formattedPasswordHash },
      });
    } else {
      await prisma.account.create({
        data: {
          id: crypto.randomUUID(),
          accountId: user.id,
          providerId: "credential",
          userId: user.id,
          password: formattedPasswordHash,
        },
      });
    }

    // Send security confirmation notification
    void EmailService.sendPasswordChangedNotification({
      to: normalizedEmail,
      name: user.name,
    });

    logger.info(
      { email: normalizedEmail },
      "User password successfully reset via OTP verification"
    );
    return { success: true };
  } catch (err) {
    logger.error({ error: err instanceof Error ? err.message : err }, "Failed to reset password");
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to reset password.",
    };
  }
}
