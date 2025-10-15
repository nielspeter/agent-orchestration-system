#!/usr/bin/env tsx
/**
 * Memory Patterns Example
 *
 * Demonstrates different memory/state sharing patterns available in our system
 * compared to other agent frameworks like LangChain, AutoGPT, or MemGPT.
 */

import * as dotenv from 'dotenv';
import { AgentSystemBuilder } from '@agent-system/core';
import type { Agent } from '@agent-system/core';

dotenv.config({ path: '../../.env' });

console.log('🧠 Agent Memory Patterns Comparison');
console.log('='.repeat(60));
console.log();

// Define test agents
const mathAgent: Agent = {
  name: 'math-agent',
  prompt: 'You are a math tutor. Remember what the user teaches you.',
  tools: [],
};

const scienceAgent: Agent = {
  name: 'science-agent',
  prompt: 'You are a science tutor. Apply what you learn.',
  tools: [],
};

/**
 * PATTERN 1: Complete Isolation (Pure Functional)
 * Each agent has its own executor with separate sessions.
 * No memory sharing whatsoever.
 *
 * Similar to: Stateless microservices, AWS Lambda functions
 */
async function completeIsolation() {
  console.log('📦 PATTERN 1: Complete Isolation');
  console.log('-'.repeat(50));
  console.log('Each agent in its own sandbox - no shared memory\n');

  // Each agent gets its own executor
  const { executor: mathExec, cleanup: cleanup1 } = await AgentSystemBuilder.minimal()
    .withAgents(mathAgent)
    .withSessionId('math-only-session')
    .withConsole(false)
    .build();

  const { executor: scienceExec, cleanup: cleanup2 } = await AgentSystemBuilder.minimal()
    .withAgents(scienceAgent)
    .withSessionId('science-only-session')
    .withConsole(false)
    .build();

  // Teach the math agent
  await mathExec.execute('math-agent', 'Remember this: The formula for circle area is πr²');

  // Science agent knows nothing about it
  const result = await scienceExec.execute('science-agent', 'What is the formula for circle area?');
  console.log('Science agent response:', result);
  console.log("→ Science agent has NO ACCESS to math agent's knowledge\n");

  await cleanup1();
  await cleanup2();
}

/**
 * PATTERN 2: Session-Based Sharing (Our Default)
 * Multiple agents share the same session/conversation history.
 * They see each other's interactions.
 *
 * Similar to: Slack threads, shared chat rooms
 */
async function sessionSharing() {
  console.log('💬 PATTERN 2: Session-Based Sharing');
  console.log('-'.repeat(50));
  console.log('Agents share conversation history through session\n');

  const { executor, cleanup } = await AgentSystemBuilder.minimal()
    .withAgents(mathAgent, scienceAgent)
    .withSessionId('shared-session')
    .withConsole(false)
    .build();

  // Math agent learns something
  const mathResponse = await executor.execute(
    'math-agent',
    'Remember this: The formula for circle area is πr²'
  );
  console.log('Math agent stored:', mathResponse);

  // Science agent can see it in the conversation
  const result = await executor.execute(
    'science-agent',
    'Look at the previous message in this conversation. What formula was mentioned about circle area?'
  );
  console.log('Science agent response:', result);
  console.log("→ Science agent CAN SEE math agent's conversation\n");

  await cleanup();
}

/**
 * PATTERN 3: Persistent Session Recovery (Cross-Execution Memory)
 * Using filesystem storage to persist sessions across executions.
 * Agents can "remember" from previous runs.
 *
 * Similar to: ChatGPT conversation history, Copilot workspace memory
 */
async function persistentMemory() {
  console.log('💾 PATTERN 3: Persistent Memory (Session Recovery)');
  console.log('-'.repeat(50));
  console.log('Using filesystem storage for memory across runs\n');

  const sessionId = 'persistent-memory-demo';

  // First execution - teach something
  console.log('First run - teaching...');
  const { executor: exec1, cleanup: cleanup1 } = await AgentSystemBuilder.minimal()
    .withAgents(mathAgent)
    .withSessionId(sessionId)
    .withStorage('filesystem') // Enable persistence
    .withConsole(false)
    .build();

  await exec1.execute('math-agent', 'Remember this important fact: E=mc²');
  await cleanup1();

  // Second execution - different instance, same session
  console.log('Second run - recalling...');
  const { executor: exec2, cleanup: cleanup2 } = await AgentSystemBuilder.minimal()
    .withAgents(mathAgent)
    .withSessionId(sessionId)
    .withStorage('filesystem') // Will recover previous session
    .withConsole(false)
    .build();

  const result = await exec2.execute('math-agent', 'What important fact did you learn earlier?');
  console.log('Agent response:', result);
  console.log('→ Agent REMEMBERS from previous execution!\n');

  await cleanup2();
}

