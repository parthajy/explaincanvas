import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "ExplainCanvas. Type anything you are stuck on. Understand it visually.";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#0a0a0a",
          fontFamily: "system-ui, sans-serif",
          color: "#fafafa",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <rect x="6" y="6" width="52" height="52" rx="14" fill="#fafafa" />
            <path d="M19 41 C 25 24, 31 24, 35 33 C 38 40, 42 36, 45 24" stroke="#0a0a0a" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <circle cx="45" cy="42" r="3.6" fill="#0a0a0a" />
          </svg>
          <div style={{ fontSize: 40, fontWeight: 600, display: "flex" }}>
            Explain<span style={{ color: "#8a8a8a", fontWeight: 400 }}>Canvas</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 600, letterSpacing: -2, lineHeight: 1.05 }}>Type anything you are stuck on.</div>
          <div style={{ fontSize: 76, fontWeight: 600, letterSpacing: -2, lineHeight: 1.05, color: "#8a8a8a" }}>Understand it visually.</div>
        </div>
        <div style={{ fontSize: 28, color: "#8a8a8a" }}>Diagrams, steps, 3D and animation for any subject at any level, checked for accuracy before you see them.</div>
      </div>
    ),
    size,
  );
}
