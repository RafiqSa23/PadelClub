import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

const baseFieldClass =
  "w-full rounded-xl border border-line bg-white px-3.5 text-sm text-night placeholder:text-slate-whisper/60 transition-colors focus:border-court focus:outline-2 focus:outline-court/30 focus:ring-court/20 disabled:bg-mist disabled:text-slate-whisper";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-night">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-semibold text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-whisper">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(baseFieldClass, "h-11", className)} {...props} />;
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(baseFieldClass, "min-h-24 py-2.5", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        baseFieldClass,
        "h-11 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%235a5a6e%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpath d=%22m6 9 6 6 6-6%22/%3E%3C/svg%3E')] bg-[position:right_0.75rem_center] bg-no-repeat pr-9",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function PhoneInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm font-semibold text-slate-whisper">+62</span>
      <input inputMode="tel" type="tel" className={cn(baseFieldClass, "h-11 pl-12", className)} {...props} />
    </div>
  );
}
