import { NextRequest, NextResponse } from "next/server";

const GROQ_API_KEY = process.env.GROQ_API_KEY!;
const STT_MODEL = "whisper-large-v3-turbo";

const HALLUCINATIONS = [
  "ترجمة",
  "نانسي",
  "قنقر",
  "مشاهدة",
  "اشتركوا",
  "subscribe",
  "thank you for watching",
  "شكرا للمشاهدة",
  "تابعونا",
  "لا تنسوا",
  "السلام عليكم ورحمة الله",
  "بسم الله الرحمن الرحيم",
];

function isHallucination(text: string): boolean {
  const lower = text.trim().toLowerCase();
  if (!lower || lower.length < 2) return true;
  // Single repeated character
  if (/^(.)\1*$/.test(lower)) return true;
  return HALLUCINATIONS.some((h) => lower.includes(h));
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("audio") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No audio file" }, { status: 400 });
  }

  if (file.size < 2000) {
    return NextResponse.json(
      { text: "", error: "Recording too short" },
      { status: 200 }
    );
  }

  const groqForm = new FormData();
  groqForm.append("file", file, "recording.webm");
  groqForm.append("model", STT_MODEL);
  groqForm.append("language", "ar");
  groqForm.append("temperature", "0");
  groqForm.append(
    "prompt",
    "محادثة تحصيل ديون باللهجة السعودية النجدية. المتحدث عميل يتكلم عن سداد مبلغ مالي ومديونية. أمثلة: ايه تمام، والله ظروفي صعبة، يمديني ادفع بكرة، كم المبلغ، انا عبدالسلام، مناسب"
  );

  const res = await fetch(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
      body: groqForm,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const data = await res.json();
  const text = data.text?.trim() || "";

  if (isHallucination(text)) {
    return NextResponse.json({ text: "", error: "No speech detected" });
  }

  return NextResponse.json({ text });
}
