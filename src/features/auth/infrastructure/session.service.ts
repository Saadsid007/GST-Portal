import { cache } from "react";
import { headers } from "next/headers";
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

export async function requireSession() {
  const session = await getServerSession();
  if (!session) {
    throw new Error("UNAUTHENTICATED");
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
    throw new Error("FORBIDDEN");
  }
  return session;
}
