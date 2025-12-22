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

// Pastel sparkle colors matching the new water theme
const SPARKLE_COLORS = [
  'hsla(0, 0%, 100%, 0.95)',     // pure white
  'hsla(45, 85%, 85%, 0.9)',     // pale gold
  'hsla(180, 55%, 85%, 0.85)',   // soft aqua
  'hsla(340, 60%, 85%, 0.8)',    // blush pink
  'hsla(20, 70%, 85%, 0.85)',    // peach
  'hsla(160, 50%, 80%, 0.8)',    // mint
];

export function WaterRippleEffect() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ripplesRef = useRef<Ripple[]>([]);
  const sparklesRef = useRef<Sparkle[]>([]);
  const animationRef = useRef<number>();
  const lastMoveRef = useRef<number>(0);
  const rippleIdRef = useRef<number>(0);
  const sparkleIdRef = useRef<number>(0);
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
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

  const addSparkles = useCallback((x: number, y: number, count: number = 6) => {
    const now = Date.now();
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const offset = Math.random() * 20;
      sparklesRef.current.push({
        id: sparkleIdRef.current++,
        x: x + Math.cos(angle) * offset,
        y: y + Math.sin(angle) * offset,
        startTime: now + Math.random() * 80,
        angle: Math.random() * Math.PI * 2,
        length: 5 + Math.random() * 10,
        color: SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)],
      });
    }
    
    if (sparklesRef.current.length > 60) {
      sparklesRef.current = sparklesRef.current.slice(-60);
    }
  }, []);

  const addRipple = useCallback((x: number, y: number) => {
    const now = Date.now();
    if (now - lastMoveRef.current < 60) return;
    lastMoveRef.current = now;
    
    ripplesRef.current.push({
      id: rippleIdRef.current++,
      x,
      y,
      startTime: now,
    });
    
    addSparkles(x, y, 5);
    
    if (ripplesRef.current.length > 15) {
      ripplesRef.current = ripplesRef.current.slice(-15);
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
      mousePosRef.current = { x: e.clientX, y: e.clientY };
      addRipple(e.clientX, e.clientY);
    };

    const handleClick = (e: MouseEvent) => {
      const now = Date.now();
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          ripplesRef.current.push({
            id: rippleIdRef.current++,
            x: e.clientX + (Math.random() - 0.5) * 30,
            y: e.clientY + (Math.random() - 0.5) * 30,
            startTime: Date.now(),
          });
        }, i * 50);
      }
      addSparkles(e.clientX, e.clientY, 12);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);

    const RIPPLE_DURATION = 900;
    const MAX_RADIUS = 100;
    const SPARKLE_DURATION = 400;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const now = Date.now();
      const mouseX = mousePosRef.current.x;
      const mouseY = mousePosRef.current.y;
      
      // Filter old effects
      ripplesRef.current = ripplesRef.current.filter(
        ripple => now - ripple.startTime < RIPPLE_DURATION
      );
      sparklesRef.current = sparklesRef.current.filter(
        sparkle => now - sparkle.startTime < SPARKLE_DURATION
      );
      
      // Subtle distortion glow at cursor position
      const distortionGradient = ctx.createRadialGradient(
        mouseX, mouseY, 0,
        mouseX, mouseY, 60
      );
      distortionGradient.addColorStop(0, 'hsla(0, 0%, 100%, 0.15)');
      distortionGradient.addColorStop(0.4, 'hsla(180, 50%, 90%, 0.08)');
      distortionGradient.addColorStop(1, 'hsla(0, 0%, 100%, 0)');
      
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, 60, 0, Math.PI * 2);
      ctx.fillStyle = distortionGradient;
      ctx.fill();
      
      // Draw ripples - bright white/aqua concentric rings
      ripplesRef.current.forEach(ripple => {
        const elapsed = now - ripple.startTime;
        const progress = elapsed / RIPPLE_DURATION;
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
        const baseRadius = easeProgress * MAX_RADIUS;
        const opacity = (1 - progress) * 0.9;
        
        // Draw 3 concentric rings
        for (let i = 0; i < 3; i++) {
          const ringProgress = 0.3 + i * 0.28;
          const ringRadius = baseRadius * ringProgress + 16;
          const ringOpacity = opacity * (1 - i * 0.3);
          const lineWidth = 2 - i * 0.5;
          
          // Main bright white ring
          ctx.beginPath();
          ctx.arc(ripple.x, ripple.y, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `hsla(0, 0%, 100%, ${ringOpacity * 0.85})`;
          ctx.lineWidth = lineWidth;
          ctx.stroke();
          
          // Subtle pastel tint behind
          const gradient = ctx.createRadialGradient(
            ripple.x, ripple.y, ringRadius - 4,
            ripple.x, ripple.y, ringRadius + 10
          );
          gradient.addColorStop(0, `hsla(180, 45%, 90%, ${ringOpacity * 0.2})`);
          gradient.addColorStop(0.5, `hsla(45, 65%, 90%, ${ringOpacity * 0.12})`);
          gradient.addColorStop(1, 'hsla(0, 0%, 100%, 0)');
          
          ctx.beginPath();
          ctx.arc(ripple.x, ripple.y, ringRadius + 3, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
        }
        
        // Central bright highlight
        const highlightOpacity = opacity * 0.35;
        const highlightGradient = ctx.createRadialGradient(
          ripple.x, ripple.y, 0,
          ripple.x, ripple.y, 20
        );
        highlightGradient.addColorStop(0, `hsla(0, 0%, 100%, ${highlightOpacity})`);
        highlightGradient.addColorStop(0.5, `hsla(45, 70%, 95%, ${highlightOpacity * 0.6})`);
        highlightGradient.addColorStop(1, 'hsla(0, 0%, 100%, 0)');
        
        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, 20, 0, Math.PI * 2);
        ctx.fillStyle = highlightGradient;
        ctx.fill();
      });
      
      // Draw sparkles - sun glints on water
      sparklesRef.current.forEach(sparkle => {
        const elapsed = now - sparkle.startTime;
        if (elapsed < 0) return;
        
        const progress = elapsed / SPARKLE_DURATION;
        const opacity = 1 - progress;
        const scale = 0.6 + (1 - progress) * 0.4;
        
        ctx.save();
        ctx.translate(sparkle.x, sparkle.y);
        ctx.rotate(sparkle.angle);
        
        // Bright streak
        const length = sparkle.length * scale;
        const gradient = ctx.createLinearGradient(-length / 2, 0, length / 2, 0);
        const baseColor = sparkle.color.replace(/[\d.]+\)$/, `${opacity * 0.95})`);
        gradient.addColorStop(0, 'hsla(0, 0%, 100%, 0)');
        gradient.addColorStop(0.25, baseColor);
        gradient.addColorStop(0.5, sparkle.color.replace(/[\d.]+\)$/, `${opacity})`));
        gradient.addColorStop(0.75, baseColor);
        gradient.addColorStop(1, 'hsla(0, 0%, 100%, 0)');
        
        ctx.beginPath();
        ctx.moveTo(-length / 2, 0);
        ctx.lineTo(length / 2, 0);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();
        
        // Bright center dot
        ctx.beginPath();
        ctx.arc(0, 0, 2, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(0, 0%, 100%, ${opacity})`;
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
      style={{ mixBlendMode: 'overlay' }}
    />
  );
}
