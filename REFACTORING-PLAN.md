# 📋 Folder Structure & Naming Refactoring Plan

## Executive Summary

This document outlines the proposed refactoring of the project's folder structure and naming conventions. The current structure works for an MVP but has several issues that will become problematic as the project grows.

**Status**: MVP-ready, but needs refactoring before production use.

## 🚨 Critical Issues Identified

### 1. Project Root Naming
- **Current**: `poc-typescript`
- **Problem**: "POC" in path indicates non-production code
- **Proposed**: `agent-orchestrator` or `agent-framework`
- **Priority**: Low (cosmetic, but impacts perception)

### 2. Scattered Tool Logic
```
Current distribution of tool-related code:
├── src/core/tool-executor.ts
├── src/core/tool-loader.ts
├── src/core/tool-registry.ts
├── src/tools/tool-registry.ts (duplicate!)
├── src/services/tool-executor.ts
└── src/tools/*.ts (implementations)
```
- **Problem**: Tool infrastructure split across 3 different modules
- **Impact**: Confusing imports, unclear ownership
- **Priority**: High

### 3. Excessive Nesting
```
src/core/logging/implementations/  # 3 levels deep
```
- **Problem**: Deep nesting makes imports verbose and navigation harder
- **Impact**: Developer experience, code readability
- **Priority**: Medium

### 4. Numbered Examples
```
examples/01-quickstart/
examples/02-orchestration/
examples/03-configuration/
```
- **Problem**: Adding/removing examples requires renumbering
- **Impact**: Maintenance overhead
- **Priority**: Low

### 5. Missing Barrel Exports
- **Problem**: No `index.ts` files for clean imports
- **Current**: `import { AgentExecutor } from '@/core/agent-executor'`
- **Desired**: `import { AgentExecutor } from '@/core/agents'`
- **Priority**: Medium

## 📁 Proposed Structure

```
agent-orchestrator/
├── src/
│   ├── agents/                 # Agent core logic
│   │   ├── executor.ts         # Main agent executor
│   │   ├── loader.ts           # Markdown agent loader
│   │   ├── types.ts            # Agent-specific types
│   │   └── index.ts            # Barrel export
│   │
│   ├── providers/              # LLM providers (renamed from llm/)
│   │   ├── anthropic.ts        # Anthropic Claude provider
│   │   ├── openai-compatible.ts # OpenRouter, etc.
│   │   ├── factory.ts          # Provider factory
│   │   ├── types.ts            # Provider types
│   │   └── index.ts
│   │
│   ├── middleware/             # Chain of responsibility pattern
│   │   ├── agent-loader.middleware.ts
│   │   ├── context-setup.middleware.ts
│   │   ├── error-handler.middleware.ts
│   │   ├── llm-call.middleware.ts
│   │   ├── provider-selection.middleware.ts
│   │   ├── safety-checks.middleware.ts
│   │   ├── tool-execution.middleware.ts
│   │   ├── pipeline.ts         # Pipeline executor
│   │   ├── types.ts            # Middleware types
│   │   └── index.ts            # Barrel export
│   │
│   ├── tools/
│   │   ├── registry/           # Tool infrastructure
│   │   │   ├── registry.ts     # Tool registry
│   │   │   ├── loader.ts       # Dynamic tool loader
│   │   │   ├── executor.ts     # Tool execution logic
│   │   │   └── index.ts
│   │   ├── built-in/           # Core tools
│   │   │   ├── file.tool.ts    # File operations
│   │   │   ├── grep.tool.ts    # Search tool
│   │   │   ├── shell.tool.ts   # Shell execution
│   │   │   ├── task.tool.ts    # Agent delegation
│   │   │   ├── todo.tool.ts    # Todo management
│   │   │   └── index.ts
│   │   ├── types.ts            # Tool interfaces
│   │   └── index.ts
│   │
│   ├── logging/                # Flattened from core/logging
│   │   ├── console.logger.ts   # Console output
│   │   ├── jsonl.logger.ts     # JSONL file logging
│   │   ├── composite.logger.ts # Multiple loggers
│   │   ├── factory.ts          # Logger factory
│   │   ├── types.ts            # Logger interfaces
│   │   └── index.ts
│   │
│   ├── config/                 # Configuration management
│   │   ├── builder.ts          # System builder
│   │   ├── types.ts            # Config types
│   │   └── index.ts
│   │
│   ├── metrics/                # NEW: Extract from core
│   │   ├── cache-collector.ts  # Cache metrics
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── todos/                  # NEW: Extract from core
│   │   ├── manager.ts          # Todo manager
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── lib/                    # Utilities (renamed from utils/)
│   │   ├── esm-helpers.ts
│   │   └── index.ts
│   │
│   ├── types.ts                # Global types
│   └── index.ts                # Main entry point
│
├── templates/                  # Agent templates (moved from root)
│   └── agents/
│       ├── default.md
│       ├── creative-writer.md
│       └── precise-analyzer.md
│
├── examples/                   # Remove numbering
│   ├── quickstart/
│   ├── orchestration/
│   ├── configuration/
│   ├── logging/
│   ├── mcp-integration/
│   ├── werewolf-game/
│   ├── session-analyzer/
│   ├── critical-illness/
│   └── script-tools/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/               # Test data
│
├── docs/                       # Documentation
│   ├── architecture.md
│   ├── middleware.md
│   └── tools.md
│
└── scripts/                    # Build/utility scripts
    └── create-agent.ts         # Agent scaffolding

```

