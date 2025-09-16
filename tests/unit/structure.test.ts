import { beforeAll, describe, expect, test } from 'vitest';
import { AgentLoader } from '@/agents/loader';
import { ToolRegistry } from '@/tools/registry/registry';
import { createListTool, createReadTool, createWriteTool } from '@/tools/file.tool';
import { createTaskTool } from '@/tools/task.tool';

describe('System Structure Tests', () => {
  let agentLoader: AgentLoader;
  let toolRegistry: ToolRegistry;

  beforeAll(async () => {
    // Direct component creation - no API needed
    agentLoader = new AgentLoader('./tests/unit/test-agents');
    toolRegistry = new ToolRegistry();

    // Register tools to test the registry
    toolRegistry.register(createReadTool());
    toolRegistry.register(createWriteTool());
    toolRegistry.register(createListTool());
    toolRegistry.register(await createTaskTool(agentLoader));
  });

  describe('Agent Loader', () => {
    test('should list available agents', async () => {
      const agents = await agentLoader.listAgents();
      expect(agents).toContain('orchestrator');
      expect(agents).toContain('code-analyzer');
      expect(agents.length).toBeGreaterThan(0);
    });

    test('should load orchestrator agent', async () => {
      const orchestrator = await agentLoader.loadAgent('orchestrator');
      expect(orchestrator.name).toBe('orchestrator');
      // Tools can be either "*" or ["*"] based on agent definition
      expect(
        orchestrator.tools === '*' ||
          (Array.isArray(orchestrator.tools) && orchestrator.tools[0] === '*')
      ).toBe(true);
      expect(orchestrator.description).toBeDefined();
      expect(orchestrator.description?.length).toBeGreaterThan(0);
    });

    test('should load code-analyzer agent', async () => {
      const analyzer = await agentLoader.loadAgent('code-analyzer');
      expect(analyzer.name).toBe('code-analyzer');
      expect(Array.isArray(analyzer.tools)).toBe(true);
      // Test agent has empty tools array for minimal tests
      expect(analyzer.tools).toEqual([]);
    });
  });

  describe('Tool Registry', () => {
    test('should register and list tools', () => {
      const tools = toolRegistry.getAllTools();
      const toolNames = tools.map((t) => t.name);

      expect(toolNames).toContain('Read');
      expect(toolNames).toContain('Write');
      expect(toolNames).toContain('List');
      expect(toolNames).toContain('Task');
      expect(tools.length).toBe(4);
    });

    test('should filter tools for orchestrator (has all tools)', async () => {
      const orchestrator = await agentLoader.loadAgent('orchestrator');
      const tools = toolRegistry.filterForAgent(orchestrator);

      // Orchestrator with tools: "*" should have access to all tools
      expect(tools.length).toBe(4);
      expect(tools.map((t) => t.name)).toContain('Task');
    });

    test('should filter tools for code-analyzer (limited tools)', async () => {
      const analyzer = await agentLoader.loadAgent('code-analyzer');
      const tools = toolRegistry.filterForAgent(analyzer);

      // Code-analyzer test agent has empty tools array
      expect(tools).toEqual([]);
      expect(tools.length).toBe(0);
    });
  });

  describe('Tool Execution', () => {
    test('List tool should execute successfully', async () => {
      const listTool = createListTool();
      const result = await listTool.execute({ path: './src' });

      expect(result.content).toBeDefined();
      expect(result.error).toBeUndefined();
      // Check that it returns an array of files
      expect(Array.isArray(result.content)).toBe(true);
      expect((result.content as string[]).length).toBeGreaterThan(0);
    });

    test('tools should be concurrency safe', () => {
      const readTool = createReadTool();
      const writeTool = createWriteTool();
      const listTool = createListTool();

      expect(readTool.isConcurrencySafe()).toBe(true);
      expect(writeTool.isConcurrencySafe()).toBe(false);
      expect(listTool.isConcurrencySafe()).toBe(true);
    });
  });

  describe('Agent Hierarchy', () => {
    test('orchestrator should have Task tool for delegation', async () => {
      const orchestrator = await agentLoader.loadAgent('orchestrator');
      const tools = toolRegistry.filterForAgent(orchestrator);
      const hasTaskTool = tools.some((t) => t.name === 'Task');

      expect(hasTaskTool).toBe(true);
    });

    test('child agents should not have Task tool', async () => {
      const analyzer = await agentLoader.loadAgent('code-analyzer');
      const tools = toolRegistry.filterForAgent(analyzer);
      const hasTaskTool = tools.some((t) => t.name === 'Task');

      expect(hasTaskTool).toBe(false);
    });

    test('all agents should have defined tools', async () => {
      const agents = await agentLoader.listAgents();

      for (const agentName of agents) {
        const agent = await agentLoader.loadAgent(agentName);
        expect(agent.tools).toBeDefined();
        expect(agent.tools === '*' || Array.isArray(agent.tools)).toBe(true);
      }
    });
  });
});
