# 📋 Types & Interfaces Review

## Executive Summary

The codebase has **significant type organization issues** that need addressing. Types are scattered across 5+ different `types.ts` files with unclear boundaries, inconsistent naming conventions, and circular dependency risks.

**Verdict**: Needs major refactoring for production readiness.

## 🚨 Critical Issues

### 1. **Multiple Competing types.ts Files**
```
src/types.ts           (77 lines)  - Global types
src/config/types.ts    (358 lines) - Config types (HUGE!)
src/core/types.ts      (16 lines)  - Core types
src/llm/types.ts       (21 lines)  - LLM types
src/tools/types.ts     (22 lines)  - Tool types
src/middleware/middleware-types.ts - Middleware types
```

**Problem**: Unclear which types belong where, leading to:
- Circular import risks
- Duplicate type definitions
- Confusion about where to add new types

### 2. **Interface vs Type Inconsistency**

```typescript
// Sometimes interface
export interface AgentDefinition { ... }
export interface ToolResult { ... }

// Sometimes type alias
export type Middleware = (ctx: MiddlewareContext, next: () => Promise<void>) => Promise<void>;
export type ToolOutput = { ... }

// No clear rule when to use which
```

**Problem**: No consistent convention for when to use `interface` vs `type`

### 3. **Config Interface Explosion**

Found 15+ different Config interfaces:
- `AgentConfig`
- `ToolConfig`
- `SafetyConfig`
- `CachingConfig`
- `MCPConfig`
- `LoggingConfig`
- `OpenAICompatibleConfig`
- `ProviderConfig`
- `ProvidersConfig`
- ... and more

**Problem**: Too many granular config types instead of a cohesive configuration model

### 4. **Poor Type Naming Conventions**

```typescript
// Inconsistent suffixes
ToolResult      // No suffix
ToolOutput      // Different concept?
ToolSchema      // Schema suffix
ToolParameter   // Parameter suffix
ToolCall        // Call suffix
ToolUse         // Use suffix
ToolExecutorConfig // Config suffix

// Which is the "main" tool type?
BaseTool vs Tool vs ToolSchema
```

### 5. **Missing Domain Boundaries**

Types mixed across concerns:
```typescript
// In src/types.ts (global)
export interface AgentDefinition { ... }  // Agent domain
export interface ToolResult { ... }       // Tool domain
export interface Message { ... }          // LLM domain
export interface ExecutionContext { ... } // Runtime domain
```

### 6. **Circular Dependency Risks**

```typescript
// src/core/types.ts imports from llm
import type { ConversationMessage, LLMProvider } from '../llm/types';

// src/config/types.ts imports from core
import type { LoggingConfig } from '@/core/logging';

// Potential for circular dependencies
```

## 🎯 Recommended Type Architecture

### Principle: Domain-Driven Types

Each domain owns its types, with a clear hierarchy:

```
src/
├── types/                      # Shared, primitive types only
│   ├── common.ts              # JSON, ID, Timestamp, etc.
│   ├── errors.ts              # Error types
│   └── index.ts               # Re-exports
│
├── agents/
│   └── types.ts               # AgentDefinition, AgentConfig
│
├── tools/
│   └── types.ts               # Tool, ToolResult, ToolCall
│
├── providers/
│   └── types.ts               # Provider, Model, Message
│
├── middleware/
│   └── types.ts               # Middleware, Context
│
└── config/
    └── types.ts               # SystemConfig (unified)
```

### Type Hierarchy

```typescript
// Level 1: Primitives (src/types/common.ts)
export type ID = string;
export type Timestamp = string;
export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
export interface JSONObject { [key: string]: JSONValue }
export type JSONArray = JSONValue[];

// Level 2: Domain Types (e.g., src/agents/types.ts)
import type { ID, JSONObject } from '@/types';

export interface Agent {
  id: ID;
  name: string;
  model?: string;
  temperature?: number;
  tools?: string[];
}

// Level 3: Runtime Types (e.g., src/middleware/types.ts)
import type { Agent } from '@/agents/types';
import type { Tool } from '@/tools/types';

export interface ExecutionContext {
  agent: Agent;
  tools: Tool[];
  // ...
}
```

## 📐 Type Guidelines

### When to Use Interface vs Type

```typescript
// ✅ Use INTERFACE for:
// - Objects that can be extended
// - Domain models
// - API contracts
export interface Agent {
  id: string;
  name: string;
}

// ✅ Use TYPE for:
// - Unions/intersections
// - Function signatures
// - Mapped types
// - Aliases
export type AgentRole = 'orchestrator' | 'worker' | 'validator';
export type Middleware = (ctx: Context) => Promise<void>;
export type Nullable<T> = T | null;
```

### Naming Conventions

```typescript
// ✅ GOOD: Clear, consistent naming
export interface Agent { }           // Entity
export interface AgentConfig { }     // Configuration
export type AgentID = string;        // ID type
export type AgentRole = '...';       // Enum/Union
export type CreateAgentInput = { };  // Input DTO
export type AgentResponse = { };     // Output DTO
export interface AgentRepository { } // Service interface

// ❌ BAD: Inconsistent, unclear
export interface AgentDefinition { } // What's a "definition"?
export interface AgentSchema { }     // Schema? Type? Model?
export type AgentType = { };        // Type of what?
```

