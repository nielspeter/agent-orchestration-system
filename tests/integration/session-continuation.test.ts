import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { AgentSystemBuilder, BuildResult } from '@/config/system-builder';
import { FilesystemStorage } from '@/session/filesystem.storage';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Session Continuation Integration Tests', () => {
  const sessionId = 'test-session-continuation';
  const storagePath = path.join(__dirname, '.test-sessions');
  let firstSystem: BuildResult;
  let secondSystem: BuildResult;

  beforeEach(async () => {
    // Clean up any existing test session
    try {
      await fs.rm(path.join(storagePath, sessionId), { recursive: true });
    } catch {
      // Ignore if doesn't exist
    }
  });

  afterEach(async () => {
    // Clean up systems
    if (firstSystem?.cleanup) {
      await firstSystem.cleanup();
    }
    if (secondSystem?.cleanup) {
      await secondSystem.cleanup();
    }

    // Clean up test sessions
    try {
      await fs.rm(storagePath, { recursive: true });
    } catch {
      // Ignore if doesn't exist
    }
  });

  test('should continue session after restart', async () => {
    // First execution - create a session
    firstSystem = await AgentSystemBuilder.default()
      .withModel(process.env.MODEL || 'anthropic/claude-3-5-haiku-latest')
      .withStorage(new FilesystemStorage(storagePath))
      .withSessionId(sessionId)
      .withConsole(false) // Disable console output for tests
      .build();

    const firstResult = await firstSystem.executor.execute(
      'default',
      'Remember this number: 42. Reply with "Number stored"'
    );

    expect(firstResult).toContain('stored');

    // Clean up first system
    await firstSystem.cleanup();

    // Second execution - continue the session
    secondSystem = await AgentSystemBuilder.default()
      .withModel(process.env.MODEL || 'anthropic/claude-3-5-haiku-latest')
      .withStorage(new FilesystemStorage(storagePath))
      .withSessionId(sessionId)
      .withConsole(false)
      .build();

    // Verify session exists
    const sessionExists = await secondSystem.storage.sessionExists(sessionId);
    expect(sessionExists).toBe(true);

    const secondResult = await secondSystem.executor.execute(
      'default',
      'What number did I ask you to remember?'
    );

    expect(secondResult).toContain('42');
  }, 20000);

  test('should handle new session when no previous exists', async () => {
    firstSystem = await AgentSystemBuilder.default()
      .withModel(process.env.MODEL || 'anthropic/claude-3-5-haiku-latest')
      .withStorage(new FilesystemStorage(storagePath))
      .withSessionId(sessionId)
      .withConsole(false)
      .build();

    // Verify session doesn't exist initially
    const sessionExists = await firstSystem.storage.sessionExists(sessionId);
    expect(sessionExists).toBe(false);

    const result = await firstSystem.executor.execute('default', 'Say "Hello World"');

    expect(result).toContain('Hello World');

    // After execution, session should exist
    const sessionExistsAfter = await firstSystem.storage.sessionExists(sessionId);
    expect(sessionExistsAfter).toBe(true);
  }, 10000);

  test('should preserve conversation context across restarts', async () => {
    // First system - have a conversation in a single session
    firstSystem = await AgentSystemBuilder.default()
      .withModel(process.env.MODEL || 'anthropic/claude-3-5-haiku-latest')
      .withStorage(new FilesystemStorage(storagePath))
      .withSessionId(sessionId)
      .withConsole(false)
      .build();

    // Have a conversation that doesn't trigger tool calls
    const firstResult = await firstSystem.executor.execute(
      'default',
      'My favorite color is blue and my favorite number is 7. Acknowledge this by saying "Noted: blue and 7"'
    );

    expect(firstResult.toLowerCase()).toContain('blue');
    expect(firstResult).toContain('7');

    // Clean up first system
    await firstSystem.cleanup();

    // Second system - verify context is preserved
    secondSystem = await AgentSystemBuilder.default()
      .withModel(process.env.MODEL || 'anthropic/claude-3-5-haiku-latest')
      .withStorage(new FilesystemStorage(storagePath))
      .withSessionId(sessionId)
      .withConsole(false)
      .build();

    const result = await secondSystem.executor.execute(
      'default',
      'What are my favorite color and number that I told you earlier?'
    );

    expect(result.toLowerCase()).toContain('blue');
    expect(result).toContain('7');
  }, 30000);

  test('should recognize completed work when resuming', async () => {
    // First system - complete a task fully
    firstSystem = await AgentSystemBuilder.default()
      .withModel(process.env.MODEL || 'anthropic/claude-3-5-haiku-latest')
      .withStorage(new FilesystemStorage(storagePath))
      .withSessionId(sessionId)
      .withConsole(false)
      .build();

    // Execute a simple task that completes
    const firstResult = await firstSystem.executor.execute(
      'default',
      'Tell me what 2 + 2 equals. Just give the answer.'
    );

    expect(firstResult).toContain('4');

    // Clean up first system
    await firstSystem.cleanup();

    // Second system - resume the same session
    secondSystem = await AgentSystemBuilder.default()
      .withModel(process.env.MODEL || 'anthropic/claude-3-5-haiku-latest')
      .withStorage(new FilesystemStorage(storagePath))
      .withSessionId(sessionId)
      .withConsole(false)
      .build();

    // Try to continue - it should recognize the task was already completed
    const secondResult = await secondSystem.executor.execute(
      'default',
      'Continue with the calculation'
    );

    // Should either continue from where we left off or indicate completion
    expect(secondResult).toBeDefined();
    expect(secondResult.toLowerCase()).toMatch(/4|already|complete|answered|calculated/);
  }, 20000);
});
