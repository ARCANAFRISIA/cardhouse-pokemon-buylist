import { NextRequest, NextResponse } from "next/server";
import { importPowertoolsCsv } from "@/lib/powertoolsImport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "No file uploaded" },
        { status: 400 }
      );
    }

    const text = await file.text();

    const result = await importPowertoolsCsv({
      text,
      filename: file.name,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message ?? "Import failed",
      },
      { status: 500 }
    );
  }
}