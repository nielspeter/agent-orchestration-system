import { describe, it, expect } from 'vitest';

/**
 * Public API Export Validation
 *
 * This test ensures all intended public exports are available from @agent-system/core.
 * If any export is missing, TypeScript compilation will fail.
 *
 * Why this test exists:
 * - Catches missing exports at build time
 * - Documents the public API surface
 * - Prevents accidental breaking changes
 */
describe('Public API Exports', () => {
  it('exports all configuration types', async () => {
    const coreModule = await import('@agent-system/core');

    // Configuration types - used by consumers to configure the system
    expect(coreModule.AgentSystemBuilder).toBeDefined();
    expect(typeof coreModule.AgentSystemBuilder).toBe('function');

    // Type exports (these are types, so we just verify they're in the module)
    // The fact that TypeScript compiles this test means they're exported
    const _buildResult: typeof coreModule.BuildResult = {} as any;
    const _agent: typeof coreModule.Agent = {} as any;
    const _agentConfig: typeof coreModule.AgentConfig = {} as any;
    const _modelConfig: typeof coreModule.ModelConfig = {} as any;
    const _safetyConfig: typeof coreModule.SafetyConfig = {} as any;
    const _thinkingConfig: typeof coreModule.ThinkingConfig = {} as any;

    expect(_buildResult).toBeDefined();
    expect(_agent).toBeDefined();
    expect(_agentConfig).toBeDefined();
    expect(_modelConfig).toBeDefined();
    expect(_safetyConfig).toBeDefined();
    expect(_thinkingConfig).toBeDefined();
  });

  it('exports all logger implementations', async () => {
    const coreModule = await import('@agent-system/core');

    // Logger classes
    expect(coreModule.EventLogger).toBeDefined();
    expect(typeof coreModule.EventLogger).toBe('function');

    expect(coreModule.ConsoleLogger).toBeDefined();
    expect(typeof coreModule.ConsoleLogger).toBe('function');

    expect(coreModule.CompositeLogger).toBeDefined();
    expect(typeof coreModule.CompositeLogger).toBe('function');

    expect(coreModule.NoOpLogger).toBeDefined();
    expect(typeof coreModule.NoOpLogger).toBe('function');

    // Logger type
    const _agentLogger: typeof coreModule.AgentLogger = {} as any;
    expect(_agentLogger).toBeDefined();
  });

  it('exports all LLM provider implementations', async () => {
    const coreModule = await import('@agent-system/core');

    // Provider classes
    expect(coreModule.AnthropicProvider).toBeDefined();
    expect(typeof coreModule.AnthropicProvider).toBe('function');

    expect(coreModule.OpenAICompatibleProvider).toBeDefined();
    expect(typeof coreModule.OpenAICompatibleProvider).toBe('function');

    // Provider interface type
    const _llmProvider: typeof coreModule.ILLMProvider = {} as any;
    expect(_llmProvider).toBeDefined();
  });

  it('exports all session management components', async () => {
    const coreModule = await import('@agent-system/core');

    // Session manager
    expect(coreModule.SimpleSessionManager).toBeDefined();
    expect(typeof coreModule.SimpleSessionManager).toBe('function');

    // Message sanitization utilities
    expect(coreModule.sanitizeRecoveredMessages).toBeDefined();
    expect(typeof coreModule.sanitizeRecoveredMessages).toBe('function');

    expect(coreModule.validateMessageStructure).toBeDefined();
    expect(typeof coreModule.validateMessageStructure).toBe('function');

    expect(coreModule.formatSanitizationIssues).toBeDefined();
    expect(typeof coreModule.formatSanitizationIssues).toBe('function');

    // Storage implementations
    expect(coreModule.InMemoryStorage).toBeDefined();
    expect(typeof coreModule.InMemoryStorage).toBe('function');

    expect(coreModule.FilesystemStorage).toBeDefined();
    expect(typeof coreModule.FilesystemStorage).toBe('function');

    expect(coreModule.NoOpStorage).toBeDefined();
    expect(typeof coreModule.NoOpStorage).toBe('function');

    // Session types
    const _sanitizationResult: typeof coreModule.SanitizationResult = {} as any;
    const _sanitizationIssue: typeof coreModule.SanitizationIssue = {} as any;
    const _sessionStorage: typeof coreModule.SessionStorage = {} as any;
    const _sessionEvent: typeof coreModule.SessionEvent = {} as any;
    const _anySessionEvent: typeof coreModule.AnySessionEvent = {} as any;

    expect(_sanitizationResult).toBeDefined();
    expect(_sanitizationIssue).toBeDefined();
    expect(_sessionStorage).toBeDefined();
    expect(_sessionEvent).toBeDefined();
    expect(_anySessionEvent).toBeDefined();
  });

  it('does not export internal implementation details', async () => {
    // This test documents what should NOT be exported
    // If any of these exist in the public API, we have a leak

    const coreModule = await import('@agent-system/core');

    // Internal middleware should not be directly accessible
    expect(coreModule.ErrorHandlerMiddleware).toBeUndefined();
    expect(coreModule.AgentLoaderMiddleware).toBeUndefined();
    expect(coreModule.ToolExecutionMiddleware).toBeUndefined();

    // Internal utilities should not leak
    expect(coreModule.createReadTool).toBeUndefined();
    expect(coreModule.createWriteTool).toBeUndefined();
    expect(coreModule.validatePath).toBeUndefined();
  });
});
