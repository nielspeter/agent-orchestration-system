import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ToolRegistry } from '../core/tool-registry';
import { ToolSchema, ToolResult } from '../types';
import { AgentLoader } from '../core/agent-loader';
import { AgentExecutor } from '../core/agent-executor';
import { LoggerFactory } from '../core/conversation-logger';
import { 
  createReadTool, 
  createWriteTool, 
  createListTool 
} from '../tools/file-tools';
import { createTaskTool } from '../tools/task-tool';
import { createTodoWriteTool } from '../tools/todowrite-tool';
import { TodoManager } from '../core/todo-manager';

/**
 * MCP-compatible configuration structure
 */
export interface MCPConfig {
  mcpServers?: {
    [serverName: string]: {
      command: string;
      args: string[];
      env?: Record<string, string>;
      description?: string;
    };
  };
  builtinTools?: {
    enabled: boolean;
    tools: string[];
  };
  agents?: {
    directory: string;
    additionalDirectories?: string[];
  };
  execution?: {
    defaultModel?: string;
    maxDepth?: number;
    maxIterations?: number;
    timeout?: number;
  };
}

/**
 * Extended MCP Client wrapper
 */
interface MCPClientWrapper {
  client: Client;
  transport: StdioClientTransport;
  serverName: string;
}

/**
 * Create an MCP client using the SDK
 */
async function createMCPClient(
  serverName: string,
  config: { command: string; args: string[]; env?: Record<string, string>; description?: string }
): Promise<MCPClientWrapper> {
  // Expand environment variables
  const env: Record<string, string> = {};
  // Copy process.env, filtering out undefined values
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }
  
  if (config.env) {
    for (const [key, value] of Object.entries(config.env)) {
      if (value.startsWith('${') && value.endsWith('}')) {
        const envVar = value.slice(2, -1);
        const envValue = process.env[envVar];
        if (envValue !== undefined) {
          env[key] = envValue;
        }
      } else {
        env[key] = value;
      }
    }
  }

  // Create transport and client
  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args,
    env
  });
  
  const client = new Client(
    {
      name: `poc-typescript-${serverName}`,
      version: '1.0.0'
    },
    {
      capabilities: {}
    }
  );

  // Connect the client
  await client.connect(transport);

  return {
    client,
    transport,
    serverName
  };
}

/**
 * Load builtin tools based on configuration
 */
async function loadBuiltinTools(
  registry: ToolRegistry, 
  config: MCPConfig['builtinTools'],
  agentLoader: AgentLoader
): Promise<void> {
  if (!config?.enabled) return;
  
  const toolMap: Record<string, () => any> = {
    'read': createReadTool,
    'write': createWriteTool,
    'list': createListTool,
    'task': async () => createTaskTool(agentLoader),
    'todowrite': () => {
      const todoManager = new TodoManager();
      return createTodoWriteTool(todoManager);
    }
  };
  
  for (const toolName of config.tools || []) {
    const creator = toolMap[toolName];
    if (creator) {
      const tool = await creator();
      registry.register(tool);
      console.log(`✅ Loaded builtin tool: ${toolName}`);
    } else {
      console.warn(`⚠️ Unknown builtin tool: ${toolName}`);
    }
  }
}

/**
 * Load MCP servers and their tools
 */
async function loadMCPServers(
  registry: ToolRegistry,
  servers: MCPConfig['mcpServers']
): Promise<MCPClientWrapper[]> {
  const clients: MCPClientWrapper[] = [];
  
  if (!servers) return clients;
  
  for (const [serverName, serverConfig] of Object.entries(servers)) {
    try {
      console.log(`🔌 Connecting to MCP server: ${serverName}`);
      
      const clientWrapper = await createMCPClient(serverName, serverConfig);
      
      // List available tools
      const toolsResponse = await clientWrapper.client.listTools();
      const tools = toolsResponse.tools || [];
      
      console.log(`  Found ${tools.length} tools from ${serverName}`);
      
      for (const mcpTool of tools) {
        // Create adapter for MCP tool
        // Convert MCP tool schema to our ToolSchema format
        const inputSchema = mcpTool.inputSchema as any || {};
        const toolSchema: ToolSchema = {
          type: 'object',
          properties: inputSchema.properties || {},
          required: inputSchema.required
        };
        
        // Replace periods with underscores in tool names for Anthropic API compatibility
        const toolName = `${serverName}_${mcpTool.name}`.replace(/\./g, '_');
        
        registry.register({
          name: toolName,
          description: mcpTool.description || '',
          parameters: toolSchema,
          execute: async (params: Record<string, unknown>): Promise<ToolResult> => {
            const result = await clientWrapper.client.callTool({
              name: mcpTool.name,
              arguments: params
            });
            return { content: result.content };
          },
          isConcurrencySafe: () => true
        });
        console.log(`    - ${toolName} (${serverName}.${mcpTool.name})`);
      }
      
      clients.push(clientWrapper);
    } catch (error) {
      console.error(`❌ Failed to load MCP server ${serverName}:`, error);
    }
  }
  
  return clients;
}

