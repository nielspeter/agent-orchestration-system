/**
 * Signal handling for graceful shutdown
 *
 * Handles SIGINT (Ctrl+C) and SIGTERM to ensure cleanup
 * is called before process termination.
 */

export class SignalHandler {
  private cleanup?: () => Promise<void>;
  private isExiting = false;

  /**
   * Set the cleanup function to call on shutdown
   */
  setCleanup(cleanup: () => Promise<void>): void {
    this.cleanup = cleanup;
  }

  /**
   * Setup signal handlers for SIGINT and SIGTERM
   */
  setup(): void {
    process.on('SIGINT', () => this.handleSignal('SIGINT'));
    process.on('SIGTERM', () => this.handleSignal('SIGTERM'));
  }

  /**
   * Handle termination signal
   */
  private async handleSignal(signal: string): Promise<void> {
    if (this.isExiting) {
      // Force exit on second signal
      process.exit(1);
    }

    this.isExiting = true;
    console.error(`\nReceived ${signal}, cleaning up...`);

    if (this.cleanup) {
      try {
        await this.cleanup();
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }

    // Exit with appropriate code
    // 130 for SIGINT (128 + 2), 143 for SIGTERM (128 + 15)
    process.exit(128 + (signal === 'SIGINT' ? 2 : 15));
  }
}