## 🔄 Migration Plan

### Phase 1: Quick Wins (MVP) ⏱️ 1 hour
1. **Add barrel exports** (`index.ts`) to existing folders
2. **Rename numbered examples** (01-quickstart → quickstart)
3. **Move** `agents/` folder to `templates/agents/`
4. **Create** `ARCHITECTURE.md` documentation

### Phase 2: Core Refactoring (Post-MVP) ⏱️ 4 hours
1. **Consolidate tool infrastructure**
   - Move all tool-related core code to `src/tools/registry/`
   - Keep tool implementations in `src/tools/built-in/`
   
2. **Flatten logging structure**
   - Move `src/core/logging/implementations/` → `src/logging/`
   - Add `.logger.ts` suffix for clarity

3. **Extract scattered modules**
   - `src/core/cache-metrics-collector.ts` → `src/metrics/`
   - `src/core/todo-manager.ts` → `src/todos/`

4. **Rename for clarity**
   - `src/llm/` → `src/providers/`
   - `src/utils/` → `src/lib/`
   - Remove redundant prefixes from files

### Phase 3: Polish (Future) ⏱️ 2 hours
1. **Consistent suffixes**
   - `.tool.ts` for tool implementations
   - `.logger.ts` for loggers
   - `.middleware.ts` for middleware (already done ✅)

2. **Documentation**
   - Add README.md to each major module
   - Create architecture diagrams
   - Document naming conventions

## 📊 Impact Analysis

### Positive Impacts
- ✅ Clearer module boundaries
- ✅ Easier navigation
- ✅ Better import statements
- ✅ More maintainable
- ✅ Production-ready appearance

### Negative Impacts
- ⚠️ Breaking changes for imports
- ⚠️ Need to update all tests
- ⚠️ Documentation updates required
- ⚠️ Git history disruption

## 🎯 Naming Conventions

### Files
- **Modules**: `lowercase-kebab.ts`
- **Middleware**: `*.middleware.ts`
- **Tools**: `*.tool.ts` (proposed)
- **Loggers**: `*.logger.ts` (proposed)
- **Tests**: `*.test.ts`
- **Types**: `types.ts` in each module

### Folders
- **Plural for collections**: `tools/`, `agents/`, `providers/`
- **Singular for singletons**: `config/`, `logging/`
- **Descriptive names**: No abbreviations or numbers

### Exports
- **Barrel exports**: Every module should have `index.ts`
- **Named exports**: Prefer over default exports
- **Re-export types**: Include types in barrel exports

## ✅ Current Good Practices (Keep)
- TypeScript path aliases (`@/`)
- Middleware naming convention (`.middleware.ts`)
- Clear separation of middleware responsibilities
- Agent definitions in markdown
- YAML frontmatter for configuration

## 🚫 Anti-patterns to Avoid
- Deep nesting (>2 levels)
- Duplicate code across modules
- Numbered folders
- Missing barrel exports
- Redundant prefixes in filenames
- "POC" or "test" in production paths

## 📈 Metrics for Success
- **Import depth**: Max 3 levels (`@/module/submodule`)
- **File count per folder**: 5-10 files max
- **Module cohesion**: Related code in same module
- **No circular dependencies**: Enforced by ESLint
- **Consistent naming**: 100% adherence to conventions

## 🗓️ Timeline

| Phase | Priority | Effort | When |
|-------|----------|--------|------|
| Quick Wins | High | 1 hour | Before next release |
| Core Refactoring | Medium | 4 hours | Next sprint |
| Polish | Low | 2 hours | Future |

## 📝 Notes

- This refactoring should be done incrementally
- Each phase should be a separate PR
- Update tests after each phase
- Consider using automated refactoring tools
- Document breaking changes in CHANGELOG

## 🤔 Open Questions

1. Should we use `.tool.ts` suffix consistently?
2. Is `providers/` better than `llm/`?
3. Should we have a `shared/` or `common/` folder?
4. Do we need `src/types/` for shared types?
5. Should examples have their own `package.json`?

---

*Document created: 2024-01-09*
*Status: Draft - Pending Review*
*Author: Senior Developer Review*