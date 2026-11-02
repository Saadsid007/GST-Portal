import { gunzipSync, gzipSync } from "node:zlib";
import { FILE_MARKER, isGzip } from "@/features/convert/utils/upload-transport";

/** Far above any real monthly report; below what could exhaust the function's memory. */
const MAX_UNPACKED_BYTES = 250_000_000;

/**
 * Server side of the upload transport: the file's bytes, gunzipped when the
 * browser compressed them. A real .xlsx starts with "PK" and a CSV with
 * text, so the gzip signature cannot be mistaken for an uncompressed report.
 */
export async function readUploadBuffer(file: Blob): Promise<Buffer> {
  const bytes = Buffer.from(await file.arrayBuffer());
  // Capped, so a small crafted archive cannot expand into gigabytes.
  return isGzip(bytes) ? gunzipSync(bytes, { maxOutputLength: MAX_UNPACKED_BYTES }) : bytes;
}

/**
 * Arguments packed by `callPacked` in the browser: gzipped JSON in which each
 * file was replaced by a marker pointing into `files`.
 */
export async function unpackArgs(payload: Blob, files: Blob[]): Promise<unknown> {
  const json = (await readUploadBuffer(payload)).toString("utf8");
  return JSON.parse(json, (_key, value: unknown) => {
    if (value && typeof value === "object" && FILE_MARKER in value) {
      const index = (value as Record<string, unknown>)[FILE_MARKER];
      const file = typeof index === "number" ? files[index] : undefined;
      if (!file) throw new Error("Invalid request");
      return file;
    }
    return value;
  });
}

/** A result for `callPacked`: gzipped JSON, sent as binary. */
export function packResult(value: unknown): Uint8Array {
  return new Uint8Array(gzipSync(JSON.stringify(value ?? null)));
}
