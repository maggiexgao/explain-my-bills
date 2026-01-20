/**
 * useAdminContext - Unified admin authorization context for all admin actions
 * 
 * Single source of truth for admin auth mode:
 * - Bypass mode: URL ?bypass=token or ?admin=bypass or localStorage
 * - Session mode: Valid Supabase session with admin role
 * 
 * Features:
 * - Consistent auth behavior across page, imports, and API calls
 * - Refresh tracking with timestamps
 * - Debug info for troubleshooting
 */

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AdminAuthMode = 'bypass' | 'session' | 'none';
export type BypassSource = 'url_bypass' | 'url_admin_shorthand' | 'localStorage' | null;

export interface AdminContext {
  // Auth state
  authMode: AdminAuthMode;
  bypassToken: string | null;
  bypassSource: BypassSource;
  sessionUserId: string | null;
  sessionEmail: string | null;
  isAdmin: boolean;
  loading: boolean;
  
  // For API calls
  getAuthHeaders: () => Record<string, string>;
  getImportUrl: (baseUrl: string) => string;
  
  // Refresh tracking
  lastRefresh: Date | null;
  refreshCount: number;
  refreshing: boolean;
  triggerRefresh: () => void;
  
  // Debug
  debugInfo: {
    origin: string;
    hasSession: boolean;
    bypassAttempted: boolean;
    timestamp: string;
  };
  
  // Manual recheck
  recheck: () => Promise<void>;
}

const AdminContextValue = createContext<AdminContext | null>(null);

/**
 * Get bypass token from various sources (priority order)
 */
function getBypassTokenFromSources(): { token: string | null; source: BypassSource } {
  if (typeof window === 'undefined') {
    return { token: null, source: null };
  }
  
  const urlParams = new URLSearchParams(window.location.search);
  
  // Priority 1: Explicit bypass param
  const bypassParam = urlParams.get('bypass');
  if (bypassParam) {
    return { token: bypassParam, source: 'url_bypass' };
  }
  
  // Priority 2: admin=bypass shorthand
  if (urlParams.get('admin') === 'bypass') {
    return { token: 'admin123', source: 'url_admin_shorthand' };
  }
  
  // Priority 3: localStorage
  const storedToken = localStorage.getItem('admin_bypass_token');
  if (storedToken) {
    return { token: storedToken, source: 'localStorage' };
  }
  
  return { token: null, source: null };
}

/**
 * Check if current origin is dev/preview
 */
function isDevOrigin(): boolean {
  if (typeof window === 'undefined') return false;
  
  const origin = window.location.origin.toLowerCase();
  const devPatterns = [
    'lovable.dev',
    'lovable.app',
    'lovableproject.com',
    'localhost',
    '127.0.0.1',
    'preview--',
  ];
  
  return devPatterns.some(p => origin.includes(p));
}

