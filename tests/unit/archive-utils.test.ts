import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import {
  expandArchive,
  isArchive,
  chooseEntryForSlot,
} from "@/features/convert/utils/archive.utils";

async function zipOf(entries: Record<string, string>): Promise<File> {
  const zip = new JSZip();
  for (const [name, body] of Object.entries(entries)) zip.file(name, body);
  const blob = await zip.generateAsync({ type: "blob" });
  return new File([blob], "download.zip", { type: "application/zip" });
}

describe("marketplace archives", () => {
  it("recognises a zip by name", () => {
    expect(isArchive("b2bReport_July_2026.zip")).toBe(true);
    expect(isArchive("MTR_B2B.csv")).toBe(false);
  });

  it("pulls the spreadsheets out of an Amazon download", async () => {
    // This is the shape Amazon actually ships: one report per archive.
    const archive = await zipOf({
      "MTR_B2B-JULY-2026-A16QNG0LU58VWU.csv": "Seller Gstin,Invoice Number\n09AAA,IN-1",
    });

    const { files } = await expandArchive(archive);

    expect(files).toHaveLength(1);
    expect(files[0]!.fileName).toBe("MTR_B2B-JULY-2026-A16QNG0LU58VWU.csv");
    expect(await files[0]!.file.text()).toContain("Seller Gstin");
  });

  it("strips directories from the entry name", async () => {
    const archive = await zipOf({ "reports/july/MTR_B2C.csv": "a,b\n1,2" });

    const { files } = await expandArchive(archive);

    expect(files[0]!.fileName).toBe("MTR_B2C.csv");
  });

  it("reports what it left behind instead of dropping it silently", async () => {
    // A seller whose archive is all PDFs should be told the app looked inside,
    // not left wondering why the slot is still empty.
    const archive = await zipOf({
      "invoice-1.pdf": "%PDF-1.4",
      "MTR_B2B.csv": "a,b\n1,2",
    });

    const { files, skipped } = await expandArchive(archive);

    expect(files.map((f) => f.fileName)).toEqual(["MTR_B2B.csv"]);
    expect(skipped).toEqual([{ name: "invoice-1.pdf", reason: "Not a spreadsheet" }]);
  });

  it("refuses to follow a nested archive", async () => {
    // Following archives into themselves turns a small upload into unbounded work.
    const inner = await zipOf({ "deep.csv": "a\n1" });
    const archive = await zipOf({ "inner.zip": await inner.text() });

    const { files, skipped } = await expandArchive(archive);

    expect(files).toHaveLength(0);
    expect(skipped[0]!.reason).toContain("Nested archive");
  });

  it("ignores macOS metadata", async () => {
    const archive = await zipOf({
      "__MACOSX/._MTR_B2B.csv": "junk",
      ".DS_Store": "junk",
      "MTR_B2B.csv": "a\n1",
    });

    const { files, skipped } = await expandArchive(archive);

    expect(files.map((f) => f.fileName)).toEqual(["MTR_B2B.csv"]);
    expect(skipped).toHaveLength(0);
  });
});

describe("placing an archive's contents into upload slots", () => {
  const entries = [
    { fileName: "MTR_B2C-JULY-2026.csv", file: new File([""], "b2c") },
    { fileName: "MTR_B2B-JULY-2026.csv", file: new File([""], "b2b") },
  ];

  it("matches the slot by what the marketplace named the file", () => {
    expect(chooseEntryForSlot(entries, "b2b")!.fileName).toContain("B2B");
    expect(chooseEntryForSlot(entries, "b2c")!.fileName).toContain("B2C");
  });

  it("uses the only file there is, whatever the slot", () => {
    const single = [{ fileName: "export.xlsx", file: new File([""], "x") }];

    expect(chooseEntryForSlot(single, "stock_transfer")!.fileName).toBe("export.xlsx");
  });

  it("returns nothing for an empty archive", () => {
    expect(chooseEntryForSlot([], "b2b")).toBeUndefined();
  });
});
