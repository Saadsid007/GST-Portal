import type { ComparableRow, Gstr1ComparisonResult } from "./gstr1.comparator";

/**
 * Runs the GSTR-1 comparison entirely in the browser.
 *
 * The reference file never leaves the machine. That is not a privacy flourish —
 * it is the only way this can work: a Government GSTR-1 Template V2.1 is around
 * 7 MB, and the deployment rejects request bodies over 4.5 MB
 * (FUNCTION_PAYLOAD_TOO_LARGE), a platform limit no application setting can
 * raise. Uploading the file to a Server Action could never have succeeded for
 * that template, which is why this failed in production and passed locally,
 * where no such limit sits in front of the app.
 *
 * Nothing here needs the server: the comparison is pure arithmetic over a file
 * the user already has, and the reference is validation-only — it is never
 * merged into the return.
 *
 * `xlsx` and the parser are imported dynamically so their weight lands only on
 * the person who actually opens the comparison, not on every page that reaches
 * this step.
 */
export async function compareGstr1InBrowser(
  ourRows: ComparableRow[],
  referenceFile: File
): Promise<
  | { success: true; data: Gstr1ComparisonResult & { sourceLabel: string } }
  | { success: false; error: string }
> {
  let parsedRef;
  try {
    const { parseGstr1Bytes } = await import("./gstr1-template.parser");
    const bytes = new Uint8Array(await referenceFile.arrayBuffer());
    parsedRef = parseGstr1Bytes(bytes, referenceFile.name);
  } catch (error) {
    // An unreadable workbook and a rejected upload used to look identical to the
    // user, and they need different fixes.
    return {
      success: false,
      error: `Could not read "${referenceFile.name}". ${
        error instanceof Error ? error.message : "The file may be corrupt or password protected."
      }`,
    };
  }

  const totalRefInvoices =
    parsedRef.b2b.length + parsedRef.b2cs.length + parsedRef.b2cl.length + parsedRef.cdnr.length;

  if (totalRefInvoices === 0) {
    return {
      success: false,
      error:
        "No GSTR-1 data found in the uploaded file. Please upload either:\n" +
        "• Amazon's auto-generated GSTR-1 Excel (GSTR1-MONTH-YEAR-*.xlsx)\n" +
        "• Government's GSTR-1 Excel Workbook Template V2.1",
    };
  }

  const { Gstr1Comparator } = await import("./gstr1.comparator");
  const result = Gstr1Comparator.compare(ourRows, parsedRef);

  return {
    success: true,
    data: {
      ...result,
      sourceLabel:
        parsedRef.sourceType === "amazon_gstr1"
          ? "Amazon Auto-Generated GSTR-1"
          : parsedRef.sourceType === "govt_template"
            ? "Government GSTR-1 Template V2.1"
            : "GSTR-1 Reference File",
    },
  };
}
