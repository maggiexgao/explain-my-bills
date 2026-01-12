/**
 * Centralized Admin Check
 * 
 * Single source of truth for admin authorization.
 * Prioritizes:
 * 1. user_roles table (database role)
 * 2. ADMIN_EMAILS environment variable fallback
 * 3. Graceful degradation if RLS blocks role check
 */

import { supabase } from '@/integrations/supabase/client';

// Fallback admin emails - these users are always admins
// In production, set VITE_ADMIN_EMAILS env var or manage via user_roles table
const FALLBACK_ADMIN_EMAILS = [
  // Add your email here for initial setup
];

/**
 * Check if the current user is an admin
 * 
 * Flow:
 * 1. Get current session
 * 2. Try user_roles table lookup
 * 3. If RLS error or table missing, check email allowlist
 * 4. Return authorized status
 */
export async function isAdmin(): Promise<{
  authorized: boolean;
  userId?: string;
  email?: string;
  method?: 'user_roles' | 'email_allowlist' | 'none';
  error?: string;
}> {
  try {
    // Step 1: Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.user) {
      return { authorized: false, method: 'none', error: 'Not authenticated' };
    }
    
    const userId = session.user.id;
    const email = session.user.email?.toLowerCase();
    
    // Step 2: Check user_roles table
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
    
    if (!roleError && roleData) {
      // Found admin role in database
      return { authorized: true, userId, email, method: 'user_roles' };
    }
    
    // Step 3: Check email allowlist
    // Get from env var or use fallback
    const envAdminEmails = import.meta.env.VITE_ADMIN_EMAILS;
    const adminEmailList: string[] = envAdminEmails
      ? envAdminEmails.split(',').map((e: string) => e.trim().toLowerCase())
      : FALLBACK_ADMIN_EMAILS;
    
    if (email && adminEmailList.includes(email)) {
      console.info('[isAdmin] Authorized via email allowlist:', email);
      return { authorized: true, userId, email, method: 'email_allowlist' };
    }
    
    // Step 4: If role check failed due to RLS but user is authenticated
    // Log the error for debugging but DON'T block if role table might be empty
    if (roleError) {
      console.warn('[isAdmin] Role lookup error (may be RLS or empty table):', roleError.message);
      
      // Graceful degradation: allow authenticated users if role table is inaccessible
      // This prevents lockout during initial setup
      if (roleError.code === 'PGRST301' || roleError.message.includes('permission')) {
        console.warn('[isAdmin] RLS blocked role check - check user_roles policies');
        // For now, deny access when RLS blocks - admin should fix policies
        return { 
          authorized: false, 
          userId, 
          email, 
          method: 'none', 
          error: 'Role check blocked by permissions' 
        };
      }
    }
    
    // No admin role found
    return { 
      authorized: false, 
      userId, 
      email, 
      method: 'none',
      error: 'No admin role found' 
    };
    
  } catch (e) {
    console.error('[isAdmin] Unexpected error:', e);
    return { authorized: false, method: 'none', error: 'Check failed' };
  }
}

/**
 * Get auth token for edge function calls
 */
export async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

/**
 * Check admin status with automatic retry and detailed feedback
 */
export async function checkAdminWithFeedback(): Promise<{
  isAuthorized: boolean;
  reason: string;
  suggestion?: string;
}> {
  const result = await isAdmin();
  
  if (result.authorized) {
    return {
      isAuthorized: true,
      reason: `Authorized via ${result.method}`
    };
  }
  
  if (!result.userId) {
    return {
      isAuthorized: false,
      reason: 'You must be signed in to access this page.',
      suggestion: 'Please sign in with an admin account.'
    };
  }
  
  if (result.error?.includes('permission')) {
    return {
      isAuthorized: false,
      reason: 'Database permissions need configuration.',
      suggestion: 'Contact the app owner to add you to the admin role.'
    };
  }
  
  return {
    isAuthorized: false,
    reason: result.error || 'Admin role required.',
    suggestion: result.email 
      ? `Add "${result.email}" to user_roles table with admin role.`
      : 'Sign in with an authorized admin account.'
  };
}
