/**
 * Agent System Builder - Unified configuration builder
 *
 * Provides a fluent API for configuring the agent orchestration system.
 * Supports both programmatic configuration and loading from files.
 * Designed to be testable, composable, and flexible.
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { AgentLoader } from '@/agents/loader';
import { ToolRegistry } from '@/tools/registry/registry';
import { ToolLoader } from '@/tools/registry/loader';
import { AgentExecutor } from '@/agents/executor';
import { TodoManager } from '@/todos/manager';
import { createListTool, createReadTool, createWriteTool } from '@/tools/file.tool';
import { createGrepTool } from '@/tools/grep.tool';
import { createTaskTool } from '@/tools/task.tool';
import { createTodoWriteTool } from '@/tools/todowrite.tool';
import { createShellTool } from '@/tools/shell.tool';
import { createGetSessionLogTool } from '@/tools/get-session-log.tool';
import { BaseTool, ToolParameter, ToolResult, ToolSchema } from '@/base-types';
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
  StorageConfig,
  SystemConfig,
  TEST_CONFIG_MINIMAL,
  TodoConfig,
} from './types';
import { SessionStorage } from '@/session/types';
import { NoOpStorage } from '@/session/noop.storage';
import { InMemoryStorage } from '@/session/memory.storage';
import { FilesystemStorage } from '@/session/filesystem.storage';
import { EventLogger } from '@/logging/event.logger';
import { Message, SimpleSessionManager } from '@/session/manager';

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
  model?: string; // Optional override for a specific run
  execution?: {
    defaultModel?: string; // Default model from agent-config.json
    defaultBehavior?: string; // Default behavior preset from agent-config.json
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
  logging?: {
    display?: 'console' | 'jsonl' | 'both' | 'none';
    verbosity?: 'minimal' | 'normal' | 'verbose';
  };
}

/**
 * Build result containing both config and executor
 */
export interface BuildResult {
  config: ResolvedSystemConfig;
  executor: AgentExecutor;
  toolRegistry: ToolRegistry;
  mcpClients: MCPClientWrapper[];
  sessionManager: SimpleSessionManager;
  storage: SessionStorage;
  cleanup: () => Promise<void>;
}

/**
 * Main builder class for agent system configuration
 */
