import { useEffect, useRef, useCallback } from 'react';

interface GlowPoint {
  x: number;
  y: number;
  color: string;
  opacity: number;
  timestamp: number;
}

const AURORA_COLORS = [
  'hsl(340, 65%, 70%)',  // hot pink
  'hsl(15, 75%, 65%)',   // coral
  'hsl(275, 50%, 60%)',  // purple
  'hsl(225, 60%, 55%)',  // deep blue
  'hsl(175, 45%, 60%)',  // teal
];

export function AuroraMouseEffect() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glowPointsRef = useRef<GlowPoint[]>([]);
  const animationFrameRef = useRef<number>();
  const lastPositionRef = useRef<{ x: number; y: number } | null>(null);
  const colorIndexRef = useRef(0);

  const prefersReducedMotion = useRef(
    typeof window !== 'undefined' 
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
      : false
  );

  const getNextColor = useCallback(() => {
    const color = AURORA_COLORS[colorIndexRef.current];
    colorIndexRef.current = (colorIndexRef.current + 1) % AURORA_COLORS.length;
    return color;
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (prefersReducedMotion.current) return;

    const now = Date.now();
    const { clientX, clientY } = e;

    // Add some smoothing by only adding points at intervals
    if (lastPositionRef.current) {
      const dx = clientX - lastPositionRef.current.x;
      const dy = clientY - lastPositionRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < 10) return; // Only add points when moved enough
    }

    lastPositionRef.current = { x: clientX, y: clientY };

    // Add new glow point
    glowPointsRef.current.push({
      x: clientX,
      y: clientY,
      color: getNextColor(),
      opacity: 0.35,
      timestamp: now,
    });

    // Keep only recent points (last 500ms)
    glowPointsRef.current = glowPointsRef.current.filter(
      point => now - point.timestamp < 500
    );
  }, [getNextColor]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const now = Date.now();
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw glow points
    glowPointsRef.current.forEach(point => {
      const age = now - point.timestamp;
      const fadeProgress = age / 500; // 500ms fade duration
      const currentOpacity = point.opacity * (1 - fadeProgress);

      if (currentOpacity <= 0) return;

      const gradient = ctx.createRadialGradient(
        point.x, point.y, 0,
        point.x, point.y, 120
      );
      
      // Parse the HSL color and add opacity
      const colorWithOpacity = point.color.replace(')', `, ${currentOpacity})`).replace('hsl', 'hsla');
      
      gradient.addColorStop(0, colorWithOpacity);
      gradient.addColorStop(0.4, colorWithOpacity.replace(String(currentOpacity), String(currentOpacity * 0.5)));
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.fillRect(point.x - 120, point.y - 120, 240, 240);
    });

    // Clean up old points
    glowPointsRef.current = glowPointsRef.current.filter(
      point => now - point.timestamp < 500
    );

    animationFrameRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    const updateSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    window.addEventListener('mousemove', handleMouseMove);

    // Start animation loop
    animationFrameRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', updateSize);
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [handleMouseMove, draw]);

  if (prefersReducedMotion.current) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ mixBlendMode: 'soft-light' }}
      aria-hidden="true"
    />
  );
}
