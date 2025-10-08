#!/usr/bin/env node
import * as dotenv from 'dotenv';
import { Command } from 'commander';
import { AgentSystemBuilder } from '@agent-system/core';
import { formatOutput, formatError, formatSuccess, type OutputFormat } from './output.js';

// Load environment variables (like examples do)
dotenv.config();

const program = new Command();

program
  .name('agent')
  .description('CLI tool for running agents')
  .version('1.0.0');

program
  .option('-p, --prompt <text>', 'The prompt to send to the agent')
  .option('-a, --agent <name>', 'Agent to use', 'default')
  .option('-m, --model <model>', 'Model to use')
  .option('--agents-dir <path>', 'Path to agents directory')
  .option('-o, --output <format>', 'Output format: clean, verbose, json', 'clean')
  .option('--list-agents', 'List available agents')
  .option('--list-tools', 'List available tools')
  .option('--json', 'Output as JSON (shorthand for --output json)');

program.parse();

const options = program.opts();

async function main() {
  try {
    // Build system using core's defaults - leverages built-in agent discovery
    let builder = AgentSystemBuilder.default();

    // Apply optional overrides
    if (options.model) {
      builder = builder.withModel(options.model);
    }

    // If agents directory specified, use it; otherwise uses default agent
    if (options.agentsDir) {
      builder = builder.withAgentsFrom(options.agentsDir);
    }

    const { executor, toolRegistry, agentLoader, cleanup } = await builder.build();

    // Handle --list-agents
    if (options.listAgents) {
      const agents = await agentLoader.listAgents();
      if (options.json) {
        console.log(JSON.stringify({ agents }, null, 2));
      } else {
        console.log('Available agents:');
        agents.forEach((agent: string) => console.log(`  - ${agent}`));
      }
      await cleanup();
      return;
    }

    // Handle --list-tools
    if (options.listTools) {
      const tools = toolRegistry.getAllTools().map((t: { name: string }) => t.name);
      if (options.json) {
        console.log(JSON.stringify({ tools }, null, 2));
      } else {
        console.log('Available tools:');
        tools.forEach((tool: string) => console.log(`  - ${tool}`));
      }
      await cleanup();
      return;
    }

    // Execute agent
    if (!options.prompt) {
      console.error('Error: --prompt is required');
      process.exit(1);
    }

    const startTime = Date.now();
    const result = await executor.execute(options.agent, options.prompt);
    const duration = Date.now() - startTime;

    // Determine output format (--json flag overrides --output)
    const outputFormat: OutputFormat = options.json ? 'json' : (options.output as OutputFormat);

    // Format and display output
    const formatted = formatOutput(
      {
        result,
        agentName: options.agent,
        duration,
      },
      outputFormat
    );
    console.log(formatted);

    // Cleanup (like examples do)
    await cleanup();
  } catch (error) {
    const outputFormat: OutputFormat = options.json ? 'json' : (options.output as OutputFormat);
    console.error(formatError(error as Error, outputFormat));
    process.exit(1);
  }
}

main().catch(console.error);
