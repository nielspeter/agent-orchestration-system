import { beforeEach, describe, expect, it } from 'vitest';
import { TodoManager } from '@/todos/manager';
import { SimpleSessionManager } from '@/session/manager';
import { InMemoryStorage } from '@/session/memory.storage';
import { EventLogger } from '@/logging/event.logger';
import { TodoItem } from '@/tools/todowrite.tool';
import { ToolCallEvent } from '@/session/types';

describe('Todo Persistence', () => {
  describe('TodoManager - Stateless', () => {
    let todoManager: TodoManager;

    beforeEach(() => {
      todoManager = new TodoManager();
      todoManager.initialize();
    });

    it('should be stateless with no filesystem operations', () => {
      // TodoManager should not have any filesystem-related properties
      expect(todoManager).not.toHaveProperty('todosDir');
      expect(todoManager).not.toHaveProperty('todosFile');

      // Initialize should not be async (no filesystem setup)
      const result = todoManager.initialize();
      expect(result).toBeUndefined(); // Not a promise
    });

    it('should validate only one in-progress task', () => {
      const todos: TodoItem[] = [
        {
          content: 'Task 1',
          status: 'in_progress',
          priority: 'medium',
          id: '1',
          activeForm: 'Working on Task 1',
        },
        {
          content: 'Task 2',
          status: 'in_progress',
          priority: 'medium',
          id: '2',
          activeForm: 'Working on Task 2',
        },
      ];

      expect(() => todoManager.updateTodos(todos)).toThrow(
        'Only one task can be in progress at a time'
      );
    });

    it('should validate no duplicate content', () => {
      const todos: TodoItem[] = [
        {
          content: 'Same Task',
          status: 'pending',
          priority: 'medium',
          id: '1',
          activeForm: 'Working on Same Task',
        },
        {
          content: 'Same Task',
          status: 'pending',
          priority: 'low',
          id: '2',
          activeForm: 'Working on Same Task',
        },
      ];

      expect(() => todoManager.updateTodos(todos)).toThrow('Duplicate tasks found');
    });

    it('should generate IDs for todos without them', () => {
      const todos: TodoItem[] = [
        {
          content: 'Task without ID',
          status: 'pending',
          priority: 'medium',
          id: '',
          activeForm: 'Working on task',
        },
      ];

      todoManager.updateTodos(todos);
      const stored = todoManager.getTodos();

      expect(stored[0].id).toBeTruthy();
      expect(stored[0].id.length).toBeGreaterThan(0);
    });

    it('should set and get todos correctly', () => {
      const todos: TodoItem[] = [
        {
          content: 'Test Task',
          status: 'pending',
          priority: 'high',
          id: 'test-123',
          activeForm: 'Testing task',
        },
      ];

      todoManager.setTodos(todos);
      const retrieved = todoManager.getTodos();

      expect(retrieved).toEqual(todos);
    });
  });

  describe('SimpleSessionManager - Todo Recovery', () => {
    let storage: InMemoryStorage;
    let sessionManager: SimpleSessionManager;
    const sessionId = 'test-session';

    beforeEach(() => {
      storage = new InMemoryStorage();
      sessionManager = new SimpleSessionManager(storage);
    });

    it('should recover todos from last TodoWrite tool call', async () => {
      const todos: TodoItem[] = [
        {
          content: 'Recovered Task',
          status: 'pending',
          priority: 'medium',
          id: 'recovered-1',
          activeForm: 'Working on recovered task',
        },
      ];

      // Simulate a TodoWrite tool call event
      const event: ToolCallEvent = {
        type: 'tool_call',
        timestamp: Date.now(),
        data: {
          id: 'call-123',
          tool: 'TodoWrite',
          params: { todos },
          agent: 'test-agent',
        },
      };

      await storage.appendEvent(sessionId, event);

      const recovered = await sessionManager.recoverTodos(sessionId);
      expect(recovered).toEqual(todos);
    });

    it('should use the LAST TodoWrite if multiple exist', async () => {
      const oldTodos: TodoItem[] = [
        {
          content: 'Old Task',
          status: 'completed',
          priority: 'low',
          id: 'old-1',
          activeForm: 'Old task',
        },
      ];

      const newTodos: TodoItem[] = [
        {
          content: 'New Task',
          status: 'pending',
          priority: 'high',
          id: 'new-1',
          activeForm: 'New task',
        },
      ];

      // Add old TodoWrite
      await storage.appendEvent(sessionId, {
        type: 'tool_call',
        timestamp: Date.now() - 1000,
        data: {
          id: 'call-old',
          tool: 'TodoWrite',
          params: { todos: oldTodos },
          agent: 'test-agent',
        },
      });

      // Add new TodoWrite
      await storage.appendEvent(sessionId, {
        type: 'tool_call',
        timestamp: Date.now(),
        data: {
          id: 'call-new',
          tool: 'TodoWrite',
          params: { todos: newTodos },
          agent: 'test-agent',
        },
      });

      const recovered = await sessionManager.recoverTodos(sessionId);
      expect(recovered).toEqual(newTodos);
      expect(recovered).not.toEqual(oldTodos);
    });

    it('should return empty array if no TodoWrite events', async () => {
      // Add some non-TodoWrite events
      await storage.appendEvent(sessionId, {
        type: 'user',
        timestamp: Date.now(),
        data: { role: 'user', content: 'Hello' },
      });

      await storage.appendEvent(sessionId, {
        type: 'tool_call',
        timestamp: Date.now(),
        data: {
          id: 'call-456',
          tool: 'Read', // Not TodoWrite
          params: { path: 'file.txt' },
          agent: 'test-agent',
        },
      });

      const recovered = await sessionManager.recoverTodos(sessionId);
      expect(recovered).toEqual([]);
    });

    it('should handle malformed events gracefully', async () => {
      // Add event with missing params
      await storage.appendEvent(sessionId, {
        type: 'tool_call',
        timestamp: Date.now(),
        data: {
          id: 'call-bad',
          tool: 'TodoWrite',
          // params is missing!
          agent: 'test-agent',
        },
      });

      const recovered = await sessionManager.recoverTodos(sessionId);
      expect(recovered).toEqual([]);
    });
  });

  describe('Integration - Event-based Todo Persistence', () => {
    let storage: InMemoryStorage;
    let logger: EventLogger;
    let sessionManager: SimpleSessionManager;
    let todoManager: TodoManager;
    const sessionId = 'integration-test';

    beforeEach(() => {
      storage = new InMemoryStorage();
      logger = new EventLogger(storage, sessionId);
      sessionManager = new SimpleSessionManager(storage);
      todoManager = new TodoManager();
      todoManager.initialize();
    });

    it('should persist todos through tool call events', async () => {
      const todos: TodoItem[] = [
        {
          content: 'Integration Test Task',
          status: 'in_progress',
          priority: 'high',
          id: 'int-1',
          activeForm: 'Testing integration',
        },
      ];

      // Simulate TodoWrite tool call
      logger.logToolCall('test-agent', 'TodoWrite', 'todo-call-1', { todos });

      // Verify event was stored
      const events = await storage.readEvents(sessionId);
      expect(events.length).toBe(1);

      const event = events[0] as ToolCallEvent;
      expect(event.type).toBe('tool_call');
      expect(event.data.tool).toBe('TodoWrite');
      expect((event.data.params as any).todos).toEqual(todos);
    });

    it('should recover todos after simulated crash', async () => {
      const initialTodos: TodoItem[] = [
        {
          content: 'Task before crash',
          status: 'pending',
          priority: 'medium',
          id: 'crash-1',
          activeForm: 'Working before crash',
        },
      ];

      // Set todos and log the tool call
      todoManager.updateTodos(initialTodos);
      logger.logToolCall('agent', 'TodoWrite', 'todo-call-2', { todos: initialTodos });

      // Simulate crash - create new instances
      const newTodoManager = new TodoManager();
      newTodoManager.initialize();

      // Should start empty
      expect(newTodoManager.getTodos()).toEqual([]);

      // Recover from events
      const recoveredTodos = await sessionManager.recoverTodos(sessionId);
      newTodoManager.setTodos(recoveredTodos);

      // Should have recovered the todos
      expect(newTodoManager.getTodos()).toEqual(initialTodos);
    });

    it('should track todo changes over time', async () => {
      // First update
      const todos1: TodoItem[] = [
        {
          content: 'Task 1',
          status: 'pending',
          priority: 'low',
          id: '1',
          activeForm: 'Starting Task 1',
        },
      ];
      logger.logToolCall('agent', 'TodoWrite', 'todo-call-3', { todos: todos1 });

      // Second update - mark as in progress
      const todos2: TodoItem[] = [
        {
          content: 'Task 1',
          status: 'in_progress',
          priority: 'low',
          id: '1',
          activeForm: 'Working on Task 1',
        },
      ];
      logger.logToolCall('agent', 'TodoWrite', 'todo-call-4', { todos: todos2 });

      // Third update - mark as completed and add new
      const todos3: TodoItem[] = [
        {
          content: 'Task 1',
          status: 'completed',
          priority: 'low',
          id: '1',
          activeForm: 'Completed Task 1',
        },
        {
          content: 'Task 2',
          status: 'pending',
          priority: 'high',
          id: '2',
          activeForm: 'Starting Task 2',
        },
      ];
      logger.logToolCall('agent', 'TodoWrite', 'todo-call-5', { todos: todos3 });

      // Recover should get the latest state
      const recovered = await sessionManager.recoverTodos(sessionId);
      expect(recovered).toEqual(todos3);
      expect(recovered.length).toBe(2);
      expect(recovered[0].status).toBe('completed');
      expect(recovered[1].status).toBe('pending');
    });

    it('should NOT use filesystem for todo storage', () => {
      // This test verifies the architectural change
      // TodoManager should not have any filesystem methods
      const manager = new TodoManager();

      // These methods should not exist
      expect(manager).not.toHaveProperty('loadTodos');
      expect(manager).not.toHaveProperty('saveTodos');
      expect(manager).not.toHaveProperty('ensureDirectoryExists');

      // The old constructor parameter should not be used
      const managerWithParam = new TodoManager();
      // Should not accept baseDir parameter (TypeScript would catch this)
      expect(managerWithParam).toBeDefined();
    });
  });
});
