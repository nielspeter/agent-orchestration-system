/**
 * CLI command handlers
 *
 * Handles:
 * - Agent execution
 * - Listing agents
 * - Listing tools
 * - Starting web server
 */

import { AgentSystemBuilder } from '@agent-system/core';
import { startServer } from '@agent-system/web/server';
import open from 'open';
import { formatOutput, type OutputFormat } from './output.js';
import { safeConsoleLog } from './error-handler.js';

/**
 * Command options (from commander)
 */
export interface CommandOptions {
  prompt?: string;
  agent?: string;
  model?: string;
  agentsDir?: string;
  output?: string;
  listAgents?: boolean;
  listTools?: boolean;
  json?: boolean;
  // Serve command options
  port?: number;
  host?: string;
  open?: boolean;
}

/**
 * Command context with cleanup handler
 */
export interface CommandContext {
  options: CommandOptions;
  cleanup?: () => Promise<void>;
}

/**
 * Configure builder with command-line options
 */
function configureBuilder(
  builder: ReturnType<typeof AgentSystemBuilder.default>,
  options: CommandOptions
): ReturnType<typeof AgentSystemBuilder.default> {
  if (options.model) {
    builder = builder.withModel(options.model);
  }

  if (options.agentsDir) {
    builder = builder.withAgentsFrom(options.agentsDir);
  }

  return builder;
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
 * Execute agent with given prompt
 */
export async function executeAgent(ctx: CommandContext, prompt: string): Promise<void> {
  const { options } = ctx;

  // Build system and execute
  const builder = configureBuilder(AgentSystemBuilder.default(), options);
  const buildResult = await builder.build();
  ctx.cleanup = buildResult.cleanup;
  const { executor } = buildResult;

  const startTime = Date.now();
  const result = await executor.execute(options.agent || 'default', prompt);
  const duration = Date.now() - startTime;

  // Validate and determine output format
  const requestedFormat = options.json ? 'json' : options.output || 'clean';
  const outputFormat = getOutputFormat(requestedFormat);

  const formatted = formatOutput(
    {
      result,
      agentName: options.agent || 'default',
      duration,
    },
    outputFormat
  );

  safeConsoleLog(formatted);

  if (ctx.cleanup) {
    await ctx.cleanup();
  }
}

/**
 * List available agents
 */
export async function listAgents(ctx: CommandContext): Promise<void> {
  const { options } = ctx;

  const builder = configureBuilder(AgentSystemBuilder.default(), options);
  const buildResult = await builder.build();
  ctx.cleanup = buildResult.cleanup;
  const { agentLoader } = buildResult;

  const agents = await agentLoader.listAgents();

  if (options.json) {
    safeConsoleLog(JSON.stringify({ agents }, null, 2));
  } else {
    safeConsoleLog('Available agents:');
    for (const agent of agents) {
      safeConsoleLog(`  - ${agent}`);
    }
  }

  if (ctx.cleanup) {
    await ctx.cleanup();
  }
}

/**
 * List available tools
 */
export async function listTools(ctx: CommandContext): Promise<void> {
  const { options } = ctx;

  const builder = configureBuilder(AgentSystemBuilder.default(), options);
  const buildResult = await builder.build();
  ctx.cleanup = buildResult.cleanup;
  const { toolRegistry } = buildResult;

  const tools = toolRegistry.getAllTools().map((t: { name: string }) => t.name);

  if (options.json) {
    safeConsoleLog(JSON.stringify({ tools }, null, 2));
  } else {
    safeConsoleLog('Available tools:');
    for (const tool of tools) {
      safeConsoleLog(`  - ${tool}`);
    }
  }

  if (ctx.cleanup) {
    await ctx.cleanup();
  }
}

/**
 * Start web UI server
 */
export async function serveWeb(ctx: CommandContext): Promise<void> {
  const { options } = ctx;
  const port = options.port || 3000;
  const host = options.host || 'localhost';
  const shouldOpen = options.open || false;
  const agentsDir = options.agentsDir;

  try {
    safeConsoleLog('Starting web server...\n');

    await startServer({ port, host, agentsDir });

    const url = `http://${host}:${port}`;
    safeConsoleLog(`✅ Server running at ${url}`);
    if (agentsDir) {
      safeConsoleLog(`📁 Using agents from: ${agentsDir}`);
    }
    safeConsoleLog('\n📝 Open your browser and use the form to start agents\n');

    if (shouldOpen) {
      await open(url);
      safeConsoleLog('📱 Opened browser automatically\n');
    }

    safeConsoleLog('Press Ctrl+C to stop\n');

    // Keep process alive
    await new Promise(() => {}); // Never resolves
  } catch (error) {
    throw new Error(
      `Failed to start server: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
