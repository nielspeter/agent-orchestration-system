import { Tool, ToolResult } from '../types';
import { TodoManager } from '@/todos';

/**
 * Todo item interface for task management
 */
export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
  id: string;
  activeForm: string; // Present continuous form for display during execution
}

/**
 * The TodoWrite tool - for task planning and progress tracking
 */
export const createTodoWriteTool = (todoManager: TodoManager): Tool => ({
  name: 'TodoWrite',
  description: `Use this tool to create and manage a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user.
It also helps the user understand the progress of the task and overall progress of their requests.

## When to Use This Tool
Use this tool proactively in these scenarios:

1. Complex multi-step tasks - When a task requires 3 or more distinct steps or actions
2. Non-trivial and complex tasks - Tasks that require careful planning or multiple operations  
3. User explicitly requests todo list - When the user directly asks you to use the todo list
4. User provides multiple tasks - When users provide a list of things to be done (numbered or comma-separated)
5. After receiving new instructions - Immediately capture user requirements as todos
6. When you start working on a task - Mark it as in_progress BEFORE beginning work. Ideally you should only have one todo as in_progress at a time
7. After completing a task - Mark it as completed and add any new follow-up tasks discovered during implementation

## When NOT to Use This Tool

Skip using this tool when:
1. There is only a single, straightforward task
2. The task is trivial and tracking it provides no organizational benefit
3. The task can be completed in less than 3 trivial steps
4. The task is purely conversational or informational

## Task States and Management

1. **Task States**: Use these states to track progress:
   - pending: Task not yet started
   - in_progress: Currently working on (limit to ONE task at a time)
   - completed: Task finished successfully

   **IMPORTANT**: Task descriptions must have two forms:
   - content: The imperative form describing what needs to be done (e.g., "Run tests", "Build the project")
   - activeForm: The present continuous form shown during execution (e.g., "Running tests", "Building the project")

2. **Task Management**:
   - Update task status in real-time as you work
   - Mark tasks complete IMMEDIATELY after finishing (don't batch completions)
   - Exactly ONE task must be in_progress at any time (not less, not more)
   - Complete current tasks before starting new ones
   - Remove tasks that are no longer relevant from the list entirely

3. **Task Completion Requirements**:
   - ONLY mark a task as completed when you have FULLY accomplished it
   - If you encounter errors, blockers, or cannot finish, keep the task as in_progress
   - When blocked, create a new task describing what needs to be resolved
   - Never mark a task as completed if:
     - Tests are failing
     - Implementation is partial
     - You encountered unresolved errors
     - You couldn't find necessary files or dependencies

4. **Task Breakdown**:
   - Create specific, actionable items
   - Break complex tasks into smaller, manageable steps
   - Use clear, descriptive task names
   - Always provide both forms:
     - content: "Fix authentication bug"
     - activeForm: "Fixing authentication bug"

When in doubt, use this tool. Being proactive with task management demonstrates attentiveness and ensures you complete all requirements successfully.`,

  parameters: {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        description: 'The updated todo list',
        items: {
          type: 'object',
          description: 'A todo item with status and priority',
          properties: {
            content: {
              type: 'string',
              description: 'The imperative form describing what needs to be done',
              minLength: 1,
            },
            status: {
              type: 'string',
              enum: ['pending', 'in_progress', 'completed'],
              description: 'Current status of the task',
            },
            priority: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
              description: 'Priority level of the task',
            },
            id: {
              type: 'string',
              description: 'Unique identifier for the task',
            },
            activeForm: {
              type: 'string',
              description: 'The present continuous form shown during execution',
              minLength: 1,
            },
          },
          required: ['content', 'status', 'activeForm'],
        },
      },
    },
    required: ['todos'],
  },

  execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
    try {
      const todos = args.todos as TodoItem[];
      // Update todos using the manager (includes validation)
      // No longer async - todos are stored in memory and persisted via session events
      todoManager.updateTodos(todos);

      return {
        content: `Todo list updated with ${todos.length} items. Tasks are tracked in session.`,
      };
    } catch (error) {
      return {
        content: null,
        error: `Failed to update todos: ${error}`,
      };
    }
  },

  isConcurrencySafe: () => false, // Todo management must be sequential to maintain state consistency
});
