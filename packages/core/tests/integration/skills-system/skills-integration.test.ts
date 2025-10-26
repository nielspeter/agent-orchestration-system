import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentSystemBuilder, BuildResult } from '@/config/system-builder';
import type { ToolCallEvent, ToolResultEvent } from '@/session/types';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Dynamic Skills System Integration Tests', () => {
  let buildResult: BuildResult;

  beforeAll(async () => {
    const sessionId = `skills-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    buildResult = await AgentSystemBuilder.default()
      .withModel(process.env.MODEL || 'anthropic/claude-haiku-4-5')
      .withAgentsFrom(path.join(__dirname, 'agents'))
      .withSkillsFrom(path.join(__dirname, '../../test-fixtures/skills'))
      .withStorage('memory') // Use memory storage for tests
      .withSessionId(sessionId)
      .build();
  });

  afterAll(async () => {
    if (buildResult?.cleanup) {
      await buildResult.cleanup();
    }
  });

  test('agent can call skill tool to load a skill', async () => {
    const result = await buildResult.executor.execute(
      'skill-user',
      'Load the valid-skill and tell me what it contains'
    );

    expect(result).toBeDefined();
    // Agent should have loaded the skill and can describe it
    expect(result.toLowerCase()).toMatch(/skill|valid|loaded|instructions/);

    // Check that skill tool was called
    const events = await buildResult.logger.getSessionEvents();
    const skillToolCall = events.find(
      (e) => e.type === 'tool_call' && (e.data as any).name === 'skill'
    ) as ToolCallEvent | undefined;

    expect(skillToolCall).toBeDefined();
    expect((skillToolCall?.data as any).arguments).toContain('valid-skill');
  }, 20000);

  test('skill tool returns formatted content with instructions', async () => {
    await buildResult.executor.execute('skill-user', 'Load the valid-skill skill');

    // Get session events
    const events = await buildResult.logger.getSessionEvents();

    // Find skill tool result
    const toolResultEvent = events.find(
      (e) => e.type === 'tool_result' && (e.data as any).name === 'skill'
    ) as ToolResultEvent | undefined;

    expect(toolResultEvent).toBeDefined();
    const result = (toolResultEvent?.data as any).result;

    // Verify formatted content structure
    expect(result).toContain('# Skill Loaded: valid-skill');
    expect(result).toContain('Valid Skill Instructions');
    expect(result).toContain('This knowledge is now available for your task');
  }, 20000);

  test('agent can load skill with resources', async () => {
    const result = await buildResult.executor.execute(
      'skill-user',
      'Load the skill-with-resources skill and list its reference documentation'
    );

    expect(result).toBeDefined();

    // Get tool result to verify resources are listed
    const events = await buildResult.logger.getSessionEvents();
    const toolResults = events.filter(
      (e) => e.type === 'tool_result' && (e.data as any).name === 'skill'
    ) as ToolResultEvent[];

    // Find the skill-with-resources result
    const resourceSkillResult = toolResults.find((e) => {
      const result = (e.data as any).result;
      return result.includes('skill-with-resources');
    });

    expect(resourceSkillResult).toBeDefined();
    const resultContent = (resourceSkillResult?.data as any).result;

    // Verify resource sections are present
    expect(resultContent).toContain('Available Resources');
    expect(resultContent).toContain('Reference docs:');
    expect(resultContent).toContain('api-docs.md');
  }, 20000);

  test('skill tool handles non-existent skill with helpful error', async () => {
    await buildResult.executor.execute(
      'skill-user',
      'Try to load a skill called "nonexistent-skill"'
    );

    // Get session events
    const events = await buildResult.logger.getSessionEvents();

    // Find skill tool result with error
    const toolResults = events.filter(
      (e) => e.type === 'tool_result' && (e.data as any).name === 'skill'
    ) as ToolResultEvent[];

    const errorResult = toolResults.find((e) => {
      const result = (e.data as any).result;
      return result && result.includes('not found');
    });

    expect(errorResult).toBeDefined();
    const resultContent = (errorResult?.data as any).result;

    // Verify helpful error message with available skills
    expect(resultContent).toContain('not found');
    expect(resultContent).toContain('Available skills:');
    expect(resultContent).toContain('valid-skill');
    expect(resultContent).toContain('skill-with-resources');
  }, 20000);

  test('conversation history acts as cache (no need to reload)', async () => {
    const result = await buildResult.executor.execute(
      'skill-user',
      'Load valid-skill, then tell me what it says without reloading it'
    );

    expect(result).toBeDefined();

    // Get all skill tool calls
    const events = await buildResult.logger.getSessionEvents();
    const skillToolCalls = events.filter(
      (e) => e.type === 'tool_call' && (e.data as any).name === 'skill'
    );

    // Should only call skill tool once (conversation history serves as cache)
    expect(skillToolCalls.length).toBe(1);

    // Agent should still be able to reference the skill instructions
    expect(result.toLowerCase()).toMatch(/skill|valid|instructions/);
  }, 20000);
});
