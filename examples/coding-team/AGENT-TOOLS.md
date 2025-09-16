# Agent Tool Requirements

This document explains the tools each agent needs and why.

## Driver Agent
**Tools:** `["List", "TodoWrite", "Task"]`
- **List** - Explores project structure to understand the codebase
- **TodoWrite** - Tracks implementation progress with a task list
- **Task** - Delegates work to specialist agents (implementer, test-writer, code-reviewer)

**Does NOT need:**
- Read/Write - Driver doesn't implement code, only orchestrates
- Shell - Driver doesn't run commands, delegates verification to implementer

## Implementer Agent
**Tools:** `["Read", "Write", "List", "Shell"]`
- **List** - Explores project structure to find appropriate locations
- **Read** - Understands existing code patterns and conventions
- **Write** - Creates the actual implementation files
- **Shell** - Runs type checking and build commands to verify code compiles

## Test Writer Agent
**Tools:** `["Read", "Write", "List", "Shell"]`
- **List** - Explores project to find test directories
- **Read** - Reads implementation to understand what to test
- **Write** - Creates test files
- **Shell** - Runs tests to verify they pass

## Code Reviewer Agent
**Tools:** `["Read", "List"]`
- **List** - Explores project structure
- **Read** - Examines implementation and test files for review

**Does NOT need:**
- Write - Reviewer provides feedback but doesn't modify code
- Shell - Reviewer analyzes code statically, doesn't need to run it

## Key Principle: Minimal Necessary Tools

Each agent only gets the tools it actually needs for its role. This:
1. **Enforces separation of concerns** - Driver can't accidentally write code
2. **Improves security** - Agents have minimal permissions
3. **Makes debugging easier** - Clear what each agent can and cannot do
4. **Documents intent** - Tool list shows what the agent is designed to do