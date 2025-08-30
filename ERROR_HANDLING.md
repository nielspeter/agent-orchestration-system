# Todo Manager Error Handling Patterns

## 1. Custom Error Classes

The todo-manager implements a set of custom error classes to provide precise error typing and handling:

- `ValidationError`: Thrown when input fails validation (e.g., empty todo content)
- `TodoNotFoundError`: Indicates that a requested todo does not exist
- `DuplicateTodoError`: Prevents creating duplicate todos
- `StorageError`: Reserved for potential future persistence-related errors

### Example:
```typescript
// Precise error typing allows for granular error handling
try {
  todoManager.addTodo('');  // Throws ValidationError
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle specific validation scenarios
  }
}
```

## 2. Logging Mechanism

A centralized `Logger` class provides structured logging with key features:
- Timestamp tracking
- Log level support (info, warn, error)
- Contextual information logging
- JSON-formatted log entries

### Logging Principles:
- Every significant operation is logged
- Errors are logged with context
- Different log levels for different severity

```typescript
Logger.log('info', 'Todo added successfully', { todoId: newTodo.id });
Logger.log('error', 'Unexpected error', { error: String(error) });
```

## 3. Input Validation Strategy

Comprehensive input validation is implemented through:
- Mandatory field checks
- Content trimming
- Status validation
- Duplicate prevention

### Validation Approach:
- Validate before processing
- Throw specific errors for different validation scenarios
- Prevent invalid data from entering the system

```typescript
private validateTodo(todo: Partial<Todo>): void {
  if (!todo.content || todo.content.trim() === '') {
    throw new ValidationError('Todo content cannot be empty');
  }
}
```

## 4. Error Recovery and Handling

Key error handling principles:
- Catch and handle specific error types
- Provide meaningful error messages
- Log errors with context
- Prevent system-wide failures

### Error Handling Pattern:
```typescript
try {
  // Attempt operation
} catch (error) {
  if (error instanceof TodoNotFoundError) {
    // Specific handling for not found errors
    Logger.log('warn', error.message);
  } else {
    // Fallback error handling
    Logger.log('error', 'Unexpected error');
    throw new Error('Operation failed');
  }
}
```

## 5. Best Practices Demonstrated

- Type-safe error handling
- Granular error classes
- Comprehensive logging
- Preventive validation
- Clear error messages
- Contextual error information

## Recommended Usage

```typescript
const todoManager = new TodoManager();

try {
  const todo = todoManager.addTodo('Learn TypeScript');
  todoManager.updateTodo(todo.id, { status: 'completed' });
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Invalid input:', error.message);
  } else if (error instanceof TodoNotFoundError) {
    console.error('Todo not found:', error.message);
  } else {
    console.error('Unexpected error occurred');
  }
}
```

## Extensibility

The error handling system is designed to be easily extended:
- Add new custom error classes as needed
- Enhance Logger with additional logging backends
- Implement more specific validation rules