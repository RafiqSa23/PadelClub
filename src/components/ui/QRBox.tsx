"use client";

import { useEffect, useRef } from "react";

function seeded(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return () => {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    return h / 4294967296;
  };
}

export function QRBox({ text, size = 144 }: { text: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const n = 21;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rand = seeded(text);
    const quiet = 2;
    const total = n + quiet * 2;
    const cell = canvas.width / total;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const finder = (r: number, c: number) => {
      for (let rr = 0; rr < 7; rr++) {
        for (let cc = 0; cc < 7; cc++) {
          const on =
            rr === 0 || rr === 6 || cc === 0 || cc === 6 || (rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4);
          ctx.fillStyle = on ? "#1a1a2e" : "#ffffff";
          ctx.fillRect((c + cc) * cell, (r + rr) * cell, cell + 0.5, cell + 0.5);
        }
      }
    };

    finder(0, 0);
    finder(0, n - 7);
    finder(n - 7, 0);

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const inFinder =
          (r < 9 && c < 9) || (r < 9 && c >= n - 8) || (r >= n - 8 && c < 9);
        if (inFinder) continue;
        ctx.fillStyle = rand() < 0.48 ? "#1a1a2e" : "#ffffff";
        ctx.fillRect((c + quiet) * cell, (r + quiet) * cell, cell + 0.5, cell + 0.5);
      }
    }
  }, [text, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="rounded-lg border border-line"
      role="img"
      aria-label="Kode QR"
    />
  );
}