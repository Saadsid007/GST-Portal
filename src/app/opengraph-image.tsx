import { ImageResponse } from "next/og";
import { SITE } from "@/config/site";

// Rendered at build time for the root route and inherited by every page that
// does not declare its own image, so social cards never fall back to a blank.
export const alt = SITE.defaultTitle;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        background: "linear-gradient(135deg, #0b1220 0%, #0f2a43 55%, #0b3b3b 100%)",
        color: "#f8fafc",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.5, color: "#7dd3fc" }}>
        {SITE.name}
      </div>
      <div
        style={{
          marginTop: 28,
          fontSize: 76,
          fontWeight: 800,
          lineHeight: 1.05,
          letterSpacing: -2,
          maxWidth: 900,
        }}
      >
        Marketplace reports to GSTR-1 in seconds
      </div>
      <div style={{ marginTop: 32, fontSize: 30, color: "#cbd5e1", maxWidth: 880 }}>
        Amazon · Flipkart · Meesho · Myntra — net sales after returns, GSTN v3.0 JSON and Excel.
      </div>
    </div>,
    size
  );
}
