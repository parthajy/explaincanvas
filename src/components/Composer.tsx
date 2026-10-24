"use client";

import { useEffect, useRef, useState } from "react";

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export interface Attachment {
  type: "image";
  path: string;
  mediaType: "image/png" | "image/jpeg" | "image/webp";
  previewUrl: string;
}

function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function Composer({
  onSend,
  disabled,
  compact,
  autoFocus,
  initialText,
  language,
  onLanguageChange,
}: {
  onSend: (text: string, attachments: Attachment[]) => Promise<void>;
  disabled?: boolean;
  compact?: boolean;
  autoFocus?: boolean;
  /** Pre-filled question, e.g. from a marketing page's "ask this" link. */
  initialText?: string;
  language?: "english" | "hinglish";
  onLanguageChange?: (l: "english" | "hinglish") => void;
}) {
  const [text, setText] = useState(initialText ?? "");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const speechRef = useRef<{ stop: () => void } | null>(null);
  const baseTextRef = useRef("");

  useEffect(() => {
    if (autoFocus) taRef.current?.focus();
  }, [autoFocus]);

  function resize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 220) + "px";
  }

  async function submit() {
    const t = text.trim();
    if (!t && !attachment) return;
    setBusy(true);
    try {
      await onSend(t || "Explain what is in this photo.", attachment ? [attachment] : []);
      setText("");
      setAttachment(null);
      if (taRef.current) taRef.current.style.height = "auto";
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    setUploading(true);
    setNote(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      if (!res.ok) throw new Error("upload failed");
      const { path, mediaType } = await res.json();
      setAttachment({ type: "image", path, mediaType, previewUrl: URL.createObjectURL(file) });
    } catch {
      setNote("Could not upload that photo. PNG, JPG or WEBP up to 8 MB.");
    } finally {
      setUploading(false);
    }
  }

  /** The browser's own recogniser is free and instant; use it when present. */
  function startBrowserSpeech(): boolean {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return false;
    const rec = new Ctor();
    rec.lang = "en-IN";
    rec.continuous = true;
    rec.interimResults = true;
    baseTextRef.current = text.trim();
    let finalText = "";
    rec.onresult = (ev) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finalText += (finalText ? " " : "") + r[0].transcript.trim();
        else interim += r[0].transcript;
      }
      const combined = [baseTextRef.current, finalText, interim].filter(Boolean).join(" ");
      setText(combined);
      requestAnimationFrame(() => taRef.current && resize(taRef.current));
    };
    rec.onerror = (ev) => {
      if (ev.error === "not-allowed") setNote("Microphone access was blocked. Allow it in the browser and try again.");
      setRecording(false);
      speechRef.current = null;
    };
    rec.onend = () => {
      setRecording(false);
      speechRef.current = null;
      taRef.current?.focus();
    };
    rec.start();
    speechRef.current = rec;
    setRecording(true);
    setTimeout(() => speechRef.current === rec && rec.stop(), 60_000);
    return true;
  }

  async function toggleRecording() {
    if (recording) {
      speechRef.current?.stop();
      recRef.current?.stop();
      return;
    }
    setNote(null);
    if (startBrowserSpeech()) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 1000) return;
        setTranscribing(true);
        try {
          const fd = new FormData();
          fd.append("audio", blob, "dictation.webm");
          const res = await fetch("/api/transcribe", { method: "POST", body: fd });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body.message ?? "transcription failed");
          if (body.text) {
            setText((prev) => (prev ? `${prev.trim()} ${body.text}` : body.text));
            requestAnimationFrame(() => taRef.current && resize(taRef.current));
            taRef.current?.focus();
          }
        } catch (err) {
          setNote(err instanceof Error ? err.message : "Could not transcribe that.");
        } finally {
          setTranscribing(false);
        }
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
      // Hard stop at 60 seconds.
      setTimeout(() => rec.state === "recording" && rec.stop(), 60_000);
    } catch {
      setNote("Microphone access was blocked. Allow it in the browser and try again.");
    }
  }

  const canSend = !disabled && !busy && !uploading && !transcribing && (text.trim().length > 0 || attachment);

  return (
    <div className="w-full">
      <div className={`rounded-[26px] border border-border bg-panel transition focus-within:border-border-2 ${compact ? "shadow-[0_8px_30px_-18px_rgba(0,0,0,0.35)]" : "shadow-(--shadow)"}`}>
        {attachment && (
          <div className="flex items-center gap-3 px-4 pt-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={attachment.previewUrl} alt="attachment" className="h-14 w-14 rounded-xl object-cover" />
            <button onClick={() => setAttachment(null)} className="text-xs text-muted hover:text-text">
              Remove
            </button>
          </div>
        )}
        <div className="flex items-end gap-2 px-3 py-2.5">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-panel-2 hover:text-text" aria-label="Add a photo of the page" title="Add a photo">
            <Icon d="M12 5v14M5 12h14" size={20} />
          </button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
          <textarea
            ref={taRef}
            value={text}
            rows={1}
            onChange={(e) => {
              setText(e.target.value);
              resize(e.target);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder={recording ? "Listening..." : transcribing ? "Writing that down..." : compact ? "Ask a follow-up or a new question" : "Ask anything you are stuck on"}
            className="max-h-[220px] min-h-[40px] w-full resize-none bg-transparent py-2 text-[16px] leading-6 outline-none placeholder:text-faint"
            disabled={disabled}
          />
          <button
            type="button"
            onClick={() => void toggleRecording()}
            disabled={transcribing}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${recording ? "recording bg-red-500 text-white" : "text-muted hover:bg-panel-2 hover:text-text"}`}
            aria-label={recording ? "Stop dictating" : "Dictate your question"}
            title={recording ? "Stop" : "Dictate"}
          >
            {recording ? <span className="h-3.5 w-3.5 rounded-sm bg-white" /> : <Icon d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM19 11a7 7 0 0 1-14 0M12 18v3" size={18} />}
          </button>
          <button onClick={() => void submit()} disabled={!canSend} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition disabled:opacity-30" aria-label="Send">
            {uploading || busy || transcribing ? (
              <span className="flex gap-0.5">
                <i className="dot h-1.5 w-1.5 rounded-full bg-on-primary" />
                <i className="dot h-1.5 w-1.5 rounded-full bg-on-primary" />
                <i className="dot h-1.5 w-1.5 rounded-full bg-on-primary" />
              </span>
            ) : (
              <Icon d="M12 19V5M5 12l7-7 7 7" size={18} />
            )}
          </button>
        </div>
      </div>
      {onLanguageChange && (
        <div className="mt-2 flex items-center justify-center gap-1 text-[11px] text-faint">
          <span className="mr-1">Explain in</span>
          {(["english", "hinglish"] as const).map((l) => (
            <button key={l} type="button" onClick={() => onLanguageChange(l)} className={`rounded-full px-2.5 py-0.5 transition ${language === l ? "bg-text text-bg" : "hover:text-text"}`} aria-pressed={language === l}>
              {l === "english" ? "English" : "Hinglish"}
            </button>
          ))}
        </div>
      )}
      {note && <p className="mt-2 text-center text-xs text-danger">{note}</p>}
      {!compact && !note && <p className="mt-3 text-center text-xs text-faint">Type, dictate, or add a photo of the page. Every explanation is checked before you see it.</p>}
    </div>
  );
}
