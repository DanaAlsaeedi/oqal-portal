"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface CallAnalysis {
  call_outcome: string;
  call_summary: string;
  promise_to_pay_date: string | null;
  promise_to_pay_amount: number | null;
  pay_probability: number;
  customer_sentiment: string;
}

const DEFAULT_DEBTOR = {
  client_name: "",
  company_name: "",
  reference_id: "",
  debt_value_sar: 0,
  debt_age_days: 0,
  attempt: 1,
};

const OUTCOME_LABELS: Record<string, { label: string; color: string }> = {
  ptp: { label: "Promise to Pay", color: "text-green" },
  no_commitment: { label: "No Commitment", color: "text-yellow" },
  callback: { label: "Callback", color: "text-accent" },
  dispute: { label: "Dispute", color: "text-red" },
  refused: { label: "Refused", color: "text-red" },
  wrong_person: { label: "Wrong Person", color: "text-text-3" },
  unknown: { label: "Unknown", color: "text-text-3" },
};

const SENTIMENT_LABELS: Record<string, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
  hostile: "Hostile",
};

export default function TestCallPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [callStarted, setCallStarted] = useState(false);
  const [debtor, setDebtor] = useState(DEFAULT_DEBTOR);
  const [showConfig, setShowConfig] = useState(true);
  const [analysis, setAnalysis] = useState<CallAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const transcriptEnd = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const unlock = () => {
      if (audioRef.current) {
        audioRef.current.play().catch(() => {});
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      document.removeEventListener("click", unlock);
    };
    document.addEventListener("click", unlock);
    return () => document.removeEventListener("click", unlock);
  }, []);

  const playAudio = useCallback(async (text: string) => {
    if (!text?.trim()) return;
    try {
      const ttsRes = await fetch("/api/voice-agent/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!ttsRes.ok) return;
      const arrayBuf = await ttsRes.arrayBuffer();
      if (arrayBuf.byteLength < 100) return;
      const blob = new Blob([arrayBuf], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.src = url;
        await audioRef.current.play().catch((e) => console.warn("Audio play blocked:", e));
      }
    } catch (e) {
      console.warn("TTS error:", e);
    }
  }, []);

  const sendToAgent = useCallback(
    async (userText: string) => {
      const newMessages: Message[] = [
        ...messages,
        { role: "user", content: userText },
      ];
      setMessages(newMessages);
      setProcessing(true);

      try {
        const chatRes = await fetch("/api/voice-agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: newMessages, debtor }),
        });
        const { text: agentText } = await chatRes.json();
        setMessages([...newMessages, { role: "assistant", content: agentText }]);
        await playAudio(agentText);
      } catch (err) {
        console.error("Agent error:", err);
      } finally {
        setProcessing(false);
      }
    },
    [messages, debtor, playAudio]
  );

  const startCall = useCallback(async () => {
    setCallStarted(true);
    setShowConfig(false);
    setMessages([]);
    setAnalysis(null);
    setProcessing(true);

    try {
      const chatRes = await fetch("/api/voice-agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "[The call has just connected. Start the conversation.]" }],
          debtor,
        }),
      });
      const { text: agentText } = await chatRes.json();
      setMessages([{ role: "assistant", content: agentText }]);
      await playAudio(agentText);
    } catch (err) {
      console.error("Start call error:", err);
    } finally {
      setProcessing(false);
    }
  }, [debtor, playAudio]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      });
      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
        audioBitsPerSecond: 128000,
      });
      audioChunks.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunks.current, { type: "audio/webm" });
        setProcessing(true);

        try {
          const form = new FormData();
          form.append("audio", blob, "recording.webm");
          const sttRes = await fetch("/api/voice-agent/stt", { method: "POST", body: form });
          const { text } = await sttRes.json();

          if (text?.trim()) {
            await sendToAgent(text);
          } else {
            setProcessing(false);
          }
        } catch (err) {
          console.error("STT error:", err);
          setProcessing(false);
        }
      };

      mediaRecorder.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Mic access denied:", err);
    }
  }, [sendToAgent]);

  const stopRecording = useCallback(() => {
    mediaRecorder.current?.stop();
    setRecording(false);
  }, []);

  const endCall = useCallback(async () => {
    setCallStarted(false);
    if (messages.length < 2) {
      setShowConfig(true);
      return;
    }

    setAnalyzing(true);
    try {
      const res = await fetch("/api/voice-agent/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, debtor }),
      });
      const data = await res.json();
      setAnalysis(data);
    } catch (err) {
      console.error("Analysis error:", err);
    } finally {
      setAnalyzing(false);
    }
  }, [messages, debtor]);

  const newCall = useCallback(() => {
    setAnalysis(null);
    setMessages([]);
    setShowConfig(true);
  }, []);

  const probColor = (p: number) => {
    if (p >= 70) return "text-green";
    if (p >= 40) return "text-yellow";
    return "text-red";
  };

  return (
    <div className="min-h-screen bg-ground flex flex-col">
      <audio ref={audioRef} preload="none" />
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg className="w-7 h-7 text-accent" viewBox="-12 -12 124 124" fill="none">
            <path stroke="currentColor" strokeWidth="6.5" strokeLinejoin="round" d="M94 50 L63 19 L15 31 L15 69 L63 81 Z" />
            <g fill="currentColor">
              <circle cx="94" cy="50" r="5.5" />
              <circle cx="63" cy="19" r="5.5" />
              <circle cx="15" cy="31" r="5.5" />
              <circle cx="15" cy="69" r="5.5" />
              <circle cx="63" cy="81" r="5.5" />
            </g>
          </svg>
          <span className="text-sm font-bold text-text-1" style={{ fontFamily: "'Space Mono', monospace", letterSpacing: "0.04em" }}>
            AQAL<span className="text-accent">AI</span>
          </span>
          <span className="text-text-3 text-sm ml-2">Voice Agent Test</span>
        </div>
        {callStarted && (
          <button onClick={endCall} className="px-4 py-1.5 bg-red/10 text-red rounded-lg text-sm hover:bg-red/20 transition">
            End Call
          </button>
        )}
      </header>

      <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto px-4 py-6">
        {/* Config Panel */}
        {showConfig && !analysis && (
          <div className="bg-surface border border-border rounded-xl p-5 mb-6">
            <h2 className="text-sm font-semibold text-text-1 mb-4">Debtor Details</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-2 mb-1">Name</label>
                <input value={debtor.client_name} onChange={(e) => setDebtor({ ...debtor, client_name: e.target.value })} className="w-full px-3 py-2 bg-surface-alt border border-border rounded-lg text-sm text-text-1 focus:outline-none focus:ring-2 focus:ring-accent/30" dir="rtl" placeholder="اسم العميل" />
              </div>
              <div>
                <label className="block text-xs text-text-2 mb-1">Company</label>
                <input value={debtor.company_name} onChange={(e) => setDebtor({ ...debtor, company_name: e.target.value })} className="w-full px-3 py-2 bg-surface-alt border border-border rounded-lg text-sm text-text-1 focus:outline-none focus:ring-2 focus:ring-accent/30" dir="rtl" placeholder="اسم الشركة" />
              </div>
              <div>
                <label className="block text-xs text-text-2 mb-1">Reference</label>
                <input value={debtor.reference_id} onChange={(e) => setDebtor({ ...debtor, reference_id: e.target.value })} className="w-full px-3 py-2 bg-surface-alt border border-border rounded-lg text-sm text-text-1 focus:outline-none focus:ring-2 focus:ring-accent/30" placeholder="INV-001" />
              </div>
              <div>
                <label className="block text-xs text-text-2 mb-1">Amount (SAR)</label>
                <input type="number" value={debtor.debt_value_sar || ""} onChange={(e) => setDebtor({ ...debtor, debt_value_sar: Number(e.target.value) })} className="w-full px-3 py-2 bg-surface-alt border border-border rounded-lg text-sm text-text-1 focus:outline-none focus:ring-2 focus:ring-accent/30" placeholder="0" />
              </div>
              <div>
                <label className="block text-xs text-text-2 mb-1">Days Overdue</label>
                <input type="number" value={debtor.debt_age_days || ""} onChange={(e) => setDebtor({ ...debtor, debt_age_days: Number(e.target.value) })} className="w-full px-3 py-2 bg-surface-alt border border-border rounded-lg text-sm text-text-1 focus:outline-none focus:ring-2 focus:ring-accent/30" placeholder="0" />
              </div>
              <div>
                <label className="block text-xs text-text-2 mb-1">Attempt #</label>
                <input type="number" value={debtor.attempt} onChange={(e) => setDebtor({ ...debtor, attempt: Number(e.target.value) })} className="w-full px-3 py-2 bg-surface-alt border border-border rounded-lg text-sm text-text-1 focus:outline-none focus:ring-2 focus:ring-accent/30" />
              </div>
            </div>
            <button onClick={startCall} className="w-full mt-5 py-3 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-semibold transition">
              Start Call
            </button>
          </div>
        )}

        {/* Call Transcript */}
        {callStarted && (
          <>
            <div className="flex-1 overflow-y-auto space-y-3 mb-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] px-4 py-2.5 rounded-xl text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-accent/15 text-text-1 rounded-br-sm"
                        : "bg-surface border border-border text-text-1 rounded-bl-sm"
                    }`}
                    dir="rtl"
                  >
                    <div className="text-[10px] text-text-3 mb-1" dir="ltr">
                      {msg.role === "user" ? "You" : "Fahad (Agent)"}
                    </div>
                    {msg.content}
                  </div>
                </div>
              ))}

              {processing && (
                <div className="flex justify-start">
                  <div className="bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-text-3 rounded-bl-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" style={{ animationDelay: "200ms" }} />
                      <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" style={{ animationDelay: "400ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={transcriptEnd} />
            </div>

            {/* Mic Button */}
            <div className="flex justify-center pb-4">
              <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                disabled={processing}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all select-none ${
                  recording
                    ? "bg-red scale-110 shadow-[0_0_40px_rgba(160,64,64,0.4)]"
                    : processing
                      ? "bg-surface border-2 border-border opacity-50 cursor-not-allowed"
                      : "bg-accent hover:bg-accent-hover hover:scale-105 shadow-[0_0_30px_rgba(196,162,90,0.2)]"
                }`}
              >
                {recording ? (
                  <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-center text-xs text-text-3 pb-2">
              {recording ? "Recording... release to send" : processing ? "Processing..." : "Hold to speak"}
            </p>
          </>
        )}

        {/* Analysis Panel — shown after End Call */}
        {!callStarted && (analyzing || analysis) && (
          <div className="space-y-4">
            {/* Transcript replay */}
            {messages.length > 0 && (
              <div className="bg-surface border border-border rounded-xl p-4">
                <h3 className="text-xs font-semibold text-text-2 mb-3">Call Transcript</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {messages.map((msg, i) => (
                    <div key={i} className="text-sm" dir="rtl">
                      <span className="text-text-3 text-xs" dir="ltr">
                        {msg.role === "user" ? "Customer" : "Agent"}:
                      </span>{" "}
                      <span className="text-text-1">{msg.content}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analyzing ? (
              <div className="bg-surface border border-border rounded-xl p-6 text-center">
                <div className="flex items-center justify-center gap-2 text-text-2 text-sm">
                  <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                  Analyzing call...
                </div>
              </div>
            ) : analysis ? (
              <div className="bg-surface border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-text-1 mb-4">Call Analysis</h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* Outcome */}
                  <div className="bg-surface-alt rounded-lg p-3">
                    <div className="text-[10px] text-text-3 uppercase tracking-wider mb-1">Outcome</div>
                    <div className={`text-sm font-semibold ${OUTCOME_LABELS[analysis.call_outcome]?.color || "text-text-1"}`}>
                      {OUTCOME_LABELS[analysis.call_outcome]?.label || analysis.call_outcome}
                    </div>
                  </div>

                  {/* Pay Probability */}
                  <div className="bg-surface-alt rounded-lg p-3">
                    <div className="text-[10px] text-text-3 uppercase tracking-wider mb-1">Pay Probability</div>
                    <div className={`text-2xl font-bold ${probColor(analysis.pay_probability)}`}>
                      {analysis.pay_probability}%
                    </div>
                  </div>

                  {/* Sentiment */}
                  <div className="bg-surface-alt rounded-lg p-3">
                    <div className="text-[10px] text-text-3 uppercase tracking-wider mb-1">Sentiment</div>
                    <div className="text-sm font-semibold text-text-1">
                      {SENTIMENT_LABELS[analysis.customer_sentiment] || analysis.customer_sentiment}
                    </div>
                  </div>

                  {/* PTP Date */}
                  <div className="bg-surface-alt rounded-lg p-3">
                    <div className="text-[10px] text-text-3 uppercase tracking-wider mb-1">PTP Date</div>
                    <div className="text-sm font-semibold text-text-1">
                      {analysis.promise_to_pay_date || "—"}
                    </div>
                  </div>

                  {/* PTP Amount */}
                  {analysis.promise_to_pay_amount && (
                    <div className="bg-surface-alt rounded-lg p-3">
                      <div className="text-[10px] text-text-3 uppercase tracking-wider mb-1">PTP Amount</div>
                      <div className="text-sm font-semibold text-text-1">
                        {analysis.promise_to_pay_amount} SAR
                      </div>
                    </div>
                  )}
                </div>

                {/* Summary */}
                <div className="mt-4 bg-surface-alt rounded-lg p-3">
                  <div className="text-[10px] text-text-3 uppercase tracking-wider mb-1">Summary</div>
                  <p className="text-sm text-text-1 leading-relaxed" dir="rtl">
                    {analysis.call_summary}
                  </p>
                </div>
              </div>
            ) : null}

            <button onClick={newCall} className="w-full py-3 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-semibold transition">
              New Call
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
