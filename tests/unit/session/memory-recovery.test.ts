import { describe, expect, it } from 'vitest';
import { AgentSystemBuilder } from '@/config/system-builder';
import { InMemoryStorage } from '@/session/memory.storage';

describe('Memory Storage Session Events', () => {
  it('should maintain session events in memory storage', async () => {
    const sessionId = `test-memory-session-${Date.now()}-${Math.random()}`;
    const storage = new InMemoryStorage();

    // Build system with memory storage
    const result = await AgentSystemBuilder.minimal()
      .withSessionId(sessionId)
      .withStorage(storage) // Use the storage instance we created
      .withConsole(false) // Silent for tests
      .build();

    // Clear any events that might have been created during build
    const buildEvents = await result.logger.getSessionEvents?.() || [];
    const eventCountAfterBuild = buildEvents.length;

    // The logger is now exposed and should be writing to memory storage
    result.logger.logUserMessage('Test message');
    result.logger.logAssistantMessage('test-agent', 'Response message');

    // Give async operations time to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Use the new getSessionEvents method
    const events = await result.logger.getSessionEvents?.();

    // Should have session events
    expect(events).toBeDefined();
    // We should have exactly 2 more events than after build
    expect(events!.length - eventCountAfterBuild).toBe(2);
    // Get only the new events we added
    const newEvents = events!.slice(eventCountAfterBuild);
    expect(newEvents[0]).toMatchObject({
      type: 'user',
      data: { content: 'Test message' },
    });
    expect(newEvents[1]).toMatchObject({
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
    const timestamp = Date.now();

    // Create first session
    const session1 = await AgentSystemBuilder.minimal()
      .withSessionId(`session-1-${timestamp}-${Math.random()}`)
      .withStorage(storage)
      .withConsole(false)
      .build();

    // Get baseline event count for session 1
    const session1BuildEvents = await session1.logger.getSessionEvents?.() || [];
    const session1EventCountAfterBuild = session1BuildEvents.length;

    session1.logger.logUserMessage('Session 1 message');

    // Create second session with same storage (e.g., GUI with multiple tabs)
    const session2 = await AgentSystemBuilder.minimal()
      .withSessionId(`session-2-${timestamp}-${Math.random()}`)
      .withStorage(storage)
      .withConsole(false)
      .build();

    // Get baseline event count for session 2
    const session2BuildEvents = await session2.logger.getSessionEvents?.() || [];
    const session2EventCountAfterBuild = session2BuildEvents.length;

    session2.logger.logUserMessage('Session 2 message');

    // Give async operations time to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Each logger can retrieve its own session events
    const events1 = await session1.logger.getSessionEvents?.();
    const events2 = await session2.logger.getSessionEvents?.();

    // Check we have exactly 1 new event for session 1
    expect(events1!.length - session1EventCountAfterBuild).toBe(1);
    const newEvents1 = events1!.slice(session1EventCountAfterBuild);
    expect(newEvents1[0]).toMatchObject({
      type: 'user',
      data: { content: 'Session 1 message' },
    });

    // Check we have exactly 1 new event for session 2
    expect(events2!.length - session2EventCountAfterBuild).toBe(1);
    const newEvents2 = events2!.slice(session2EventCountAfterBuild);
    expect(newEvents2[0]).toMatchObject({
      type: 'user',
      data: { content: 'Session 2 message' },
    });

    // Useful for monitoring active sessions
    expect(storage.getSessionCount()).toBe(2);
    // Check that both sessions exist (don't check exact IDs since they have timestamps)
    expect(storage.getSessionIds()).toHaveLength(2);

    await session1.cleanup();
    await session2.cleanup();
  });
});