export class AgentSystemBuilder {
  protected config: Partial<SystemConfig>;
  protected customTools: BaseTool[] = [];
  protected mcpClients: MCPClientWrapper[] = [];
  protected toolDirectories: string[] = [];
  protected storageInstance?: SessionStorage;

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
   * Load tools from a directory containing scripts
   */
  withToolsFrom(...directories: string[]): this {
    this.toolDirectories.push(...directories);
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
   * Set session ID (auto-generates UUID if not provided)
   */
  withSessionId(sessionId?: string): AgentSystemBuilder {
    return this.with({
      session: {
        ...this.config.session,
        sessionId: sessionId || uuidv4(),
      } as SessionConfig,
    });
  }

  /**
   * Configure with a JsonlLogger instance
   * Extracts session ID from the logger for use in session context
   */
  withLogger(logger: { getSessionId(): string }): AgentSystemBuilder {
    return this.withSessionId(logger.getSessionId());
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
   * Configure storage for session persistence
   */
  withStorage(storage: StorageConfig | SessionStorage): AgentSystemBuilder {
    // If it's a SessionStorage instance, we'll handle it in build()
    if ('appendEvent' in storage && 'readEvents' in storage) {
      // It's a SessionStorage instance - store it separately
      const newBuilder = new AgentSystemBuilder(this.config);
      newBuilder.customTools = [...this.customTools];
      newBuilder.mcpClients = [...this.mcpClients];
      newBuilder.toolDirectories = [...this.toolDirectories];
      newBuilder.storageInstance = storage;
      return newBuilder;
    }
    // It's a StorageConfig
    return this.with({
      storage: storage,
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
    const newBuilder = new AgentSystemBuilder(mergeConfigs(this.config, overrides));
    // Preserve instance properties not in config
    newBuilder.customTools = [...this.customTools];
    newBuilder.mcpClients = [...this.mcpClients];
    newBuilder.toolDirectories = [...this.toolDirectories];
    newBuilder.storageInstance = this.storageInstance;
    return newBuilder;
  }

  /**
   * Validate configuration before building
   */
  private async validateConfiguration(): Promise<void> {
    // Skip validation for test configurations
    if (process.env.NODE_ENV === 'test' || this.config.model === 'test-model') {
      return;
    }

    const errors: string[] = [];

    // Check API keys
    if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENROUTER_API_KEY) {
      errors.push('No API keys found. Set ANTHROPIC_API_KEY or OPENROUTER_API_KEY');
    }

    // Check if any agents are configured
    if (
      this.config.agents?.directories?.length === 0 &&
      (!this.config.agents?.agents || this.config.agents.agents.length === 0)
    ) {
      errors.push('No agents configured');
    }

    // Check agent directories exist
    if (this.config.agents?.directories) {
      for (const dir of this.config.agents.directories) {
        if (!fsSync.existsSync(dir)) {
          errors.push(`Agent directory not found: ${dir}`);
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `Configuration validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`
      );
    }
  }

  /**
   * Build the executor with the current configuration
   */
  async build(): Promise<BuildResult> {
    // Validate configuration first
    await this.validateConfiguration();

    const resolvedConfig = resolveConfig(this.config);

    // Use defaultModel if model is not specified
    if (!resolvedConfig.model || resolvedConfig.model === '') {
      resolvedConfig.model = resolvedConfig.defaultModel;
    }

    // Ensure session has an ID (generate UUID if not set)
    if (!resolvedConfig.session.sessionId) {
      resolvedConfig.session.sessionId = uuidv4();
    }

    // Create storage instance
    let storage: SessionStorage;
    if (this.storageInstance) {
      // Use the provided storage instance
      storage = this.storageInstance;
    } else {
      // Create storage based on config
      const storageConfig = resolvedConfig.storage;
      switch (storageConfig.type) {
        case 'memory':
          storage = new InMemoryStorage();
          break;
        case 'filesystem':
          storage = new FilesystemStorage(storageConfig.options?.path);
          break;
        case 'noop':
        default:
          storage = new NoOpStorage();
          break;
      }
    }

    // Create EventLogger with storage
    const eventLogger = new EventLogger(storage, resolvedConfig.session.sessionId);

    // Create session manager
    const sessionManager = new SimpleSessionManager(storage);

    // For backward compatibility, create a logger facade if needed
    // EventLogger implements AgentLogger, so we can use it directly
    const logger = eventLogger;

    // Initialize agent loader
    const allAgentDirs = [
      ...resolvedConfig.agents.directories,
      ...(resolvedConfig.agents.additionalDirectories || []),
    ];

    const agentLoader = new AgentLoader(allAgentDirs[0], logger);
    // TODO: Add support for multiple directories in AgentLoader

    // Initialize tool registry
    const toolRegistry = new ToolRegistry();

    // TodoManager instance (if todowrite tool is enabled)
    let todoManager: TodoManager | undefined;

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
        case 'grep':
          toolRegistry.register(createGrepTool());
          break;
        case 'task':
          toolRegistry.register(await createTaskTool(agentLoader));
          break;
        case 'todowrite': {
          todoManager = new TodoManager();
          todoManager.initialize();
          toolRegistry.register(createTodoWriteTool(todoManager));
          break;
        }
        case 'shell':
          toolRegistry.register(createShellTool());
          break;
      }
    }

    // Register session log tool only if we have builtin tools configured
    // This prevents the tool from being registered in minimal configuration
    if (resolvedConfig.session.sessionId && resolvedConfig.tools.builtin.length > 0) {
      toolRegistry.register(createGetSessionLogTool(resolvedConfig.session.sessionId));
    }

    // Register custom tools
    for (const tool of this.customTools) {
      toolRegistry.register(tool);
    }

    // Load tools from directories
    for (const directory of this.toolDirectories) {
      console.info(`Loading tools from directory: ${directory}`);
      const toolLoader = new ToolLoader(directory, logger);
      const toolNames = await toolLoader.listTools();
      console.info(`Found ${toolNames.length} tool(s): ${toolNames.join(', ')}`);

      for (const toolName of toolNames) {
        try {
          const tool = await toolLoader.loadTool(toolName);
          toolRegistry.register(tool);
          console.info(`✓ Loaded tool: ${toolName} from ${directory}`);
        } catch (error) {
          console.error(`Failed to load tool ${toolName}:`, error);
        }
      }
    }

    // Initialize MCP servers if configured
    if (resolvedConfig.mcp?.servers) {
      for (const [serverName, serverConfig] of Object.entries(resolvedConfig.mcp.servers)) {
        try {
          console.info(`Initializing MCP server: ${serverName}`);

          // Create transport with clean environment
          // MCP servers should not inherit process environment variables
          const cleanEnv: Record<string, string> = {
            PATH: process.env.PATH || '',
            HOME: process.env.HOME || '',
            USER: process.env.USER || '',
            // Add any server-specific env vars
            ...(serverConfig.env || {}),
          };

          const transport = new StdioClientTransport({
            command: serverConfig.command,
            args: serverConfig.args,
            env: cleanEnv,
            cwd: serverConfig.cwd, // Use server-specific working directory if provided
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

          console.info(`✓ MCP server ${serverName} connected with ${tools.length} tools`);
        } catch (error) {
          console.error(`Failed to initialize MCP server ${serverName}:`, error);
        }
      }
    }

    // Check for session recovery
    let recoveredMessages: unknown[] = [];
    if (await storage.sessionExists(resolvedConfig.session.sessionId)) {
      console.info(`Recovering session: ${resolvedConfig.session.sessionId}`);
      recoveredMessages = await sessionManager.recoverSession(resolvedConfig.session.sessionId);

      // Check if we have an incomplete tool call
      if (sessionManager.hasIncompleteToolCall(recoveredMessages as Message[])) {
        const toolCall = sessionManager.getLastToolCall(recoveredMessages as Message[]);
        if (toolCall) {
          console.info(`Executing incomplete tool call: ${toolCall.name}`);
          // The executor will handle this when it receives the messages
        }
      }

      // Recover todos if TodoWrite tool is enabled
      if (todoManager) {
        const recoveredTodos = await sessionManager.recoverTodos(resolvedConfig.session.sessionId);
        if (recoveredTodos.length > 0) {
          todoManager.setTodos(recoveredTodos);
          console.info(`Recovered ${recoveredTodos.length} todos from session`);
        }
      }
    }

    // Create executor with config
    const executor = new AgentExecutor(
      agentLoader,
      toolRegistry,
      resolvedConfig,
      resolvedConfig.model,
      logger,
      resolvedConfig.session.sessionId
    );

    // TODO: Add method to executor to continue with recovered messages
    // For now, the executor will need to be enhanced to support this

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
      sessionManager,
      storage,
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
    if (config.model) {
      systemConfig.model = config.model;
    }

    // Set defaultModel and defaultBehavior from execution config
    if (config.execution?.defaultModel) {
      systemConfig.defaultModel = config.execution.defaultModel;
    }
    if (config.execution?.defaultBehavior) {
      systemConfig.defaultBehavior = config.execution.defaultBehavior;
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
      // Only set safety config if values are provided
      if (
        config.execution.maxIterations !== undefined ||
        config.execution.maxDepth !== undefined ||
        config.execution.warnAtIteration !== undefined ||
        config.execution.maxTokensEstimate !== undefined
      ) {
        systemConfig.safety = {} as SafetyConfig;
        if (config.execution.maxIterations !== undefined) {
          systemConfig.safety.maxIterations = config.execution.maxIterations;
        }
        if (config.execution.maxDepth !== undefined) {
          systemConfig.safety.maxDepth = config.execution.maxDepth;
        }
        if (config.execution.warnAtIteration !== undefined) {
          systemConfig.safety.warnAtIteration = config.execution.warnAtIteration;
        }
        if (config.execution.maxTokensEstimate !== undefined) {
          systemConfig.safety.maxTokensEstimate = config.execution.maxTokensEstimate;
        }
      }

      if (config.execution.timeout !== undefined) {
        systemConfig.session = {
          timeout: config.execution.timeout,
        } as SessionConfig;
      }
    }

    if (config.mcpServers) {
      systemConfig.mcp = {
        servers: config.mcpServers,
      };
    }

    // Add logging config if provided
    if (config.logging) {
      systemConfig.logging = {
        display: config.logging.display || 'both',
        jsonl: {
          enabled: true,
          path: './logs',
        },
        console: {
          timestamps: true,
          colors: true,
          verbosity: config.logging.verbosity || 'normal',
        },
      };
    }

    return new AgentSystemBuilder(systemConfig);
  }

  /**
   * Factory method: Minimal configuration
   */
  static minimal(): AgentSystemBuilder {
    const isTest = process.env.NODE_ENV === 'test';
    return new AgentSystemBuilder({
      model: isTest ? 'test-model' : DEFAULT_SYSTEM_CONFIG.model,
      agents: isTest
        ? { directories: ['tests/unit/test-agents'], agents: [] }
        : { directories: [] }, // Uses built-in default agent
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
    const isTest = process.env.NODE_ENV === 'test';
    return new AgentSystemBuilder({
      model: isTest ? 'test-model' : DEFAULT_SYSTEM_CONFIG.model,
      agents: isTest
        ? { directories: ['tests/unit/test-agents'], agents: [] }
        : { directories: [] }, // Uses built-in default agent
      tools: { builtin: ['read', 'write', 'list', 'grep', 'task', 'todowrite'] },
      caching: { enabled: true, maxCacheBlocks: 4, cacheTTLMinutes: 5 },
      logging: {
        display: 'both',
        jsonl: {
          enabled: true,
          path: './logs',
        },
        console: {
          timestamps: true,
          colors: true,
          verbosity: 'verbose',
        },
      },
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
  protected toolDirectories: string[] = [];

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
    testBuilder.toolDirectories = this.toolDirectories;
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
