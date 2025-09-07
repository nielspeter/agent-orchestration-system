/**
 * Tool-specific error types
 */

export class ToolRegistryError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'ToolRegistryError';
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ToolRegistryError.prototype);
  }
}

export class InvalidToolError extends ToolRegistryError {
  constructor(
    public tool: unknown,
    public missingFields: string[]
  ) {
    super(`Invalid tool: missing ${missingFields.join(', ')}`, 'INVALID_TOOL');
    this.name = 'InvalidToolError';
    Object.setPrototypeOf(this, InvalidToolError.prototype);
  }
}

export class DuplicateToolError extends ToolRegistryError {
  constructor(public toolName: string) {
    super(`Tool ${toolName} is already registered`, 'DUPLICATE_TOOL');
    this.name = 'DuplicateToolError';
    Object.setPrototypeOf(this, DuplicateToolError.prototype);
  }
}

export class ToolNotFoundError extends ToolRegistryError {
  constructor(
    public toolName: string,
    public availableTools: string[]
  ) {
    super(
      `Tool '${toolName}' not found. Available: ${availableTools.join(', ')}`,
      'TOOL_NOT_FOUND'
    );
    this.name = 'ToolNotFoundError';
    Object.setPrototypeOf(this, ToolNotFoundError.prototype);
  }
}

export class InvalidToolNameError extends ToolRegistryError {
  constructor(public toolName: string) {
    super(
      `Invalid tool name format: '${toolName}'. Must match /^[a-zA-Z0-9-_]+$/`,
      'INVALID_TOOL_NAME'
    );
    this.name = 'InvalidToolNameError';
    Object.setPrototypeOf(this, InvalidToolNameError.prototype);
  }
}

export class InvalidToolSchemaError extends ToolRegistryError {
  constructor(
    public toolName: string,
    message: string
  ) {
    super(`Invalid parameters schema for tool '${toolName}': ${message}`, 'INVALID_SCHEMA');
    this.name = 'InvalidToolSchemaError';
    Object.setPrototypeOf(this, InvalidToolSchemaError.prototype);
  }
}
