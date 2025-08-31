/**
 * Agent System Builder - Unified configuration builder
 *
 * Provides a fluent API for configuring the agent orchestration system.
 * Supports both programmatic configuration and loading from files.
 * Designed to be testable, composable, and flexible.
 */

import * as fs from 'fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { AgentLoader } from '@/core/agent-loader';
import { ToolRegistry } from '@/core/tool-registry';
import { AgentExecutor } from '@/core/agent-executor';
import { TodoManager } from '@/core/todo-manager';
import { LoggerFactory } from '@/core/conversation-logger';
import { createListTool, createReadTool, createWriteTool } from '@/tools/file-tools';
import { createTaskTool } from '@/tools/task-tool';
import { createTodoWriteTool } from '@/tools/todowrite-tool';
import { BaseTool, ToolParameter, ToolResult, ToolSchema } from '@/types';
import {
  Agent,
  CachingConfig,
  DEFAULT_SYSTEM_CONFIG,
  LoggingConfig,
  MCPConfig,
  mergeConfigs,
  resolveConfig,
  ResolvedSystemConfig,
  SafetyConfig,
  SessionConfig,
  SystemConfig,
  TEST_CONFIG_MINIMAL,
  TodoConfig,
} from './types';

/**
 * MCP Client wrapper for managing connections
 */
interface MCPClientWrapper {
  client: Client;
  transport: StdioClientTransport;
  serverName: string;
}

/**
 * Configuration object from file format
 */
interface FileConfig {
  model?: string;
  execution?: {
    defaultModel?: string;
    maxIterations?: number;
    maxDepth?: number;
    warnAtIteration?: number;
    maxTokensEstimate?: number;
    timeout?: number;
  };
  agents?: {
    directory?: string;
    directories?: string[];
    additionalDirectories?: string[];
  };
  builtinTools?: {
    tools?: string[];
  };
  tools?: {
    builtin?: string[];
  };
  mcpServers?: Record<string, MCPConfig['servers'][string]>;
}

/**
 * Build result containing both config and executor
 */
export interface BuildResult {
  config: ResolvedSystemConfig;
  executor: AgentExecutor;
  toolRegistry: ToolRegistry;
  mcpClients: MCPClientWrapper[];
  cleanup: () => Promise<void>;
}

/**
 * Main builder class for agent system configuration
 */
export class AgentSystemBuilder {
  protected config: Partial<SystemConfig>;
  protected customTools: BaseTool[] = [];
  protected mcpClients: MCPClientWrapper[] = [];

  constructor(initialConfig: Partial<SystemConfig> = {}) {
    this.config = { ...initialConfig };
  }

  /**
   * Set the model to use
   */
  withModel(model: string): AgentSystemBuilder {
    return this.with({ model });
  }

  /**
   * Set agent directories
   */
  withAgentsFrom(...directories: string[]): AgentSystemBuilder {
    return this.with({
      agents: { directories },
    });
  }

  /**
   * Add additional agent directories
   */
  addAgentsFrom(...directories: string[]): AgentSystemBuilder {
    const current = this.config.agents || { directories: [] };
    return this.with({
      agents: {
        ...current,
        additionalDirectories: [...(current.additionalDirectories || []), ...directories],
      },
    });
  }

  /**
   * Add programmatically defined agents
   */
  withAgents(...agents: Agent[]): AgentSystemBuilder {
    const current = this.config.agents || { directories: [] };
    return this.with({
      agents: {
        ...current,
        agents: [...(current.agents || []), ...agents],
      },
    });
  }

  /**
   * Configure built-in tools
   */
  withBuiltinTools(...tools: string[]): AgentSystemBuilder {
    return this.with({
      tools: {
        ...this.config.tools,
        builtin: tools,
      },
    });
  }

  /**
   * Add default tools (read, write, list, task)
   */
  withDefaultTools(): AgentSystemBuilder {
    return this.withBuiltinTools('read', 'write', 'list', 'task');
  }

  /**
   * Add todo management tool
   */
  withTodoTool(): AgentSystemBuilder {
    const current = this.config.tools?.builtin || [];
    return this.withBuiltinTools(...current, 'todowrite');
  }

  /**
   * Add a custom tool
   */
  withTool(tool: BaseTool): this {
    this.customTools.push(tool);
    return this;
  }

  /**
   * Configure safety limits
   */
  withSafetyLimits(limits: Partial<SafetyConfig>): AgentSystemBuilder {
    const currentSafety = this.config.safety || {};
    return this.with({
      safety: { ...currentSafety, ...limits } as SafetyConfig,
    });
  }

  /**
   * Configure caching
   */
  withCaching(config: Partial<CachingConfig>): AgentSystemBuilder {
    const currentCaching = this.config.caching || {};
    return this.with({
      caching: { ...currentCaching, ...config } as CachingConfig,
    });
  }

