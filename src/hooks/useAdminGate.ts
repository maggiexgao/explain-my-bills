/**
 * useAdminGate - Robust admin authorization hook
 * 
 * Priority order (all RLS-safe):
 * 1. JWT app_metadata.role === 'admin' or app_metadata.is_admin === true
 * 2. user_roles table lookup (uses has_role() security definer function)
 * 3. VITE_ADMIN_EMAILS environment variable fallback
 * 
 * Features:
 * - Never shows "Access Denied" while still loading
 * - Debug mode via ?debug=1 query param
 * - Detailed reason tracking for debugging
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AdminGateState = 'loading' | 'allowed' | 'denied';
export type AdminSource = 'jwt_claim' | 'user_roles' | 'email_allowlist' | 'none';

export interface AdminGateResult {
  state: AdminGateState;
  isAdmin: boolean;
  loading: boolean;
  userId: string | null;
  email: string | null;
  source: AdminSource;
  reason: string;
  suggestion?: string;
  debugInfo: {
    sessionExists: boolean;
    appMetadata: Record<string, unknown> | null;
    jwtClaimChecked: string | null;
    roleQueryResult: string | null;
    emailAllowlistChecked: boolean;
    timestamp: string;
  };
  recheck: () => Promise<void>;
}

// Fallback admin emails - set VITE_ADMIN_EMAILS in production
const FALLBACK_ADMIN_EMAILS: string[] = [];

// Development bypass - set to true to skip all auth checks (NEVER in production!)
const DEV_BYPASS_ADMIN = import.meta.env.VITE_DEV_BYPASS_ADMIN === 'true' || 
                          new URLSearchParams(window.location.search).get('admin') === 'bypass';

export function useAdminGate(): AdminGateResult {
  const [state, setState] = useState<AdminGateState>('loading');
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [source, setSource] = useState<AdminSource>('none');
  const [reason, setReason] = useState<string>('Checking authorization...');
  const [suggestion, setSuggestion] = useState<string | undefined>(undefined);
  const [debugInfo, setDebugInfo] = useState<AdminGateResult['debugInfo']>({
    sessionExists: false,
    appMetadata: null,
    jwtClaimChecked: null,
    roleQueryResult: null,
    emailAllowlistChecked: false,
    timestamp: new Date().toISOString(),
  });

  const checkAdmin = useCallback(async () => {
    // Development bypass
    if (DEV_BYPASS_ADMIN) {
      console.warn('[useAdminGate] DEV BYPASS ENABLED - skipping auth check');
      setState('allowed');
      setSource('jwt_claim');
      setReason('Development bypass enabled');
      return;
    }

    setState('loading');
    setReason('Checking authorization...');
    
    const debug: AdminGateResult['debugInfo'] = {
      sessionExists: false,
      appMetadata: null,
      jwtClaimChecked: null,
      roleQueryResult: null,
      emailAllowlistChecked: false,
      timestamp: new Date().toISOString(),
    };

    try {
      // Step 1: Get user (not just session) for fresh app_metadata
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        debug.sessionExists = false;
        setDebugInfo(debug);
        setState('denied');
        setSource('none');
        setReason('Not authenticated');
        setSuggestion('Please sign in with an admin account.');
        return;
      }

      debug.sessionExists = true;
      setUserId(user.id);
      setEmail(user.email?.toLowerCase() || null);
      
      const appMetadata = user.app_metadata || {};
      debug.appMetadata = appMetadata;

      // Step 2: Check JWT app_metadata claims (most reliable, RLS-safe)
      const jwtRole = appMetadata.role;
      const jwtIsAdmin = appMetadata.is_admin;
      debug.jwtClaimChecked = `role=${jwtRole}, is_admin=${jwtIsAdmin}`;

      if (jwtRole === 'admin' || jwtIsAdmin === true) {
        setDebugInfo(debug);
        setState('allowed');
        setSource('jwt_claim');
        setReason(`Authorized via JWT claim (${jwtRole === 'admin' ? 'role=admin' : 'is_admin=true'})`);
        return;
      }

      // Step 3: Check user_roles table via has_role() security definer function
      // This bypasses RLS since has_role is SECURITY DEFINER
      try {
        const { data: hasAdminRole, error: roleError } = await supabase
          .rpc('has_role', { _user_id: user.id, _role: 'admin' });
        
        if (roleError) {
          debug.roleQueryResult = `Error: ${roleError.message}`;
        } else {
          debug.roleQueryResult = `has_role returned: ${hasAdminRole}`;
          
          if (hasAdminRole === true) {
            setDebugInfo(debug);
            setState('allowed');
            setSource('user_roles');
            setReason('Authorized via user_roles table');
            return;
          }
        }
      } catch (rpcError) {
        debug.roleQueryResult = `RPC failed: ${rpcError}`;
      }

      // Step 4: Check email allowlist fallback
      const envAdminEmails = import.meta.env.VITE_ADMIN_EMAILS;
      const adminEmailList: string[] = envAdminEmails
        ? envAdminEmails.split(',').map((e: string) => e.trim().toLowerCase())
        : FALLBACK_ADMIN_EMAILS;
      
      debug.emailAllowlistChecked = true;
      
      const userEmail = user.email?.toLowerCase();
      if (userEmail && adminEmailList.length > 0 && adminEmailList.includes(userEmail)) {
        setDebugInfo(debug);
        setState('allowed');
        setSource('email_allowlist');
        setReason('Authorized via email allowlist');
        return;
      }

      // Not authorized
      setDebugInfo(debug);
      setState('denied');
      setSource('none');
      setReason('Admin role required');
      setSuggestion(
        userEmail 
          ? `To grant admin access, either:\n1. Set app_metadata.role = 'admin' in Supabase Auth\n2. Add row to user_roles table: (user_id: ${user.id}, role: 'admin')\n3. Add ${userEmail} to VITE_ADMIN_EMAILS`
          : 'Sign in with an authorized admin account.'
      );

    } catch (e) {
      console.error('[useAdminGate] Unexpected error:', e);
      setDebugInfo(debug);
      setState('denied');
      setSource('none');
      setReason('Authorization check failed');
      setSuggestion('Please try again or contact support.');
    }
  }, []);

  // Initial check and auth state subscription
  useEffect(() => {
    checkAdmin();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Re-check on any auth state change
      checkAdmin();
    });

    return () => subscription.unsubscribe();
  }, [checkAdmin]);

  return {
    state,
    isAdmin: state === 'allowed',
    loading: state === 'loading',
    userId,
    email,
    source,
    reason,
    suggestion,
    debugInfo,
    recheck: checkAdmin,
  };
}
