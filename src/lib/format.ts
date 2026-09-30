const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function formatRupiah(value: number): string {
  return rupiah.format(value);
}

export function dateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayString(): string {
  return dateString(new Date());
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return dateString(d);
}

function formatTime(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function hourLabel(startHour: number, endHour?: number): string {
  if (endHour === undefined) return formatTime(startHour);
  return `${formatTime(startHour)}–${formatTime(endHour)}`;
}

export function dateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const weekdays = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ];
  return `${weekdays[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function shortDateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function relativeTime(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const diff = d.getTime() - Date.now();
  const day = Math.round(diff / 86400000);
  if (day === 0) return "Hari ini";
  if (day === 1) return "Besok";
  if (day === -1) return "Kemarin";
  return dateLabel(dateStr);
}