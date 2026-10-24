import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: 180, height: 180, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", borderRadius: 40 }}>
        <svg width="150" height="150" viewBox="0 0 64 64" fill="none">
          <rect x="6" y="6" width="52" height="52" rx="14" fill="#09090b" />
          <path d="M19 41 C 25 24, 31 24, 35 33 C 38 40, 42 36, 45 24" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx="45" cy="42" r="3.6" fill="#fff" />
        </svg>
      </div>
    ),
    size,
  );
}
