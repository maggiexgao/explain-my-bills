interface JewelLogoProps {
  className?: string;
}

export function JewelLogo({ className = "h-6 w-6" }: JewelLogoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Diamond/gem outer shape */}
      <polygon points="12,2 22,9 12,22 2,9" />
      {/* Top facets */}
      <line x1="2" y1="9" x2="22" y2="9" />
      <line x1="12" y1="2" x2="7" y2="9" />
      <line x1="12" y1="2" x2="17" y2="9" />
      {/* Center facet lines to bottom point */}
      <line x1="7" y1="9" x2="12" y2="22" />
      <line x1="17" y1="9" x2="12" y2="22" />
    </svg>
  );
}
