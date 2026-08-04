import { NextResponse } from "next/server";
import { VersioningManager } from "@/features/convert/engine/versioning/versioning.manager";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const platformId = searchParams.get("platform") || "amazon";

  const buffer = VersioningManager.generateSampleExcel(platformId);

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Sample_${platformId}_Template.xlsx"`,
    },
  });
}
