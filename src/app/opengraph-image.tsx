import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Barça Dashboard — a stadium-lit football dashboard for matchday, history and your own story";
export const size = { width: 1200, height: 675 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const [image, brandMark] = await Promise.all([
    readFile(join(process.cwd(), "public", "images", "brand", "share-stadium.png"), "base64"),
    readFile(join(process.cwd(), "src", "app", "icon.png"), "base64"),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          backgroundColor: "#07111f",
          color: "#f6f2e9",
          fontFamily: "Arial, sans-serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/png;base64,${image}`}
          alt=""
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            display: "flex",
            background: "linear-gradient(90deg, rgba(7,17,31,0.86) 0%, rgba(7,17,31,0.34) 48%, rgba(7,17,31,0.04) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 66,
            top: 62,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/png;base64,${brandMark}`} alt="" style={{ width: 58, height: 58 }} />
          <div style={{ display: "flex", color: "#d39c43", fontSize: 18, fontWeight: 700, letterSpacing: 5 }}>
            FC BARCELONA
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 66,
            top: 255,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", fontSize: 90, fontWeight: 800, letterSpacing: -5, lineHeight: 1 }}>
            BARÇA
          </div>
          <div style={{ display: "flex", marginTop: 10, fontSize: 47, fontWeight: 700, letterSpacing: 9 }}>
            DASHBOARD
          </div>
          <div style={{ display: "flex", marginTop: 38, color: "#d9dce1", fontSize: 18, letterSpacing: 3 }}>
            MATCHDAY  /  HISTORY  /  YOUR CLUB
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 54,
            left: 66,
            width: 94,
            height: 4,
            backgroundColor: "#d39c43",
            display: "flex",
          }}
        />
      </div>
    ),
    size,
  );
}
