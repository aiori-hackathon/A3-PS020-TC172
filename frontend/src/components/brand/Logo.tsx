/**
 * NetNova mark: a source and a destination joined by two diverging paths - the primary (cyan)
 * and the backup (violet) - which is the idea the whole project demonstrates.
 */
export function LogoMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} role="img" aria-label="NetNova">
      <rect width="32" height="32" rx="8" fill="#0d1526" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="none" stroke="#233252" />
      <path d="M7 16 L16 8.5 L25 16" fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 16 L12 23.5 L20 23.5 L25 16" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7" cy="16" r="2.6" fill="#e2e8f0" />
      <circle cx="25" cy="16" r="2.6" fill="#e2e8f0" />
      <circle cx="16" cy="8.5" r="1.8" fill="#22d3ee" />
      <circle cx="12" cy="23.5" r="1.6" fill="#a78bfa" />
      <circle cx="20" cy="23.5" r="1.6" fill="#a78bfa" />
    </svg>
  );
}
