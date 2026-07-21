import { NextRequest, NextResponse } from "next/server";

const GROQ_API_KEY = process.env.GROQ_API_KEY!;
const TTS_MODEL = "canopylabs/orpheus-arabic-saudi";
const TTS_VOICE = "fahad";

function findDataChunk(wav: Uint8Array): { offset: number; size: number } | null {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  let pos = 12; // skip RIFF header (4 RIFF + 4 size + 4 WAVE)
  while (pos + 8 <= wav.length) {
    const id = String.fromCharCode(wav[pos], wav[pos + 1], wav[pos + 2], wav[pos + 3]);
    const size = view.getUint32(pos + 4, true);
    if (id === "data") {
      return { offset: pos + 8, size };
    }
    pos += 8 + size;
    if (pos % 2 !== 0) pos++; // WAV chunks are word-aligned
  }
  return null;
}

function extractWavMeta(wav: Uint8Array) {
  // Extract format info from the "fmt " chunk
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  let pos = 12;
  while (pos + 8 <= wav.length) {
    const id = String.fromCharCode(wav[pos], wav[pos + 1], wav[pos + 2], wav[pos + 3]);
    const size = view.getUint32(pos + 4, true);
    if (id === "fmt ") {
      return {
        fmtChunk: wav.slice(pos, pos + 8 + size),
        audioFormat: view.getUint16(pos + 8, true),
        channels: view.getUint16(pos + 10, true),
        sampleRate: view.getUint32(pos + 12, true),
        byteRate: view.getUint32(pos + 16, true),
        blockAlign: view.getUint16(pos + 20, true),
        bitsPerSample: view.getUint16(pos + 22, true),
      };
    }
    pos += 8 + size;
    if (pos % 2 !== 0) pos++;
  }
  return null;
}

function buildWav(fmtChunk: Uint8Array, pcmData: Uint8Array): Uint8Array {
  // RIFF header (12) + fmt chunk + data chunk header (8) + PCM
  const totalSize = 12 + fmtChunk.length + 8 + pcmData.length;
  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);

  // RIFF header
  out.set([0x52, 0x49, 0x46, 0x46]); // "RIFF"
  view.setUint32(4, totalSize - 8, true);
  out.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"

  // fmt chunk
  out.set(fmtChunk, 12);

  // data chunk
  const dataPos = 12 + fmtChunk.length;
  out.set([0x64, 0x61, 0x74, 0x61], dataPos); // "data"
  view.setUint32(dataPos + 4, pcmData.length, true);
  out.set(pcmData, dataPos + 8);

  return out;
}

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  if (!text?.trim()) {
    return NextResponse.json({ error: "No text" }, { status: 400 });
  }

  const sentences = text
    .split(/[.،؟!?\n]+/)
    .map((s: string) => s.trim())
    .filter(Boolean);

  const toSpeak = sentences.length ? sentences : [text];
  const wavBuffers: Uint8Array[] = [];

  for (const sentence of toSpeak) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: TTS_MODEL,
          voice: TTS_VOICE,
          input: sentence,
          response_format: "wav",
          speed: 1.7,
        }),
      });

      if (!res.ok) continue; // skip failed sentence, don't abort

      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length > 44) wavBuffers.push(buf);
    } catch {
      continue;
    }
  }

  if (wavBuffers.length === 0) {
    return NextResponse.json({ error: "TTS failed" }, { status: 500 });
  }

  if (wavBuffers.length === 1) {
    return new NextResponse(wavBuffers[0].buffer as ArrayBuffer, {
      headers: { "Content-Type": "audio/wav" },
    });
  }

  // Concatenate: extract PCM from each WAV properly
  const meta = extractWavMeta(wavBuffers[0]);
  if (!meta) {
    return new NextResponse(wavBuffers[0].buffer as ArrayBuffer, {
      headers: { "Content-Type": "audio/wav" },
    });
  }

  const pcmParts: Uint8Array[] = [];
  for (const wav of wavBuffers) {
    const dataChunk = findDataChunk(wav);
    if (dataChunk) {
      pcmParts.push(wav.slice(dataChunk.offset, dataChunk.offset + dataChunk.size));
    }
  }

  const totalPcm = pcmParts.reduce((n, p) => n + p.length, 0);
  const combined = new Uint8Array(totalPcm);
  let offset = 0;
  for (const part of pcmParts) {
    combined.set(part, offset);
    offset += part.length;
  }

  const finalWav = buildWav(meta.fmtChunk, combined);

  return new NextResponse(finalWav.buffer as ArrayBuffer, {
    headers: { "Content-Type": "audio/wav" },
  });
}
