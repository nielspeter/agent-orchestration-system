/**
 * Error handling and safe console output
 *
 * Provides:
 * - EPIPE-safe console output
 * - Triple-fallback error formatting
 * - Safe error display for all output formats
 */

import { formatError, type OutputFormat } from './output.js';

/**
 * Safe console output that handles EPIPE errors
 */
export function safeConsoleLog(data: string): void {
  try {
    console.log(data);
  } catch (error: unknown) {
    // Ignore EPIPE errors (broken pipe)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'EPIPE') {
      process.exit(0);
    }
    throw error;
  }
}

/**
 * Safe console error that handles EPIPE errors
 */
export function safeConsoleError(data: string): void {
  try {
    console.error(data);
  } catch (error: unknown) {
    // Ignore EPIPE errors (broken pipe)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'EPIPE') {
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Validate and normalize output format
 */
function getOutputFormat(requestedFormat: string): OutputFormat {
  if (requestedFormat === 'clean' || requestedFormat === 'verbose' || requestedFormat === 'json') {
    return requestedFormat;
  }
  return 'clean'; // Fallback to safe default
}

/**
 * Format and display error with triple-fallback safety
 */
export function formatAndDisplayError(
  error: unknown,
  options: { json?: boolean; output?: string }
): void {
  // Safely format and display error
  try {
    const requestedFormat = options.json ? 'json' : options.output || 'clean';
    const outputFormat = getOutputFormat(requestedFormat);

    const errorMessage =
      error && typeof error === 'object' && 'message' in error
        ? (error as Error)
        : new Error(String(error));

    safeConsoleError(formatError(errorMessage, outputFormat));
  } catch {
    // Last resort: plain error message (formatError threw)
    const msg =
      error && typeof error === 'object' && 'message' in error
        ? (error as { message: string }).message
        : String(error);
    safeConsoleError(`Error: ${msg}`);
  }
}