export function AdminContextProvider({ children }: { children: ReactNode }) {
  const [authMode, setAuthMode] = useState<AdminAuthMode>('none');
  const [bypassToken, setBypassToken] = useState<string | null>(null);
  const [bypassSource, setBypassSource] = useState<BypassSource>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [debugInfo, setDebugInfo] = useState({
    origin: typeof window !== 'undefined' ? window.location.origin : '',
    hasSession: false,
    bypassAttempted: false,
    timestamp: new Date().toISOString(),
  });

  const checkAuth = useCallback(async () => {
    setLoading(true);
    
    const bypass = getBypassTokenFromSources();
    const isDev = isDevOrigin();
    
    setBypassToken(bypass.token);
    setBypassSource(bypass.source);
    
    // Check for bypass first
    if (bypass.token && isDev) {
      console.log('[AdminContext] Bypass active:', bypass.source);
      setAuthMode('bypass');
      setDebugInfo({
        origin: window.location.origin,
        hasSession: false,
        bypassAttempted: true,
        timestamp: new Date().toISOString(),
      });
      setLoading(false);
      return;
    }
    
    // Check session
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setSessionUserId(session.user.id);
        setSessionEmail(session.user.email || null);
        
        // Check if user has admin role
        const appMetadata = session.user.app_metadata || {};
        const isAdminFromMeta = appMetadata.role === 'admin' || appMetadata.is_admin === true;
        
        if (isAdminFromMeta) {
          setAuthMode('session');
          setDebugInfo({
            origin: window.location.origin,
            hasSession: true,
            bypassAttempted: !!bypass.token,
            timestamp: new Date().toISOString(),
          });
          setLoading(false);
          return;
        }
        
        // Check user_roles table
        const { data: hasRole } = await supabase.rpc('has_role', { 
          _user_id: session.user.id, 
          _role: 'admin' 
        });
        
        if (hasRole) {
          setAuthMode('session');
          setDebugInfo({
            origin: window.location.origin,
            hasSession: true,
            bypassAttempted: !!bypass.token,
            timestamp: new Date().toISOString(),
          });
          setLoading(false);
          return;
        }
        
        // Session exists but not admin - still allow with bypass in dev
        if (bypass.token && isDev) {
          setAuthMode('bypass');
        } else {
          setAuthMode('none');
        }
      } else {
        // No session - bypass only option
        if (bypass.token && isDev) {
          setAuthMode('bypass');
        } else {
          setAuthMode('none');
        }
      }
      
      setDebugInfo({
        origin: window.location.origin,
        hasSession: !!session,
        bypassAttempted: !!bypass.token,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      console.error('[AdminContext] Auth check failed:', e);
      // Fallback to bypass if available
      if (bypass.token && isDev) {
        setAuthMode('bypass');
      } else {
        setAuthMode('none');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAuth();
    });
    
    return () => subscription.unsubscribe();
  }, [checkAuth]);

  /**
   * Get headers for API calls (edge functions)
   */
  const getAuthHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    };
    
    if (authMode === 'bypass' && bypassToken) {
      headers['X-Dev-Bypass'] = bypassToken;
    }
    
    // Note: Authorization header added by caller if session exists
    return headers;
  }, [authMode, bypassToken]);

  /**
   * Get import URL with bypass param if needed
   */
  const getImportUrl = useCallback((baseUrl: string): string => {
    if (authMode === 'bypass' && bypassToken) {
      const separator = baseUrl.includes('?') ? '&' : '?';
      return `${baseUrl}${separator}bypass=${encodeURIComponent(bypassToken)}`;
    }
    return baseUrl;
  }, [authMode, bypassToken]);

  /**
   * Trigger a data refresh
   */
  const triggerRefresh = useCallback(() => {
    setRefreshCount(c => c + 1);
    setLastRefresh(new Date());
    setRefreshing(true);
    // Auto-reset refreshing after a short delay
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const isAdmin = authMode === 'bypass' || authMode === 'session';

  const contextValue: AdminContext = {
    authMode,
    bypassToken,
    bypassSource,
    sessionUserId,
    sessionEmail,
    isAdmin,
    loading,
    getAuthHeaders,
    getImportUrl,
    lastRefresh,
    refreshCount,
    refreshing,
    triggerRefresh,
    debugInfo,
    recheck: checkAuth,
  };

  return (
    <AdminContextValue.Provider value={contextValue}>
      {children}
    </AdminContextValue.Provider>
  );
}

export function useAdminContext(): AdminContext {
  const ctx = useContext(AdminContextValue);
  if (!ctx) {
    throw new Error('useAdminContext must be used within AdminContextProvider');
  }
  return ctx;
}

/**
 * Standalone hook for getting admin context (can be used outside provider)
 * Falls back to direct checks if no provider
 */
export function useAdminContextStandalone() {
  const [authMode, setAuthMode] = useState<AdminAuthMode>('none');
  const [bypassToken, setBypassToken] = useState<string | null>(null);
  const [bypassSource, setBypassSource] = useState<BypassSource>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bypass = getBypassTokenFromSources();
    const isDev = isDevOrigin();
    
    setBypassToken(bypass.token);
    setBypassSource(bypass.source);
    
    if (bypass.token && isDev) {
      setAuthMode('bypass');
      setLoading(false);
      return;
    }
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setAuthMode('session');
      } else {
        setAuthMode('none');
      }
      setLoading(false);
    });
  }, []);

  return {
    authMode,
    bypassToken,
    bypassSource,
    isAdmin: authMode !== 'none',
    loading,
  };
}
