import {
  TodoManager,
  ValidationError,
  TodoNotFoundError,
  DuplicateTodoError,
} from './todo-manager';

describe('TodoManager Error Handling', () => {
  let todoManager: TodoManager;

  beforeEach(() => {
    todoManager = new TodoManager();
  });

  // Input Validation Tests
  describe('Input Validation', () => {
    test('should throw ValidationError for empty todo content', () => {
      expect(() => todoManager.addTodo('')).toThrow(ValidationError);
      expect(() => todoManager.addTodo('  ')).toThrow(ValidationError);
    });

    test('should throw DuplicateTodoError for duplicate todo', () => {
      todoManager.addTodo('Test todo');
      expect(() => todoManager.addTodo('Test todo')).toThrow(DuplicateTodoError);
    });
  });

  // Not Found Error Tests
  describe('Not Found Errors', () => {
    test('should throw TodoNotFoundError when updating non-existent todo', () => {
      expect(() => todoManager.updateTodo('non-existent-id', { content: 'Updated' })).toThrow(
        TodoNotFoundError
      );
    });

    test('should throw TodoNotFoundError when deleting non-existent todo', () => {
      expect(() => todoManager.deleteTodo('non-existent-id')).toThrow(TodoNotFoundError);
    });

    test('should throw TodoNotFoundError when getting non-existent todo', () => {
      expect(() => todoManager.getTodoById('non-existent-id')).toThrow(TodoNotFoundError);
    });
  });

  // Successful Operations
  describe('Successful Operations', () => {
    test('should successfully add a todo', () => {
      const todo = todoManager.addTodo('New todo');
      expect(todo.content).toBe('New todo');
      expect(todo.status).toBe('pending');
    });

    test('should successfully update a todo', () => {
      const todo = todoManager.addTodo('Original todo');
      const updatedTodo = todoManager.updateTodo(todo.id, { status: 'completed' });
      expect(updatedTodo.status).toBe('completed');
    });
  });
});
