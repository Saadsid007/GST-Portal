import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * Request-memoised. A single dashboard navigation used to validate the session
 * two or three times over — the layout called getServerSession(), then
 * isAdmin() called it again, then the page called requireSession(). React's
 * cache() collapses those to one call per request.
 */
export const getServerSession = cache(async () => {
  return auth.api.getSession({
    headers: await headers(),
  });
});

/** Coarse enough that browsing costs one write per stretch of use, not one per click. */
const ACTIVITY_WINDOW_MS = 5 * 60 * 1000;

/**
 * Records that the user is using the product, after the response is sent.
 *
 * One conditional write that matches nothing while the stored time is fresh,
 * so the page never waits on it and a busy session does not rewrite the row
 * on every navigation. Admins read this as "last active".
 */
export function recordActivity(userId: string): void {
  after(async () => {
    const now = new Date();
    await prisma.user.updateMany({
      where: {
        id: userId,
        OR: [
          { lastActiveAt: null },
          { lastActiveAt: { lt: new Date(now.getTime() - ACTIVITY_WINDOW_MS) } },
        ],
      },
      data: { lastActiveAt: now },
    });
  });
}

export async function requireSession() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

/**
 * Role is read from the database rather than the session, so revoking an admin
 * takes effect immediately instead of waiting for the session cookie to expire.
 * Memoised for the same reason as the session: the layout, the nav and every
 * guarded action re-read it within one render.
 */
export const getUserRole = cache(async (): Promise<string | null> => {
  const session = await getServerSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  return user?.role ?? null;
});

export async function isAdmin(): Promise<boolean> {
  return (await getUserRole()) === "ADMIN";
}

export async function requireAdmin() {
  const session = await requireSession();
  if ((await getUserRole()) !== "ADMIN") {
    redirect("/dashboard");
  }
  return session;
}
