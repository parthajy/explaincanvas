"use client";

import { useEffect, useState } from "react";

/**
 * A dismissible video card. Shows the thumbnail first and loads the YouTube player only on tap, so the
 * landing page stays fast and no YouTube script runs until the visitor asks for it. Closing is remembered.
 */
export function VideoCard({ videoId, title, dark }: { videoId: string; title: string; dark: { panel: string; line: string; muted: string; text: string; bg: string } }) {
  const KEY = `ec-video-closed:${videoId}`;
  const [closed, setClosed] = useState(false);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "1") setTimeout(() => setClosed(true), 0);
    } catch {}
  }, [KEY]);
  if (closed) return null;
  function close() {
    setClosed(true);
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
  }
  return (
    <section className="mx-auto max-w-6xl px-6 pt-20" aria-label="Video">
      <div className="relative overflow-hidden rounded-[28px] border" style={{ borderColor: dark.line, background: dark.panel }}>
        <div className="flex items-center justify-between px-5 py-3 text-[13px]" style={{ color: dark.muted }}>
          <span>{title}</span>
          <button onClick={close} className="flex h-8 w-8 items-center justify-center rounded-full border transition hover:bg-white/10" style={{ borderColor: dark.line, color: dark.text }} aria-label="Close video">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="relative aspect-video w-full bg-black">
          {playing ? (
            <iframe
              className="absolute inset-0 h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&color=white`}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <button onClick={() => setPlaying(true)} className="group absolute inset-0 h-full w-full" aria-label={`Play: ${title}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`}
                onError={(e) => {
                  const img = e.currentTarget;
                  if (!img.src.includes("hqdefault")) img.src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
                }}
                alt=""
                className="h-full w-full object-cover opacity-80 transition group-hover:opacity-100"
              />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-20 w-20 items-center justify-center rounded-full transition group-hover:scale-105" style={{ background: dark.text, color: dark.bg }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
