import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as XLSX from "xlsx";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  if (data.length === 0) {
    return NextResponse.json({ error: "Empty sheet" }, { status: 400 });
  }

  const headers = Object.keys(data[0]);
  const sampleRows = data.slice(0, 3).map((row) =>
    headers.reduce(
      (acc, h) => {
        acc[h] = String(row[h] ?? "");
        return acc;
      },
      {} as Record<string, string>
    )
  );

  return NextResponse.json({
    fileName: file.name,
    headers,
    sampleRows,
    totalRows: data.length,
  });
}
