"use client";

import { useSyncExternalStore } from "react";

/**
 * Kesiapan `snap.js` Midtrans (ADR 0008) sebagai state eksternal, bukan state
 * React: skrip dimuat di luar React (script tag dinamis), jadi snapshot-nya
 * dibaca langsung dari `window.snap` lewat `useSyncExternalStore`.
 *
 * Ini menghindari `setState` sinkron di dalam effect (cascading render) sekaligus
 * tetap reaktif saat skrip selesai dimuat.
 */

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        callbacks?: {
          onSuccess?: (result: unknown) => void;
          onPending?: (result: unknown) => void;
          onError?: (result: unknown) => void;
          onClose?: () => void;
        },
      ) => void;
    };
  }
}

export const SNAP_SCRIPT_ATTR = "data-midtrans-snap";
export const SNAP_READY_EVENT = "padelclub:snap-ready";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(SNAP_READY_EVENT, onChange);
  return () => window.removeEventListener(SNAP_READY_EVENT, onChange);
}

function getSnapshot(): boolean {
  return typeof window !== "undefined" && Boolean(window.snap);
}

function getServerSnapshot(): boolean {
  return false;
}

/** `true` bila `window.snap` siap dipakai (false saat SSR). */
export function useSnapReady(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Beri tahu React bahwa `window.snap` baru tersedia (dipanggil dari onload/once listener). */
export function notifySnapReady(): void {
  window.dispatchEvent(new Event(SNAP_READY_EVENT));
}

/** Skrip Snap yang sudah ada di DOM (dimuat halaman/komponen lain). */
export function findSnapScript(): HTMLScriptElement | null {
  return document.querySelector<HTMLScriptElement>(`script[${SNAP_SCRIPT_ATTR}]`);
}
