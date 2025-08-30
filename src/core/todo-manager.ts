import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { TodoItem } from '../tools/todowrite-tool';

export class TodoManager {
  private readonly todosDir: string;
  private readonly todosFile: string;
  private todos: TodoItem[] = [];

  constructor(baseDir?: string) {
    // Default to current working directory like Claude Code
    this.todosDir = path.join(baseDir || process.cwd(), 'todos');
    this.todosFile = path.join(this.todosDir, 'current-session.json');
  }

  /**
   * Initialize the todo manager and load existing todos
   */
  async initialize(): Promise<void> {
    await this.ensureDirectoryExists();
    await this.loadTodos();
  }

  /**
   * Update the entire todo list
   */
  async updateTodos(todos: TodoItem[]): Promise<void> {
    // Validate the update
    const errors = this.validateTodos(todos);
    if (errors.length > 0) {
      throw new Error(`Invalid todo update: ${errors.join(', ')}`);
    }

    // Generate IDs for items that don't have them
    this.todos = todos.map((todo) => ({
      ...todo,
      id: todo.id || this.generateId(),
      priority: todo.priority || 'medium', // Default priority
    }));
    await this.saveTodos();
  }

  /**
   * Load todos from filesystem
   */
  private async loadTodos(): Promise<void> {
    try {
      const content = await fs.readFile(this.todosFile, 'utf-8');
      const data = JSON.parse(content);

      if (Array.isArray(data) && this.isValidTodoArray(data)) {
        this.todos = data;
      } else {
        console.warn('Invalid todo file format, starting fresh');
        this.todos = [];
      }
    } catch (error) {
      // File doesn't exist or is corrupted, start fresh
      this.todos = [];
    }
  }

  /**
   * Save todos to filesystem
   */
  private async saveTodos(): Promise<void> {
    try {
      await fs.writeFile(this.todosFile, JSON.stringify(this.todos, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save todos:', error);
      throw new Error(`Failed to save todos: ${error}`);
    }
  }

  /**
   * Ensure the todos directory exists
   */
  private async ensureDirectoryExists(): Promise<void> {
    try {
      await fs.mkdir(this.todosDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create todos directory:', error);
      throw new Error(`Failed to create todos directory: ${error}`);
    }
  }

  /**
   * Generate a unique ID for a todo item
   */
  private generateId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Validate todo items according to Claude Code's rules
   */
  private validateTodos(todos: TodoItem[]): string[] {
    const errors: string[] = [];
    const inProgressCount = todos.filter((t) => t.status === 'in_progress').length;

    // Only one task can be in_progress at a time
    if (inProgressCount > 1) {
      errors.push(`Only one task can be in_progress at a time, found ${inProgressCount}`);
    }

    // Validate individual items
    todos.forEach((todo, index) => {
      if (!todo.content || todo.content.trim().length === 0) {
        errors.push(`Todo ${index + 1}: content cannot be empty`);
      }

      if (!todo.activeForm || todo.activeForm.trim().length === 0) {
        errors.push(`Todo ${index + 1}: activeForm cannot be empty`);
      }

      if (!['pending', 'in_progress', 'completed'].includes(todo.status)) {
        errors.push(`Todo ${index + 1}: invalid status "${todo.status}"`);
      }

      if (todo.priority && !['high', 'medium', 'low'].includes(todo.priority)) {
        errors.push(`Todo ${index + 1}: invalid priority "${todo.priority}"`);
      }
    });

    return errors;
  }

  /**
   * Check if data is a valid todo array
   */
  private isValidTodoArray(data: unknown): data is TodoItem[] {
    if (!Array.isArray(data)) return false;

    return data.every(
      (item) =>
        typeof item === 'object' &&
        typeof item.content === 'string' &&
        typeof item.status === 'string' &&
        ['pending', 'in_progress', 'completed'].includes(item.status) &&
        typeof item.activeForm === 'string'
    );
  }
}
