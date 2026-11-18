"use client";

import { useEffect, useState } from "react";
import type { SessionUser } from "@/lib/session-types";

/**
 * Status sesi pemain untuk UI (navbar). `undefined` = belum diketahui,
 * `null` = belum login. Satu fetch `/api/auth/me` saat komponen mount.
 *
 * `invalidateCurrentUser()` memicu fetch ulang di semua pemakai hook — dipakai
 * setelah logout supaya navbar langsung berubah tanpa full page reload.
 */
const SESSION_CHANGED_EVENT = "padel:session-changed";

export function invalidateCurrentUser(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
}

export function useCurrentUser(): SessionUser | null | undefined {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    // Nomor urut request: respons lama (mis. sebelum logout) tidak boleh
    // menimpa hasil request terbaru.
    let requestId = 0;

    async function load() {
      const id = ++requestId;
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (cancelled || id !== requestId) return;
        if (res.status === 401) {
          setUser(null);
          return;
        }
        const json = (await res.json().catch(() => null)) as
          | { ok?: boolean; user?: SessionUser }
          | null;
        if (cancelled || id !== requestId) return;
        setUser(json?.ok && json.user ? json.user : null);
      } catch {
        if (!cancelled && id === requestId) setUser(null);
      }
    }

    const onChange = () => void load();
    void load();
    window.addEventListener(SESSION_CHANGED_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(SESSION_CHANGED_EVENT, onChange);
    };
  }, []);

  return user;
}
