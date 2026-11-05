import { ImageResponse } from "next/og";

// Home-screen icon for iOS (generated as a 180x180 PNG at build time).
// Same artwork as app/icon.svg; iOS rounds the corners itself, so the tile is square.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#171717"/>
  <path d="M21 12h15.5L46 21.5V48a4 4 0 0 1-4 4H21a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4z" fill="#fafafa"/>
  <path d="M36.5 12v6.5a3 3 0 0 0 3 3H46z" fill="#a3a3a3"/>
  <rect x="22" y="26" width="13" height="3" rx="1.5" fill="#a3a3a3"/>
  <rect x="22" y="32" width="19" height="3" rx="1.5" fill="#a3a3a3"/>
  <rect x="22" y="41" width="19" height="4" rx="2" fill="#171717"/>
</svg>`;

export default function AppleIcon() {
  return new ImageResponse(
    (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`}
        width={180}
        height={180}
        alt=""
      />
    ),
    size
  );
}
