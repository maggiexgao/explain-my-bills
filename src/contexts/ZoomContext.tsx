import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

type ZoomLevel = 'normal' | 'large' | 'x-large';

interface ZoomContextType {
  zoomLevel: ZoomLevel;
  setZoomLevel: (level: ZoomLevel) => void;
  cycleZoom: () => void;
  zoomClass: string;
}

const ZoomContext = createContext<ZoomContextType | undefined>(undefined);

const ZOOM_CLASSES: Record<ZoomLevel, string> = {
  normal: '',
  large: 'text-zoom-large',
  'x-large': 'text-zoom-xl',
};

export function ZoomProvider({ children }: { children: ReactNode }) {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('pond-zoom-level');
      if (saved && (saved === 'normal' || saved === 'large' || saved === 'x-large')) {
        return saved as ZoomLevel;
      }
    }
    return 'normal';
  });

  useEffect(() => {
    sessionStorage.setItem('pond-zoom-level', zoomLevel);
  }, [zoomLevel]);

  const cycleZoom = () => {
    setZoomLevel((current) => {
      if (current === 'normal') return 'large';
      if (current === 'large') return 'x-large';
      return 'normal';
    });
  };

  return (
    <ZoomContext.Provider
      value={{
        zoomLevel,
        setZoomLevel,
        cycleZoom,
        zoomClass: ZOOM_CLASSES[zoomLevel],
      }}
    >
      {children}
    </ZoomContext.Provider>
  );
}

export function useZoom() {
  const context = useContext(ZoomContext);
  if (context === undefined) {
    throw new Error('useZoom must be used within a ZoomProvider');
  }
  return context;
}
