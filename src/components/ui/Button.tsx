import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline-danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  icon?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary: "bg-primary-container text-field-white shadow-md hover:bg-court-green-deep",
  secondary:
    "border border-line bg-field-white text-on-surface hover:border-primary-container/50 hover:bg-court-grass-light/60 hover:text-court-green-deep",
  ghost: "bg-transparent text-slate-whisper hover:bg-court-grass-light hover:text-court-green-deep",
  danger: "bg-error-red text-white hover:bg-error-red/90",
  "outline-danger":
    "border border-error-red/30 bg-field-white text-error-red hover:bg-danger-light",
};

const sizes: Record<Size, string> = {
  sm: "min-h-11 px-3.5 text-label-md",
  md: "min-h-11 px-5 text-label-lg",
  lg: "min-h-12 px-6 text-label-lg",
};

function Spinner() {
  return (
    <span
      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden="true"
    />
  );
}

function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
}: {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court disabled:cursor-not-allowed disabled:opacity-50",
    variants[variant],
    sizes[size],
    fullWidth && "w-full",
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth,
  loading,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  fullWidth,
  icon,
  className,
  children,
  ...props
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
} & Omit<React.ComponentProps<typeof Link>, "href" | "className" | "children">) {
  return (
    <Link href={href} className={buttonClasses({ variant, size, fullWidth, className })} {...props}>
      {icon}
      {children}
    </Link>
  );
}
