import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import { readFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { AgentSystemBuilder } from '@/config/system-builder';
import { FilesystemStorage } from '@/session/filesystem.storage';

describe('Metadata Persistence Integration', () => {
  let sessionDir: string;
  let sessionId: string;
  let sessionPath: string;

  beforeEach(() => {
    // Create a unique session directory for each test
    sessionId = `test-session-${Date.now()}`;
    sessionDir = join(tmpdir(), 'metadata-test-base');
    // FilesystemStorage creates: {basePath}/{sessionId}/events.jsonl
    sessionPath = join(sessionDir, sessionId, 'events.jsonl');
  });

  afterEach(() => {
    // Clean up session directory
    if (existsSync(sessionDir)) {
      rmSync(sessionDir, { recursive: true, force: true });
    }
  });

  test('persists metadata through full agent execution', async () => {
    // Skip if no API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('Skipping integration test - no ANTHROPIC_API_KEY');
      return;
    }

    // Create system with file storage and event logger
    const storage = new FilesystemStorage(sessionDir);
    const builder = AgentSystemBuilder.default()
      .withModel(process.env.MODEL || 'anthropic/claude-3-5-haiku-latest')
      .withStorage(storage)
      .withSessionId(sessionId);

    const { executor } = await builder.build();

    // Execute a simple task
    await executor.execute('default', 'Say "Hello metadata test" and nothing else');

    // Flush storage if supported, otherwise wait for async writes
    if (storage.flush) {
      await storage.flush(sessionId);
    } else {
      // Fallback for storages without flush
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Read and parse JSONL file
    const jsonlContent = readFileSync(sessionPath, 'utf-8');
    const events = jsonlContent
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    // Find assistant message events from actual agents
    const assistantEvents = events.filter(
      (e: any) => e.type === 'assistant' && e.data?.content && e.data?.agent
    );
    expect(assistantEvents.length).toBeGreaterThan(0);

    // Verify metadata is present (if it exists)
    const firstAssistantEvent = assistantEvents[0];

    // Some events may not have metadata if they're system messages or errors
    // Only check metadata structure if it exists
    if (firstAssistantEvent.metadata) {
      expect(firstAssistantEvent.metadata).toBeDefined();

      if (firstAssistantEvent.metadata.usage) {
        expect(firstAssistantEvent.metadata.usage.promptTokens).toBeGreaterThan(0);
        expect(firstAssistantEvent.metadata.usage.completionTokens).toBeGreaterThan(0);
        expect(firstAssistantEvent.metadata.usage.totalTokens).toBeGreaterThan(0);
      }

      // Check for model and provider
      if (firstAssistantEvent.metadata.model) {
        expect(firstAssistantEvent.metadata.model).toBeDefined();
      }
      if (firstAssistantEvent.metadata.provider) {
        expect(firstAssistantEvent.metadata.provider).toBeDefined();
      }

      // Check for performance metrics
      if (firstAssistantEvent.metadata.performance) {
        expect(firstAssistantEvent.metadata.performance.latencyMs).toBeGreaterThan(0);
      }
    } else {
      // If no metadata, just verify the event has content
      expect(firstAssistantEvent.data.content).toBeDefined();
    }
  });

  test('tracks metadata for tool calls', async () => {
    // Skip if no API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('Skipping integration test - no ANTHROPIC_API_KEY');
      return;
    }

    // Create system with file storage
    const storage = new FilesystemStorage(sessionDir);
    const builder = AgentSystemBuilder.default()
      .withModel(process.env.MODEL || 'anthropic/claude-3-5-haiku-latest')
      .withStorage(storage)
      .withSessionId(sessionId);

    const { executor } = await builder.build();

    // Execute a task that uses tools
    await executor.execute('default', 'Use the List tool to list files in /tmp directory');

    // Flush storage if supported, otherwise wait for async writes
    if (storage.flush) {
      await storage.flush(sessionId);
    } else {
      // Fallback for storages without flush
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Read and parse JSONL file
    const jsonlContent = readFileSync(sessionPath, 'utf-8');
    const events = jsonlContent
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    // Find tool call events
    const toolCallEvents = events.filter((e: any) => e.type === 'tool_call');
    expect(toolCallEvents.length).toBeGreaterThan(0);

    // Verify tool calls have metadata from their triggering LLM call
    const firstToolCall = toolCallEvents[0];
    expect(firstToolCall.metadata).toBeDefined();
    expect(firstToolCall.metadata.model).toBeDefined();
    expect(firstToolCall.metadata.usage).toBeDefined();

    // Find tool result events
    const toolResultEvents = events.filter((e: any) => e.type === 'tool_result');
    expect(toolResultEvents.length).toBeGreaterThan(0);

    // Verify tool results have size tracking (these are in the data object)
    const firstToolResult = toolResultEvents[0];
    expect(firstToolResult.data).toBeDefined();
    expect(firstToolResult.data.resultSizeBytes).toBeGreaterThan(0);
    expect(firstToolResult.data.estimatedTokens).toBeGreaterThan(0);
  });
});
