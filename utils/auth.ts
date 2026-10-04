/**
 * Check if a JWT token is expired
 * @param token The JWT token to check
 * @returns true if expired, false if valid or invalid format
 */
export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  
  try {
    // A JWT has 3 parts separated by dots. The payload is the middle part.
    const parts = token.split('.');
    if (parts.length !== 3) return false; // Not a JWT?
    
    // Decode base64 payload
    const payload = JSON.parse(atob(parts[1]));
    
    // Check expiration (exp is in seconds, Date.now() is in ms)
    if (payload.exp && (payload.exp * 1000) < Date.now()) {
      return true;
    }
    
    return false;
  } catch (e) {
    // If we can't parse it, assume it's invalid/expired to be safe
    console.error('Failed to parse token for expiration check:', e);
    return true;
  }
}

/**
 * Handle auth failure by clearing token and redirecting to login
 * Used primarily by SSE connections that bypass Axios interceptors
 */
export function handleAuthFailure(): void {
  console.warn('⚠️ Session expired or invalid - redirecting to login');
  if (typeof window !== 'undefined') {
    localStorage.removeItem('firebase_token');
    window.location.href = '/login';
  }
}
