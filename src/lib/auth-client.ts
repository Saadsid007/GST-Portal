import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";

/**
 * No baseURL: the auth routes are served by this same app, so better-auth falls back to the
 * browser's own origin. Passing NEXT_PUBLIC_APP_URL instead baked whatever scheme was configured
 * into the client bundle, and an `http://` value on an HTTPS deployment made every sign-in a
 * blocked mixed-content request.
 *
 * The server's extra user fields (phone) are inferred so `signUp.email` accepts them.
 */
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
});
