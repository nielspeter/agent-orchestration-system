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

    const result = await firstSystem.executor.execute(
      'default',
      'Say "Hello World"'
    );

    expect(result).toContain('Hello World');

    // After execution, session should exist
    const sessionExistsAfter = await firstSystem.storage.sessionExists(sessionId);
    expect(sessionExistsAfter).toBe(true);
  }, 10000);

  test('should preserve conversation context across restarts', async () => {
    // First system - have a conversation
    firstSystem = await AgentSystemBuilder.default()
      .withModel(process.env.MODEL || 'anthropic/claude-3-5-haiku-latest')
      .withStorage(new FilesystemStorage(storagePath))
      .withSessionId(sessionId)
      .withConsole(false)
      .build();

    await firstSystem.executor.execute(
      'default',
      'My favorite color is blue. Remember this.'
    );

    await firstSystem.executor.execute(
      'default',
      'My favorite number is 7. Remember this too.'
    );

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
      'What are my favorite color and number?'
    );

    expect(result.toLowerCase()).toContain('blue');
    expect(result).toContain('7');
  }, 30000);

  // TODO: Add test for incomplete tool calls once the bug is fixed
  test.skip('should handle incomplete tool calls gracefully', async () => {
    // This test is skipped until we fix the incomplete tool call bug
    // documented in docs/known-issues.md
    
    // The test would:
    // 1. Create a session with a tool call
    // 2. Interrupt before tool result is logged
    // 3. Attempt to continue the session
    // 4. Verify it either completes the tool call or handles it gracefully
  });
});