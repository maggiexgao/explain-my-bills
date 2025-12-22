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

export function PondIntroScreen({ onComplete }: PondIntroScreenProps) {
  const [displayedText1, setDisplayedText1] = useState('');
  const [displayedText2, setDisplayedText2] = useState('');
  const [displayedText3, setDisplayedText3] = useState('');
  const [currentLine, setCurrentLine] = useState(1);
  const [showFrog, setShowFrog] = useState(false);
  const [frogHop, setFrogHop] = useState(0);
  const [showLilypad, setShowLilypad] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [ripples, setRipples] = useState<IntroRipple[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const rippleIdRef = useRef(0);

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
  }, []);

  const line1 = "welcome to pond, your quiet corner of the healthcare ocean.";
  const line2 = "you are your own best advocate.";
  const line3 = "take a dip";

  const addRipple = useCallback((x: number, y: number) => {
    const id = rippleIdRef.current++;
    setRipples(prev => [...prev, { id, x, y }]);
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== id));
    }, 700);
  }, []);

  // Typewriter effect for line 1
  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayedText1(line1);
      setDisplayedText2(line2);
      setDisplayedText3(line3);
      setCurrentLine(4);
      setShowFrog(true);
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
        // Trigger frog animation after line 3 completes
        setTimeout(() => {
          setShowFrog(true);
          // Hop sequence
          setTimeout(() => {
            setFrogHop(1);
            addRipple(50, 80);
          }, 200);
          setTimeout(() => {
            setFrogHop(2);
            addRipple(30, 85);
          }, 500);
          setTimeout(() => {
            setShowLilypad(true);
          }, 800);
        }, 300);
      }
    }, 55);

    return () => clearInterval(typeInterval);
  }, [currentLine, prefersReducedMotion, addRipple]);

  const handleClick = useCallback(() => {
    if (!showLilypad) return;
    
    // Add splash effect
    addRipple(50, 90);
    setTimeout(() => addRipple(45, 88), 100);
    setTimeout(() => addRipple(55, 92), 150);
    
    setTimeout(() => {
      setIsExiting(true);
      setTimeout(onComplete, 500);
    }, 300);
  }, [showLilypad, onComplete, addRipple]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && showLilypad) {
      e.preventDefault();
      handleClick();
    }
  }, [showLilypad, handleClick]);

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-500 ${
        isExiting ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        background: 'linear-gradient(180deg, hsl(200 50% 85%) 0%, hsl(175 45% 75%) 50%, hsl(200 55% 70%) 100%)',
      }}
    >
      {/* Water caustic overlay */}
      <div 
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(ellipse at 30% 20%, hsl(180 60% 90% / 0.4) 0%, transparent 40%),
            radial-gradient(ellipse at 70% 60%, hsl(175 50% 85% / 0.3) 0%, transparent 35%),
            radial-gradient(ellipse at 50% 80%, hsl(200 55% 80% / 0.4) 0%, transparent 40%)
          `,
        }}
      />

      {/* Animated water lines */}
      <svg className="absolute inset-0 w-full h-full opacity-20" preserveAspectRatio="none">
        <defs>
          <pattern id="waterPattern" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
            <path d="M0 100 Q50 80 100 100 T200 100" stroke="hsl(200, 70%, 95%)" strokeWidth="2" fill="none" opacity="0.5">
              <animate attributeName="d" dur="3s" repeatCount="indefinite"
                values="M0 100 Q50 80 100 100 T200 100;M0 100 Q50 120 100 100 T200 100;M0 100 Q50 80 100 100 T200 100" />
            </path>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#waterPattern)" />
      </svg>

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
              className="absolute rounded-full border-2 border-white/40"
              style={{
                animation: `rippleExpand 0.7s ease-out forwards`,
                animationDelay: `${i * 0.1}s`,
                width: 0,
                height: 0,
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}
        </div>
      ))}

      {/* Content */}
      <div className="text-center px-6 max-w-3xl relative z-10">
        <div className="space-y-3 mb-8">
          <p className="font-mono text-lg md:text-xl lg:text-2xl text-slate-700 drop-shadow-sm min-h-[1.5em] leading-relaxed">
            {displayedText1}
            {currentLine === 1 && displayedText1.length < line1.length && (
              <span className="animate-pulse">|</span>
            )}
          </p>
          
          <p className="font-mono text-lg md:text-xl lg:text-2xl text-slate-700 drop-shadow-sm min-h-[1.5em] leading-relaxed font-medium">
            {displayedText2}
            {currentLine === 2 && displayedText2.length < line2.length && (
              <span className="animate-pulse">|</span>
            )}
          </p>
          
          <div className="min-h-[4rem] flex flex-col items-center justify-center relative pt-4">
            {/* Frog */}
            {showFrog && !prefersReducedMotion && (
              <div
                className="absolute transition-all duration-300 ease-out"
                style={{
                  transform: `translateX(${frogHop === 0 ? -100 : frogHop === 1 ? -40 : -60}px) translateY(${frogHop === 2 ? -20 : 0}px)`,
                  opacity: showFrog ? 1 : 0,
                }}
              >
                <FrogLogo className="w-12 h-12" />
              </div>
            )}
            {prefersReducedMotion && showFrog && (
              <div className="absolute" style={{ transform: 'translateX(-60px) translateY(-20px)' }}>
                <FrogLogo className="w-12 h-12" />
              </div>
            )}

            {/* Lilypad button */}
            {showLilypad ? (
              <button
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={`
                  relative font-mono text-lg md:text-xl text-white font-medium
                  px-8 py-3 rounded-full
                  transition-all duration-300 ease-out
                  focus:outline-none focus:ring-4 focus:ring-green-300/50
                  ${isHovered ? 'scale-105' : 'scale-100'}
                `}
                style={{
                  background: 'linear-gradient(135deg, hsl(130 45% 45%) 0%, hsl(140 50% 40%) 100%)',
                  boxShadow: isHovered 
                    ? '0 8px 32px hsl(130 50% 30% / 0.4), 0 0 20px hsl(130 60% 50% / 0.3), inset 0 1px 0 hsl(130 60% 70% / 0.3)'
                    : '0 4px 16px hsl(130 50% 30% / 0.3), inset 0 1px 0 hsl(130 60% 70% / 0.3)',
                }}
              >
                {/* Leaf vein lines */}
                <svg 
                  className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
                  viewBox="0 0 120 48"
                  preserveAspectRatio="none"
                >
                  <path d="M60 0 L60 48" stroke="hsl(130, 30%, 30%)" strokeWidth="1" />
                  <path d="M60 24 L30 10" stroke="hsl(130, 30%, 30%)" strokeWidth="0.5" />
                  <path d="M60 24 L90 10" stroke="hsl(130, 30%, 30%)" strokeWidth="0.5" />
                  <path d="M60 24 L30 38" stroke="hsl(130, 30%, 30%)" strokeWidth="0.5" />
                  <path d="M60 24 L90 38" stroke="hsl(130, 30%, 30%)" strokeWidth="0.5" />
                </svg>
                <span className="relative z-10 drop-shadow-sm">take a dip</span>
              </button>
            ) : (
              <p className="font-mono text-lg md:text-xl text-slate-700 drop-shadow-sm">
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
        @keyframes rippleExpand {
          0% {
            width: 0;
            height: 0;
            opacity: 0.6;
          }
          100% {
            width: 100px;
            height: 100px;
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