### Config Consolidation

Instead of 15+ config interfaces:

```typescript
// ✅ GOOD: Unified configuration model
export interface SystemConfig {
  agents?: AgentConfig;
  tools?: ToolConfig;
  providers?: ProviderConfig;
  safety?: SafetyConfig;
  logging?: LoggingConfig;
  cache?: CacheConfig;
  mcp?: MCPConfig;
}

export interface AgentConfig {
  defaultModel?: string;
  defaultBehavior?: string;
  maxDepth?: number;
}

// Each section is optional and focused
```

## 🔄 Migration Plan

### Phase 1: Create Type Foundation (1 hour)
1. Create `src/types/` directory with:
   - `common.ts` - Shared primitives
   - `errors.ts` - Error types
   - `index.ts` - Barrel exports

2. Move truly global types here

### Phase 2: Domain Type Consolidation (2 hours)
1. Move agent types to `src/agents/types.ts`
2. Move tool types to `src/tools/types.ts`
3. Move provider types to `src/providers/types.ts`
4. Update imports

### Phase 3: Config Unification (1 hour)
1. Create unified `SystemConfig` interface
2. Consolidate 15+ config interfaces
3. Update all config consumers

### Phase 4: Cleanup (1 hour)
1. Remove duplicate types
2. Fix inconsistent naming
3. Add JSDoc comments
4. Update tests

## 📊 Type Metrics

### Current State
- **Files with types**: 22
- **Total interfaces**: ~50
- **Total type aliases**: ~30
- **Config interfaces**: 15+
- **Duplicate concepts**: 5+ (Tool variants)

### Target State
- **Files with types**: 6-8 (one per domain)
- **Total interfaces**: ~30 (consolidated)
- **Total type aliases**: ~20 (focused)
- **Config interfaces**: 5 (hierarchical)
- **Duplicate concepts**: 0

## 🚫 Anti-Patterns to Fix

1. **The "Everything Bucket"**
   ```typescript
   // ❌ BAD: src/types.ts with 20+ unrelated types
   ```

2. **The "Config Explosion"**
   ```typescript
   // ❌ BAD: 15+ separate config interfaces
   ```

3. **The "Synonym Game"**
   ```typescript
   // ❌ BAD: Tool, ToolSchema, ToolDefinition, ToolConfig
   ```

4. **The "Any Escape Hatch"**
   ```typescript
   // ❌ BAD: Still have 26 'any' types in codebase
   ```

5. **The "Circular Import Dance"**
   ```typescript
   // ❌ BAD: A imports from B, B imports from A
   ```

## ✅ Best Practices to Adopt

1. **Domain Ownership**: Each module owns its types
2. **Single Source of Truth**: One type per concept
3. **Clear Naming**: Entity, Config, Input, Output, etc.
4. **Type Safety**: No `any`, minimal `unknown`
5. **Documentation**: JSDoc for all public types
6. **Validation**: Runtime validation for external data
7. **Immutability**: Prefer `readonly` where possible

## 🎯 Specific Recommendations

### Immediate Actions (MVP)
1. **Fix the Tool type mess** - Pick ONE canonical Tool interface
2. **Consolidate config types** - Create SystemConfig
3. **Add barrel exports** - Every module needs clean exports

### Post-MVP
1. **Domain separation** - Move types to their domains
2. **Remove `any` types** - Replace with proper types
3. **Add runtime validation** - Use zod or similar

### Code Examples

```typescript
// ✅ GOOD: Clear, focused type file
// src/agents/types.ts

/**
 * Represents an agent definition loaded from markdown
 */
export interface Agent {
  id: string;
  name: string;
  description?: string;
  model?: string;
  behavior?: BehaviorPreset;
  tools?: string[];
}

export type BehaviorPreset = 
  | 'deterministic'
  | 'precise' 
  | 'balanced'
  | 'creative'
  | 'exploratory';

export interface AgentConfig {
  defaultModel: string;
  defaultBehavior: BehaviorPreset;
  maxDepth: number;
  maxIterations: number;
}

// Clear, focused, documented
```

## 📈 Success Metrics

- **Type coverage**: >95% (currently ~80%)
- **`any` usage**: 0 (currently 26)
- **Import depth**: Max 2 levels
- **Circular dependencies**: 0
- **Type files per module**: 1
- **Lines per type file**: <200

## 🤔 Open Questions

1. Should we use a validation library (zod, io-ts)?
2. Should we generate types from OpenAPI specs?
3. Do we need branded types for IDs?
4. Should we use const assertions more?
5. How to handle provider-specific types?

## 📝 Conclusion

The current type system is **functional but messy**. It works for an MVP but will become a maintenance nightmare as the codebase grows. The main issues are:

1. **No clear ownership** - Types scattered everywhere
2. **No naming conventions** - Inconsistent patterns
3. **Config explosion** - Too many granular interfaces
4. **Circular dependency risks** - Poor module boundaries

**Recommendation**: Implement Phase 1 immediately (1 hour), schedule remaining phases for next sprint.

---

*Document created: 2024-01-09*
*Status: Critical - Needs immediate attention*
*Impact: High - Affects entire codebase*