/**
 * Example: Session Continuation
 *
 * Demonstrates how to continue a conversation after a crash or exit
 * by using recovered messages from a previous session.
 */

import * as dotenv from 'dotenv';
import { AgentSystemBuilder } from '@/config';
import { FilesystemStorage } from '@/session/filesystem.storage';

// Load environment variables
dotenv.config();

async function main() {
  const sessionId = 'demo-session-123';

  // Build system with filesystem storage for persistence
  const system = await AgentSystemBuilder.default()
    .withStorage(new FilesystemStorage('.agent-sessions'))
    .withSessionId(sessionId)
    .build();

  const { executor, storage, cleanup } = system;

  try {
    // Check if this is a continuation or new session
    const sessionExists = await storage.sessionExists(sessionId);

    if (sessionExists) {
      console.log(`\n📂 Continuing existing session ${sessionId}\n`);
      console.log('The executor will automatically load and continue from previous messages.\n');
    } else {
      console.log(`\n🆕 Starting new session ${sessionId}\n`);
    }

    // Execute - session recovery happens automatically inside executor
    const result = await executor.execute(
      'default',
      sessionExists
        ? 'Continue from where we left off'
        : 'Analyze the project structure and tell me about the main components'
    );

    console.log('Result:', result);
  } finally {
    await cleanup();
  }
}

// Run the example
main().catch(console.error);
