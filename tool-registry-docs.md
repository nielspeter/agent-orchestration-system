# Tool Registry Documentation

## File Tools

### 1. Read Tool
- **Name**: `read`
- **Description**: Reads the contents of a file.
- **Parameters**:
  - `path` (string): The path to the file to read.
- **Execution**: Returns the content of the file or an error message if it fails.

### 2. Write Tool
- **Name**: `write`
- **Description**: Writes content to a file.
- **Parameters**:
  - `path` (string): The path to the file to write.
  - `content` (string): The content to write to the file.
- **Execution**: Creates the directory if it doesn't exist and writes the specified content to the file, returning a success message or an error message if it fails.

### 3. List Tool
- **Name**: `list`
- **Description**: Lists files in a directory.
- **Parameters**:
  - `path` (string): The path to the directory.
- **Execution**: Returns a list of files in the directory or an error message if it fails.

## Task Tool

### Task Tool
- **Name**: `Task`
- **Description**: Delegates a task to another specialized agent.
- **Parameters**:
  - `subagent_type` (string): The name of the agent to delegate to.
  - `prompt` (string): The task or question for the agent to handle.
  - `description` (string, optional): A brief description of the task.
- **Execution**: This tool is a placeholder and does not execute anything itself; it requires the `AgentExecutor` to handle task execution.