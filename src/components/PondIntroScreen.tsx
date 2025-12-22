import { useState, useEffect, useCallback, useRef } from 'react';
import pondFrog from '@/assets/pond-frog.png';

interface PondIntroScreenProps {
  onComplete: () => void;
}

interface IntroRipple {
  id: number;
  x: number;
  y: number;
}

interface IntroSparkle {
  id: number;
  x: number;
  y: number;
  angle: number;
}

export function PondIntroScreen({ onComplete }: PondIntroScreenProps) {
  const [displayedText1, setDisplayedText1] = useState('');
  const [displayedText2, setDisplayedText2] = useState('');
  const [displayedText3, setDisplayedText3] = useState('');
  const [currentLine, setCurrentLine] = useState(1);
  const [showLilypad, setShowLilypad] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [ripples, setRipples] = useState<IntroRipple[]>([]);
  const [sparkles, setSparkles] = useState<IntroSparkle[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const rippleIdRef = useRef(0);
  const sparkleIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
  }, []);

  const line1 = "welcome to pond, your quiet corner of the healthcare ocean.";
  const line2 = "you are your own best advocate.";
  const line3 = "take a dip";

  const addRipple = useCallback((xPercent: number, yPercent: number) => {
    const id = rippleIdRef.current++;
    setRipples(prev => [...prev, { id, x: xPercent, y: yPercent }]);
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== id));
    }, 800);
  }, []);

  const addSparkles = useCallback((xPercent: number, yPercent: number, count: number = 6) => {
    const newSparkles: IntroSparkle[] = [];
    for (let i = 0; i < count; i++) {
      const id = sparkleIdRef.current++;
      newSparkles.push({
        id,
        x: xPercent + (Math.random() - 0.5) * 8,
        y: yPercent + (Math.random() - 0.5) * 8,
        angle: Math.random() * 360,
      });
      setTimeout(() => {
        setSparkles(prev => prev.filter(s => s.id !== id));
      }, 400);
    }
    setSparkles(prev => [...prev, ...newSparkles]);
  }, []);

  // Track mouse position for frog cursor
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Typewriter effect for line 1
  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayedText1(line1);
      setDisplayedText2(line2);
      setDisplayedText3(line3);
      setCurrentLine(4);
      setShowLilypad(true);
      return;
    }

    let currentIndex = 0;
    const typeInterval = setInterval(() => {
      if (currentIndex < line1.length) {
        setDisplayedText1(line1.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(typeInterval);
        setTimeout(() => setCurrentLine(2), 300);
      }
    }, 40);

    return () => clearInterval(typeInterval);
  }, [prefersReducedMotion]);

  // Typewriter effect for line 2
  useEffect(() => {
    if (currentLine !== 2 || prefersReducedMotion) return;

    let currentIndex = 0;
    const typeInterval = setInterval(() => {
      if (currentIndex < line2.length) {
        setDisplayedText2(line2.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(typeInterval);
        setTimeout(() => setCurrentLine(3), 300);
      }
    }, 45);

    return () => clearInterval(typeInterval);
  }, [currentLine, prefersReducedMotion]);

  // Typewriter effect for line 3
  useEffect(() => {
    if (currentLine !== 3 || prefersReducedMotion) return;

    let currentIndex = 0;
    const typeInterval = setInterval(() => {
      if (currentIndex < line3.length) {
        setDisplayedText3(line3.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(typeInterval);
        setTimeout(() => {
          setShowLilypad(true);
          addRipple(50, 70);
          addSparkles(50, 70, 8);
        }, 200);
      }
    }, 50);

    return () => clearInterval(typeInterval);
  }, [currentLine, prefersReducedMotion, addRipple, addSparkles]);

  const handleClick = useCallback(() => {
    if (!showLilypad) return;
    
    addRipple(50, 70);
    addSparkles(50, 70, 12);
    setTimeout(() => addRipple(48, 68), 80);
    setTimeout(() => addRipple(52, 72), 120);
    
    setTimeout(() => {
      setIsExiting(true);
      setTimeout(onComplete, 400);
    }, 250);
  }, [showLilypad, onComplete, addRipple, addSparkles]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && showLilypad) {
      e.preventDefault();
      handleClick();
    }
  }, [showLilypad, handleClick]);

  return (
    <div 
      ref={containerRef}
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-400 ${
        isExiting ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        backgroundImage: `url('/images/pond-water-bg.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        cursor: prefersReducedMotion ? 'auto' : 'none',
      }}
    >
      {/* Subtle darkening overlay for better text readability */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, hsl(200 30% 15% / 0.15) 0%, hsl(200 30% 10% / 0.25) 100%)',
        }}
      />

      {/* Shimmer sparkle overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="shimmer-particles" />
      </div>

      {/* Frog cursor - using actual image */}
      {!prefersReducedMotion && (
        <div
          className="fixed pointer-events-none z-[100] transition-transform duration-75"
          style={{
            left: mousePos.x,
            top: mousePos.y,
            transform: `translate(-50%, -50%) ${isHovered ? 'scale(1.1)' : 'scale(1)'}`,
          }}
        >
          <img 
            src={pondFrog} 
            alt="" 
            className="w-10 h-10 drop-shadow-lg rounded-full"
          />
        </div>
      )}

      {/* Ripples */}
      {ripples.map(ripple => (
        <div
          key={ripple.id}
          className="absolute pointer-events-none"
          style={{
            left: `${ripple.x}%`,
            top: `${ripple.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                animation: `rippleExpandIntro 0.8s ease-out forwards`,
                animationDelay: `${i * 0.1}s`,
                width: 0,
                height: 0,
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                border: `${2 - i * 0.4}px solid hsla(0, 0%, 100%, ${0.7 - i * 0.2})`,
                boxShadow: `0 0 ${8 - i * 2}px hsla(45, 80%, 70%, ${0.4 - i * 0.1})`,
              }}
            />
          ))}
        </div>
      ))}

      {/* Sparkles */}
      {sparkles.map(sparkle => (
        <div
          key={sparkle.id}
          className="absolute pointer-events-none"
          style={{
            left: `${sparkle.x}%`,
            top: `${sparkle.y}%`,
            transform: `translate(-50%, -50%) rotate(${sparkle.angle}deg)`,
            animation: 'sparkleFlash 0.4s ease-out forwards',
          }}
        >
          <div 
            className="w-3 h-0.5 rounded-full"
            style={{
              background: 'linear-gradient(90deg, transparent, hsla(45, 90%, 80%, 0.9), transparent)',
            }}
          />
        </div>
      ))}

      {/* Content */}
      <div className="text-center px-6 max-w-2xl relative z-10">
        <div className="space-y-3 mb-6">
          <p className="font-mono text-base md:text-lg lg:text-xl text-white/90 drop-shadow-md min-h-[1.25em] leading-relaxed">
            {displayedText1}
            {currentLine === 1 && displayedText1.length < line1.length && (
              <span className="animate-pulse">|</span>
            )}
          </p>
          
          <p className="font-mono text-base md:text-lg lg:text-xl text-white drop-shadow-md min-h-[1.25em] leading-relaxed font-medium">
            {displayedText2}
            {currentLine === 2 && displayedText2.length < line2.length && (
              <span className="animate-pulse">|</span>
            )}
          </p>
          
          <div className="min-h-[8rem] flex flex-col items-center justify-center relative pt-4">
            {/* Lilypad button */}
            {showLilypad ? (
              <button
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                onMouseEnter={() => {
                  setIsHovered(true);
                  addSparkles(50, 70, 4);
                }}
                onMouseLeave={() => setIsHovered(false)}
                className={`
                  relative font-sans text-base md:text-lg text-white font-semibold
                  transition-all duration-300 ease-out
                  focus:outline-none focus:ring-4 focus:ring-green-400/50
                  ${isHovered ? 'scale-105' : 'scale-100'}
                `}
                style={{
                  width: '140px',
                  height: '140px',
                  borderRadius: '50%',
                  background: `
                    radial-gradient(ellipse at 40% 30%, hsl(130 55% 50%) 0%, hsl(135 50% 42%) 40%, hsl(140 45% 35%) 100%)
                  `,
                  boxShadow: isHovered 
                    ? `
                      0 8px 30px hsl(130 50% 25% / 0.5), 
                      0 0 25px hsl(130 60% 45% / 0.4), 
                      inset 0 2px 4px hsl(130 60% 70% / 0.4),
                      inset 0 -4px 8px hsl(140 50% 25% / 0.3)
                    `
                    : `
                      0 4px 20px hsl(130 50% 20% / 0.4), 
                      inset 0 2px 4px hsl(130 60% 70% / 0.3),
                      inset 0 -4px 8px hsl(140 50% 25% / 0.2)
                    `,
                  transform: isHovered ? 'scale(1.05) rotate(-2deg)' : 'scale(1)',
                  cursor: prefersReducedMotion ? 'pointer' : 'none',
                  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%, 12% 50%, 50% 45%)',
                }}
              >
                {/* Lilypad vein SVG overlay */}
                <svg 
                  className="absolute inset-0 w-full h-full opacity-25 pointer-events-none"
                  viewBox="0 0 100 100"
                >
                  <path d="M50 15 L50 85" stroke="hsl(135, 35%, 30%)" strokeWidth="1.5" fill="none" />
                  <path d="M50 50 L20 25" stroke="hsl(135, 35%, 30%)" strokeWidth="1" fill="none" />
                  <path d="M50 50 L80 25" stroke="hsl(135, 35%, 30%)" strokeWidth="1" fill="none" />
                  <path d="M50 50 L15 50" stroke="hsl(135, 35%, 30%)" strokeWidth="1" fill="none" />
                  <path d="M50 50 L85 50" stroke="hsl(135, 35%, 30%)" strokeWidth="1" fill="none" />
                  <path d="M50 50 L20 75" stroke="hsl(135, 35%, 30%)" strokeWidth="1" fill="none" />
                  <path d="M50 50 L80 75" stroke="hsl(135, 35%, 30%)" strokeWidth="1" fill="none" />
                </svg>
                
                {/* Water highlight */}
                <div 
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    background: 'radial-gradient(ellipse at 35% 25%, hsla(0, 0%, 100%, 0.25) 0%, transparent 50%)',
                    clipPath: 'inherit',
                  }}
                />
                
                <span className="relative z-10 drop-shadow-lg">take a dip</span>
              </button>
            ) : (
              <p className="font-mono text-base md:text-lg text-white/90 drop-shadow-md">
                {displayedText3}
                {currentLine === 3 && displayedText3.length < line3.length && (
                  <span className="animate-pulse">|</span>
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes rippleExpandIntro {
          0% {
            width: 0;
            height: 0;
            opacity: 1;
          }
          100% {
            width: 100px;
            height: 100px;
            opacity: 0;
          }
        }
        
        @keyframes sparkleFlash {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.5);
          }
          30% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.3);
          }
        }

        .shimmer-particles {
          position: absolute;
          inset: 0;
          background-image: 
            radial-gradient(1px 1px at 10% 20%, hsla(45, 90%, 80%, 0.8) 0%, transparent 100%),
            radial-gradient(1px 1px at 30% 40%, hsla(0, 0%, 100%, 0.6) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 50% 15%, hsla(180, 70%, 80%, 0.7) 0%, transparent 100%),
            radial-gradient(1px 1px at 70% 60%, hsla(45, 85%, 75%, 0.6) 0%, transparent 100%),
            radial-gradient(1px 1px at 85% 30%, hsla(0, 0%, 100%, 0.5) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 20% 70%, hsla(200, 70%, 80%, 0.6) 0%, transparent 100%),
            radial-gradient(1px 1px at 60% 85%, hsla(45, 80%, 70%, 0.5) 0%, transparent 100%),
            radial-gradient(1px 1px at 90% 75%, hsla(0, 0%, 100%, 0.4) 0%, transparent 100%);
          animation: shimmerDrift 10s ease-in-out infinite;
        }

        @keyframes shimmerDrift {
          0%, 100% {
            transform: translateY(0) translateX(0);
            opacity: 0.6;
          }
          50% {
            transform: translateY(-10px) translateX(5px);
            opacity: 0.8;
          }
        }
      `}</style>
    </div>
  );
}
