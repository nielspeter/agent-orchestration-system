import { describe, expect, it } from 'vitest';
import { AgentSystemBuilder } from '@/config/system-builder';
import { InMemoryStorage } from '@/session/memory.storage';

describe('Memory Storage Session Events', () => {
  it('should maintain session events in memory storage', async () => {
    const sessionId = 'test-memory-session';
    const storage = new InMemoryStorage();

    // Build system with memory storage
    const result = await AgentSystemBuilder.minimal()
      .withSessionId(sessionId)
      .withStorage(storage) // Use the storage instance we created
      .withConsole(false) // Silent for tests
      .build();

    // The logger is now exposed and should be writing to memory storage
    result.logger.logUserMessage('Test message');
    result.logger.logAssistantMessage('test-agent', 'Response message');

    // Give async operations time to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Use the new getSessionEvents method
    const events = await result.logger.getSessionEvents?.();

    // Should have session events
    expect(events).toBeDefined();
    expect(events).toHaveLength(2);
    expect(events![0]).toMatchObject({
      type: 'user',
      data: { content: 'Test message' },
    });
    expect(events![1]).toMatchObject({
      type: 'assistant',
      data: { content: 'Response message' },
    });

    // Can also verify through storage directly for monitoring purposes
    expect(storage.getSessionIds()).toContain(sessionId);
    expect(storage.getSessionCount()).toBe(1);

    await result.cleanup();
  });

  it('should track multiple concurrent sessions for monitoring', async () => {
    const storage = new InMemoryStorage();

    // Create first session
    const session1 = await AgentSystemBuilder.minimal()
      .withSessionId('session-1')
      .withStorage(storage)
      .withConsole(false)
      .build();

    session1.logger.logUserMessage('Session 1 message');

    // Create second session with same storage (e.g., GUI with multiple tabs)
    const session2 = await AgentSystemBuilder.minimal()
      .withSessionId('session-2')
      .withStorage(storage)
      .withConsole(false)
      .build();

    session2.logger.logUserMessage('Session 2 message');

    // Give async operations time to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Each logger can retrieve its own session events
    const events1 = await session1.logger.getSessionEvents?.();
    const events2 = await session2.logger.getSessionEvents?.();

    expect(events1).toHaveLength(1);
    expect(events1![0]).toMatchObject({
      type: 'user',
      data: { content: 'Session 1 message' },
    });

    expect(events2).toHaveLength(1);
    expect(events2![0]).toMatchObject({
      type: 'user',
      data: { content: 'Session 2 message' },
    });

    // Useful for monitoring active sessions
    expect(storage.getSessionCount()).toBe(2);
    expect(storage.getSessionIds()).toEqual(['session-1', 'session-2']);

    await session1.cleanup();
    await session2.cleanup();
  });
});
