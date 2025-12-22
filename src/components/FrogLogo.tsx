import { cn } from '@/lib/utils';

interface FrogLogoProps {
  className?: string;
}

export function FrogLogo({ className }: FrogLogoProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-10 h-10", className)}
    >
      {/* Shadow under frog */}
      <ellipse
        cx="50"
        cy="88"
        rx="25"
        ry="6"
        fill="hsl(195, 40%, 12%)"
        opacity="0.3"
      />
      
      {/* Back legs peeking out */}
      <ellipse
        cx="25"
        cy="70"
        rx="8"
        ry="10"
        fill="hsl(140, 45%, 40%)"
      />
      <ellipse
        cx="75"
        cy="70"
        rx="8"
        ry="10"
        fill="hsl(140, 45%, 40%)"
      />
      
      {/* Main body - rounded frog shape */}
      <ellipse
        cx="50"
        cy="58"
        rx="32"
        ry="26"
        fill="hsl(135, 50%, 45%)"
      />
      
      {/* Body highlight */}
      <ellipse
        cx="45"
        cy="50"
        rx="18"
        ry="14"
        fill="hsl(130, 55%, 55%)"
        opacity="0.6"
      />
      
      {/* Front arms */}
      <ellipse
        cx="22"
        cy="65"
        rx="8"
        ry="10"
        fill="hsl(135, 50%, 45%)"
      />
      <ellipse
        cx="78"
        cy="65"
        rx="8"
        ry="10"
        fill="hsl(135, 50%, 45%)"
      />
      
      {/* Eye bumps */}
      <ellipse
        cx="35"
        cy="32"
        rx="13"
        ry="13"
        fill="hsl(135, 50%, 45%)"
      />
      <ellipse
        cx="65"
        cy="32"
        rx="13"
        ry="13"
        fill="hsl(135, 50%, 45%)"
      />
      
      {/* Eye bump highlights */}
      <ellipse
        cx="33"
        cy="28"
        rx="6"
        ry="5"
        fill="hsl(130, 55%, 55%)"
        opacity="0.5"
      />
      <ellipse
        cx="63"
        cy="28"
        rx="6"
        ry="5"
        fill="hsl(130, 55%, 55%)"
        opacity="0.5"
      />
      
      {/* Eye whites */}
      <circle
        cx="35"
        cy="30"
        r="7"
        fill="hsl(45, 30%, 95%)"
      />
      <circle
        cx="65"
        cy="30"
        r="7"
        fill="hsl(45, 30%, 95%)"
      />
      
      {/* Pupils */}
      <circle
        cx="36"
        cy="31"
        r="3.5"
        fill="hsl(195, 50%, 15%)"
      />
      <circle
        cx="66"
        cy="31"
        r="3.5"
        fill="hsl(195, 50%, 15%)"
      />
      
      {/* Eye shine */}
      <circle
        cx="34"
        cy="29"
        r="1.5"
        fill="white"
      />
      <circle
        cx="64"
        cy="29"
        r="1.5"
        fill="white"
      />
      
      {/* Mouth - happy curve */}
      <path
        d="M 38 52 Q 50 60 62 52"
        stroke="hsl(140, 40%, 30%)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      
      {/* Cheek blush */}
      <ellipse
        cx="28"
        cy="48"
        rx="5"
        ry="3"
        fill="hsl(15, 70%, 65%)"
        opacity="0.4"
      />
      <ellipse
        cx="72"
        cy="48"
        rx="5"
        ry="3"
        fill="hsl(15, 70%, 65%)"
        opacity="0.4"
      />
      
      {/* Nostrils */}
      <circle
        cx="44"
        cy="44"
        r="1.5"
        fill="hsl(140, 40%, 30%)"
      />
      <circle
        cx="56"
        cy="44"
        r="1.5"
        fill="hsl(140, 40%, 30%)"
      />
    </svg>
  );
}