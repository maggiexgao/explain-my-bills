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

// Soft sparkle colors - occasional twinkles
const SPARKLE_COLORS = [
  'hsla(0, 0%, 100%, 0.7)',      // soft white
  'hsla(45, 60%, 85%, 0.6)',     // pale gold
  'hsla(180, 40%, 88%, 0.55)',   // soft aqua
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

  const addSparkles = useCallback((x: number, y: number, count: number = 3) => {
    const now = Date.now();
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const offset = Math.random() * 20;
      sparklesRef.current.push({
        id: sparkleIdRef.current++,
        x: x + Math.cos(angle) * offset,
        y: y + Math.sin(angle) * offset,
        startTime: now + Math.random() * 60,
        angle: Math.random() * Math.PI * 2,
        length: 4 + Math.random() * 8,
        color: SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)],
      });
    }
    
    if (sparklesRef.current.length > 40) {
      sparklesRef.current = sparklesRef.current.slice(-40);
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
    
    // Occasional sparkles - reduced count
    if (Math.random() > 0.5) {
      addSparkles(x, y, 2);
    }
    
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
      for (let i = 0; i < 2; i++) {
        setTimeout(() => {
          ripplesRef.current.push({
            id: rippleIdRef.current++,
            x: e.clientX + (Math.random() - 0.5) * 30,
            y: e.clientY + (Math.random() - 0.5) * 30,
            startTime: Date.now(),
          });
        }, i * 80);
      }
      addSparkles(e.clientX, e.clientY, 5);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);

    const RIPPLE_DURATION = 650;
    const MAX_RADIUS = 90;
    const SPARKLE_DURATION = 320;

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
      
      // Cursor distortion glow - stronger
      const distortionGradient = ctx.createRadialGradient(
        mouseX, mouseY, 0,
        mouseX, mouseY, 65
      );
      distortionGradient.addColorStop(0, 'hsla(0, 0%, 100%, 0.22)');
      distortionGradient.addColorStop(0.3, 'hsla(180, 45%, 92%, 0.15)');
      distortionGradient.addColorStop(0.6, 'hsla(45, 50%, 92%, 0.08)');
      distortionGradient.addColorStop(1, 'hsla(0, 0%, 100%, 0)');
      
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, 65, 0, Math.PI * 2);
      ctx.fillStyle = distortionGradient;
      ctx.fill();
      
      // Draw ripples - slightly stronger concentric rings
      ripplesRef.current.forEach(ripple => {
        const elapsed = now - ripple.startTime;
        const progress = elapsed / RIPPLE_DURATION;
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
        const baseRadius = easeProgress * MAX_RADIUS;
        const opacity = (1 - progress) * 0.7; // Stronger opacity
        
        // Draw 2 concentric rings with better visibility
        for (let i = 0; i < 2; i++) {
          const ringProgress = 0.25 + i * 0.4;
          const ringRadius = baseRadius * ringProgress + 18;
          const ringOpacity = opacity * (1 - i * 0.25);
          const lineWidth = 1.8 - i * 0.4;
          
          // White ring with better visibility
          ctx.beginPath();
          ctx.arc(ripple.x, ripple.y, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `hsla(0, 0%, 100%, ${ringOpacity * 0.85})`;
          ctx.lineWidth = lineWidth;
          ctx.stroke();
          
          // Subtle glow around ring
          const gradient = ctx.createRadialGradient(
            ripple.x, ripple.y, ringRadius - 4,
            ripple.x, ripple.y, ringRadius + 12
          );
          gradient.addColorStop(0, `hsla(180, 45%, 95%, ${ringOpacity * 0.18})`);
          gradient.addColorStop(0.5, `hsla(45, 50%, 95%, ${ringOpacity * 0.1})`);
          gradient.addColorStop(1, 'hsla(0, 0%, 100%, 0)');
          
          ctx.beginPath();
          ctx.arc(ripple.x, ripple.y, ringRadius + 4, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
        }
        
        // Soft central highlight - slightly stronger
        const highlightOpacity = opacity * 0.3;
        const highlightGradient = ctx.createRadialGradient(
          ripple.x, ripple.y, 0,
          ripple.x, ripple.y, 22
        );
        highlightGradient.addColorStop(0, `hsla(0, 0%, 100%, ${highlightOpacity})`);
        highlightGradient.addColorStop(0.5, `hsla(180, 40%, 98%, ${highlightOpacity * 0.5})`);
        highlightGradient.addColorStop(1, 'hsla(0, 0%, 100%, 0)');
        
        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, 22, 0, Math.PI * 2);
        ctx.fillStyle = highlightGradient;
        ctx.fill();
      });
      
      // Draw sparkles - occasional tiny twinkles
      sparklesRef.current.forEach(sparkle => {
        const elapsed = now - sparkle.startTime;
        if (elapsed < 0) return;
        
        const progress = elapsed / SPARKLE_DURATION;
        const opacity = 1 - progress;
        const scale = 0.5 + (1 - progress) * 0.5;
        
        ctx.save();
        ctx.translate(sparkle.x, sparkle.y);
        ctx.rotate(sparkle.angle);
        
        // Soft streak
        const length = sparkle.length * scale;
        const gradient = ctx.createLinearGradient(-length / 2, 0, length / 2, 0);
        const baseColor = sparkle.color.replace(/[\d.]+\)$/, `${opacity * 0.6})`);
        gradient.addColorStop(0, 'hsla(0, 0%, 100%, 0)');
        gradient.addColorStop(0.3, baseColor);
        gradient.addColorStop(0.5, sparkle.color.replace(/[\d.]+\)$/, `${opacity * 0.7})`));
        gradient.addColorStop(0.7, baseColor);
        gradient.addColorStop(1, 'hsla(0, 0%, 100%, 0)');
        
        ctx.beginPath();
        ctx.moveTo(-length / 2, 0);
        ctx.lineTo(length / 2, 0);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke();
        
        // Small center dot
        ctx.beginPath();
        ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(0, 0%, 100%, ${opacity * 0.6})`;
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
      style={{ mixBlendMode: 'soft-light' }}
    />
  );
}
