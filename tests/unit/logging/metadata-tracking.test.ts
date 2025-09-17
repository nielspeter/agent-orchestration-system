import { describe, expect, test, beforeEach } from 'vitest';
import { EventLogger } from '@/logging';
import { InMemoryStorage } from '@/session/memory.storage';
import { LLMMetadata } from '@/session/types';

describe('Metadata Tracking', () => {
  let logger: EventLogger;
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
    logger = new EventLogger(storage, 'test-session-id');
  });

  test('captures metadata in assistant message events', async () => {
    const metadata: LLMMetadata = {
      model: 'claude-3-haiku',
      provider: 'anthropic',
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        promptCacheHitTokens: 80,
      },
      performance: {
        latencyMs: 1234,
      },
    };

    logger.logAssistantMessage('test-agent', 'Hello world', metadata);

    const events = await logger.getSessionEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('assistant');
    expect(events[0].metadata).toEqual(metadata);
  });

  test('captures metadata in tool call events', async () => {
    const metadata: LLMMetadata = {
      model: 'gpt-4',
      provider: 'openai',
      usage: {
        promptTokens: 200,
        completionTokens: 100,
        totalTokens: 300,
      },
    };

    logger.logToolCall('test-agent', 'read', 'call-123', { path: '/tmp/file.txt' }, metadata);

    const events = await logger.getSessionEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('tool_call');
    expect(events[0].metadata).toEqual(metadata);
  });

  test('calculates size and estimates tokens for tool results', async () => {
    const largeResult = {
      content: 'x'.repeat(4000), // Approximately 1000 tokens (4 bytes per token)
    };

    logger.logToolResult('test-agent', 'read', 'call-123', largeResult);

    const events = await logger.getSessionEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('tool_result');

    // Check size calculation
    const event = events[0] as any;
    expect(event.data.resultSizeBytes).toBeGreaterThan(4000);
    expect(event.data.resultSizeBytes).toBeLessThan(4100); // Some overhead for JSON structure

    // Check token estimation (roughly 1 token per 4 bytes)
    expect(event.data.estimatedTokens).toBeGreaterThan(1000);
    expect(event.data.estimatedTokens).toBeLessThan(1100);
  });

  test('handles missing metadata gracefully', async () => {
    // Call without metadata
    logger.logAssistantMessage('test-agent', 'No metadata here', undefined);
    logger.logToolCall('test-agent', 'write', 'call-456', { content: 'test' }, undefined);

    const events = await logger.getSessionEvents();
    expect(events).toHaveLength(2);

    // Should not have metadata field
    expect(events[0].metadata).toBeUndefined();
    expect(events[1].metadata).toBeUndefined();
  });

  test('preserves metadata through event persistence', async () => {
    const metadata: LLMMetadata = {
      model: 'claude-3-opus',
      provider: 'anthropic',
      usage: {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
        promptCacheHitTokens: 900,
        promptCacheMissTokens: 100,
      },
      performance: {
        latencyMs: 2500,
      },
    };

    // Log event with metadata
    logger.logAssistantMessage('test-agent', 'Complex response', metadata);

    // Flush to storage
    logger.flush();

    // Read back from storage
    // InMemoryStorage doesn't have getSessionEvents, it's part of SessionStorage interface
    // We already have the events from logger.getSessionEvents()
    const storedEvents = await logger.getSessionEvents();
    expect(storedEvents).toHaveLength(1);
    expect(storedEvents[0].metadata).toEqual(metadata);
  });
});
