import { ImageResponse } from "next/og";

export const alt = "Foleyo — your offline course player";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0f",
          color: "#e8e8f0",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 160,
            height: 160,
            marginBottom: 48,
            borderRadius: 36,
            background: "#12121a",
            border: "2px solid #2a2a3a",
          }}
        >
          {/* Stylized folder + play mark, echoing the app icon */}
          <svg width="96" height="96" viewBox="0 0 24 24" fill="none">
            <path
              d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
              stroke="#7c5cfc"
              strokeWidth="1.75"
              strokeLinejoin="round"
            />
            <path d="M10 9.5v5l4.5-2.5z" fill="#7c5cfc" />
          </svg>
        </div>
        <div style={{ display: "flex", fontSize: 88, fontWeight: 700 }}>
          Foleyo
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 20,
            fontSize: 32,
            color: "#8888a0",
          }}
        >
          Your offline course player — nothing uploaded, nothing installed.
        </div>
      </div>
    ),
    size
  );
}
