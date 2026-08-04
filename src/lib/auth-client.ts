import { createAuthClient } from "better-auth/react";

/**
 * No baseURL: the auth routes are served by this same app, so better-auth falls back to the
 * browser's own origin. Passing NEXT_PUBLIC_APP_URL instead baked whatever scheme was configured
 * into the client bundle, and an `http://` value on an HTTPS deployment made every sign-in a
 * blocked mixed-content request.
 */
export const authClient = createAuthClient();
