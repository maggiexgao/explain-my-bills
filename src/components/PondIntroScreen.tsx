import { useState, useEffect, useCallback, useRef } from 'react';
import pondFrog from '@/assets/pond-frog.png';
import lilypadButton from '@/assets/lilypad-button.png';

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
  const [displayedText4, setDisplayedText4] = useState('');
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

  const line1 = "welcome to pond.";
  const line2 = "clear answers to complex healthcare.";
  const line3 = "lower your costs. understand your care. own your health.";
  const lilypadText = "take a dip";

  const addRipple = useCallback((xPercent: number, yPercent: number) => {
    const id = rippleIdRef.current++;
    setRipples(prev => [...prev, { id, x: xPercent, y: yPercent }]);
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== id));
    }, 700);
  }, []);

  const addSparkles = useCallback((xPercent: number, yPercent: number, count: number = 4) => {
    const newSparkles: IntroSparkle[] = [];
    for (let i = 0; i < count; i++) {
      const id = sparkleIdRef.current++;
      newSparkles.push({
        id,
        x: xPercent + (Math.random() - 0.5) * 6,
        y: yPercent + (Math.random() - 0.5) * 6,
        angle: Math.random() * 360,
      });
      setTimeout(() => {
        setSparkles(prev => prev.filter(s => s.id !== id));
      }, 350);
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
      setDisplayedText4(lilypadText);
      setCurrentLine(5);
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
    }, 35);

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
        setTimeout(() => setCurrentLine(4), 300);
      }
    }, 30);

    return () => clearInterval(typeInterval);
  }, [currentLine, prefersReducedMotion]);

  // Show lilypad after line 3
  useEffect(() => {
    if (currentLine !== 4 || prefersReducedMotion) return;

    let currentIndex = 0;
    const typeInterval = setInterval(() => {
      if (currentIndex < lilypadText.length) {
        setDisplayedText4(lilypadText.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(typeInterval);
        setTimeout(() => {
          setShowLilypad(true);
          addRipple(50, 72);
          addSparkles(50, 72, 5);
        }, 200);
      }
    }, 50);

    return () => clearInterval(typeInterval);
  }, [currentLine, prefersReducedMotion, addRipple, addSparkles]);

  const handleClick = useCallback(() => {
    if (!showLilypad) return;
    
    addRipple(50, 72);
    addSparkles(50, 72, 8);
    setTimeout(() => addRipple(48, 70), 80);
    setTimeout(() => addRipple(52, 74), 120);
    
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
      {/* Very light overlay for text readability */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, hsl(0 0% 100% / 0.05) 0%, hsl(0 0% 100% / 0.1) 100%)',
        }}
      />

      {/* Shimmer sparkle overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="shimmer-particles" />
      </div>

      {/* Frog cursor - using actual image */}
      {!prefersReducedMotion && (
        <div
          className="fixed pointer-events-none z-[100] transition-transform duration-75 hidden md:block"
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
          {[0, 1].map(i => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                animation: `rippleExpandIntro 0.7s ease-out forwards`,
                animationDelay: `${i * 0.1}s`,
                width: 0,
                height: 0,
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                border: `${1.5 - i * 0.3}px solid hsla(0, 0%, 100%, ${0.5 - i * 0.15})`,
                boxShadow: `0 0 ${6 - i * 2}px hsla(180, 50%, 85%, ${0.3 - i * 0.1})`,
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
            animation: 'sparkleFlash 0.35s ease-out forwards',
          }}
        >
          <div 
            className="w-2 h-0.5 rounded-full"
            style={{
              background: 'linear-gradient(90deg, transparent, hsla(0, 0%, 100%, 0.7), transparent)',
            }}
          />
        </div>
      ))}

      {/* Content */}
      <div className="text-center px-4 md:px-6 max-w-2xl relative z-10">
        <div className="space-y-2 md:space-y-3 mb-4 md:mb-6">
          {/* Line 1: welcome to pond. */}
          <p className="font-mono text-base md:text-lg lg:text-xl text-gray-800 drop-shadow-sm min-h-[1.5em] leading-relaxed">
            {displayedText1}
            {currentLine === 1 && displayedText1.length < line1.length && (
              <span className="animate-pulse">|</span>
            )}
          </p>
          
          {/* Line 2: clear answers to complex healthcare. */}
          <p className="font-mono text-base md:text-lg lg:text-xl text-gray-900 drop-shadow-sm min-h-[1.5em] leading-relaxed font-medium">
            {displayedText2}
            {currentLine === 2 && displayedText2.length < line2.length && (
              <span className="animate-pulse">|</span>
            )}
          </p>
          
          {/* Line 3: lower your costs. understand your care. own your health. */}
          <p className="font-mono text-sm md:text-base lg:text-lg text-gray-800 drop-shadow-sm min-h-[1.5em] leading-relaxed">
            {displayedText3}
            {currentLine === 3 && displayedText3.length < line3.length && (
              <span className="animate-pulse">|</span>
            )}
          </p>
          
          {/* Lilypad button area - 2.5x larger */}
          <div className="min-h-[18rem] md:min-h-[20rem] flex flex-col items-center justify-center relative pt-4 md:pt-6">
            {showLilypad ? (
              <button
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                onMouseEnter={() => {
                  setIsHovered(true);
                  addSparkles(50, 72, 3);
                }}
                onMouseLeave={() => setIsHovered(false)}
                className={`
                  relative
                  transition-all duration-300 ease-out
                  focus:outline-none focus:ring-4 focus:ring-teal-400/40
                  ${isHovered ? 'scale-105 brightness-110' : 'scale-100'}
                `}
                style={{
                  cursor: prefersReducedMotion ? 'pointer' : 'none',
                }}
              >
                {/* Lilypad image - 2.5x larger (was w-52, now ~w-[32.5rem] = ~520px) */}
                <img 
                  src={lilypadButton} 
                  alt="Lilypad"
                  className="w-72 md:w-[26rem] h-auto drop-shadow-lg"
                  style={{
                    filter: isHovered ? 'brightness(1.08) drop-shadow(0 12px 30px hsl(130 40% 30% / 0.4))' : 'drop-shadow(0 6px 18px hsl(130 40% 30% / 0.3))',
                  }}
                />
                
                {/* Text overlay on the lilypad - larger text */}
                <span 
                  className="absolute inset-0 flex items-center justify-center font-sans text-xl md:text-2xl lg:text-3xl font-semibold text-gray-900 drop-shadow-sm"
                  style={{
                    paddingTop: '2rem',
                  }}
                >
                  take a dip
                </span>
              </button>
            ) : (
              <p className="font-mono text-base md:text-lg text-gray-800 drop-shadow-sm">
                {displayedText4}
                {currentLine === 4 && displayedText4.length < lilypadText.length && (
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
            opacity: 0.8;
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
            radial-gradient(1px 1px at 10% 20%, hsla(0, 0%, 100%, 0.6) 0%, transparent 100%),
            radial-gradient(1px 1px at 30% 40%, hsla(0, 0%, 100%, 0.5) 0%, transparent 100%),
            radial-gradient(1px 1px at 50% 15%, hsla(180, 70%, 90%, 0.5) 0%, transparent 100%),
            radial-gradient(1px 1px at 70% 60%, hsla(45, 85%, 85%, 0.4) 0%, transparent 100%),
            radial-gradient(1px 1px at 85% 30%, hsla(0, 0%, 100%, 0.4) 0%, transparent 100%),
            radial-gradient(1px 1px at 20% 70%, hsla(200, 70%, 90%, 0.4) 0%, transparent 100%);
          animation: shimmerDrift 12s ease-in-out infinite;
        }

        @keyframes shimmerDrift {
          0%, 100% {
            transform: translateY(0) translateX(0);
            opacity: 0.5;
          }
          50% {
            transform: translateY(-8px) translateX(4px);
            opacity: 0.7;
          }
        }
      `}</style>
    </div>
  );
}
