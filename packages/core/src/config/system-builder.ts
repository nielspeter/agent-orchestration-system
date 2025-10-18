/**
 * Agent System Builder - Unified configuration builder
 *
 * Provides a fluent API for configuring the agent orchestration system.
 * Supports both programmatic configuration and loading from files.
 * Designed to be testable, composable, and flexible.
 */

import * as fs from 'fs/promises';
import * as fsSync from 'node:fs';
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
import { createDelegateTool } from '@/tools/delegate.tool';
import { createTodoWriteTool } from '@/tools/todowrite.tool';
import { createShellTool } from '@/tools/shell.tool';
import { createGetSessionLogTool } from '@/tools/get-session-log.tool';
import { BaseTool, Message, ToolParameter, ToolResult, ToolSchema } from '@/base-types';
import {
  Agent,
  CachingConfig,
  DEFAULT_SYSTEM_CONFIG,
  MCPConfig,
  mergeConfigs,
  ProvidersConfig,
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
import { InMemoryStorage } from '@/session/memory.storage';
import { FilesystemStorage } from '@/session/filesystem.storage';
import { NoOpStorage } from '@/session/noop.storage';
import { EventLogger } from '@/logging/event.logger';
import { AgentLogger, ConsoleConfig, NoOpLogger } from '@/logging';
import { ConsoleLogger } from '@/logging/console.logger';
import { CompositeLogger } from '@/logging/composite.logger';
import { SimpleSessionManager } from '@/session/manager';

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
  console?:
    | boolean
    | {
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
  agentLoader: AgentLoader;
  mcpClients: MCPClientWrapper[];
  sessionManager: SimpleSessionManager;
  storage: SessionStorage;
  logger: AgentLogger;
  eventLogger: EventLogger; // Direct access for event subscriptions (web UI, etc.)
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
   * Provide providers configuration programmatically
   * This makes providers-config.json optional
   */
  withProvidersConfig(config: ProvidersConfig): AgentSystemBuilder {
    return this.with({ providersConfig: config });
  }

  /**
   * Provide API keys programmatically
   * Allows injection from secret managers, testing, etc.
   * Falls back to process.env if not provided
   */
  withAPIKeys(keys: Record<string, string>): AgentSystemBuilder {
    return this.with({ apiKeys: keys });
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
   * Configure built-in tools (replaces existing built-in tools)
   * Use this when you want to specify exactly which tools are available.
   * For adding tools to existing set, use addBuiltinTools() or specific methods like withTodoTool()
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
   * Add built-in tools to existing set (additive)
   */
  addBuiltinTools(...tools: string[]): AgentSystemBuilder {
    const current = this.config.tools?.builtin || [];
    const combined = [...new Set([...current, ...tools])]; // Use Set to avoid duplicates
    return this.with({
      tools: {
        ...this.config.tools,
        builtin: combined,
      },
    });
  }

  /**
   * Add default tools (read, write, list, delegate)
   */
  withDefaultTools(): AgentSystemBuilder {
    return this.withBuiltinTools('read', 'write', 'list', 'delegate');
  }

  /**
   * Add todo management tool
   */
  withTodoTool(): AgentSystemBuilder {
    return this.addBuiltinTools('todowrite');
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
   * Configure console output
   */
  withConsole(config: boolean | ConsoleConfig = true): AgentSystemBuilder {
    return this.with({ console: config });
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
  withStorage(type: 'memory' | 'filesystem', path?: string): AgentSystemBuilder;
  withStorage(storage: StorageConfig | SessionStorage): AgentSystemBuilder;
  withStorage(
    storageOrType: StorageConfig | SessionStorage | 'memory' | 'filesystem',
    path?: string
  ): AgentSystemBuilder {
    // If it's a string type, create a StorageConfig
    if (typeof storageOrType === 'string') {
      const storage: StorageConfig = {
        type: storageOrType,
        ...(path && { options: { path } }),
      };
      return this.with({ storage });
    }

    const storage = storageOrType;
    // If it's a SessionStorage instance, we'll handle it in build()
    if ('appendEvent' in storage && 'readEvents' in storage) {
      // It's a SessionStorage instance - store it separately
      const newBuilder = new AgentSystemBuilder(this.config);
      newBuilder.customTools = [...this.customTools];
      newBuilder.mcpClients = [...this.mcpClients];
      newBuilder.toolDirectories = [...this.toolDirectories];
      newBuilder.storageInstance = storage;

      // Also set the storage type in config based on the instance type
      // This ensures EventLogger is created for InMemoryStorage/FilesystemStorage
      if (storage instanceof InMemoryStorage) {
        newBuilder.config.storage = { type: 'memory' };
      } else if (storage instanceof FilesystemStorage) {
        newBuilder.config.storage = { type: 'filesystem' };
      }
      // NoOpStorage keeps the default 'none' type

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

    // Check API keys (environment or programmatic)
    const hasAnthropicKey = process.env.ANTHROPIC_API_KEY || this.config.apiKeys?.ANTHROPIC_API_KEY;
    const hasOpenRouterKey =
      process.env.OPENROUTER_API_KEY || this.config.apiKeys?.OPENROUTER_API_KEY;

    if (!hasAnthropicKey && !hasOpenRouterKey) {
      errors.push(
        'No API keys found. Set ANTHROPIC_API_KEY or OPENROUTER_API_KEY environment variable, or provide via withAPIKeys()'
      );
    }

    // Check if any agents are configured
    // Allow empty configuration when using built-in default agent
    // An empty directories array [] signals use of the built-in default agent
    const hasDirectories =
      this.config.agents?.directories && this.config.agents.directories.length > 0;
    const hasAgents = this.config.agents?.agents && this.config.agents.agents.length > 0;
    const hasEmptyDirectories =
      Array.isArray(this.config.agents?.directories) && this.config.agents.directories.length === 0;

    // Only error if we have no way to get agents (no directories, no agents, and not using default)
    if (!hasDirectories && !hasAgents && !hasEmptyDirectories) {
      errors.push('No agents configured');
    }

    // Check agent directories exist
    // Only validate directories if they are explicitly provided (non-empty array)
    if (this.config.agents?.directories && this.config.agents.directories.length > 0) {
      for (const dir of this.config.agents.directories) {
        if (!fsSync.existsSync(dir)) {
          errors.push(`Agent directory not found: ${dir}`);
        }
      }
    }

    if (errors.length > 0) {
      const errorList = errors.map((e) => `  - ${e}`).join('\n');
      throw new Error(`Configuration validation failed:\n${errorList}`);
    }
  }

  /**
   * Validate and resolve configuration with defaults
   */
  private async validateAndResolve(): Promise<ResolvedSystemConfig> {
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

    return resolvedConfig;
  }

  /**
   * Create storage instance based on configuration
   */
  private createStorage(config: ResolvedSystemConfig): SessionStorage {
    if (this.storageInstance) {
      // Use the provided storage instance
      return this.storageInstance;
    }

    // Create storage based on config
    const storageConfig = config.storage;
    const validStorageTypes = ['none', 'memory', 'filesystem'] as const;
    type ValidStorageType = (typeof validStorageTypes)[number];

    // Validate storage type to prevent silent data loss
    function isValidStorageType(type: string): type is ValidStorageType {
      return validStorageTypes.includes(type as ValidStorageType);
    }

    if (!isValidStorageType(storageConfig.type)) {
      throw new Error(
        `Invalid storage type: '${storageConfig.type}'. ` +
          `Valid types are: ${validStorageTypes.join(', ')}. ` +
          'Check for typos in your configuration.'
      );
    }

    switch (storageConfig.type) {
      case 'none':
        return new NoOpStorage();
      case 'memory':
        return new InMemoryStorage();
      case 'filesystem':
        return new FilesystemStorage(storageConfig.options?.path);
      default:
        // This should never be reached due to validation above
        // But TypeScript doesn't know that, so we need this for exhaustiveness
        throw new Error(`Unexpected storage type: ${storageConfig.type}`);
    }
  }

  /**
   * Create logger and session manager
   */
  private createLoggerAndSessionManager(
    storage: SessionStorage,
    config: ResolvedSystemConfig
  ): {
    logger: AgentLogger;
    eventLogger: EventLogger;
    sessionManager: SimpleSessionManager;
  } {
    // sessionId is guaranteed to exist after validateAndResolve()
    if (!config.session.sessionId) {
      throw new Error('Session ID should be set after validateAndResolve()');
    }
    const sessionId = config.session.sessionId;
    const loggers: AgentLogger[] = [];

    // Always create EventLogger for event emission
    // Storage subscribes internally (NoOpStorage does nothing, others persist)
    const eventLogger = new EventLogger(storage, sessionId);
    loggers.push(eventLogger);

    // Always create session manager with the storage
    const sessionManager = new SimpleSessionManager(storage);

    // Console logger is EXPLICIT (now top-level)
    if (config.console) {
      // Handle both boolean and object config
      if (typeof config.console === 'boolean') {
        if (config.console) {
          const consoleLogger = new ConsoleLogger({
            verbosity: 'normal',
            timestamps: true,
            colors: true, // Auto-detect TTY
          });
          loggers.push(consoleLogger);
        }
      } else {
        // ConsoleConfig object - presence means enabled
        const consoleLogger = new ConsoleLogger({
          verbosity: config.console.verbosity || 'normal',
          timestamps: true,
          colors: true,
        });
        loggers.push(consoleLogger);
      }
    }

    // Determine final logger
    let logger: AgentLogger;
    if (loggers.length === 0) {
      logger = new NoOpLogger();
    } else if (loggers.length === 1) {
      logger = loggers[0];
    } else {
      logger = new CompositeLogger(loggers);
    }

    return { logger, eventLogger, sessionManager };
  }

  /**
   * Register built-in tools to the registry
   */
  private async registerBuiltinTools(
    toolRegistry: ToolRegistry,
    config: ResolvedSystemConfig,
    agentLoader: AgentLoader
  ): Promise<TodoManager | undefined> {
    // TodoManager instance (if todowrite tool is enabled)
    let todoManager: TodoManager | undefined;

    // Register built-in tools
    const builtinTools = config.tools.builtin || [];
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
        case 'delegate':
          toolRegistry.register(await createDelegateTool(agentLoader));
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
    if (config.session.sessionId && config.tools.builtin.length > 0) {
      // sessionId is guaranteed to exist after validateAndResolve()
      toolRegistry.register(createGetSessionLogTool(config.session.sessionId));
    }

    return todoManager;
  }

  /**
   * Validate that all agents can access their requested tools
   */
  private async validateAgentTools(
    agentLoader: AgentLoader,
    toolRegistry: ToolRegistry,
    logger: AgentLogger
  ): Promise<void> {
    // Get all available agents
    const agentNames = await agentLoader.listAgents();
    const registeredTools = toolRegistry.getAllTools();
    const registeredToolNames = new Set(registeredTools.map((t) => t.name));

    for (const agentName of agentNames) {
      const agent = await agentLoader.loadAgent(agentName);
      if (!agent || !agent.tools) continue;

      // Skip agents with wildcard access
      if (agent.tools === '*' || (Array.isArray(agent.tools) && agent.tools.includes('*'))) {
        continue;
      }

      const requestedTools = Array.isArray(agent.tools) ? agent.tools : [];
      const missingTools: string[] = [];

      for (const toolName of requestedTools) {
        // Skip pattern matching (e.g., 'file-*')
        if (toolName.endsWith('-*')) continue;

        // Check if tool exists in registry
        if (!registeredToolNames.has(toolName)) {
          missingTools.push(toolName);
        }
      }

      if (missingTools.length > 0) {
        const availableTools = Array.from(registeredToolNames).sort().join(', ');
        throw new Error(
          `Agent "${agentName}" requests tools that don't exist: [${missingTools.join(', ')}]\n` +
            `Available tools: [${availableTools}]\n` +
            'Hint: Tool names are case-sensitive and lowercase. Use exact names like "read", "write", "delegate", etc.'
        );
      }
    }

    logger.logSystemMessage('✓ All agent tool requirements validated');
  }

  /**
   * Register custom tools and load from directories
   */
  private async registerCustomTools(
    toolRegistry: ToolRegistry,
    logger: AgentLogger
  ): Promise<void> {
    // Register custom tools
    for (const tool of this.customTools) {
      toolRegistry.register(tool);
    }

    // Load tools from directories
    for (const directory of this.toolDirectories) {
      logger.logSystemMessage(`Loading tools from directory: ${directory}`);
      const toolLoader = new ToolLoader(directory, logger);
      const toolNames = await toolLoader.listTools();
      logger.logSystemMessage(`Found ${toolNames.length} tool(s): ${toolNames.join(', ')}`);

      for (const toolName of toolNames) {
        try {
          const tool = await toolLoader.loadTool(toolName);
          toolRegistry.register(tool);
          logger.logSystemMessage(`✓ Loaded tool: ${toolName} from ${directory}`);
        } catch (error) {
          logger.logSystemMessage(`ERROR: Failed to load tool ${toolName}: ${error}`);
        }
      }
    }
  }

  /**
   * Initialize MCP servers and register their tools
   */
  private async initializeMCPServers(
    toolRegistry: ToolRegistry,
    config: ResolvedSystemConfig,
    logger: AgentLogger
  ): Promise<void> {
    if (!config.mcp?.servers) {
      return;
    }

    for (const [serverName, serverConfig] of Object.entries(config.mcp.servers)) {
      try {
        logger.logSystemMessage(`Initializing MCP server: ${serverName}`);

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
            // Replace dots with underscores to comply with Anthropic's tool naming requirements
            // Pattern: ^[a-zA-Z0-9_-]{1,128}
            name: `${serverName}_${tool.name}`.replace(/\./g, '_'),
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

        logger.logMCPServerConnected(serverName, tools.length);
      } catch (error) {
        logger.logSystemMessage(`ERROR: Failed to initialize MCP server ${serverName}: ${error}`);
      }
    }
  }

  /**
   * Handle session recovery if session exists
   */
  private async handleSessionRecovery(
    storage: SessionStorage,
    sessionManager: SimpleSessionManager,
    config: ResolvedSystemConfig,
    logger: AgentLogger,
    todoManager?: TodoManager
  ): Promise<unknown[]> {
    let recoveredMessages: unknown[] = [];

    if (!config.session.sessionId) {
      return recoveredMessages;
    }

    // Try to recover session messages - don't check sessionExists() first
    // because logging creates the session directory, leading to false positives
    try {
      recoveredMessages = await sessionManager.recoverSession(config.session.sessionId);
    } catch {
      // Session doesn't exist or failed to recover - start fresh
      return recoveredMessages;
    }

    // Only log recovery if we actually recovered conversation messages
    if (recoveredMessages.length > 0) {
      // Recover todos if TodoWrite tool is enabled
      let todoCount = 0;
      if (todoManager) {
        const recoveredTodos = await sessionManager.recoverTodos(config.session.sessionId);
        if (recoveredTodos.length > 0) {
          todoManager.setTodos(recoveredTodos);
          todoCount = recoveredTodos.length;
        }
      }

      // Log session recovery with counts
      logger.logSessionRecovery(
        config.session.sessionId,
        recoveredMessages.length,
        todoCount || undefined
      );

      // Check if we have an incomplete tool call
      if (sessionManager.hasIncompleteToolCall(recoveredMessages as Message[])) {
        const toolCall = sessionManager.getLastToolCall(recoveredMessages as Message[]);
        if (toolCall) {
          logger.logSystemMessage(`Executing incomplete tool call: ${toolCall.name}`);
          // The executor will handle this when it receives the messages
        }
      }
    }

    return recoveredMessages;
  }

  /**
   * Create cleanup function for MCP clients
   */
  private createCleanupFunction(): () => Promise<void> {
    return async () => {
      // Cleanup MCP clients
      for (const wrapper of this.mcpClients) {
        try {
          await wrapper.client.close();
          await wrapper.transport.close();
        } catch (error) {
          // Use console.error here since logger might be disposed
          console.error(`Error closing MCP client ${wrapper.serverName}:`, error);
        }
      }
    };
  }

  /**
   * Build the executor with the current configuration
   */
  async build(): Promise<BuildResult> {
    // Validate and resolve configuration
    const resolvedConfig = await this.validateAndResolve();

    // Create core components
    const storage = this.createStorage(resolvedConfig);
    const { logger, eventLogger, sessionManager } = this.createLoggerAndSessionManager(
      storage,
      resolvedConfig
    );

    // Initialize agent loader
    const allAgentDirs = [
      ...resolvedConfig.agents.directories,
      ...(resolvedConfig.agents.additionalDirectories || []),
    ];

    // Use first directory, or default to 'agents' directory
    // If 'agents' doesn't exist, AgentLoader will gracefully fall back to just the default agent
    const primaryDir = allAgentDirs[0] || 'agents';
    // Pass inline agents directly - they're already in the right format
    const inlineAgents = resolvedConfig.agents.agents;
    const agentLoader = new AgentLoader(
      primaryDir,
      logger,
      inlineAgents,
      resolvedConfig.providersConfig,
      resolvedConfig.defaultModel
    );

    // Warn if multiple directories were specified but not all used
    if (allAgentDirs.length > 1) {
      logger.logSystemMessage(
        `WARNING: Multiple agent directories specified (${allAgentDirs.length}), but only using first: ${primaryDir}. ` +
          'AgentLoader currently supports only one directory.'
      );
    }

    // Setup tools
    const toolRegistry = new ToolRegistry();
    const todoManager = await this.registerBuiltinTools(toolRegistry, resolvedConfig, agentLoader);
    await this.registerCustomTools(toolRegistry, logger);

    // Initialize MCP if configured
    await this.initializeMCPServers(toolRegistry, resolvedConfig, logger);

    // Validate that all agents can access their requested tools
    await this.validateAgentTools(agentLoader, toolRegistry, logger);

    // Handle session recovery
    const recoveredMessages = await this.handleSessionRecovery(
      storage,
      sessionManager,
      resolvedConfig,
      logger,
      todoManager
    );

    // Create executor with session manager for automatic recovery
    const executor = new AgentExecutor(
      agentLoader,
      toolRegistry,
      resolvedConfig,
      resolvedConfig.model,
      logger,
      resolvedConfig.session.sessionId,
      sessionManager // Pass session manager for automatic recovery
    );

    // Session recovery is handled automatically by the executor.
    // If a session exists, the executor will load and continue from previous messages.
    if (recoveredMessages.length > 0) {
      logger.logSystemMessage(
        `Session ${resolvedConfig.session.sessionId} exists with ${recoveredMessages.length} messages. ` +
          'Executor will automatically continue from previous state.'
      );
    }

    // Build result
    return {
      config: resolvedConfig,
      executor,
      toolRegistry,
      agentLoader,
      mcpClients: this.mcpClients,
      sessionManager,
      storage,
      logger,
      eventLogger,
      cleanup: this.createCleanupFunction(),
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

    // Add console config if provided
    if (config.console !== undefined) {
      systemConfig.console = config.console;
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
        : { directories: [] }, // Empty directories - rely on built-in default agent
      tools: { builtin: ['read', 'write', 'list', 'grep', 'delegate', 'todowrite'] },
      caching: { enabled: true, maxCacheBlocks: 4, cacheTTLMinutes: 5 },
      storage: { type: 'filesystem' }, // Implies event logging
      console: true, // Enable console with normal verbosity
    });
  }

  /**
   * Factory method: Test configuration
   */
  static forTest(config: Partial<SystemConfig> = {}): AgentSystemBuilder {
    // Don't load agents from current directory in tests unless explicitly specified
    const testConfig = mergeConfigs(TEST_CONFIG_MINIMAL, config);
    if (!config.agents?.directories) {
      testConfig.agents = { ...testConfig.agents, directories: ['tests/unit/test-agents'] };
    }
    return new AgentSystemBuilder(testConfig);
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
