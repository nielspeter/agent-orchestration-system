/**
 * Agent Orchestration System - TypeScript Architecture
 * 
 * Core principle: Everything is an agent, orchestration emerges from tool access
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Agent definition loaded from markdown files
 */
interface AgentDefinition {
  name: string;                    // Unique agent identifier
  description: string;              // System prompt for the agent
  tools: string[] | "*";           // Tool names or "*" for all tools
  model?: string;                   // Optional model override
}

/**
 * Tool definition - the extension point of the system
 */
interface Tool {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  execute: (args: any) => Promise<ToolResult>;
}

/**
 * Result from tool execution
 */
interface ToolResult {
  content: any;
  error?: string;
}

/**
 * OpenAI-style message format
 */
interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

/**
 * OpenAI-style tool call
 */
interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;  // JSON string
  };
}

/**
 * LLM provider interface
 */
interface LLMProvider {
  complete(messages: Message[], tools?: Tool[]): Promise<Message>;
}

// ============================================================================
// Core System Components
// ============================================================================

/**
 * Agent loader - parses markdown files with frontmatter
 */
interface AgentLoader {
  loadAgent(name: string): Promise<AgentDefinition>;
  listAgents(): Promise<string[]>;
  getAgentPath(name: string): string;
}

/**
 * Tool registry - manages available tools
 */
interface ToolRegistry {
  register(tool: Tool): void;
  get(name: string): Tool | undefined;
  list(): Tool[];
  filterForAgent(agent: AgentDefinition): Tool[];
}

/**
 * Agent executor - the core execution loop
 */
interface AgentExecutor {
  execute(agentName: string, prompt: string): Promise<string>;
}

// ============================================================================
// Implementation Interfaces
// ============================================================================

/**
 * Configuration for the system
 */
interface SystemConfig {
  agentsDir: string;              // Directory containing agent .md files
  defaultModel: string;           // Default LLM model to use
  maxRecursionDepth: number;      // Safety limit for delegation chains
  timeout?: number;               // Optional timeout per agent execution
}

/**
 * Execution context passed through recursive calls
 */
interface ExecutionContext {
  depth: number;                  // Current recursion depth
  parentAgent?: string;           // Name of delegating agent
  startTime: number;              // Execution start timestamp
}

/**
 * The special Task tool that enables delegation
 */
interface TaskTool extends Tool {
  name: "Task";
  parameters: {
    type: "object";
    properties: {
      subagent_type: { type: "string"; description: "Name of agent to delegate to" };
      prompt: { type: "string"; description: "Task for the agent to perform" };
      description?: { type: "string"; description: "Short task description" };
    };
    required: ["subagent_type", "prompt"];
  };
}

// ============================================================================
// System Architecture Flow
// ============================================================================

/**
 * Main system class that ties everything together
 */
interface AgentOrchestrationSystem {
  // Core components
  agentLoader: AgentLoader;
  toolRegistry: ToolRegistry;
  llmProvider: LLMProvider;
  executor: AgentExecutor;
  
  // System operations
  initialize(config: SystemConfig): Promise<void>;
  execute(agentName: string, prompt: string): Promise<string>;
  registerTool(tool: Tool): void;
  
  // The special Task tool is registered like any other tool
  registerTaskTool(): void;
}

// ============================================================================
// Execution Flow Pseudocode (for documentation)
// ============================================================================

