import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeSingleTool, groupToolsByConcurrency } from '@/tools/registry/executor-service';
import { ToolRegistry } from '@/tools/registry/registry';
import { ToolCall } from '@/base-types';

describe('ExecutorService - Critical Path (Minimal MVP Tests)', () => {
  let registry: ToolRegistry;
  let mockLogger: any;
  let mockContext: any;

  beforeEach(() => {
    registry = new ToolRegistry();
    mockLogger = {
      logSystemMessage: vi.fn(),
      logToolCall: vi.fn(),
      logToolResult: vi.fn(),
      logToolError: vi.fn(),
      logDelegation: vi.fn(),
    };
    mockContext = {
      agentName: 'test-agent',
      logger: mockLogger,
      executionContext: {
        depth: 0,
      },
    };
  });

  describe('groupToolsByConcurrency - The Core Grouping Logic', () => {
    it('should group consecutive safe tools together', () => {
      // This is the ACTUAL behavior - groups consecutive tools with same safety
      registry.register({
        name: 'Read',
        description: 'Read file',
        parameters: { type: 'object', properties: {}, required: [] },
        execute: vi.fn(),
        isConcurrencySafe: () => true,
      });

      const toolCalls: ToolCall[] = [
        { id: '1', type: 'function', function: { name: 'Read', arguments: '{}' } },
        { id: '2', type: 'function', function: { name: 'Read', arguments: '{}' } },
        { id: '3', type: 'function', function: { name: 'Read', arguments: '{}' } },
      ];

      const groups = groupToolsByConcurrency(toolCalls, registry);

      // All consecutive safe tools in one group
      expect(groups).toHaveLength(1);
      expect(groups[0].isConcurrencySafe).toBe(true);
      expect(groups[0].tools).toHaveLength(3);
    });

    it('should NOT separate non-consecutive unsafe tools - this is the actual behavior', () => {
      // The implementation groups CONSECUTIVE tools with same safety
      registry.register({
        name: 'Write',
        description: 'Write file',
        parameters: { type: 'object', properties: {}, required: [] },
        execute: vi.fn(),
        isConcurrencySafe: () => false,
      });

      const toolCalls: ToolCall[] = [
        { id: '1', type: 'function', function: { name: 'Write', arguments: '{}' } },
        { id: '2', type: 'function', function: { name: 'Write', arguments: '{}' } },
      ];

      const groups = groupToolsByConcurrency(toolCalls, registry);

      // Consecutive unsafe tools stay together (not ideal but that's the implementation)
      expect(groups).toHaveLength(1);
      expect(groups[0].isConcurrencySafe).toBe(false);
      expect(groups[0].tools).toHaveLength(2);
    });

    it('should create new group when safety changes', () => {
      registry.register({
        name: 'Read',
        description: 'Read file',
        parameters: { type: 'object', properties: {}, required: [] },
        execute: vi.fn(),
        isConcurrencySafe: () => true,
      });

      registry.register({
        name: 'Write',
        description: 'Write file',
        parameters: { type: 'object', properties: {}, required: [] },
        execute: vi.fn(),
        isConcurrencySafe: () => false,
      });

      const toolCalls: ToolCall[] = [
        { id: '1', type: 'function', function: { name: 'Read', arguments: '{}' } },
        { id: '2', type: 'function', function: { name: 'Write', arguments: '{}' } },
        { id: '3', type: 'function', function: { name: 'Read', arguments: '{}' } },
      ];

      const groups = groupToolsByConcurrency(toolCalls, registry);

      // Should create new group each time safety changes
      expect(groups).toHaveLength(3);
      expect(groups[0].isConcurrencySafe).toBe(true);
      expect(groups[0].tools).toHaveLength(1);
      expect(groups[1].isConcurrencySafe).toBe(false);
      expect(groups[1].tools).toHaveLength(1);
      expect(groups[2].isConcurrencySafe).toBe(true);
      expect(groups[2].tools).toHaveLength(1);
    });
  });

  describe('executeSingleTool - Error Handling', () => {
    it('should handle tool not found', async () => {
      const toolCall: ToolCall = {
        id: 'test-1',
        type: 'function',
        function: { name: 'NonExistentTool', arguments: '{}' },
      };

      const result = await executeSingleTool(toolCall, mockContext, registry, vi.fn());

      expect(result.role).toBe('tool');
      expect(result.tool_call_id).toBe('test-1');
      expect(result.content).toContain('Tool NonExistentTool not found');
    });

    it('should handle invalid JSON arguments', async () => {
      registry.register({
        name: 'TestTool',
        description: 'Test tool',
        parameters: { type: 'object', properties: {}, required: [] },
        execute: vi.fn(),
        isConcurrencySafe: () => true,
      });

      const toolCall: ToolCall = {
        id: 'test-1',
        type: 'function',
        function: { name: 'TestTool', arguments: 'not valid json' },
      };

      const result = await executeSingleTool(toolCall, mockContext, registry, vi.fn());

      expect(result.role).toBe('tool');
      expect(result.content).toContain('Tool execution failed');
    });

    it('should handle tool execution errors gracefully', async () => {
      registry.register({
        name: 'FailingTool',
        description: 'Tool that fails',
        parameters: { type: 'object', properties: {}, required: [] },
        execute: async () => {
          throw new Error('Something went wrong');
        },
        isConcurrencySafe: () => true,
      });

      const toolCall: ToolCall = {
        id: 'test-1',
        type: 'function',
        function: { name: 'FailingTool', arguments: '{}' },
      };

      const result = await executeSingleTool(toolCall, mockContext, registry, vi.fn());

      expect(result.role).toBe('tool');
      expect(result.content).toContain('Something went wrong');
      expect(mockLogger.logToolError).toHaveBeenCalled();
    });

    it('should execute tool successfully', async () => {
      const mockExecute = vi.fn().mockResolvedValue({ content: 'success' });
      registry.register({
        name: 'SuccessfulTool',
        description: 'Tool that succeeds',
        parameters: { type: 'object', properties: {}, required: [] },
        execute: mockExecute,
        isConcurrencySafe: () => true,
      });

      const toolCall: ToolCall = {
        id: 'test-1',
        type: 'function',
        function: { name: 'SuccessfulTool', arguments: '{"key": "value"}' },
      };

      const result = await executeSingleTool(toolCall, mockContext, registry, vi.fn());

      expect(mockExecute).toHaveBeenCalledWith({ key: 'value' });
      expect(result.role).toBe('tool');
      expect(result.content).toContain('success');
      expect(mockLogger.logToolCall).toHaveBeenCalled();
      expect(mockLogger.logToolResult).toHaveBeenCalled();
    });
  });

  describe('Task Delegation - The Special Case', () => {
    it('should handle Task tool delegation', async () => {
      const mockDelegate = vi.fn().mockResolvedValue('delegation result');

      registry.register({
        name: 'Task',
        description: 'Delegate to sub-agent',
        parameters: { type: 'object', properties: {}, required: [] },
        execute: vi.fn(), // This won't be called
        isConcurrencySafe: () => false,
      });

      const toolCall: ToolCall = {
        id: 'test-1',
        type: 'function',
        function: {
          name: 'Task',
          arguments: JSON.stringify({
            subagent_type: 'helper',
            prompt: 'Do something',
          }),
        },
      };

      const result = await executeSingleTool(toolCall, mockContext, registry, mockDelegate);

      // Verify delegation was called
      expect(mockDelegate).toHaveBeenCalledWith(
        'helper',
        'Do something',
        expect.objectContaining({
          depth: 1,
          parentAgent: 'test-agent',
          isSidechain: true,
          parentMessages: [], // Pull architecture - no parent messages
        })
      );

      expect(mockLogger.logDelegation).toHaveBeenCalled();
      expect(result.content).toContain('delegation result');
    });

    it('should enforce pull architecture - no parent messages to child', async () => {
      const mockDelegate = vi.fn().mockResolvedValue('result');

      registry.register({
        name: 'Task',
        description: 'Delegate',
        parameters: { type: 'object', properties: {}, required: [] },
        execute: vi.fn(),
        isConcurrencySafe: () => false,
      });

      // Context with parent messages
      const contextWithMessages = {
        ...mockContext,
        executionContext: {
          depth: 2,
          parentMessages: ['should', 'not', 'be', 'passed'],
        },
      };

      const toolCall: ToolCall = {
        id: 'test-1',
        type: 'function',
        function: {
          name: 'Task',
          arguments: JSON.stringify({
            subagent_type: 'child',
            prompt: 'test',
          }),
        },
      };

      await executeSingleTool(toolCall, contextWithMessages, registry, mockDelegate);

      // Verify child gets empty parent messages (pull architecture)
      expect(mockDelegate).toHaveBeenCalledWith(
        'child',
        'test',
        expect.objectContaining({
          parentMessages: [], // Always empty for pull architecture
        })
      );
    });
  });
});
