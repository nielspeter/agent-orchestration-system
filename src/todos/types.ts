/**
 * Todo management types
 */

export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface Todo {
  id: string;
  content: string;
  status: TodoStatus;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface TodoSession {
  sessionId: string;
  todos: Todo[];
  createdAt: string;
  updatedAt: string;
}
