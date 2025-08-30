// Comprehensive Error Handling for Todo Manager

// Custom Error Classes
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

class TodoNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TodoNotFoundError';
  }
}

class DuplicateTodoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateTodoError';
  }
}

class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

// Logging Utility
class Logger {
  static log(level: 'info' | 'warn' | 'error', message: string, context?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      context,
    };
    console[level](JSON.stringify(logEntry));
  }
}

// Todo Interface
interface Todo {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: Date;
  updatedAt?: Date;
}

// Todo Manager Class
class TodoManager {
  private todos: Todo[] = [];

  // Input Validation Method
  private validateTodo(todo: Partial<Todo>): void {
    if (!todo.content || todo.content.trim() === '') {
      throw new ValidationError('Todo content cannot be empty');
    }

    if (todo.status && !['pending', 'in_progress', 'completed'].includes(todo.status)) {
      throw new ValidationError('Invalid todo status');
    }
  }

  // Add Todo with Comprehensive Error Handling
  addTodo(content: string): Todo {
    try {
      // Input validation
      if (!content || content.trim() === '') {
        throw new ValidationError('Todo content is required');
      }

      // Check for duplicates
      const existingTodo = this.todos.find((todo) => todo.content.trim() === content.trim());
      if (existingTodo) {
        throw new DuplicateTodoError('A similar todo already exists');
      }

      const newTodo: Todo = {
        id: this.generateUniqueId(),
        content: content.trim(),
        status: 'pending',
        createdAt: new Date(),
      };

      this.validateTodo(newTodo);
      this.todos.push(newTodo);

      Logger.log('info', 'Todo added successfully', { todoId: newTodo.id });
      return newTodo;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof DuplicateTodoError) {
        Logger.log('warn', error.message, { errorName: error.name });
        throw error;
      }

      Logger.log('error', 'Unexpected error adding todo', { error: String(error) });
      throw new Error('Failed to add todo');
    }
  }

  // Update Todo with Error Handling
  updateTodo(id: string, updates: Partial<Todo>): Todo {
    try {
      const todoIndex = this.todos.findIndex((todo) => todo.id === id);

      if (todoIndex === -1) {
        throw new TodoNotFoundError(`Todo with id ${id} not found`);
      }

      // Validate updates
      this.validateTodo(updates);

      // Merge updates
      const updatedTodo = {
        ...this.todos[todoIndex],
        ...updates,
        updatedAt: new Date(),
      };

      this.todos[todoIndex] = updatedTodo;

      Logger.log('info', 'Todo updated successfully', { todoId: id });
      return updatedTodo;
    } catch (error) {
      if (error instanceof TodoNotFoundError || error instanceof ValidationError) {
        Logger.log('warn', error.message, { errorName: error.name });
        throw error;
      }

      Logger.log('error', 'Unexpected error updating todo', { error: String(error) });
      throw new Error('Failed to update todo');
    }
  }

  // Delete Todo with Error Handling
  deleteTodo(id: string): void {
    try {
      const todoIndex = this.todos.findIndex((todo) => todo.id === id);

      if (todoIndex === -1) {
        throw new TodoNotFoundError(`Todo with id ${id} not found`);
      }

      this.todos.splice(todoIndex, 1);
      Logger.log('info', 'Todo deleted successfully', { todoId: id });
    } catch (error) {
      if (error instanceof TodoNotFoundError) {
        Logger.log('warn', error.message, { errorName: error.name });
        throw error;
      }

      Logger.log('error', 'Unexpected error deleting todo', { error: String(error) });
      throw new Error('Failed to delete todo');
    }
  }

  // Generate Unique ID (simple implementation)
  private generateUniqueId(): string {
    return `todo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get Todo by ID with Error Handling
  getTodoById(id: string): Todo {
    try {
      const todo = this.todos.find((todo) => todo.id === id);

      if (!todo) {
        throw new TodoNotFoundError(`Todo with id ${id} not found`);
      }

      return todo;
    } catch (error) {
      if (error instanceof TodoNotFoundError) {
        Logger.log('warn', error.message, { errorName: error.name });
        throw error;
      }

      Logger.log('error', 'Unexpected error retrieving todo', { error: String(error) });
      throw new Error('Failed to retrieve todo');
    }
  }

  // List Todos with Optional Filtering
  listTodos(filter?: Partial<Todo>): Todo[] {
    try {
      if (filter) {
        return this.todos.filter((todo) =>
          Object.entries(filter).every(([key, value]) => todo[key as keyof Todo] === value)
        );
      }
      return [...this.todos];
    } catch (error) {
      Logger.log('error', 'Error listing todos', { error: String(error) });
      throw new Error('Failed to list todos');
    }
  }
}

export { TodoManager, ValidationError, TodoNotFoundError, DuplicateTodoError, StorageError };
