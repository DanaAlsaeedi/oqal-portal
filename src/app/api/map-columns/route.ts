import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const FIELD_PATTERNS: [string, RegExp[]][] = [
  ["debtAgeDays", [/عمر.*دين|أيام|age.*days|days.*overdue|عمر/i]],
  ["clientName", [/اسم.*عميل|عميل|client.*name|debtor.*name|الاسم/i]],
  ["phoneNumber", [/جوال|هاتف|رقم.*جوال|phone|mobile|tel/i]],
  ["referenceId", [/مرجع|رقم.*مرجع|reference|ref|invoice|فاتورة/i]],
  ["debtValueSar", [/قيمة.*دين|مبلغ|debt.*value|amount|sar|المبلغ/i]],
  ["companyName", [/شركة|اسم.*شركة|company|creditor|مؤسسة/i]],
];

function heuristicMap(headers: string[], sampleRows: Record<string, string>[]) {
  return headers.map((header) => {
    let bestField: string | null = null;
    let bestConfidence = 0;

    for (const [field, patterns] of FIELD_PATTERNS) {
      for (const pattern of patterns) {
        if (pattern.test(header)) {
          bestField = field;
          bestConfidence = 0.85;
          break;
        }
      }
      if (bestField) break;
    }

    if (!bestField && sampleRows.length > 0) {
      const val = String(sampleRows[0][header] ?? "");
      if (/^\+?966|^05\d{8}$/.test(val.replace(/\s/g, ""))) {
        bestField = "phoneNumber";
        bestConfidence = 0.9;
      } else if (/^\d+(\.\d+)?$/.test(val) && parseFloat(val) > 100) {
        bestField = "debtValueSar";
        bestConfidence = 0.6;
      }
    }

    return {
      sourceColumn: header,
      targetField: bestField,
      confidence: bestField ? bestConfidence : 0,
      sampleValues: sampleRows.slice(0, 3).map((row) => String(row[header] ?? "")),
    };
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { headers, sampleRows } = await req.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const mappings = heuristicMap(headers, sampleRows);
    return NextResponse.json({ mappings, method: "heuristic" });
  }

  try {
    const client = new Anthropic({ apiKey });

    const sampleTable = sampleRows
      .map((row: Record<string, string>) =>
        headers.map((h: string) => `${h}: ${row[h]}`).join(" | ")
      )
      .join("\n");

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are a data mapping assistant. Given spreadsheet column headers and sample data, map each column to the most appropriate field from this list:

TARGET FIELDS:
- clientName: The debtor's name (Arabic or English)
- phoneNumber: Mobile/phone number (Saudi format +966... or 05...)
- referenceId: Invoice number, reference, or ID
- debtValueSar: The debt amount in SAR (numbers)
- debtAgeDays: How many days the debt has been outstanding (numbers)
- companyName: The creditor/company name

If a column doesn't match any field, map it to null.

SPREADSHEET COLUMNS: ${JSON.stringify(headers)}

SAMPLE DATA (first 3 rows):
${sampleTable}

Respond with ONLY a valid JSON array, no markdown, no explanation. Each element should be:
{"sourceColumn": "original column name", "targetField": "fieldName or null", "confidence": 0.0-1.0}

Example response:
[{"sourceColumn":"اسم العميل","targetField":"clientName","confidence":0.95},{"sourceColumn":"Notes","targetField":null,"confidence":0.9}]`,
        },
      ],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    let mappings;
    try {
      const jsonStr = text.replace(/```json\n?|\n?```/g, "").trim();
      mappings = JSON.parse(jsonStr);
    } catch {
      const fallback = heuristicMap(headers, sampleRows);
      return NextResponse.json({ mappings: fallback, method: "heuristic" });
    }

    const enriched = mappings.map(
      (m: { sourceColumn: string; targetField: string | null; confidence: number }) => ({
        ...m,
        sampleValues: sampleRows
          .slice(0, 3)
          .map((row: Record<string, string>) => String(row[m.sourceColumn] ?? "")),
      })
    );

    return NextResponse.json({ mappings: enriched, method: "ai" });
  } catch {
    const fallback = heuristicMap(headers, sampleRows);
    return NextResponse.json({ mappings: fallback, method: "heuristic" });
  }
}
