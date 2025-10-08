import { describe, expect, it } from 'vitest';
import { isNodeError, isSessionEvent, isTodoItemArray } from '@/utils/type-guards';

describe('Type Guards', () => {
  describe('isNodeError', () => {
    it('should return true for Node.js errors with code', () => {
      const error = new Error('ENOENT: file not found');
      (error as any).code = 'ENOENT';
      expect(isNodeError(error)).toBe(true);
    });

    it('should return false for regular errors', () => {
      const error = new Error('Regular error');
      expect(isNodeError(error)).toBe(false);
    });

    it('should return false for non-errors', () => {
      expect(isNodeError('not an error')).toBe(false);
      expect(isNodeError(null)).toBe(false);
      expect(isNodeError(undefined)).toBe(false);
      expect(isNodeError({})).toBe(false);
    });

    it('should return false for errors with non-string code', () => {
      const error = new Error('Error with number code');
      (error as any).code = 123;
      expect(isNodeError(error)).toBe(false);
    });
  });

  describe('isSessionEvent', () => {
    it('should return true for valid session events', () => {
      const event = {
        type: 'user',
        timestamp: Date.now(),
        data: { content: 'Hello' },
      };
      expect(isSessionEvent(event)).toBe(true);
    });

    it('should return true with any defined data value', () => {
      expect(isSessionEvent({ type: 'test', timestamp: 123, data: null })).toBe(true);
      expect(isSessionEvent({ type: 'test', timestamp: 123, data: {} })).toBe(true);
      expect(isSessionEvent({ type: 'test', timestamp: 123, data: 'string' })).toBe(true);
      expect(isSessionEvent({ type: 'test', timestamp: 123, data: 0 })).toBe(true);
    });

    it('should return false with undefined data', () => {
      const event = {
        type: 'system',
        timestamp: Date.now(),
        data: undefined,
      };
      // data must be defined (but can be any value)
      expect(isSessionEvent(event)).toBe(false);
    });

    it('should return false for missing type', () => {
      const event = {
        timestamp: Date.now(),
        data: {},
      };
      expect(isSessionEvent(event)).toBe(false);
    });

    it('should return false for missing timestamp', () => {
      const event = {
        type: 'user',
        data: {},
      };
      expect(isSessionEvent(event)).toBe(false);
    });

    it('should return false for non-objects', () => {
      expect(isSessionEvent(null)).toBe(false);
      expect(isSessionEvent(undefined)).toBe(false);
      expect(isSessionEvent('string')).toBe(false);
      expect(isSessionEvent(123)).toBe(false);
    });

    it('should return false for wrong type fields', () => {
      expect(isSessionEvent({ type: 123, timestamp: Date.now(), data: {} })).toBe(false);
      expect(isSessionEvent({ type: 'user', timestamp: 'not-a-number', data: {} })).toBe(false);
    });
  });

  describe('isTodoItemArray', () => {
    it('should return true for valid TodoItem array', () => {
      const todos = [
        {
          id: '1',
          content: 'Test todo',
          status: 'pending',
          priority: 'high',
          activeForm: 'Testing todo',
        },
        {
          id: '2',
          content: 'Another todo',
          status: 'in_progress',
          priority: 'medium',
          activeForm: 'Working on todo',
        },
      ];
      expect(isTodoItemArray(todos)).toBe(true);
    });

    it('should return true for empty array', () => {
      expect(isTodoItemArray([])).toBe(true);
    });

    it('should return false for non-arrays', () => {
      expect(isTodoItemArray(null)).toBe(false);
      expect(isTodoItemArray(undefined)).toBe(false);
      expect(isTodoItemArray('string')).toBe(false);
      expect(isTodoItemArray({})).toBe(false);
    });

    it('should return false for invalid status values', () => {
      const todos = [
        {
          id: '1',
          content: 'Test',
          status: 'invalid-status',
          priority: 'high',
          activeForm: 'Testing',
        },
      ];
      expect(isTodoItemArray(todos)).toBe(false);
    });

    it('should return false for invalid priority values', () => {
      const todos = [
        {
          id: '1',
          content: 'Test',
          status: 'pending',
          priority: 'invalid-priority',
          activeForm: 'Testing',
        },
      ];
      expect(isTodoItemArray(todos)).toBe(false);
    });

    it('should return false for missing required fields', () => {
      const missingId = [
        { content: 'Test', status: 'pending', priority: 'high', activeForm: 'Testing' },
      ];
      expect(isTodoItemArray(missingId)).toBe(false);

      const missingContent = [
        { id: '1', status: 'pending', priority: 'high', activeForm: 'Testing' },
      ];
      expect(isTodoItemArray(missingContent)).toBe(false);

      const missingStatus = [{ id: '1', content: 'Test', priority: 'high', activeForm: 'Testing' }];
      expect(isTodoItemArray(missingStatus)).toBe(false);

      const missingPriority = [
        { id: '1', content: 'Test', status: 'pending', activeForm: 'Testing' },
      ];
      expect(isTodoItemArray(missingPriority)).toBe(false);

      const missingActiveForm = [{ id: '1', content: 'Test', status: 'pending', priority: 'high' }];
      expect(isTodoItemArray(missingActiveForm)).toBe(false);
    });

    it('should return false for wrong field types', () => {
      const wrongTypes = [
        {
          id: 123, // should be string
          content: 'Test',
          status: 'pending',
          priority: 'high',
          activeForm: 'Testing',
        },
      ];
      expect(isTodoItemArray(wrongTypes)).toBe(false);
    });
  });
});
