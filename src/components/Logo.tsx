import Link from "next/link";

/**
 * ExplainCanvas mark: a rounded canvas with one stroke that resolves into a point.
 * Monochrome: ink on the page colour, so it flips with the theme.
 */
export function LogoMark({ size = 32, className = "", invert = false }: { size?: number; className?: string; invert?: boolean }) {
  const fill = invert ? "var(--on-primary)" : "var(--primary)";
  const stroke = invert ? "var(--primary)" : "var(--on-primary)";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden>
      <rect x="6" y="6" width="52" height="52" rx="14" fill={fill} />
      <path d="M19 41 C 25 24, 31 24, 35 33 C 38 40, 42 36, 45 24" stroke={stroke} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="45" cy="42" r="3.6" fill={stroke} />
    </svg>
  );
}

export function Logo({ href = "/", size = 26, textClass = "text-[17px]" }: { href?: string; size?: number; textClass?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5" aria-label="ExplainCanvas home">
      <LogoMark size={size} />
      <span className={`${textClass} font-semibold tracking-tight`}>
        Explain<span className="font-normal text-muted">Canvas</span>
      </span>
    </Link>
  );
}
