/**
 * stdin reading utilities for CLI
 *
 * Provides secure, limited stdin reading with:
 * - Size limits (10MB max)
 * - Timeout protection (30s)
 * - Proper event listener cleanup
 */

// Maximum stdin input size (10MB)
export const MAX_STDIN_SIZE = 10 * 1024 * 1024;

// Timeout for stdin reading (30 seconds)
export const STDIN_TIMEOUT_MS = 30000;

/**
 * Read from stdin if data is piped
 * Returns null if stdin is not piped, is empty, or exceeds limits
 */
export async function readStdin(): Promise<string | null> {
  // Check if stdin is piped (not a TTY)
  if (process.stdin.isTTY) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalSize = 0;
    let timeoutId: NodeJS.Timeout | undefined;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      process.stdin.removeListener('data', dataHandler);
      process.stdin.removeListener('end', endHandler);
      process.stdin.removeListener('error', errorHandler);
    };

    const dataHandler = (chunk: Buffer) => {
      totalSize += chunk.length;

      // Enforce size limit
      if (totalSize > MAX_STDIN_SIZE) {
        cleanup();
        reject(new Error(`stdin input exceeds maximum size of ${MAX_STDIN_SIZE / 1024 / 1024}MB`));
        return;
      }

      chunks.push(chunk);
    };

    const endHandler = () => {
      cleanup();
      if (chunks.length === 0) {
        resolve(null);
      } else {
        const content = Buffer.concat(chunks).toString('utf8').trim();
        // Return null if stdin only contained whitespace
        resolve(content || null);
      }
    };

    const errorHandler = (err: Error) => {
      cleanup();
      reject(new Error(`stdin read error: ${err.message}`));
    };

    // Set timeout
    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(`stdin read timeout after ${STDIN_TIMEOUT_MS / 1000}s`));
    }, STDIN_TIMEOUT_MS);

    process.stdin.on('data', dataHandler);
    process.stdin.on('end', endHandler);
    process.stdin.on('error', errorHandler);

    // Resume stdin in case it's paused
    process.stdin.resume();
  });
}
