import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Button({
  className = "",
  variant = "primary",
  loading = false,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ink" | "ghost";
  loading?: boolean;
}) {
  const variants = {
    primary:
      "bg-hp-blue text-white hover:bg-hp-deep focus-visible:outline-hp-blue disabled:bg-steel",
    outline:
      "border border-hp-blue bg-white text-hp-blue hover:bg-hp-soft focus-visible:outline-hp-blue",
    ink: "bg-ink text-white hover:bg-black focus-visible:outline-ink disabled:bg-steel",
    ghost:
      "bg-white text-ink hover:bg-cloud focus-visible:outline-hp-blue disabled:text-graphite"
  };

  return (
    <button
      className={[
        "inline-flex min-h-11 items-center justify-center gap-2 rounded px-6 py-3 text-sm font-semibold uppercase tracking-[0.7px] transition disabled:cursor-not-allowed",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        variants[variant],
        className
      ].join(" ")}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={[
        "h-11 w-full rounded border border-steel bg-white px-4 text-base text-ink outline-none transition placeholder:text-charcoal",
        "focus:border-ink disabled:cursor-not-allowed disabled:bg-cloud",
        className
      ].join(" ")}
      {...props}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={["rounded-2xl bg-white p-6 shadow-soft", className].join(" ")}>
      {children}
    </section>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "blue" | "danger" | "success" }) {
  const tones = {
    neutral: "border border-ink text-ink",
    blue: "bg-hp-soft text-hp-deep",
    danger: "bg-red-50 text-danger",
    success: "bg-green-50 text-success"
  };

  return (
    <span className={["inline-flex rounded-lg px-3 py-1 text-sm font-medium", tones[tone]].join(" ")}>
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  body,
  action
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-fog bg-cloud px-6 py-10 text-center">
      <h2 className="text-xl font-medium text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-charcoal">{body}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
