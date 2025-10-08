/**
 * Tests for output formatting utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  formatOutput,
  formatError,
  formatSuccess,
  formatWarning,
  formatInfo,
  type ExecutionResult,
  type AnySessionEvent,
} from '../src/output';

describe('Output Formatting', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const sampleResult: ExecutionResult = {
    result: 'Task completed successfully',
    agentName: 'test-agent',
    sessionId: 'test-session-123',
    duration: 1500,
  };

  const sampleEvents: AnySessionEvent[] = [
    {
      type: 'assistant',
      timestamp: Date.now(),
      data: {
        role: 'assistant',
        content: 'Processing...',
      },
      metadata: {
        model: 'claude-3-5-sonnet',
        provider: 'anthropic',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
        cost: {
          totalCost: 0.0015,
        },
      },
    },
    {
      type: 'tool_call',
      timestamp: Date.now(),
      data: {
        tool: 'Read',
        params: { path: '/test/file.txt' },
      },
    },
  ];

  describe('formatOutput', () => {
    it('should format in clean mode (just the result)', () => {
      const output = formatOutput(sampleResult, 'clean');
      expect(output).toBe('Task completed successfully');
    });

    it('should format in verbose mode with metadata', () => {
      const output = formatOutput(sampleResult, 'verbose');
      expect(output).toContain('Agent Execution Result');
      expect(output).toContain('test-agent');
      expect(output).toContain('test-session-123');
      expect(output).toContain('1.50s');
      expect(output).toContain('Task completed successfully');
    });

    it('should format in JSON mode', () => {
      const output = formatOutput(sampleResult, 'json');
      const parsed = JSON.parse(output);
      expect(parsed).toMatchObject({
        result: 'Task completed successfully',
        agent: 'test-agent',
        sessionId: 'test-session-123',
        duration: 1500,
      });
    });

    it('should include metrics from events in verbose mode', () => {
      const resultWithEvents: ExecutionResult = {
        ...sampleResult,
        events: sampleEvents,
      };
      const output = formatOutput(resultWithEvents, 'verbose');
      expect(output).toContain('Execution Metrics');
      expect(output).toContain('Iterations');
      expect(output).toContain('Tool Calls');
    });

    it('should format tool calls in verbose mode', () => {
      const resultWithEvents: ExecutionResult = {
        ...sampleResult,
        events: sampleEvents,
      };
      const output = formatOutput(resultWithEvents, 'verbose');
      expect(output).toContain('Tool Calls');
      expect(output).toContain('Read');
    });

    it('should extract metadata from events', () => {
      const resultWithEvents: ExecutionResult = {
        ...sampleResult,
        events: sampleEvents,
      };
      const output = formatOutput(resultWithEvents, 'json');
      const parsed = JSON.parse(output);
      expect(parsed.metrics).toMatchObject({
        iterations: 1,
        toolCalls: 1,
        totalTokens: 150,
        totalCost: 0.0015,
      });
    });
  });

  describe('formatError', () => {
    it('should format error string in clean mode', () => {
      const output = formatError('Something went wrong', 'clean');
      expect(output).toContain('Something went wrong');
    });

    it('should format Error object in clean mode', () => {
      const error = new Error('Test error');
      const output = formatError(error, 'clean');
      expect(output).toContain('Test error');
    });

    it('should format error in verbose mode with stack trace', () => {
      const error = new Error('Test error');
      const output = formatError(error, 'verbose');
      expect(output).toContain('ERROR');
      expect(output).toContain('Test error');
      expect(output).toContain('Stack trace');
    });

    it('should format error in JSON mode', () => {
      const error = new Error('Test error');
      const output = formatError(error, 'json');
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty('error', 'Test error');
      expect(parsed).toHaveProperty('stack');
    });
  });

  describe('Utility formatters', () => {
    it('should format success message', () => {
      const output = formatSuccess('Operation completed');
      expect(output).toContain('Operation completed');
    });

    it('should format warning message', () => {
      const output = formatWarning('Be careful');
      expect(output).toContain('Be careful');
    });

    it('should format info message', () => {
      const output = formatInfo('Just so you know');
      expect(output).toContain('Just so you know');
    });
  });

  describe('Color handling', () => {
    it('should disable colors when NO_COLOR is set', () => {
      process.env.NO_COLOR = '1';
      const output = formatSuccess('Test');
      // When NO_COLOR is set, there should be no ANSI codes
      expect(output).not.toMatch(/\x1b\[\d+m/);
    });

    it('should enable colors by default (if TTY)', () => {
      delete process.env.NO_COLOR;
      const output = formatSuccess('Test');
      // This test is environment-dependent
      // Just verify it doesn't throw
      expect(output).toBeTruthy();
    });
  });

  describe('Duration formatting', () => {
    it('should format milliseconds correctly', () => {
      const result = { ...sampleResult, duration: 500 };
      const output = formatOutput(result, 'verbose');
      expect(output).toContain('500ms');
    });

    it('should format seconds correctly', () => {
      const result = { ...sampleResult, duration: 2500 };
      const output = formatOutput(result, 'verbose');
      expect(output).toContain('2.50s');
    });
  });
});
