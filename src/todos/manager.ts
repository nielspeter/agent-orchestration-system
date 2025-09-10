import * as crypto from 'crypto';
import { TodoItem } from '@/tools/todowrite.tool';

/**
 * Stateless Todo Manager
 *
 * Holds todos in memory only. No filesystem persistence.
 * Todos are persisted as tool_call events in the session storage.
 * On recovery, todos are reconstructed from the last TodoWrite event.
 */
export class TodoManager {
  private todos: TodoItem[] = [];

  /**
   * Initialize the todo manager
   * No longer needs async or filesystem setup
   */
  initialize(): void {
    // Nothing to initialize - stateless
  }

  /**
   * Update the entire todo list
   */
  updateTodos(todos: TodoItem[]): void {
    // Validate the update
    const errors = this.validateTodos(todos);
    if (errors.length > 0) {
      throw new Error(`Invalid todo update: ${errors.join(', ')}`);
    }

    // Generate IDs for items that don't have them
    this.todos = todos.map((todo) => ({
      ...todo,
      id: todo.id || this.generateId(),
      priority: todo.priority || 'medium',
    }));
  }

  /**
   * Get current todos
   */
  getTodos(): TodoItem[] {
    return [...this.todos];
  }

  /**
   * Set todos (used for recovery from session events)
   */
  setTodos(todos: TodoItem[]): void {
    this.todos = todos;
  }

  /**
   * Clear all todos
   */
  clearTodos(): void {
    this.todos = [];
  }

  /**
   * Get todos organized by status
   */
  getTodosByStatus(): {
    pending: TodoItem[];
    inProgress: TodoItem[];
    completed: TodoItem[];
  } {
    return {
      pending: this.todos.filter((t) => t.status === 'pending'),
      inProgress: this.todos.filter((t) => t.status === 'in_progress'),
      completed: this.todos.filter((t) => t.status === 'completed'),
    };
  }

  /**
   * Validate todos for business rules
   */
  private validateTodos(todos: TodoItem[]): string[] {
    const errors: string[] = [];

    // Check for only one in-progress task
    const inProgressCount = todos.filter((t) => t.status === 'in_progress').length;
    if (inProgressCount > 1) {
      errors.push(`Only one task can be in progress at a time (found ${inProgressCount})`);
    }

    // Check for duplicate content
    const contents = todos.map((t) => t.content.toLowerCase());
    const duplicates = contents.filter((c, i) => contents.indexOf(c) !== i);
    if (duplicates.length > 0) {
      errors.push(`Duplicate tasks found: ${duplicates.join(', ')}`);
    }

    // Validate required fields
    for (const todo of todos) {
      if (!todo.content || todo.content.trim().length === 0) {
        errors.push('Todo content cannot be empty');
      }
      if (!todo.activeForm || todo.activeForm.trim().length === 0) {
        errors.push(`Todo "${todo.content}" is missing activeForm`);
      }
      if (!['pending', 'in_progress', 'completed'].includes(todo.status)) {
        errors.push(`Invalid status "${todo.status}" for todo "${todo.content}"`);
      }
    }

    return errors;
  }

  /**
   * Generate a unique ID for a todo item
   */
  private generateId(): string {
    return crypto.randomBytes(4).toString('hex');
  }

  /**
   * Format todos for display
   */
  formatTodos(): string {
    if (this.todos.length === 0) {
      return 'No todos';
    }

    const byStatus = this.getTodosByStatus();
    const parts: string[] = [];

    if (byStatus.inProgress.length > 0) {
      parts.push(
        `In Progress (${byStatus.inProgress.length}):\n` +
          byStatus.inProgress.map((t) => `  • ${t.activeForm}`).join('\n')
      );
    }

    if (byStatus.pending.length > 0) {
      parts.push(
        `Pending (${byStatus.pending.length}):\n` +
          byStatus.pending.map((t) => `  • ${t.content}`).join('\n')
      );
    }

    if (byStatus.completed.length > 0) {
      parts.push(
        `Completed (${byStatus.completed.length}):\n` +
          byStatus.completed.map((t) => `  ✓ ${t.content}`).join('\n')
      );
    }

    return parts.join('\n\n');
  }
}