  /**
   * Configure logging
   */
  withLogging(config: Partial<LoggingConfig>): AgentSystemBuilder {
    const currentLogging = this.config.logging || {};
    return this.with({
      logging: { ...currentLogging, ...config } as LoggingConfig,
    });
  }

  /**
   * Set session ID
   */
  withSessionId(sessionId: string): AgentSystemBuilder {
    return this.with({
      session: {
        ...this.config.session,
        sessionId,
      } as SessionConfig,
    });
  }

  /**
   * Configure todo management
   */
  withTodos(config: Partial<TodoConfig>): AgentSystemBuilder {
    const currentTodos = this.config.todos || {};
    return this.with({
      todos: { ...currentTodos, ...config } as TodoConfig,
    });
  }

  /**
   * Configure MCP servers
   */
  withMCPServers(servers: MCPConfig['servers']): AgentSystemBuilder {
    return this.with({
      mcp: { servers },
    });
  }

  /**
   * Generic method to set any configuration
   */
  with(overrides: Partial<SystemConfig>): AgentSystemBuilder {
    return new AgentSystemBuilder(mergeConfigs(this.config, overrides));
  }

  /**
   * Build the executor with the current configuration
   */
  async build(): Promise<BuildResult> {
    const resolvedConfig = resolveConfig(this.config);

    // Create logger
    const logger = LoggerFactory.createCombinedLogger(resolvedConfig.session.sessionId);

    // Initialize agent loader
    const allAgentDirs = [
      ...resolvedConfig.agents.directories,
      ...(resolvedConfig.agents.additionalDirectories || []),
    ];

    const agentLoader = new AgentLoader(allAgentDirs[0], logger);
    // TODO: Add support for multiple directories in AgentLoader

    // Initialize tool registry
    const toolRegistry = new ToolRegistry();

    // Register built-in tools
    const builtinTools = resolvedConfig.tools.builtin || [];
    for (const toolName of builtinTools) {
      switch (toolName) {
        case 'read':
          toolRegistry.register(createReadTool());
          break;
        case 'write':
          toolRegistry.register(createWriteTool());
          break;
        case 'list':
          toolRegistry.register(createListTool());
          break;
        case 'task':
          toolRegistry.register(await createTaskTool(agentLoader));
          break;
        case 'todowrite': {
          const todoManager = new TodoManager(resolvedConfig.todos.todosDir);
          await todoManager.initialize();
          toolRegistry.register(createTodoWriteTool(todoManager));
          break;
        }
      }
    }

    // Register custom tools
    for (const tool of this.customTools) {
      toolRegistry.register(tool);
    }

    // Initialize MCP servers if configured
    if (resolvedConfig.mcp?.servers) {
      for (const [serverName, serverConfig] of Object.entries(resolvedConfig.mcp.servers)) {
        try {
          console.log(`Initializing MCP server: ${serverName}`);

          // Create transport
          const transport = new StdioClientTransport({
            command: serverConfig.command,
            args: serverConfig.args,
            env: serverConfig.env,
          });

          // Create client
          const client = new Client(
            {
              name: `agent-system-${serverName}`,
              version: '1.0.0',
            },
            {
              capabilities: {},
            }
          );

          // Connect to server
          await client.connect(transport);

          // List available tools from this server
          const { tools } = await client.listTools();

          // Register each tool from the MCP server
          for (const tool of tools) {
            // Ensure inputSchema has the correct structure
            const toolSchema: ToolSchema = tool.inputSchema
              ? {
                  type: 'object' as const,
                  properties:
                    ((tool.inputSchema as Record<string, unknown>).properties as Record<
                      string,
                      ToolParameter
                    >) || {},
                  required:
                    ((tool.inputSchema as Record<string, unknown>).required as string[]) || [],
                }
              : { type: 'object' as const, properties: {}, required: [] };

            const mcpTool: BaseTool = {
              name: `${serverName}.${tool.name}`,
              description: tool.description || `Tool from ${serverName} MCP server`,
              parameters: toolSchema,
              execute: async (input: Record<string, unknown>) => {
                try {
                  const result = await client.callTool({
                    name: tool.name,
                    arguments: input,
                  });
                  return { content: result.content };
                } catch (error) {
                  return {
                    content: '',
                    error: error instanceof Error ? error.message : String(error),
                  };
                }
              },
              isConcurrencySafe: () => true,
            };
            toolRegistry.register(mcpTool);
          }

          // Store client for cleanup
          this.mcpClients.push({
            client,
            transport,
            serverName,
          });

          console.log(`✓ MCP server ${serverName} connected with ${tools.length} tools`);
        } catch (error) {
          console.error(`Failed to initialize MCP server ${serverName}:`, error);
        }
      }
    }

    // Create executor with config
    const executor = new AgentExecutor(
      agentLoader,
      toolRegistry,
      resolvedConfig,
      resolvedConfig.model,
      logger
    );

    // Cleanup function
    const cleanup = async () => {
      // Cleanup MCP clients
      for (const wrapper of this.mcpClients) {
        try {
          await wrapper.client.close();
          await wrapper.transport.close();
        } catch (error) {
          console.error(`Error closing MCP client ${wrapper.serverName}:`, error);
        }
      }
    };

    return {
      config: resolvedConfig,
      executor,
      toolRegistry,
      mcpClients: this.mcpClients,
      cleanup,
    };
  }

