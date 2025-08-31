/**
 * AuthProvider - Manages authentication for the agent system
 * 
 * Supports two authentication methods:
 * 1. API Key from environment variable (primary)
 * 2. Bearer token (for future OAuth support)
 */
export class AuthProvider {
  private apiKey?: string;
  private bearerToken?: string;

  constructor() {
    // Load API key from environment
    this.apiKey = process.env.ANTHROPIC_API_KEY;
  }

  /**
   * Gets the current authentication headers
   */
  getAuthHeaders(): Record<string, string> {
    if (this.bearerToken) {
      return {
        'Authorization': `Bearer ${this.bearerToken}`
      };
    }

    if (this.apiKey) {
      return {
        'x-api-key': this.apiKey
      };
    }

    throw new Error('No authentication configured. Please set ANTHROPIC_API_KEY environment variable.');
  }

  /**
   * Sets a bearer token for OAuth authentication
   */
  setBearerToken(token: string): void {
    this.bearerToken = token;
    // Clear API key when using bearer token
    this.apiKey = undefined;
  }

  /**
   * Sets an API key for authentication
   */
  setApiKey(key: string): void {
    this.apiKey = key;
    // Clear bearer token when using API key
    this.bearerToken = undefined;
  }

  /**
   * Checks if authentication is configured
   */
  isAuthenticated(): boolean {
    return !!(this.apiKey || this.bearerToken);
  }

  /**
   * Gets redacted authentication info for logging
   */
  getRedactedAuthInfo(): string {
    if (this.bearerToken) {
      return 'Bearer [REDACTED]';
    }
    
    if (this.apiKey) {
      const visibleChars = 4;
      const prefix = this.apiKey.substring(0, visibleChars);
      return `API Key ${prefix}...[REDACTED]`;
    }

    return 'No authentication';
  }

  /**
   * Clears all authentication
   */
  clearAuth(): void {
    this.apiKey = undefined;
    this.bearerToken = undefined;
  }
}