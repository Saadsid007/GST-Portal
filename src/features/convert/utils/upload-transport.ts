/**
 * How uploaded reports travel from the browser to the conversion actions.
 *
 * Vercel refuses any function request body over 4.5 MB before the app sees
 * it, and answers with a plain error page. The Server Action client cannot
 * read that page and shows "An unexpected response was received from the
 * server". Marketplace reports pass that size easily (an Amazon MTR CSV for a
 * busy month is 10 to 30 MB), and every conversion step sends the files again.
 *
 * So files are gzipped in the browser and gunzipped on the server. Report
 * data is very repetitive: CSV shrinks about 10x, and even an .xlsx (already
 * zipped) shrinks a little. Files that are still too large are refused up
 * front with a message the seller can act on.
 */

/**
 * Compressed size allowed per request. On the VPS the ceiling is Next's
 * serverActions.bodySizeLimit (25 MB) behind nginx's 30 MB; leave room for
 * the rest of the request. (It was 4 MB while the app ran on Vercel, whose
 * platform limit is 4.5 MB.)
 */
export const MAX_UPLOAD_BYTES = 24_000_000;

/** Stands in for a file inside packed JSON arguments: { [FILE_MARKER]: index }. */
export const FILE_MARKER = "__gstpilotFile";

const GZIP_MAGIC_0 = 0x1f;
const GZIP_MAGIC_1 = 0x8b;

export function isGzip(bytes: Uint8Array): boolean {
  return bytes.length > 2 && bytes[0] === GZIP_MAGIC_0 && bytes[1] === GZIP_MAGIC_1;
}

export function formatMegabytes(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/** The message shown when the compressed upload is still above the limit. */
export function uploadTooLargeMessage(compressedBytes: number, fileNames: string[]): string {
  const which = fileNames.length === 1 ? fileNames[0] : `${fileNames.length} files`;
  return (
    `${which} is too large to process online (${formatMegabytes(compressedBytes)} after ` +
    `compression, the limit is ${formatMegabytes(MAX_UPLOAD_BYTES)}). Download the report ` +
    `in two parts, for example 1 to 15 and 16 to the end of the month, and convert each part.`
  );
}

/**
 * Turns the Server Action transport error into something a seller can act
 * on. Any other message passes through unchanged.
 */
export function explainTransportError(message: string): string {
  if (/unexpected response was received from the server/i.test(message)) {
    return (
      "The server could not accept this upload. It is usually a very large report. " +
      "Try downloading the report in two parts (for example 1 to 15 and 16 to the end " +
      "of the month), or contact support with the file name."
    );
  }
  return message;
}

/**
 * A page loaded before a deploy calls Server Actions by IDs the new build may
 * not have ("Server Action ... was not found on the server"). The only cure is
 * loading the page again.
 */
export function isStaleDeploymentError(message: string): boolean {
  return /Server Action .* was not found on the server|Failed to find Server Action/i.test(message);
}

export const STALE_DEPLOYMENT_MESSAGE =
  "GSTPilot was just updated. The page is reloading; please upload your report again.";

/**
 * The toast text for a failed convert call: the size or transport problem
 * when that is what happened, otherwise the step's own fallback.
 */
export function describeFailure(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : "";
  if (/too large to process online/i.test(message)) return message;
  if (message === STALE_DEPLOYMENT_MESSAGE || isStaleDeploymentError(message)) {
    return STALE_DEPLOYMENT_MESSAGE;
  }
  if (/unexpected response was received from the server/i.test(message)) {
    return explainTransportError(message);
  }
  return fallback;
}
