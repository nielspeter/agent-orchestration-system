import { beforeAll, describe, expect, it } from 'vitest';
import { GameEventParser } from '../utils/game-event-parser';
import '../matchers/game-matchers';
import { AgentSystemBuilder } from '@/config';
import path from 'path';
import fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

const FIXTURE_COUNT = 5;
const FIXTURES_DIR = path.join(__dirname, '../fixtures/werewolf-games');

/**
 * Werewolf Game Integration Tests
 *
 * Uses fixture-based testing for fast, deterministic test execution.
 * Fixtures are generated once and reused across test runs.
 */

// Setup phase: Ensure fixtures exist
describe('Werewolf Game - Fixture Setup', () => {
  it(`should have ${FIXTURE_COUNT} fixtures ready`, async () => {
    if (!fs.existsSync(FIXTURES_DIR)) {
      fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    }

    for (let i = 1; i <= FIXTURE_COUNT; i++) {
      const sessionId = `werewolf-fixture-${String(i).padStart(3, '0')}`;
      const fixturePath = path.join(FIXTURES_DIR, sessionId);

      if (!fs.existsSync(fixturePath)) {
        console.log(`Generating fixture ${i}/${FIXTURE_COUNT}: ${sessionId}`);

        const { executor, cleanup } = await AgentSystemBuilder.default()
          .withModel('openrouter/openai/gpt-4o')
          .withAgentsFrom(path.join(__dirname, '../../examples/werewolf-game/agents'))
          .withToolsFrom(path.join(__dirname, '../../examples/werewolf-game/tools'))
          .withStorage('filesystem', FIXTURES_DIR)
          .withSessionId(sessionId)
          .withSafetyLimits({
            maxIterations: 50,
            warnAtIteration: 30,
            maxDepth: 10,
            maxTokensEstimate: 100000,
          })
          .build();

        await executor.execute('game-master', 'Start a werewolf game and play it to completion.');
        await cleanup();
      }
    }

    const fixtures = fs.readdirSync(FIXTURES_DIR).filter((f) => f.startsWith('werewolf-fixture-'));

    expect(fixtures.length).toBe(FIXTURE_COUNT);
  }, 600000);
});

// Test phase: Run tests against each fixture
const fixtureIds = Array.from(
  { length: FIXTURE_COUNT },
  (_, i) => `werewolf-fixture-${String(i + 1).padStart(3, '0')}`
);

describe.each(fixtureIds)('Werewolf Game - %s', (sessionId) => {
  let messages: any[] = [];

  beforeAll(() => {
    const fixturePath = path.join(FIXTURES_DIR, sessionId, 'events.jsonl');

    if (fs.existsSync(fixturePath)) {
      const jsonlContent = fs.readFileSync(fixturePath, 'utf-8');
      const lines = jsonlContent
        .trim()
        .split('\n')
        .filter((line) => line);
      messages = lines
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    }
  });

  it('should complete the game successfully', () => {
    expect(messages).toHaveGameCompletion();
    expect(messages.length).toBeGreaterThan(10);
  });

  it('should delegate to role agents instead of simulating', () => {
    expect(messages).toHaveDelegatedToAgents(['werewolf', 'seer']);
    expect(messages).toNotSimulateResponses();
  });

  it('should assign exactly one of each role', () => {
    expect(messages).toHaveValidRoleAssignments(['werewolf', 'seer', 'villager']);
  });

  it('should have multiple agent interactions', () => {
    expect(messages).toHaveAgentInteractions(3);
  });

  it('should follow proper game phases', () => {
    const game = GameEventParser.parseGame(messages);

    // Game should have roles assigned
    expect(Object.keys(game.roles)).toHaveLength(3);

    // Game should have delegations (night/day actions)
    expect(game.delegations.length).toBeGreaterThan(2);

    // Game should reach a conclusion
    expect(game.hasVictory).toBe(true);
    expect(game.winner).toBeTruthy();
  });
});
