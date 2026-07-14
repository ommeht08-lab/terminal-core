export default function PrismLogo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="prismStroke" x1="4" y1="6" x2="28" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e2e8f0" />
          <stop offset="55%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>

      {/* incoming beam of white light */}
      <line x1="0" y1="17" x2="11" y2="17" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />

      {/* prism cross-section */}
      <path
        d="M16 4 L28 26 L4 26 Z"
        stroke="url(#prismStroke)"
        strokeWidth="1.75"
        strokeLinejoin="round"
        fill="url(#prismStroke)"
        fillOpacity="0.08"
      />

      {/* refracted beams fanning out in the brand's ice-blue/cyan range */}
      <line x1="22" y1="18" x2="32" y2="12" stroke="#7dd3fc" strokeWidth="1.25" strokeLinecap="round" />
      <line x1="23" y1="21" x2="32" y2="21" stroke="#22d3ee" strokeWidth="1.25" strokeLinecap="round" />
      <line x1="22" y1="24" x2="32" y2="29" stroke="#0ea5e9" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}
