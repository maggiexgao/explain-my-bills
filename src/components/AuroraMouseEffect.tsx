import { useEffect, useRef, useCallback } from 'react';

interface Sparkle {
  x: number;
  y: number;
  color: string;
  angle: number;
  length: number;
  opacity: number;
  timestamp: number;
}

interface GlowPoint {
  x: number;
  y: number;
  opacity: number;
  timestamp: number;
}

// Prism rainbow colors - bright, refracted light tones
const SPARKLE_COLORS = [
  'hsl(0, 85%, 75%)',    // soft red
  'hsl(30, 90%, 70%)',   // gold/orange
  'hsl(55, 85%, 70%)',   // yellow
  'hsl(120, 60%, 70%)',  // soft green
  'hsl(185, 80%, 70%)',  // cyan
  'hsl(220, 75%, 75%)',  // soft blue
  'hsl(280, 65%, 75%)',  // violet
  'hsl(320, 70%, 75%)',  // magenta
];

export function AuroraMouseEffect() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparklesRef = useRef<Sparkle[]>([]);
  const glowRef = useRef<GlowPoint | null>(null);
  const animationFrameRef = useRef<number>();
  const lastPositionRef = useRef<{ x: number; y: number } | null>(null);

  const prefersReducedMotion = useRef(
    typeof window !== 'undefined' 
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
      : false
  );

  const getRandomColor = useCallback(() => {
    return SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)];
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (prefersReducedMotion.current) return;

    const now = Date.now();
    const { clientX, clientY } = e;

    // Update the main glow position
    glowRef.current = {
      x: clientX,
      y: clientY,
      opacity: 0.4,
      timestamp: now,
    };

    // Add sparkles when moving
    if (lastPositionRef.current) {
      const dx = clientX - lastPositionRef.current.x;
      const dy = clientY - lastPositionRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 8) {
        // Add 2-4 tiny sparkles around the cursor
        const numSparkles = Math.floor(Math.random() * 3) + 2;
        for (let i = 0; i < numSparkles; i++) {
          const offsetAngle = Math.random() * Math.PI * 2;
          const offsetRadius = Math.random() * 15 + 5;
          sparklesRef.current.push({
            x: clientX + Math.cos(offsetAngle) * offsetRadius,
            y: clientY + Math.sin(offsetAngle) * offsetRadius,
            color: getRandomColor(),
            angle: Math.random() * Math.PI * 2,
            length: Math.random() * 8 + 4,
            opacity: Math.random() * 0.4 + 0.3,
            timestamp: now,
          });
        }
        lastPositionRef.current = { x: clientX, y: clientY };
      }
    } else {
      lastPositionRef.current = { x: clientX, y: clientY };
    }

    // Keep only recent sparkles (last 250ms for quick fade)
    sparklesRef.current = sparklesRef.current.filter(
      sparkle => now - sparkle.timestamp < 250
    );
  }, [getRandomColor]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const now = Date.now();
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the main soft glow (small, centered on cursor)
    if (glowRef.current) {
      const glow = glowRef.current;
      const age = now - glow.timestamp;
      const fadeProgress = Math.min(age / 400, 1);
      const currentOpacity = glow.opacity * (1 - fadeProgress * 0.5);

      if (currentOpacity > 0.05) {
        // Outer soft glow
        const outerGradient = ctx.createRadialGradient(
          glow.x, glow.y, 0,
          glow.x, glow.y, 50
        );
        outerGradient.addColorStop(0, `hsla(40, 30%, 95%, ${currentOpacity * 0.3})`);
        outerGradient.addColorStop(0.5, `hsla(40, 20%, 90%, ${currentOpacity * 0.15})`);
        outerGradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = outerGradient;
        ctx.fillRect(glow.x - 50, glow.y - 50, 100, 100);

        // Inner bright core
        const innerGradient = ctx.createRadialGradient(
          glow.x, glow.y, 0,
          glow.x, glow.y, 16
        );
        innerGradient.addColorStop(0, `hsla(45, 40%, 98%, ${currentOpacity * 0.5})`);
        innerGradient.addColorStop(0.6, `hsla(40, 30%, 95%, ${currentOpacity * 0.25})`);
        innerGradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = innerGradient;
        ctx.fillRect(glow.x - 16, glow.y - 16, 32, 32);
      }
    }

    // Draw sparkles (tiny prismatic streaks)
    sparklesRef.current.forEach(sparkle => {
      const age = now - sparkle.timestamp;
      const fadeProgress = age / 250; // 250ms fade duration
      const currentOpacity = sparkle.opacity * (1 - fadeProgress);

      if (currentOpacity <= 0) return;

      ctx.save();
      ctx.translate(sparkle.x, sparkle.y);
      ctx.rotate(sparkle.angle);
      
      // Draw a tiny streak/line
      const gradient = ctx.createLinearGradient(-sparkle.length / 2, 0, sparkle.length / 2, 0);
      const colorWithOpacity = sparkle.color.replace(')', `, ${currentOpacity})`).replace('hsl', 'hsla');
      const colorFaded = sparkle.color.replace(')', `, ${currentOpacity * 0.2})`).replace('hsl', 'hsla');
      
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(0.3, colorFaded);
      gradient.addColorStop(0.5, colorWithOpacity);
      gradient.addColorStop(0.7, colorFaded);
      gradient.addColorStop(1, 'transparent');

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      
      ctx.beginPath();
      ctx.moveTo(-sparkle.length / 2, 0);
      ctx.lineTo(sparkle.length / 2, 0);
      ctx.stroke();

      // Add a tiny bright dot at center
      ctx.fillStyle = `hsla(45, 50%, 98%, ${currentOpacity * 0.8})`;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });

    // Clean up old sparkles
    sparklesRef.current = sparklesRef.current.filter(
      sparkle => now - sparkle.timestamp < 250
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
