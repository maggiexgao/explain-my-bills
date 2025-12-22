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
      {/* Main body - rounded frog shape */}
      <ellipse
        cx="50"
        cy="55"
        rx="35"
        ry="30"
        fill="hsl(120, 45%, 55%)"
        stroke="hsl(120, 30%, 25%)"
        strokeWidth="3"
      />
      
      {/* Left arm/bump */}
      <ellipse
        cx="22"
        cy="60"
        rx="10"
        ry="12"
        fill="hsl(120, 45%, 55%)"
        stroke="hsl(120, 30%, 25%)"
        strokeWidth="3"
      />
      
      {/* Right arm/bump */}
      <ellipse
        cx="78"
        cy="60"
        rx="10"
        ry="12"
        fill="hsl(120, 45%, 55%)"
        stroke="hsl(120, 30%, 25%)"
        strokeWidth="3"
      />
      
      {/* Head bumps/eyes background */}
      <ellipse
        cx="35"
        cy="30"
        rx="12"
        ry="12"
        fill="hsl(120, 45%, 55%)"
        stroke="hsl(120, 30%, 25%)"
        strokeWidth="3"
      />
      <ellipse
        cx="65"
        cy="30"
        rx="12"
        ry="12"
        fill="hsl(120, 45%, 55%)"
        stroke="hsl(120, 30%, 25%)"
        strokeWidth="3"
      />
      
      {/* Eyes - small dots */}
      <circle
        cx="35"
        cy="30"
        r="3"
        fill="hsl(120, 30%, 20%)"
      />
      <circle
        cx="65"
        cy="30"
        r="3"
        fill="hsl(120, 30%, 20%)"
      />
      
      {/* Mouth - simple curved line */}
      <path
        d="M 35 55 Q 50 62 65 55"
        stroke="hsl(120, 30%, 25%)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      
      {/* Cheek blush - left */}
      <ellipse
        cx="30"
        cy="50"
        rx="5"
        ry="3"
        fill="hsl(350, 60%, 70%)"
        opacity="0.5"
      />
      
      {/* Cheek blush - right */}
      <ellipse
        cx="70"
        cy="50"
        rx="5"
        ry="3"
        fill="hsl(350, 60%, 70%)"
        opacity="0.5"
      />
    </svg>
  );
}