/**
 * Setup options
 */
export interface SetupOptions {
  configPath?: string;
  configOverrides?: Partial<MCPConfig>;
  sessionId?: string;
}

/**
 * Setup result with all components
 */
export interface SetupResult {
  executor: AgentExecutor;
  agentLoader: AgentLoader;
  toolRegistry: ToolRegistry;
  mcpClients: MCPClientWrapper[];
  config: MCPConfig;
  cleanup: () => Promise<void>;
}

/**
 * Load configuration from JSON file
 */
async function loadConfig(configPath: string): Promise<MCPConfig> {
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`Could not load config from ${configPath}, using defaults`);
    return {
      builtinTools: {
        enabled: true,
        tools: ['read', 'write', 'list', 'task']
      },
      agents: {
        directory: './agents'
      }
    };
  }
}

/**
 * Main setup function that loads configuration and initializes everything
 */
export async function setupFromConfig(options?: SetupOptions): Promise<SetupResult> {
  // Load configuration
  const configPath = options?.configPath || './agent-config.json';
  const fileConfig = await loadConfig(configPath);
  const config = { ...fileConfig, ...options?.configOverrides };
  
  console.log('🚀 Setting up from configuration...\n');
  
  // Initialize core components
  const agentLoader = new AgentLoader(
    config.agents?.directory || './agents'
  );
  
  // Load additional agent directories
  if (config.agents?.additionalDirectories) {
    for (const dir of config.agents.additionalDirectories) {
      // AgentLoader would need to support multiple directories
      console.log(`  Would load agents from: ${dir}`);
    }
  }
  
  const toolRegistry = new ToolRegistry();
  const logger = LoggerFactory.createCombinedLogger(options?.sessionId);
  
  // Load builtin tools
  await loadBuiltinTools(toolRegistry, config.builtinTools, agentLoader);
  
  // Load MCP servers
  const mcpClients = await loadMCPServers(toolRegistry, config.mcpServers);
  
  // Create executor
  const modelName = config.execution?.defaultModel || 'claude-3-5-haiku-20241022';
  const executor = new AgentExecutor(
    agentLoader,
    toolRegistry,
    modelName,
    logger,
    options?.sessionId
  );
  
  console.log('\n✅ Setup complete!');
  console.log(`  Model: ${modelName}`);
  console.log(`  Agents directory: ${config.agents?.directory}`);
  console.log(`  Builtin tools: ${config.builtinTools?.tools?.join(', ')}`);
  console.log(`  MCP servers: ${Object.keys(config.mcpServers || {}).join(', ')}`);
  
  return {
    executor,
    agentLoader,
    toolRegistry,
    mcpClients,
    config,
    cleanup: async () => {
      // Disconnect all MCP clients
      for (const clientWrapper of mcpClients) {
        await clientWrapper.client.close();
        await clientWrapper.transport.close();
      }
    }
  };
}

/**
 * Helper for examples that want simple defaults
 */
export async function quickSetup(options?: {
  mcpServers?: string[];
  additionalTools?: string[];
}): Promise<SetupResult> {
  const config: Partial<MCPConfig> = {
    builtinTools: {
      enabled: true,
      tools: ['read', 'write', 'list', 'task', ...(options?.additionalTools || [])]
    }
  };
  
  // Add requested MCP servers from default config
  if (options?.mcpServers) {
    const defaultConfig = await loadConfig('./agent-config.json');
    config.mcpServers = {};
    for (const serverName of options.mcpServers) {
      if (defaultConfig.mcpServers?.[serverName]) {
        config.mcpServers[serverName] = defaultConfig.mcpServers[serverName];
      }
    }
  }
  
  return setupFromConfig({ configOverrides: config });
}