/**
 * PATTERN 4: Orchestrated Shared Context
 * Agents communicate through delegation, passing context explicitly.
 * Parent-child relationship with controlled information flow.
 *
 * Similar to: Function calls with parameters, Actor model
 */
async function orchestratedContext() {
  console.log('🎭 PATTERN 4: Orchestrated Context Passing');
  console.log('-'.repeat(50));
  console.log('Agents pass context through delegation\n');

  const orchestrator: Agent = {
    name: 'orchestrator',
    prompt: `You are a teaching orchestrator. When you learn something, 
    you should delegate to appropriate specialist agents to provide deeper explanations.
    
    Available agents for delegation:
    - specialist: For scientific and technical explanations
    
    Use the Delegate tool to delegate work when appropriate.`,
    tools: ['delegate'],
  };

  const specialist: Agent = {
    name: 'specialist',
    prompt: `You are a science specialist. When asked to explain scientific phenomena,
    provide clear, detailed explanations based on scientific principles.`,
    tools: [],
  };

  // Use a unique session ID to avoid conflicts
  const sessionId = `orchestrated-${Date.now()}`;

  const { executor, cleanup } = await AgentSystemBuilder.default()
    .withAgents(orchestrator, specialist)
    .withSessionId(sessionId)
    .withConsole(true) // Enable console to see what's happening
    .build();

  const result = await executor.execute(
    'orchestrator',
    'I just learned that water boils at 100°C. Please have the specialist explain why this happens.'
  );

  console.log('Result:', result);
  console.log('→ Context passed explicitly through delegation\n');

  await cleanup();
}

/**
 * COMPARISON WITH OTHER SYSTEMS
 *
 * LangChain-style (Not available in our system):
 * - Each agent would have: memory.save(), memory.load()
 * - Vector stores for semantic memory
 * - Conversation buffers with summarization
 *
 * AutoGPT-style (Not available in our system):
 * - Persistent agent.json files
 * - Long-term memory in Pinecone/Weaviate
 * - Episodic memory with importance scoring
 *
 * What WE CAN DO with current system:
 */
async function simulateAgentMemory() {
  console.log('🔄 SIMULATING Agent-Attached Memory');
  console.log('-'.repeat(50));
  console.log('Using filesystem storage + agent namespacing\n');

  // Simulate private agent memory using agent-specific sessions
  const mathMemorySession = 'math-agent-private-memory';
  const scienceMemorySession = 'science-agent-private-memory';

  // Math agent with its "private memory"
  const { executor: mathExec, cleanup: cleanup1 } = await AgentSystemBuilder.minimal()
    .withAgents(mathAgent)
    .withSessionId(mathMemorySession)
    .withStorage('filesystem')
    .withConsole(false)
    .build();

  // Science agent with its "private memory"
  const { executor: scienceExec, cleanup: cleanup2 } = await AgentSystemBuilder.minimal()
    .withAgents(scienceAgent)
    .withSessionId(scienceMemorySession)
    .withStorage('filesystem')
    .withConsole(false)
    .build();

  // Each agent maintains its own knowledge base
  await mathExec.execute('math-agent', 'I specialize in: algebra, calculus, geometry');
  await scienceExec.execute('science-agent', 'I specialize in: physics, chemistry, biology');

  // Later, each recalls its own specialization
  const mathRecall = await mathExec.execute('math-agent', 'What do I specialize in?');
  const scienceRecall = await scienceExec.execute('science-agent', 'What do I specialize in?');

  console.log('Math agent recalls:', mathRecall);
  console.log('Science agent recalls:', scienceRecall);
  console.log('→ Each agent has PRIVATE persistent memory!\n');

  await cleanup1();
  await cleanup2();
}

// Run all patterns
async function main() {
  try {
    await completeIsolation();
    await sessionSharing();
    await persistentMemory();
    await orchestratedContext();
    await simulateAgentMemory();

    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`
Our System Supports:
✅ Complete isolation (separate executors)
✅ Session-based sharing (shared executor)
✅ Persistent sessions (filesystem storage)
✅ Orchestrated context (Task delegation)
✅ Simulated agent memory (agent-specific sessions)

Our System Lacks:
❌ Built-in vector memory (would need external DB)
❌ Memory summarization (no automatic compression)
❌ Importance-based retrieval (no scoring system)
❌ Semantic memory search (no embeddings)

Key Insight:
Our system is FLEXIBLE - you choose the memory pattern that fits
your use case by configuring executors and sessions appropriately.
`);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
