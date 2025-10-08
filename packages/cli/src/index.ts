#!/usr/bin/env node
import * as dotenv from 'dotenv';
import { Command } from 'commander';
import { AgentSystemBuilder } from '@agent-system/core';
import { formatOutput, formatError, type OutputFormat } from './output.js';

// Load environment variables (like examples do)
dotenv.config();

// Maximum stdin input size (10MB)
const MAX_STDIN_SIZE = 10 * 1024 * 1024;

// Timeout for stdin reading (30 seconds)
const STDIN_TIMEOUT_MS = 30000;

/**
 * Read from stdin if data is piped
 * Returns null if stdin is not piped, is empty, or exceeds limits
 */
async function readStdin(): Promise<string | null> {
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

const program = new Command();

program
  .name('agent')
  .description('CLI tool for running agents (accepts input via -p flag or stdin)')
  .version('1.0.0');

program
  .option('-p, --prompt <text>', 'The prompt to send to the agent (or pipe via stdin)')
  .option('-a, --agent <name>', 'Agent to use', 'default')
  .option('-m, --model <model>', 'Model to use')
  .option('--agents-dir <path>', 'Path to agents directory')
  .option('-o, --output <format>', 'Output format: clean, verbose, json', 'clean')
  .option('--list-agents', 'List available agents')
  .option('--list-tools', 'List available tools')
  .option('--json', 'Output as JSON (shorthand for --output json)');

program.parse();

const options = program.opts();

/**
 * Configure builder with command-line options
 */
function configureBuilder(builder: ReturnType<typeof AgentSystemBuilder.default>) {
  if (options.model) {
    builder = builder.withModel(options.model);
  }

  if (options.agentsDir) {
    builder = builder.withAgentsFrom(options.agentsDir);
  }

  return builder;
}

/**
 * Safe console output that handles EPIPE errors
 */
function safeConsoleLog(data: string): void {
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
function safeConsoleError(data: string): void {
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

async function main() {
  let cleanup: (() => Promise<void>) | undefined;
  let isExiting = false;

  // Handle termination signals gracefully
  const handleSignal = async (signal: string) => {
    if (isExiting) {
      // Force exit on second signal
      process.exit(1);
    }

    isExiting = true;
    console.error(`\nReceived ${signal}, cleaning up...`);

    if (cleanup) {
      try {
        await cleanup();
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }

    process.exit(128 + (signal === 'SIGINT' ? 2 : 15));
  };

  process.on('SIGINT', () => handleSignal('SIGINT'));
  process.on('SIGTERM', () => handleSignal('SIGTERM'));

  try {
    // For execution (not listing), check prompt availability BEFORE building system
    // This provides fast failure when user forgets the prompt
    const needsExecution = !options.listAgents && !options.listTools;

    if (needsExecution) {
      // Get prompt from -p flag or stdin
      let prompt = options.prompt;

      if (!prompt) {
        // Try reading from stdin if no -p flag provided
        prompt = await readStdin();
      }

      if (!prompt) {
        safeConsoleError('Error: --prompt is required (use -p flag or pipe via stdin)');
        process.exit(1);
      }

      // Now build system and execute
      let builder = configureBuilder(AgentSystemBuilder.default());

      const buildResult = await builder.build();
      cleanup = buildResult.cleanup;
      const { executor } = buildResult;

      const startTime = Date.now();
      const result = await executor.execute(options.agent, prompt);
      const duration = Date.now() - startTime;

      // Validate and determine output format
      const requestedFormat = options.json ? 'json' : options.output;
      const outputFormat: OutputFormat =
        requestedFormat === 'clean' || requestedFormat === 'verbose' || requestedFormat === 'json'
          ? requestedFormat
          : 'clean';

      const formatted = formatOutput(
        {
          result,
          agentName: options.agent,
          duration,
        },
        outputFormat
      );
      safeConsoleLog(formatted);

      await cleanup();
      return;
    }

    // Handle --list-agents or --list-tools
    let builder = configureBuilder(AgentSystemBuilder.default());

    const buildResult = await builder.build();
    cleanup = buildResult.cleanup;
    const { toolRegistry, agentLoader } = buildResult;

    if (options.listAgents) {
      const agents = await agentLoader.listAgents();
      if (options.json) {
        safeConsoleLog(JSON.stringify({ agents }, null, 2));
      } else {
        safeConsoleLog('Available agents:');
        for (const agent of agents) {
          safeConsoleLog(`  - ${agent}`);
        }
      }
      await cleanup();
      return;
    }

    if (options.listTools) {
      const tools = toolRegistry.getAllTools().map((t: { name: string }) => t.name);
      if (options.json) {
        safeConsoleLog(JSON.stringify({ tools }, null, 2));
      } else {
        safeConsoleLog('Available tools:');
        for (const tool of tools) {
          safeConsoleLog(`  - ${tool}`);
        }
      }
      await cleanup();
      return;
    }
  } catch (error) {
    // Ensure cleanup is called even on error
    if (cleanup) {
      try {
        await cleanup();
      } catch (cleanupError) {
        // Log cleanup error but don't mask original error
        safeConsoleError(`Cleanup error: ${cleanupError}`);
      }
    }

    // Safely format and display error
    try {
      const requestedFormat = options.json ? 'json' : options.output;
      const outputFormat: OutputFormat =
        requestedFormat === 'clean' || requestedFormat === 'verbose' || requestedFormat === 'json'
          ? requestedFormat
          : 'clean';

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

    process.exit(1);
  }
}

main().catch((error) => {
  // Catch any errors that escape main's try-catch
  console.error('Fatal error:', error);
  process.exit(1);
});
