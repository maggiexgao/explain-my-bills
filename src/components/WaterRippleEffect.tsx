import { useEffect, useRef, useCallback, useState } from 'react';

interface Ripple {
  id: number;
  x: number;
  y: number;
  startTime: number;
}

export function WaterRippleEffect() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ripplesRef = useRef<Ripple[]>([]);
  const animationRef = useRef<number>();
  const lastMoveRef = useRef<number>(0);
  const rippleIdRef = useRef<number>(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const addRipple = useCallback((x: number, y: number) => {
    const now = Date.now();
    // Throttle ripple creation to every 100ms
    if (now - lastMoveRef.current < 100) return;
    lastMoveRef.current = now;
    
    ripplesRef.current.push({
      id: rippleIdRef.current++,
      x,
      y,
      startTime: now,
    });
    
    // Limit ripples to prevent performance issues
    if (ripplesRef.current.length > 15) {
      ripplesRef.current = ripplesRef.current.slice(-15);
    }
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const handleMouseMove = (e: MouseEvent) => {
      addRipple(e.clientX, e.clientY);
    };

    const handleClick = (e: MouseEvent) => {
      // Add multiple ripples on click for a splash effect
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          addRipple(
            e.clientX + (Math.random() - 0.5) * 20,
            e.clientY + (Math.random() - 0.5) * 20
          );
        }, i * 50);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);

    const RIPPLE_DURATION = 600; // ms
    const MAX_RADIUS = 80;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const now = Date.now();
      
      // Filter out old ripples
      ripplesRef.current = ripplesRef.current.filter(
        ripple => now - ripple.startTime < RIPPLE_DURATION
      );
      
      // Draw ripples
      ripplesRef.current.forEach(ripple => {
        const elapsed = now - ripple.startTime;
        const progress = elapsed / RIPPLE_DURATION;
        const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic
        
        const radius = easeProgress * MAX_RADIUS;
        const opacity = 1 - progress;
        
        // Draw multiple concentric rings
        for (let i = 0; i < 3; i++) {
          const ringRadius = radius * (0.4 + i * 0.3);
          const ringOpacity = opacity * (1 - i * 0.3) * 0.3;
          
          ctx.beginPath();
          ctx.arc(ripple.x, ripple.y, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `hsla(200, 60%, 85%, ${ringOpacity})`;
          ctx.lineWidth = 2 - i * 0.5;
          ctx.stroke();
        }
        
        // Central highlight
        const highlightOpacity = opacity * 0.15;
        const gradient = ctx.createRadialGradient(
          ripple.x, ripple.y, 0,
          ripple.x, ripple.y, radius * 0.5
        );
        gradient.addColorStop(0, `hsla(180, 50%, 90%, ${highlightOpacity})`);
        gradient.addColorStop(1, 'hsla(180, 50%, 90%, 0)');
        
        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, radius * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      });
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [prefersReducedMotion, addRipple]);

  if (prefersReducedMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[1]"
      style={{ mixBlendMode: 'overlay' }}
    />
  );
}
