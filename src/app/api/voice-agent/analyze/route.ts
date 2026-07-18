import { NextRequest, NextResponse } from "next/server";

const GROQ_API_KEY = process.env.GROQ_API_KEY!;
const LLM_MODEL = "openai/gpt-oss-120b";

export async function POST(req: NextRequest) {
  const { messages, debtor } = await req.json();

  const analysisPrompt = `حلل المكالمة السابقة وارجع JSON فقط بهذا الشكل:
{
  "call_outcome": "ptp" | "no_commitment" | "callback" | "dispute" | "refused" | "wrong_person",
  "call_summary": "ملخص بجملتين بالعربي",
  "promise_to_pay_date": "YYYY-MM-DD أو null",
  "promise_to_pay_amount": رقم أو null,
  "pay_probability": 0-100,
  "customer_sentiment": "positive" | "neutral" | "negative" | "hostile"
}
ارجع JSON فقط بدون أي نص ثاني.`;

  const llmMessages = [
    ...messages,
    { role: "user", content: analysisPrompt },
  ];

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: llmMessages,
      temperature: 0,
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const data = await res.json();
  let text = data.choices[0].message.content?.trim() || "";

  // Strip markdown code fences
  if (text.startsWith("```")) {
    text = text.split("\n").slice(1).join("\n").replace(/```\s*$/, "").trim();
  }

  try {
    const analysis = JSON.parse(text);
    return NextResponse.json(analysis);
  } catch {
    return NextResponse.json({
      call_outcome: "unknown",
      call_summary: text,
      pay_probability: 0,
      customer_sentiment: "neutral",
    });
  }
}
