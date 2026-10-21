import { after } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "email-background" });

type Send = () => Promise<{ success: boolean; error?: string } | unknown>;

/**
 * Sends mail after the response has gone out, without making the user wait
 * for SMTP.
 *
 * A bare `void promise` is not enough on Vercel: the function is frozen the
 * moment the response is sent, and the unawaited send dies with it. That is
 * how verification codes stopped reaching sign-ups in production while every
 * local test passed. `after()` keeps the function alive until the work ends.
 *
 * Outside a request (scripts, tests) `after()` throws; the mail is then sent
 * in place.
 */
export function sendInBackground(label: string, send: Send): void {
  const run = async () => {
    try {
      const result = await send();
      if (result && typeof result === "object" && "success" in result && !result.success) {
        log.error({ label, error: (result as { error?: string }).error }, "Email failed");
      }
    } catch (err) {
      log.error({ label, err }, "Email failed");
    }
  };
  try {
    after(run);
  } catch {
    void run();
  }
}
