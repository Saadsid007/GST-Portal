import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  describeFailure,
  isStaleDeploymentError,
  STALE_DEPLOYMENT_MESSAGE,
  explainTransportError,
  FILE_MARKER,
  isGzip,
  MAX_UPLOAD_BYTES,
  uploadTooLargeMessage,
} from "@/features/convert/utils/upload-transport";
import { packResult, readUploadBuffer, unpackArgs } from "@/features/convert/utils/read-upload";

const csv = "Invoice Number,Taxable Value\nIN-1,100\nIN-2,200\n";

describe("upload transport", () => {
  it("reads a gzipped upload back to the original bytes", async () => {
    const blob = new Blob([gzipSync(csv)]);
    expect((await readUploadBuffer(blob)).toString()).toBe(csv);
  });

  it("passes an uncompressed file through untouched", async () => {
    expect((await readUploadBuffer(new Blob([csv]))).toString()).toBe(csv);
    // An .xlsx starts with PK, never with the gzip signature.
    expect(isGzip(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe(false);
  });

  it("restores files from their markers in packed arguments", async () => {
    const file = new Blob([csv]);
    const args = [[{ fileName: "mtr.csv", file: { [FILE_MARKER]: 0 } }], "09ABCDE1234F1Z5"];
    const payload = new Blob([gzipSync(JSON.stringify(args))]);
    const out = (await unpackArgs(payload, [file])) as [{ file: Blob }[], string];
    expect(out[0][0]!.file).toBe(file);
    expect(out[1]).toBe("09ABCDE1234F1Z5");
  });

  it("refuses a marker that points at no file", async () => {
    const payload = new Blob([gzipSync(JSON.stringify([{ [FILE_MARKER]: 3 }]))]);
    await expect(unpackArgs(payload, [])).rejects.toThrow("Invalid request");
  });

  it("packs results as gzip", () => {
    const bytes = packResult({ success: true, rows: [1, 2] });
    expect(isGzip(bytes)).toBe(true);
  });

  it("explains the cryptic Server Action transport error", () => {
    const msg = explainTransportError("An unexpected response was received from the server.");
    expect(msg).toContain("two parts");
    expect(explainTransportError("Some other error")).toBe("Some other error");
  });

  it("recognises a call from a page loaded before a deploy", () => {
    const raw =
      'Server Action "70f5937d58aa44987eedbe0094340e59f5dec94fd8" was not found on the server. Read more: https://nextjs.org/docs/messages/failed-to-find-server-action';
    expect(isStaleDeploymentError(raw)).toBe(true);
    expect(describeFailure(new Error(raw), "Failed")).toBe(STALE_DEPLOYMENT_MESSAGE);
    expect(isStaleDeploymentError("Invalid request")).toBe(false);
  });

  it("tells the seller which file is too large and what to do", () => {
    const msg = uploadTooLargeMessage(MAX_UPLOAD_BYTES * 2, ["MTR_B2C-OCT.csv"]);
    expect(msg).toContain("MTR_B2C-OCT.csv");
    expect(msg).toContain("48.0 MB");
    expect(describeFailure(new Error(msg), "Failed")).toBe(msg);
    expect(describeFailure(new Error("boom"), "Failed to revalidate")).toBe("Failed to revalidate");
  });
});
