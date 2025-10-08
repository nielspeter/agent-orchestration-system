import { describe, expect, it } from 'vitest';
import { EventStreamParser } from '../utils/event-stream-parser';
import '../matchers/agent-matchers';
import type { EventMessage } from '../types/event-types';

/**
 * Integration test for generic test utilities.
 * Demonstrates that utilities work for any agent system, not just specific games.
 */

describe('Generic Test Utilities', () => {
  // Fixed base timestamp for deterministic tests
  const BASE_TIMESTAMP = 1704067200000; // 2024-01-01 00:00:00 UTC

  // Create mock event messages that simulate a simple agent execution
  const createMockMessages = (): EventMessage[] => {
    return [
      {
        type: 'agent_start',
        timestamp: BASE_TIMESTAMP,
        data: {
          agent: 'orchestrator',
          prompt: 'Analyze and process data files',
        },
      },
      {
        type: 'assistant',
        timestamp: BASE_TIMESTAMP + 1000,
        data: {
          content: 'I will analyze the data files and delegate specific tasks.',
        },
      },
      {
        type: 'tool_call',
        timestamp: BASE_TIMESTAMP + 2000,
        data: {
          agent: 'orchestrator',
          tool: 'read',
          tool_call_id: 'call_001',
          params: { file: 'data.json' },
        },
      },
      {
        type: 'delegation',
        timestamp: BASE_TIMESTAMP + 3000,
        data: {
          parent: 'orchestrator',
          child: 'data-processor',
          task: 'Process JSON data',
        },
      },
      {
        type: 'agent_start',
        timestamp: BASE_TIMESTAMP + 4000,
        data: {
          agent: 'data-processor',
          prompt: 'Process JSON data',
        },
      },
      {
        type: 'tool_call',
        timestamp: BASE_TIMESTAMP + 5000,
        data: {
          agent: 'data-processor',
          tool: 'write',
          tool_call_id: 'call_002',
          params: { file: 'output.json', content: '{}' },
        },
      },
      {
        type: 'delegation',
        timestamp: BASE_TIMESTAMP + 6000,
        data: {
          parent: 'orchestrator',
          child: 'validator',
          task: 'Validate output',
        },
      },
      {
        type: 'agent_start',
        timestamp: BASE_TIMESTAMP + 7000,
        data: {
          agent: 'validator',
          prompt: 'Validate output',
        },
      },
      {
        type: 'tool_call',
        timestamp: BASE_TIMESTAMP + 8000,
        data: {
          agent: 'validator',
          tool: 'grep',
          tool_call_id: 'call_003',
          params: { pattern: 'error', path: 'logs/' },
        },
      },
      {
        type: 'assistant',
        timestamp: BASE_TIMESTAMP + 9000,
        data: {
          content: 'All tasks have been completed successfully.',
        },
      },
    ];
  };

  describe('EventStreamParser', () => {
    const messages = createMockMessages();

    it('should extract delegations from any agent system', () => {
      const delegations = EventStreamParser.extractDelegations(messages);

      expect(delegations).toHaveLength(2);
      expect(delegations[0]).toEqual({
        from: 'orchestrator',
        to: 'data-processor',
        task: 'Process JSON data',
      });
      expect(delegations[1]).toEqual({
        from: 'orchestrator',
        to: 'validator',
        task: 'Validate output',
      });
    });

    it('should extract tool calls by type', () => {
      const readCalls = EventStreamParser.extractToolCalls(messages, 'read');
      const writeCalls = EventStreamParser.extractToolCalls(messages, 'write');
      const allCalls = EventStreamParser.extractToolCalls(messages);

      expect(readCalls).toHaveLength(1);
      expect(readCalls[0]?.tool).toBe('read');

      expect(writeCalls).toHaveLength(1);
      expect(writeCalls[0]?.tool).toBe('write');

      expect(allCalls).toHaveLength(3);
      expect(allCalls.map((c) => c?.tool)).toEqual(['read', 'write', 'grep']);
    });

    it('should extract unique agent calls', () => {
      const agentCalls = EventStreamParser.extractAgentCalls(messages);

      // extractAgentCalls returns all agents from agent_start events
      expect(agentCalls).toEqual(['orchestrator', 'data-processor', 'validator']);
      expect(agentCalls).toContain('orchestrator'); // All agents that started are included
    });

    it('should check for keywords in content', () => {
      const hasSuccess = EventStreamParser.hasKeywords(messages, ['completed', 'successfully']);
      const hasFailed = EventStreamParser.hasKeywords(messages, ['failed', 'error']);

      expect(hasSuccess).toBe(true);
      expect(hasFailed).toBe(false);
    });

    it('should parse full execution summary', () => {
      const execution = EventStreamParser.parseExecution(messages);

      expect(execution.delegations).toHaveLength(2);
      expect(execution.toolCalls).toHaveLength(3);
      expect(execution.agentsCalled).toEqual(['orchestrator', 'data-processor', 'validator']);
      expect(execution.totalMessages).toBe(10); // We have 10 messages now
      // hasCompletion is not a field in ParsedExecution
    });
  });

  describe('Custom Matchers', () => {
    const messages = createMockMessages();

    it('should work with toHaveCompleted matcher', () => {
      expect(messages).toHaveCompleted(['completed', 'successfully']);
      expect(messages).not.toHaveCompleted(['failed', 'error']);
    });

    it('should work with toHaveDelegatedToAgents matcher', () => {
      expect(messages).toHaveDelegatedToAgents(['data-processor', 'validator']);
      expect(messages).not.toHaveDelegatedToAgents(['non-existent-agent']);
    });

    it('should work with toHaveExecutedTools matcher', () => {
      expect(messages).toHaveExecutedTools(['read', 'write', 'grep']);
      expect(messages).not.toHaveExecutedTools(['todowrite', 'list']);
    });

    it('should work with toNotContainPatterns matcher', () => {
      const simulationPattern = /simulated.*response/i;
      const errorPattern = /error.*occurred/i;

      expect(messages).toNotContainPatterns([simulationPattern, errorPattern]);
    });

    it('should work with toHaveAgentInteractions matcher', () => {
      expect(messages).toHaveAgentInteractions(2); // data-processor and validator
      expect(messages).not.toHaveAgentInteractions(5);
    });

    it('should work with toHaveKeywords matcher', () => {
      expect(messages).toHaveKeywords(['completed', 'tasks']);
      expect(messages).not.toHaveKeywords(['failure', 'crashed']);
    });
  });

  describe('Complex Agent Scenarios', () => {
    const BASE_TIMESTAMP = 1704067200000; // Use same fixed timestamp
    it('should handle nested delegations', () => {
      const nestedMessages: EventMessage[] = [
        {
          type: 'delegation',
          timestamp: BASE_TIMESTAMP + 1000,
          data: { parent: 'agent-a', child: 'agent-b', task: 'Task 1' },
        },
        {
          type: 'delegation',
          timestamp: BASE_TIMESTAMP + 2000,
          data: { parent: 'agent-b', child: 'agent-c', task: 'Task 2' },
        },
        {
          type: 'delegation',
          timestamp: BASE_TIMESTAMP + 3000,
          data: { parent: 'agent-c', child: 'agent-d', task: 'Task 3' },
        },
      ];

      const delegations = EventStreamParser.extractDelegations(nestedMessages);
      expect(delegations).toHaveLength(3);

      // extractAgentCalls only returns agents from agent_start events
      // For delegation-only messages, we need to use delegation data
      const delegatedAgents = delegations.map((d) => d.to);
      expect(delegatedAgents).toEqual(['agent-b', 'agent-c', 'agent-d']);
    });

    it('should handle parallel tool executions', () => {
      const parallelMessages: EventMessage[] = [
        {
          type: 'tool_call',
          timestamp: BASE_TIMESTAMP + 1000,
          data: { agent: 'worker', tool: 'read', tool_call_id: '1', params: {} },
        },
        {
          type: 'tool_call',
          timestamp: BASE_TIMESTAMP + 1000,
          data: { agent: 'worker', tool: 'read', tool_call_id: '2', params: {} },
        },
        {
          type: 'tool_call',
          timestamp: BASE_TIMESTAMP + 1000,
          data: { agent: 'worker', tool: 'read', tool_call_id: '3', params: {} },
        },
      ];

      const toolCalls = EventStreamParser.extractToolCalls(parallelMessages, 'read');
      expect(toolCalls).toHaveLength(3);
      expect(toolCalls.every((tc) => tc?.tool === 'read')).toBe(true);
    });

    it('should handle empty or minimal message streams', () => {
      const emptyMessages: EventMessage[] = [];
      const minimalMessages: EventMessage[] = [
        {
          type: 'agent_start',
          timestamp: BASE_TIMESTAMP,
          data: { agent: 'solo', prompt: 'Simple task' },
        },
      ];

      // Empty stream
      expect(EventStreamParser.extractDelegations(emptyMessages)).toHaveLength(0);
      expect(EventStreamParser.extractToolCalls(emptyMessages)).toHaveLength(0);
      expect(EventStreamParser.hasKeywords(emptyMessages, ['any'])).toBe(false);

      // Minimal stream
      const execution = EventStreamParser.parseExecution(minimalMessages);
      expect(execution.totalMessages).toBe(1);
      expect(execution.delegations).toHaveLength(0);
      expect(execution.agentsCalled).toEqual(['solo']);
    });
  });

  describe('Error Handling', () => {
    const BASE_TIMESTAMP = 1704067200000; // Use same fixed timestamp
    it('should handle malformed messages gracefully', () => {
      const malformedMessages: EventMessage[] = [
        {
          type: 'unknown_type',
          timestamp: BASE_TIMESTAMP,
        } as EventMessage,
        {
          type: 'delegation',
          timestamp: BASE_TIMESTAMP + 1000,
          data: { parent: 'agent', child: 'other', task: 'Valid task' },
        },
      ];

      // Should still extract valid data
      const delegations = EventStreamParser.extractDelegations(malformedMessages);
      expect(delegations).toHaveLength(1);
      expect(delegations[0]?.task).toBe('Valid task');
    });

    it('should handle missing optional fields', () => {
      const sparseMessages: EventMessage[] = [
        {
          type: 'tool_call',
          timestamp: BASE_TIMESTAMP,
          data: {
            agent: 'worker',
            tool: 'CustomTool',
            tool_call_id: 'call_sparse',
            // No params field - testing optional field handling
          },
        },
      ];

      const toolCalls = EventStreamParser.extractToolCalls(sparseMessages);
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0]?.tool).toBe('CustomTool');
    });
  });
});
