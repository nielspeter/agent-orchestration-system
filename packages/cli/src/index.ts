#!/usr/bin/env node
import * as dotenv from 'dotenv';
import { Command } from 'commander';
import { SignalHandler } from './signal-handler.js';
import { readStdin } from './stdin.js';
import { type CommandContext, executeAgent, listAgents, listTools, serveWeb } from './commands.js';
import { formatAndDisplayError, safeConsoleError } from './error-handler.js';

// Load environment variables
dotenv.config();

// Configure command-line interface
const program = new Command();

program
  .name('agent')
  .description('CLI tool for running agents (accepts input via -p flag or stdin)')
  .version('1.0.0');

// Run command (default)
program
  .command('run', { isDefault: true })
  .description('Execute an agent task')
  .option('-p, --prompt <text>', 'The prompt to send to the agent (or pipe via stdin)')
  .option('-a, --agent <name>', 'Agent to use', 'default')
  .option('-m, --model <model>', 'Model to use')
  .option('--agents-dir <path>', 'Path to agents directory')
  .option('-o, --output <format>', 'Output format: clean, verbose, json', 'clean')
  .option('--list-agents', 'List available agents')
  .option('--list-tools', 'List available tools')
  .option('--json', 'Output as JSON (shorthand for --output json)')
  .action(async (options) => {
    await runCommand(options);
  });

// Serve command
program
  .command('serve')
  .description('Start web UI server')
  .option('-p, --port <port>', 'Port number', '3000')
  .option('--host <host>', 'Hostname', 'localhost')
  .option('-o, --open', 'Open browser automatically', false)
  .action(async (options) => {
    const ctx: CommandContext = { options };
    const signalHandler = new SignalHandler();
    signalHandler.setup();

    try {
      await serveWeb(ctx);
    } catch (error) {
      formatAndDisplayError(error, options);
      process.exit(1);
    }
  });

/**
 * Run command handler
 */
async function runCommand(options: any): Promise<void> {
  // Setup context and signal handling
  const ctx: CommandContext = { options };
  const signalHandler = new SignalHandler();
  signalHandler.setup();

  try {
    // Route to appropriate command
    if (options.listAgents) {
      await listAgents(ctx);
      if (ctx.cleanup) signalHandler.setCleanup(ctx.cleanup);
      return;
    }

    if (options.listTools) {
      await listTools(ctx);
      if (ctx.cleanup) signalHandler.setCleanup(ctx.cleanup);
      return;
    }

    // Execute agent - get prompt from -p flag or stdin
    let prompt = options.prompt;

    if (!prompt) {
      prompt = await readStdin();
    }

    if (!prompt) {
      safeConsoleError('Error: --prompt is required (use -p flag or pipe via stdin)');
      process.exit(1);
    }

    await executeAgent(ctx, prompt);
    if (ctx.cleanup) signalHandler.setCleanup(ctx.cleanup);
  } catch (error) {
    // Ensure cleanup is called even on error
    if (ctx.cleanup) {
      try {
        await ctx.cleanup();
      } catch (cleanupError) {
        safeConsoleError(`Cleanup error: ${cleanupError}`);
      }
    }

    formatAndDisplayError(error, options);
    process.exit(1);
  }
}