  /**
   * Factory method: Load from config file
   */
  static async fromConfigFile(
    configPath: string = './agent-config.json'
  ): Promise<AgentSystemBuilder> {
    const configContent = await fs.readFile(configPath, 'utf-8');
    const fileConfig = JSON.parse(configContent);
    return AgentSystemBuilder.fromConfig(fileConfig);
  }

  /**
   * Factory method: Create from config object
   */
  static fromConfig(config: FileConfig): AgentSystemBuilder {
    const systemConfig: Partial<SystemConfig> = {};

    // Map from file config format to our format
    if (config.execution?.defaultModel || config.model) {
      systemConfig.model = config.execution?.defaultModel || config.model;
    }

    if (config.agents) {
      systemConfig.agents = {
        directories: config.agents.directory
          ? [config.agents.directory]
          : config.agents.directories || [],
        additionalDirectories: config.agents.additionalDirectories,
      };
    }

    if (config.builtinTools || config.tools) {
      systemConfig.tools = {
        builtin: config.builtinTools?.tools || config.tools?.builtin || [],
      };
    }

    if (config.execution) {
      systemConfig.safety = {
        maxIterations: config.execution.maxIterations!,
        maxDepth: config.execution.maxDepth!,
        warnAtIteration: config.execution.warnAtIteration!,
        maxTokensEstimate: config.execution.maxTokensEstimate!,
      } as SafetyConfig;

      systemConfig.session = {
        timeout: config.execution.timeout,
      } as SessionConfig;
    }

    if (config.mcpServers) {
      systemConfig.mcp = {
        servers: config.mcpServers,
      };
    }

    return new AgentSystemBuilder(systemConfig);
  }

  /**
   * Factory method: Minimal configuration
   */
  static minimal(): AgentSystemBuilder {
    return new AgentSystemBuilder({
      model: DEFAULT_SYSTEM_CONFIG.model,
      agents: { directories: ['./agents'] },
      tools: { builtin: [] },
      safety: {
        maxIterations: 10,
        warnAtIteration: 5,
        maxTokensEstimate: 20000,
        maxDepth: 3,
      },
    });
  }

  /**
   * Factory method: Default configuration
   */
  static default(): AgentSystemBuilder {
    return new AgentSystemBuilder({
      model: DEFAULT_SYSTEM_CONFIG.model,
      agents: { directories: ['./agents'] },
      tools: { builtin: ['read', 'write', 'list', 'task', 'todowrite'] },
      caching: { enabled: true, maxCacheBlocks: 4, cacheTTLMinutes: 5 },
      logging: { logDir: 'logs', verbose: true },
    });
  }

  /**
   * Factory method: Test configuration
   */
  static forTest(config: Partial<SystemConfig> = {}): AgentSystemBuilder {
    return new AgentSystemBuilder(mergeConfigs(TEST_CONFIG_MINIMAL, config));
  }
}

/**
 * Test-specific builder with additional capabilities
 */
export class TestConfigBuilder extends AgentSystemBuilder {
  protected mockAgents: Map<string, Map<string, string>> = new Map();
  protected mockTools: Map<string, (args: Record<string, unknown>) => Promise<ToolResult>> =
    new Map();
  protected recording: boolean = false;

  /**
   * Add a mock agent
   */
  withMockAgent(name: string, responses: Map<string, string>): this {
    this.mockAgents.set(name, responses);
    return this;
  }

  /**
   * Add a mock tool
   */
  withMockTool(
    name: string,
    handler: (args: Record<string, unknown>) => Promise<ToolResult>
  ): this {
    this.mockTools.set(name, handler);
    return this;
  }

  /**
   * Enable recording for assertions
   */
  withRecording(): this {
    this.recording = true;
    return this;
  }

  /**
   * Set deterministic mode (disable randomness, timestamps, etc.)
   */
  withDeterministicMode(): TestConfigBuilder {
    const newConfig = mergeConfigs(this.config, {
      session: {
        ...this.config.session,
        sessionId: 'test-session',
      },
    });
    // Return a new TestConfigBuilder with the updated config
    const testBuilder = new TestConfigBuilder(newConfig);
    testBuilder.mockAgents = this.mockAgents;
    testBuilder.mockTools = this.mockTools;
    testBuilder.recording = this.recording;
    return testBuilder;
  }

  /**
   * Build for testing (with mocks injected)
   */
  async buildForTest(): Promise<BuildResult> {
    // TODO: Implement mock injection
    // This will require updates to AgentLoader and ToolRegistry
    // to support mock agents and tools
    return this.build();
  }
}
