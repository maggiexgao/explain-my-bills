import { useState, useEffect, useCallback, useRef } from 'react';
import { FrogLogo } from './FrogLogo';

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
        setTimeout(() => setCurrentLine(2), 400);
      }
    }, 45);

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
        setTimeout(() => setCurrentLine(3), 400);
      }
    }, 50);

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
        // Show lilypad button after typing completes
        setTimeout(() => {
          setShowLilypad(true);
          addRipple(50, 75);
          addSparkles(50, 75, 8);
        }, 300);
      }
    }, 55);

    return () => clearInterval(typeInterval);
  }, [currentLine, prefersReducedMotion, addRipple, addSparkles]);

  const handleClick = useCallback(() => {
    if (!showLilypad) return;
    
    // Add splash effect
    addRipple(50, 75);
    addSparkles(50, 75, 12);
    setTimeout(() => addRipple(48, 73), 80);
    setTimeout(() => addRipple(52, 77), 120);
    
    setTimeout(() => {
      setIsExiting(true);
      setTimeout(onComplete, 500);
    }, 300);
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
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-500 ${
        isExiting ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        background: `
          radial-gradient(ellipse at 25% 15%, hsl(340 60% 55% / 0.45) 0%, transparent 45%),
          radial-gradient(ellipse at 75% 25%, hsl(15 75% 55% / 0.5) 0%, transparent 40%),
          radial-gradient(ellipse at 60% 70%, hsl(45 80% 55% / 0.4) 0%, transparent 45%),
          radial-gradient(ellipse at 30% 80%, hsl(340 55% 50% / 0.35) 0%, transparent 40%),
          linear-gradient(180deg, hsl(195 50% 20%) 0%, hsl(185 45% 22%) 50%, hsl(200 55% 18%) 100%)
        `,
        cursor: prefersReducedMotion ? 'auto' : 'none',
      }}
    >
      {/* Water caustic overlay */}
      <div 
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(ellipse at 20% 30%, hsl(45 85% 70% / 0.2) 0%, transparent 30%),
            radial-gradient(ellipse at 80% 20%, hsl(0 0% 100% / 0.15) 0%, transparent 25%),
            radial-gradient(ellipse at 60% 50%, hsl(180 60% 75% / 0.12) 0%, transparent 35%),
            radial-gradient(ellipse at 35% 70%, hsl(0 0% 100% / 0.12) 0%, transparent 30%)
          `,
        }}
      />

      {/* Animated water lines */}
      <svg className="absolute inset-0 w-full h-full opacity-15" preserveAspectRatio="none">
        <defs>
          <pattern id="waterPattern" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
            <path d="M0 100 Q50 80 100 100 T200 100" stroke="hsl(0, 0%, 100%)" strokeWidth="1.5" fill="none" opacity="0.6">
              <animate attributeName="d" dur="3s" repeatCount="indefinite"
                values="M0 100 Q50 80 100 100 T200 100;M0 100 Q50 120 100 100 T200 100;M0 100 Q50 80 100 100 T200 100" />
            </path>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#waterPattern)" />
      </svg>

      {/* Frog cursor */}
      {!prefersReducedMotion && (
        <div
          className="fixed pointer-events-none z-[100] transition-transform duration-75"
          style={{
            left: mousePos.x,
            top: mousePos.y,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <FrogLogo className="w-10 h-10 drop-shadow-lg" />
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
      <div className="text-center px-6 max-w-3xl relative z-10">
        <div className="space-y-4 mb-8">
          <p className="font-mono text-lg md:text-xl lg:text-2xl text-white/90 drop-shadow-md min-h-[1.5em] leading-relaxed">
            {displayedText1}
            {currentLine === 1 && displayedText1.length < line1.length && (
              <span className="animate-pulse">|</span>
            )}
          </p>
          
          <p className="font-mono text-lg md:text-xl lg:text-2xl text-white drop-shadow-md min-h-[1.5em] leading-relaxed font-medium">
            {displayedText2}
            {currentLine === 2 && displayedText2.length < line2.length && (
              <span className="animate-pulse">|</span>
            )}
          </p>
          
          <div className="min-h-[5rem] flex flex-col items-center justify-center relative pt-6">
            {/* Lilypad button */}
            {showLilypad ? (
              <button
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                onMouseEnter={() => {
                  setIsHovered(true);
                  addSparkles(50, 75, 4);
                }}
                onMouseLeave={() => setIsHovered(false)}
                className={`
                  relative font-sans text-lg md:text-xl text-white font-semibold
                  transition-all duration-300 ease-out
                  focus:outline-none focus:ring-4 focus:ring-green-400/50
                  ${isHovered ? 'scale-110' : 'scale-100'}
                `}
                style={{
                  width: '180px',
                  height: '180px',
                  borderRadius: '50%',
                  background: `
                    radial-gradient(ellipse at 40% 30%, hsl(130 55% 50%) 0%, hsl(135 50% 42%) 40%, hsl(140 45% 35%) 100%)
                  `,
                  boxShadow: isHovered 
                    ? `
                      0 12px 40px hsl(130 50% 25% / 0.5), 
                      0 0 30px hsl(130 60% 45% / 0.4), 
                      inset 0 2px 4px hsl(130 60% 70% / 0.4),
                      inset 0 -4px 8px hsl(140 50% 25% / 0.3)
                    `
                    : `
                      0 6px 24px hsl(130 50% 20% / 0.4), 
                      inset 0 2px 4px hsl(130 60% 70% / 0.3),
                      inset 0 -4px 8px hsl(140 50% 25% / 0.2)
                    `,
                  transform: isHovered ? 'scale(1.1) rotate(-2deg)' : 'scale(1)',
                  cursor: prefersReducedMotion ? 'pointer' : 'none',
                  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%, 15% 50%, 50% 45%)',
                }}
              >
                {/* Lilypad vein SVG overlay */}
                <svg 
                  className="absolute inset-0 w-full h-full opacity-30 pointer-events-none"
                  viewBox="0 0 100 100"
                >
                  {/* Central vein */}
                  <path d="M50 15 L50 85" stroke="hsl(135, 35%, 30%)" strokeWidth="1.5" fill="none" />
                  {/* Radiating veins */}
                  <path d="M50 50 L20 25" stroke="hsl(135, 35%, 30%)" strokeWidth="1" fill="none" />
                  <path d="M50 50 L80 25" stroke="hsl(135, 35%, 30%)" strokeWidth="1" fill="none" />
                  <path d="M50 50 L15 50" stroke="hsl(135, 35%, 30%)" strokeWidth="1" fill="none" />
                  <path d="M50 50 L85 50" stroke="hsl(135, 35%, 30%)" strokeWidth="1" fill="none" />
                  <path d="M50 50 L20 75" stroke="hsl(135, 35%, 30%)" strokeWidth="1" fill="none" />
                  <path d="M50 50 L80 75" stroke="hsl(135, 35%, 30%)" strokeWidth="1" fill="none" />
                  {/* Secondary veins */}
                  <path d="M35 32 L25 20" stroke="hsl(135, 35%, 35%)" strokeWidth="0.5" fill="none" />
                  <path d="M65 32 L75 20" stroke="hsl(135, 35%, 35%)" strokeWidth="0.5" fill="none" />
                  <path d="M35 68 L25 80" stroke="hsl(135, 35%, 35%)" strokeWidth="0.5" fill="none" />
                  <path d="M65 68 L75 80" stroke="hsl(135, 35%, 35%)" strokeWidth="0.5" fill="none" />
                </svg>
                
                {/* Water highlight on surface */}
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
              <p className="font-mono text-lg md:text-xl text-white/90 drop-shadow-md">
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
            width: 120px;
            height: 120px;
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
      `}</style>
    </div>
  );
}