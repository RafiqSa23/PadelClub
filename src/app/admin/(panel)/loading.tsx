"use client";

import { AdminShell } from "@/components/layout/AdminShell";

const SKELETON_CARDS = [1, 2, 3, 4];

export default function AdminPanelLoading() {
  return (
    <AdminShell>
      <div className="flex w-full flex-col gap-6">
        <div className="h-24 animate-pulse rounded-2xl bg-field-white shadow-sm" />
        <div className="h-7 w-56 animate-pulse rounded-xl bg-field-white shadow-sm" />
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {SKELETON_CARDS.map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-2xl bg-field-white shadow-sm" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-2xl bg-field-white shadow-sm" />
      </div>
    </AdminShell>
  );
}
