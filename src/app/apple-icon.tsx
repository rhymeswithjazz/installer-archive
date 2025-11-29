import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1a1a2e 0%, #0f0f1a 100%)",
          borderRadius: "32px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Top bar of archive box */}
          <div
            style={{
              width: "120px",
              height: "28px",
              background: "linear-gradient(135deg, #a78bfa 0%, #c084fc 100%)",
              borderRadius: "6px",
              marginBottom: "4px",
            }}
          />
          {/* Body of archive box */}
          <div
            style={{
              width: "120px",
              height: "72px",
              border: "6px solid transparent",
              borderImage: "linear-gradient(135deg, #a78bfa 0%, #c084fc 100%) 1",
              borderTop: "none",
              borderBottomLeftRadius: "12px",
              borderBottomRightRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            {/* Left border */}
            <div
              style={{
                position: "absolute",
                left: "0",
                top: "0",
                bottom: "0",
                width: "6px",
                background: "linear-gradient(180deg, #a78bfa 0%, #b794f6 100%)",
              }}
            />
            {/* Right border */}
            <div
              style={{
                position: "absolute",
                right: "0",
                top: "0",
                bottom: "0",
                width: "6px",
                background: "linear-gradient(180deg, #b794f6 0%, #c084fc 100%)",
              }}
            />
            {/* Bottom border */}
            <div
              style={{
                position: "absolute",
                left: "0",
                right: "0",
                bottom: "0",
                height: "6px",
                background: "linear-gradient(90deg, #a78bfa 0%, #c084fc 100%)",
                borderBottomLeftRadius: "6px",
                borderBottomRightRadius: "6px",
              }}
            />
            {/* Letter I */}
            <span
              style={{
                fontSize: "48px",
                fontWeight: "bold",
                fontFamily: "Georgia, Times, serif",
                background: "linear-gradient(135deg, #a78bfa 0%, #c084fc 100%)",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              I
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
