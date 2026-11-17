"use client";

import { QRCodeCanvas } from "qrcode.react";

/**
 * QR asli (bukan pola dekoratif) — bisa dipindai kamera/scanner gate.
 * Payload tiket = token bertanda tangan `v1.<KODE>.<exp>.<hmac>` (ADR 0014),
 * bukan kode booking polos, supaya QR palsu/kedaluwarsa ditolak server.
 * Level M cukup tahan noda layar.
 */
export function QRBox({ text, size = 144 }: { text: string; size?: number }) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-field-white p-2">
      <QRCodeCanvas
        value={text}
        size={size}
        level="M"
        marginSize={2}
        bgColor="#ffffff"
        fgColor="#1a1a2e"
        title={`QR tiket ${text}`}
        aria-label={`Kode QR tiket ${text}`}
        className="rounded"
      />
    </div>
  );
}
