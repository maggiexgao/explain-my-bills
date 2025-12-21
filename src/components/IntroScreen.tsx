import { useState, useEffect } from 'react';

interface IntroScreenProps {
  onComplete: () => void;
}

const IntroScreen = ({ onComplete }: IntroScreenProps) => {
  const [displayedText1, setDisplayedText1] = useState('');
  const [displayedText2, setDisplayedText2] = useState('');
  const [showSecondLine, setShowSecondLine] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const line1 = "Welcome to Rosetta...";
  const line2 = "your personal medical bill decoder";

  useEffect(() => {
    let currentIndex = 0;
    const typeInterval = setInterval(() => {
      if (currentIndex < line1.length) {
        setDisplayedText1(line1.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(typeInterval);
        setTimeout(() => setShowSecondLine(true), 500);
      }
    }, 60);

    return () => clearInterval(typeInterval);
  }, []);

  useEffect(() => {
    if (!showSecondLine) return;

    let currentIndex = 0;
    const typeInterval = setInterval(() => {
      if (currentIndex < line2.length) {
        setDisplayedText2(line2.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(typeInterval);
        setTimeout(() => {
          setIsExiting(true);
          setTimeout(onComplete, 600);
        }, 800);
      }
    }, 50);

    return () => clearInterval(typeInterval);
  }, [showSecondLine, onComplete]);

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center aurora-bg transition-opacity duration-500 ${
        isExiting ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="text-center px-6 max-w-2xl">
        <h1 className="font-mono text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 drop-shadow-lg min-h-[1.2em]">
          {displayedText1}
          {displayedText1.length < line1.length && (
            <span className="animate-pulse">|</span>
          )}
        </h1>
        
        <p className="font-mono text-xl md:text-2xl lg:text-3xl text-white/90 font-light drop-shadow-md min-h-[1.5em]">
          {displayedText2}
          {showSecondLine && displayedText2.length < line2.length && (
            <span className="animate-pulse">|</span>
          )}
        </p>
      </div>
    </div>
  );
};

export default IntroScreen;
