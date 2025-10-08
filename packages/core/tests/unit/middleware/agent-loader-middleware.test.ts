import { beforeEach, describe, expect, it } from 'vitest';
import { createAgentLoaderMiddleware } from '@/middleware/agent-loader.middleware';
import { AgentLoader } from '@/agents/loader';
import { ToolRegistry } from '@/tools/registry/registry';
import { MiddlewareContext } from '@/middleware/middleware-types';
import { ConsoleLogger } from '@/logging/console.logger';
import type { Agent } from '@/config/types';

describe('AgentLoaderMiddleware - Tool Filtering', () => {
  let agentLoader: AgentLoader;
  let toolRegistry: ToolRegistry;
  let middleware: any;
  let context: MiddlewareContext;

  beforeEach(() => {
    const logger = new ConsoleLogger({ verbosity: 'minimal' });

    // Create agents with different tool restrictions
    const agents: Agent[] = [
      {
        name: 'reader',
        prompt: 'You can only read',
        tools: ['read', 'list'],
      },
      {
        name: 'writer',
        prompt: 'You can only write',
        tools: ['write'],
      },
      {
        name: 'unlimited',
        prompt: 'You have all tools',
        tools: '*', // '*' means all tools
      },
    ];

    agentLoader = new AgentLoader('.', logger, agents);
    toolRegistry = new ToolRegistry();

    // Register some tools
    toolRegistry.register({
      name: 'read',
      description: 'Read files',
      parameters: { type: 'object', properties: {}, required: [] },
      execute: async () => ({ content: 'file content' }),
      isConcurrencySafe: () => true,
    });

    toolRegistry.register({
      name: 'write',
      description: 'Write files',
      parameters: { type: 'object', properties: {}, required: [] },
      execute: async () => ({ content: 'file written' }),
      isConcurrencySafe: () => false,
    });

    toolRegistry.register({
      name: 'list',
      description: 'List files',
      parameters: { type: 'object', properties: {}, required: [] },
      execute: async () => ({ content: ['file1', 'file2'] }),
      isConcurrencySafe: () => true,
    });

    middleware = createAgentLoaderMiddleware(agentLoader, toolRegistry);

    // Base context
    context = {
      agentName: 'reader',
      prompt: 'test prompt',
      executionContext: {
        depth: 0,
        startTime: Date.now(),
        maxDepth: 5,
        isSidechain: false,
        traceId: 'test-trace',
      },
      messages: [],
      iteration: 1,
      logger,
      modelName: 'test-model',
      shouldContinue: true,
    };
  });

  it('should filter tools based on agent.tools array', async () => {
    let nextCalled = false;

    await middleware(context, async () => {
      nextCalled = true;
      // Verify context has been updated with agent and filtered tools
      expect(context.agent).toBeDefined();
      expect(context.agent?.name).toBe('reader');
      expect(context.tools).toBeDefined();
      expect(context.tools?.length).toBe(2);

      const toolNames = context.tools?.map((t) => t.name);
      expect(toolNames).toContain('read');
      expect(toolNames).toContain('list');
      expect(toolNames).not.toContain('write');
    });

    expect(nextCalled).toBe(true);
  });

  it('should give all tools when agent.tools is "*"', async () => {
    context.agentName = 'unlimited';

    await middleware(context, async () => {
      expect(context.tools?.length).toBe(3);
      const toolNames = context.tools?.map((t) => t.name);
      expect(toolNames).toContain('read');
      expect(toolNames).toContain('write');
      expect(toolNames).toContain('list');
    });
  });

  it('should give only specified tool for restricted agent', async () => {
    context.agentName = 'writer';

    await middleware(context, async () => {
      expect(context.tools?.length).toBe(1);
      expect(context.tools?.[0].name).toBe('write');
    });
  });

  it('should handle non-existent agent gracefully', async () => {
    context.agentName = 'non-existent';

    await middleware(context, async () => {
      // Should use default agent or handle gracefully
      expect(context.agent).toBeDefined();
      // Should still have tools available
      expect(context.tools).toBeDefined();
    });
  });

  it('should not give tools that dont exist in registry', async () => {
    const agentWithInvalidTools: Agent = {
      name: 'invalid',
      prompt: 'Has non-existent tools',
      tools: ['read', 'NonExistentTool', 'list'],
    };

    const loader = new AgentLoader('.', new ConsoleLogger({ verbosity: 'minimal' }), [
      agentWithInvalidTools,
    ]);

    const mw = createAgentLoaderMiddleware(loader, toolRegistry);
    context.agentName = 'invalid';

    await mw(context, async () => {
      // Should only have the valid tools
      expect(context.tools?.length).toBe(2);
      const toolNames = context.tools?.map((t) => t.name);
      expect(toolNames).toContain('read');
      expect(toolNames).toContain('list');
      expect(toolNames).not.toContain('NonExistentTool');
    });
  });
});