/**
 * Core execution loop (conceptual - not actual implementation)
 * 
 * async function executeAgent(agentName: string, prompt: string, context: ExecutionContext): Promise<string> {
 *   // 1. Load agent definition
 *   const agent = await agentLoader.loadAgent(agentName);
 *   
 *   // 2. Get available tools for this agent
 *   const tools = toolRegistry.filterForAgent(agent);
 *   
 *   // 3. Initialize conversation
 *   const messages: Message[] = [
 *     { role: "system", content: agent.description },
 *     { role: "user", content: prompt }
 *   ];
 *   
 *   // 4. Execution loop
 *   while (true) {
 *     // Call LLM with messages and tools
 *     const response = await llmProvider.complete(messages, tools);
 *     
 *     // Check for tool calls
 *     if (response.tool_calls) {
 *       // Execute each tool call
 *       for (const call of response.tool_calls) {
 *         const tool = toolRegistry.get(call.function.name);
 *         const args = JSON.parse(call.function.arguments);
 *         
 *         // Special handling for Task tool (recursive call)
 *         let result: ToolResult;
 *         if (tool.name === "Task") {
 *           const subAgentResult = await executeAgent(
 *             args.subagent_type, 
 *             args.prompt,
 *             { ...context, depth: context.depth + 1 }
 *           );
 *           result = { content: subAgentResult };
 *         } else {
 *           result = await tool.execute(args);
 *         }
 *         
 *         // Add tool result to conversation
 *         messages.push(response);  // Assistant's tool request
 *         messages.push({            // Tool result
 *           role: "tool",
 *           tool_call_id: call.id,
 *           content: JSON.stringify(result)
 *         });
 *       }
 *       
 *       // Continue loop to let agent process tool results
 *       continue;
 *     }
 *     
 *     // No tool calls - agent is done
 *     return response.content;
 *   }
 * }
 */

// ============================================================================
// Agent Examples (for documentation)
// ============================================================================

/**
 * Example orchestrator agent definition:
 * 
 * ---
 * name: orchestrator
 * tools: ["*"]
 * ---
 * 
 * You are the main orchestrator. Analyze tasks and decide whether to:
 * 1. Handle them directly using available tools
 * 2. Delegate to specialist agents using the Task tool
 * 
 * Available specialists:
 * - code-analyzer: For code analysis and debugging
 * - test-writer: For writing tests
 * - documenter: For creating documentation
 */

/**
 * Example specialist agent definition:
 * 
 * ---
 * name: code-analyzer
 * tools: ["read", "search", "analyze"]
 * ---
 * 
 * You are a code analysis specialist. You examine code for:
 * - Bugs and potential issues
 * - Performance problems
 * - Security vulnerabilities
 * - Code quality concerns
 * 
 * Provide detailed analysis with specific line numbers and suggestions.
 */

// ============================================================================
// Key Architectural Properties
// ============================================================================

/**
 * 1. UNIFORMITY
 *    - All agents use the same execution loop
 *    - No special orchestrator class or logic
 *    - Consistent interface for all components
 * 
 * 2. COMPOSABILITY
 *    - Any agent can orchestrate if given Task tool
 *    - Agents can be composed into hierarchies
 *    - New capabilities through new agents/tools
 * 
 * 3. RECURSION
 *    - Task tool recursively calls executeAgent
 *    - Natural hierarchy emerges from recursive calls
 *    - Clean stack-based execution model
 * 
 * 4. TOOL-BASED EXTENSION
 *    - All capabilities exposed as tools
 *    - Delegation is just another tool
 *    - Easy to add new tools without changing core
 * 
 * 5. LLM-NATIVE
 *    - Uses native function calling
 *    - No text parsing or custom protocols
 *    - Clean separation of reasoning and mechanics
 */

// ============================================================================
// Implementation Notes
// ============================================================================

/**
 * File Structure:
 * 
 * poc-typescript/
 * ├── src/
 * │   ├── core/
 * │   │   ├── agent-executor.ts    // Main execution loop
 * │   │   ├── agent-loader.ts      // Markdown/frontmatter parser
 * │   │   └── tool-registry.ts     // Tool management
 * │   ├── tools/
 * │   │   ├── task-tool.ts         // The special delegation tool
 * │   │   ├── file-tools.ts        // read, write, search
 * │   │   └── index.ts             // Tool exports
 * │   ├── llm/
 * │   │   ├── openai-provider.ts   // OpenAI implementation
 * │   │   └── provider.ts          // LLM interface
 * │   └── index.ts                 // Main entry point
 * ├── agents/
 * │   ├── orchestrator.md
 * │   ├── code-analyzer.md
 * │   └── test-writer.md
 * ├── tests/
 * │   └── ...
 * └── package.json
 */

export type {
  AgentDefinition,
  Tool,
  ToolResult,
  Message,
  ToolCall,
  LLMProvider,
  AgentLoader,
  ToolRegistry,
  AgentExecutor,
  SystemConfig,
  ExecutionContext,
  TaskTool,
  AgentOrchestrationSystem
};