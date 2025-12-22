import { useEffect, useRef, useCallback, useState } from 'react';

interface Ripple {
  id: number;
  x: number;
  y: number;
  startTime: number;
}

interface Sparkle {
  id: number;
  x: number;
  y: number;
  startTime: number;
  angle: number;
  length: number;
  color: string;
}

const SPARKLE_COLORS = [
  'hsla(0, 0%, 100%, 0.9)',     // white
  'hsla(45, 90%, 70%, 0.85)',   // pale gold
  'hsla(180, 60%, 75%, 0.8)',   // aqua
  'hsla(340, 70%, 75%, 0.75)',  // pink
  'hsla(200, 65%, 70%, 0.8)',   // blue
  'hsla(15, 80%, 70%, 0.75)',   // coral
];

export function WaterRippleEffect() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ripplesRef = useRef<Ripple[]>([]);
  const sparklesRef = useRef<Sparkle[]>([]);
  const animationRef = useRef<number>();
  const lastMoveRef = useRef<number>(0);
  const rippleIdRef = useRef<number>(0);
  const sparkleIdRef = useRef<number>(0);
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

  const addSparkles = useCallback((x: number, y: number, count: number = 5) => {
    const now = Date.now();
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const offset = Math.random() * 15;
      sparklesRef.current.push({
        id: sparkleIdRef.current++,
        x: x + Math.cos(angle) * offset,
        y: y + Math.sin(angle) * offset,
        startTime: now + Math.random() * 100,
        angle: Math.random() * Math.PI * 2,
        length: 4 + Math.random() * 8,
        color: SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)],
      });
    }
    
    // Limit sparkles
    if (sparklesRef.current.length > 50) {
      sparklesRef.current = sparklesRef.current.slice(-50);
    }
  }, []);

  const addRipple = useCallback((x: number, y: number) => {
    const now = Date.now();
    // Throttle ripple creation to every 80ms
    if (now - lastMoveRef.current < 80) return;
    lastMoveRef.current = now;
    
    ripplesRef.current.push({
      id: rippleIdRef.current++,
      x,
      y,
      startTime: now,
    });
    
    // Add sparkles with the ripple
    addSparkles(x, y, 4);
    
    // Limit ripples to prevent performance issues
    if (ripplesRef.current.length > 12) {
      ripplesRef.current = ripplesRef.current.slice(-12);
    }
  }, [addSparkles]);

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
      // Add multiple ripples and extra sparkles on click
      const now = Date.now();
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          ripplesRef.current.push({
            id: rippleIdRef.current++,
            x: e.clientX + (Math.random() - 0.5) * 25,
            y: e.clientY + (Math.random() - 0.5) * 25,
            startTime: Date.now(),
          });
        }, i * 60);
      }
      addSparkles(e.clientX, e.clientY, 10);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);

    const RIPPLE_DURATION = 800; // ms
    const MAX_RADIUS = 85;
    const SPARKLE_DURATION = 350; // ms

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const now = Date.now();
      
      // Filter out old ripples
      ripplesRef.current = ripplesRef.current.filter(
        ripple => now - ripple.startTime < RIPPLE_DURATION
      );
      
      // Filter out old sparkles
      sparklesRef.current = sparklesRef.current.filter(
        sparkle => now - sparkle.startTime < SPARKLE_DURATION
      );
      
      // Draw ripples - concentric rings like light caustics
      ripplesRef.current.forEach(ripple => {
        const elapsed = now - ripple.startTime;
        const progress = elapsed / RIPPLE_DURATION;
        const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic
        
        const baseRadius = easeProgress * MAX_RADIUS;
        const opacity = (1 - progress) * 0.8;
        
        // Draw 3 concentric rings with different radii and brightness
        for (let i = 0; i < 3; i++) {
          const ringProgress = 0.35 + i * 0.25;
          const ringRadius = baseRadius * ringProgress + 12;
          const ringOpacity = opacity * (1 - i * 0.25);
          const lineWidth = 2.5 - i * 0.6;
          
          // Bright caustic ring
          ctx.beginPath();
          ctx.arc(ripple.x, ripple.y, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `hsla(0, 0%, 100%, ${ringOpacity * 0.7})`;
          ctx.lineWidth = lineWidth;
          ctx.stroke();
          
          // Subtle colored tint behind ring
          const gradient = ctx.createRadialGradient(
            ripple.x, ripple.y, ringRadius - 3,
            ripple.x, ripple.y, ringRadius + 8
          );
          gradient.addColorStop(0, `hsla(180, 50%, 85%, ${ringOpacity * 0.15})`);
          gradient.addColorStop(0.5, `hsla(45, 70%, 80%, ${ringOpacity * 0.1})`);
          gradient.addColorStop(1, 'hsla(0, 0%, 100%, 0)');
          
          ctx.beginPath();
          ctx.arc(ripple.x, ripple.y, ringRadius + 2, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
        }
        
        // Central bright highlight
        const highlightOpacity = opacity * 0.25;
        const highlightGradient = ctx.createRadialGradient(
          ripple.x, ripple.y, 0,
          ripple.x, ripple.y, 18
        );
        highlightGradient.addColorStop(0, `hsla(45, 80%, 90%, ${highlightOpacity})`);
        highlightGradient.addColorStop(0.5, `hsla(0, 0%, 100%, ${highlightOpacity * 0.6})`);
        highlightGradient.addColorStop(1, 'hsla(0, 0%, 100%, 0)');
        
        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, 18, 0, Math.PI * 2);
        ctx.fillStyle = highlightGradient;
        ctx.fill();
      });
      
      // Draw sparkles - short bright streaks
      sparklesRef.current.forEach(sparkle => {
        const elapsed = now - sparkle.startTime;
        if (elapsed < 0) return; // Not started yet
        
        const progress = elapsed / SPARKLE_DURATION;
        const opacity = 1 - progress;
        const scale = 0.5 + (1 - progress) * 0.5;
        
        ctx.save();
        ctx.translate(sparkle.x, sparkle.y);
        ctx.rotate(sparkle.angle);
        
        // Draw a short bright streak
        const length = sparkle.length * scale;
        const gradient = ctx.createLinearGradient(-length / 2, 0, length / 2, 0);
        const baseColor = sparkle.color.replace(/[\d.]+\)$/, `${opacity * 0.9})`);
        gradient.addColorStop(0, 'hsla(0, 0%, 100%, 0)');
        gradient.addColorStop(0.3, baseColor);
        gradient.addColorStop(0.5, sparkle.color.replace(/[\d.]+\)$/, `${opacity})`));
        gradient.addColorStop(0.7, baseColor);
        gradient.addColorStop(1, 'hsla(0, 0%, 100%, 0)');
        
        ctx.beginPath();
        ctx.moveTo(-length / 2, 0);
        ctx.lineTo(length / 2, 0);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke();
        
        // Add a tiny bright dot at center
        ctx.beginPath();
        ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(0, 0%, 100%, ${opacity * 0.9})`;
        ctx.fill();
        
        ctx.restore();
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
  }, [prefersReducedMotion, addRipple, addSparkles]);

  if (prefersReducedMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[1]"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}