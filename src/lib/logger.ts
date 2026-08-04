import pino from "pino";
import { env } from "@/lib/env";

const isDev = env.NODE_ENV !== "production";

const logger = pino({
  level: env.LOG_LEVEL,
  transport: isDev ? { target: "pino-pretty", options: { colorize: true } } : undefined,
});

export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

export default logger;
