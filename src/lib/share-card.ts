/**
 * Draws a shareable signal card (1200×675 PNG) in the browser: brand, coin,
 * signal, key numbers and the site link. Client-only — uses <canvas>.
 */
export type ShareCardInput = {
  base: string;
  price: string;
  change24h: number;
  signal: "LONG" | "SHORT" | "WAIT";
  signalLabel: string;
  score: number;
  interval: string;
  facts: string[];
  appName: string;
  tagline: string;
  link: string;
  footnote: string;
};

const W = 1200;
const H = 675;
const TONE = { LONG: "#22c55e", SHORT: "#ef4444", WAIT: "#f59e0b" } as const;
const FONT = '"Inter Variable", Inter, "Segoe UI", system-ui, sans-serif';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

export async function drawShareCard(input: ShareCardInput): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  try {
    await document.fonts?.ready;
  } catch {
    /* system font is fine */
  }

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0b1020");
  bg.addColorStop(1, "#1a1640");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  glow(ctx, W - 120, 60, 420, "rgba(99,102,241,0.35)");
  glow(ctx, 80, H - 40, 380, "rgba(20,184,166,0.22)");
  glow(ctx, W * 0.62, H * 0.55, 300, `${TONE[input.signal]}22`);

  // Brand
  const logo = ctx.createLinearGradient(56, 48, 128, 120);
  logo.addColorStop(0, "#6366f1");
  logo.addColorStop(1, "#22d3ee");
  ctx.fillStyle = logo;
  roundRect(ctx, 56, 48, 72, 72, 18);
  ctx.fill();
  ctx.fillStyle = "#fff";
  const u = 72 / 32; // the site mark, drawn from its 32×32 SVG
  roundRect(ctx, 56 + 6 * u, 48 + 4 * u, 3 * u, 24 * u, 2);
  ctx.fill();
  roundRect(ctx, 56 + 14 * u, 48 + 10 * u, 12 * u, 2.4 * u, 2);
  ctx.fill();
  ctx.globalAlpha = 0.55;
  roundRect(ctx, 56 + 14 * u, 48 + 19.6 * u, 8 * u, 2.4 * u, 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 40px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.fillText(input.appName, 148, 72);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `500 22px ${FONT}`;
  ctx.fillText(input.tagline, 148, 106);

  // Timeframe chip (top right)
  ctx.font = `700 22px ${FONT}`;
  const chip = input.interval;
  const chipW = ctx.measureText(chip).width + 40;
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  roundRect(ctx, W - 56 - chipW, 56, chipW, 48, 24);
  ctx.fill();
  ctx.fillStyle = "#e2e8f0";
  ctx.fillText(chip, W - 56 - chipW + 20, 81);

  // Coin and price
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 104px ${FONT}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(input.base, 56, 290);
  const baseW = ctx.measureText(input.base).width;
  ctx.font = `600 30px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText("/ USDT", 56 + baseW + 18, 290);
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 52px ${FONT}`;
  ctx.fillText(input.price, 56, 370);
  const priceW = ctx.measureText(input.price).width;
  const up = input.change24h >= 0;
  ctx.fillStyle = up ? "#22c55e" : "#ef4444";
  ctx.font = `700 32px ${FONT}`;
  ctx.fillText(`${up ? "▲" : "▼"} ${Math.abs(input.change24h).toFixed(2)}%  24h`, 56 + priceW + 24, 368);

  // Signal pill
  const tone = TONE[input.signal];
  ctx.font = `800 56px ${FONT}`;
  const label = input.signalLabel.toUpperCase();
  const pillW = ctx.measureText(label).width + 88;
  const pillX = W - 56 - pillW;
  ctx.fillStyle = `${tone}26`;
  roundRect(ctx, pillX, 196, pillW, 104, 52);
  ctx.fill();
  ctx.strokeStyle = tone;
  ctx.lineWidth = 3;
  roundRect(ctx, pillX, 196, pillW, 104, 52);
  ctx.stroke();
  ctx.fillStyle = tone;
  ctx.textBaseline = "middle";
  ctx.fillText(label, pillX + 44, 250);

  // Score bar
  const barX = W - 56 - 420;
  const barY = 340;
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  roundRect(ctx, barX, barY, 420, 16, 8);
  ctx.fill();
  const mid = barX + 210;
  const len = (Math.min(100, Math.abs(input.score)) / 100) * 210;
  ctx.fillStyle = input.score >= 0 ? "#22c55e" : "#ef4444";
  roundRect(ctx, input.score >= 0 ? mid : mid - len, barY, Math.max(len, 6), 16, 8);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = `600 22px ${FONT}`;
  ctx.textBaseline = "alphabetic";
  const scoreText = `${input.score > 0 ? "+" : ""}${Math.round(input.score)} / 100`;
  ctx.fillText(scoreText, W - 56 - ctx.measureText(scoreText).width, barY + 52);

  // Facts row
  ctx.font = `600 26px ${FONT}`;
  let x = 56;
  for (const fact of input.facts.slice(0, 4)) {
    const w = ctx.measureText(fact).width + 36;
    if (x + w > W - 56) break;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    roundRect(ctx, x, 440, w, 56, 16);
    ctx.fill();
    ctx.fillStyle = "#e2e8f0";
    ctx.textBaseline = "middle";
    ctx.fillText(fact, x + 18, 469);
    x += w + 14;
  }

  // Footer: link and note
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(56, 560);
  ctx.lineTo(W - 56, 560);
  ctx.stroke();
  ctx.fillStyle = "#a5b4fc";
  ctx.font = `700 30px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.fillText(input.link, 56, 612);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = `500 20px ${FONT}`;
  const note = input.footnote;
  ctx.fillText(note, W - 56 - ctx.measureText(note).width, 612);

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png"));
}
