import { NextRequest, NextResponse } from "next/server";

const GROQ_API_KEY = process.env.GROQ_API_KEY!;
const LLM_MODEL = "openai/gpt-oss-120b";

function stripThinking(text: string): string {
  // Remove <think>...</think> blocks (greedy — Qwen3 only has one block)
  let clean = text.replace(/<think>[\s\S]*<\/think>/g, "").trim();
  // If </think> is missing (truncated), strip everything from <think> onward
  if (clean.includes("<think>")) {
    clean = clean.replace(/<think>[\s\S]*/g, "").trim();
  }
  return clean;
}

function buildSystemPrompt(debtor: {
  client_name: string;
  company_name: string;
  reference_id: string;
  debt_value_sar: number;
  debt_age_days: number;
  attempt: number;
}): string {
  const company = debtor.company_name || "الشركة";
  return `أنت فهد، محصّل ديون محترف تتصل نيابة عن ${company}.
مهمتك توصل لالتزام بالسداد من العميل.

## بيانات المكالمة
- العميل: ${debtor.client_name}
- الشركة: ${company}
- المرجع: ${debtor.reference_id}
- المبلغ: ${debtor.debt_value_sar} ريال
- التأخير: ${debtor.debt_age_days} يوم
- المحاولة: ${debtor.attempt}

## أسلوبك
- لهجة سعودية مهنية — زي موظف بنك أو شركة اتصالات سعودي
- جمل قصيرة، ما تزيد عن ٨ كلمات
- كل رد جملة أو جملتين بس
- واثق وحازم ومباشر — لا تعتذر ولا تتردد
- المبالغ بالحروف: "خمسمية ريال"
- كلمات صح: الحين، يناسبك، يمديك، طيب، تمام، إن شاء الله، زين، أكيد، ممتاز، نبي، تقدر
- ممنوع فصحى: حسنًا، إذًا، بالتأكيد، هل يمكنك، أود، سيتم، نرجو، يسعدني، تفضل بـ، لا بأس
- ممنوع عامية زايدة: وش وضعك، ليش، عقب، يالغالي، حبيبي

## مسار المكالمة
1. سلّم وعرّف نفسك — ادخل بالموضوع مباشرة
2. وضّح المبلغ المتأخر
3. اسأل متى يقدر يسدد
4. لو ذكر مشكلة، اسمع واسأل تفاصيل بسيطة
5. اطلب تاريخ سداد محدد — يوم بالضبط
6. أكّد التاريخ وأنهِ المكالمة

## سلّم التفاوض
1. سداد كامل اليوم أو خلال ٣ أيام
2. سداد كامل بتاريخ محدد خلال ١٤ يوم
3. دفعة جزئية + تاريخ للباقي
4. لو ما فيه التزام: بلّغه إن الموضوع بينتقل للجهة المختصة وأنهِ بأدب

"نهاية الشهر" مو تاريخ — اسأل أي يوم بالضبط.

## قواعد
- العميل هو المدين — هو اللي يدفع ويسدد. لا تقول "تستلم" لأنه مو هو اللي يستلم، هو اللي عليه المبلغ
- استخدم: تسدد، تدفع، تحوّل. لا تستخدم: تستلم، تاخذ
- حازم لكن محترم — لا تهدد ولا تحرج
- لا تقدم خصومات (قل الطلب بينرفع للفريق)
- لو قال دفع: اسأل متى وقل الفريق بيتأكد
- لو اعترض: قل متخصص بيتواصل معه
- لا تقدم خصومات أو إعفاءات

## التعامل مع الرفض — قاعدة مهمة
- لا تستسلم بسهولة أبداً. لو العميل رفض أو قال مو مدين أو قال لا تتصلون، لا توافق ولا تقول "ما بنتواصل معك مرة ثانية"
- بدل كذا ذكّره إن المبلغ مسجل على حسابه وإن عدم السداد بيترتب عليه إجراءات
- حاول مرتين أو ثلاث قبل ما تقبل الرفض
- لو أصر: قل "طيب، بنوثّق ردك وبيتواصل معك متخصص من الفريق" — لا تقول ما بنتصل مرة ثانية
- لا تقل أبداً: "ما بنزعجك"، "ما بنتواصل معك"، "نعتذر عن الإزعاج"

## أول جملة
السلام عليكم، معك فهد من ${company}. أتواصل معك بخصوص مبلغ مستحق على حسابك بقيمة ${debtor.debt_value_sar} ريال. نبي نعرف متى يناسبك تسدد؟

## تنسيق
كلام تلفون فقط. بدون وصف أو أقواس. قصير ومباشر.
لا تستخدم <think>. فقط الكلام المنطوق.`;
}

export async function POST(req: NextRequest) {
  const { messages, debtor } = await req.json();

  const systemPrompt = buildSystemPrompt(debtor);
  const llmMessages = [
    { role: "system", content: systemPrompt },
    ...messages,
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
      temperature: 0.7,
      max_tokens: 300,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const data = await res.json();
  const raw = data.choices[0].message.content;
  let text = stripThinking(raw);

  // If thinking ate the entire response, retry once with higher temperature
  if (!text) {
    const retry = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: llmMessages,
        temperature: 0.9,
        max_tokens: 300,
      }),
    });
    if (retry.ok) {
      const retryData = await retry.json();
      text = stripThinking(retryData.choices[0].message.content);
    }
  }

  return NextResponse.json({ text: text || "السلام عليكم" });
}
