import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentSystemBuilder, BuildResult } from '@/config/system-builder';
import type { AgentStartEvent } from '@/session/types';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Skills System Integration Tests', () => {
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

  test('agent can load skills', async () => {
    const result = await buildResult.executor.execute(
      'skill-user',
      'List the skills you have available'
    );

    expect(result).toBeDefined();
    expect(result.toLowerCase()).toContain('skill');
  }, 15000);

  test('skills are logged to session events', async () => {
    // Execute agent with skills
    await buildResult.executor.execute('skill-user', 'Say hello');

    // Get session events
    const events = await buildResult.logger.getSessionEvents();

    // Find agent_start event
    const agentStartEvent = events.find(
      (e) => e.type === 'agent_start' && e.data.agent === 'skill-user'
    ) as AgentStartEvent | undefined;

    expect(agentStartEvent).toBeDefined();
    expect(agentStartEvent?.data.skills).toBeDefined();
    expect(agentStartEvent?.data.skills).toContain('valid-skill');
    expect(agentStartEvent?.data.skills).toContain('skill-with-resources');

    // Check skill versions are logged
    expect(agentStartEvent?.data.skillVersions).toBeDefined();
    expect(agentStartEvent?.data.skillVersions?.['valid-skill']).toBe('1.0.0');
    expect(agentStartEvent?.data.skillVersions?.['skill-with-resources']).toBe('2.1.0');
  }, 15000);

  test('skill instructions are injected into agent prompt', async () => {
    const result = await buildResult.executor.execute(
      'skill-user',
      'What instructions do you have for testing skill loading?'
    );

    expect(result).toBeDefined();
    // The agent should mention something about skill loading since that's in valid-skill's instructions
    expect(result.toLowerCase()).toMatch(/skill|loading|testing/);
  }, 15000);

  test('agent can access skill with resources', async () => {
    const result = await buildResult.executor.execute(
      'skill-user',
      'Do you have any skills with reference documentation?'
    );

    expect(result).toBeDefined();
    // Agent should acknowledge having skills with resources
    expect(result.toLowerCase()).toMatch(/skill.*resource|resource.*skill|reference|documentation/);
  }, 15000);
});
