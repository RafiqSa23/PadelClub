import { useRef } from "react";
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

const OTP_LENGTH = 6;

export function OTPInput({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  function handleChange(index: number, char: string) {
    if (!/^\d?$/.test(char)) return;
    const arr = value.split("");
    arr[index] = char;
    const next = arr.join("").slice(0, OTP_LENGTH);
    onChange(next);
    if (char && index < OTP_LENGTH - 1) refs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Backspace") return;
    const arr = value.split("");
    if (value[index]) {
      arr[index] = "";
      onChange(arr.join(""));
    } else if (index > 0) {
      arr[index - 1] = "";
      onChange(arr.join(""));
      refs.current[index - 1]?.focus();
    }
  }

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="Kode OTP 6 digit">
      {Array.from({ length: OTP_LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={(element) => {
            refs.current[i] = element;
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1}`}
          aria-invalid={error}
          maxLength={1}
          value={value[i] ?? ""}
          onChange={(event) => handleChange(i, event.target.value)}
          onKeyDown={(event) => handleKeyDown(i, event)}
          onFocus={(event) => event.target.select()}
          className={cn(
            "h-12 w-11 rounded-xl border text-center text-lg font-extrabold tabular-nums text-night transition-colors focus:outline-2 focus:outline-offset-2 focus:outline-court sm:w-12",
            error ? "border-danger bg-danger-light" : "border-line bg-white focus:border-court",
          )}
        />
      ))}
    </div>
  );
}
