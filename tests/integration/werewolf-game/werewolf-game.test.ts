import { expect, it } from 'vitest';
import { GameEventParser } from './parser';
import './matchers';
import { AgentSystemBuilder } from '@/config';
import { describeWithFixtures } from '../../utils/fixture-runner';
import type { EventMessage } from '../../types/event-types';
import path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

// Configuration
const FIXTURE_COUNT = parseInt(process.env.WEREWOLF_FIXTURE_COUNT || '5', 10);
const MODEL = process.env.WEREWOLF_TEST_MODEL || 'openrouter/openai/gpt-4o';
const MAX_ITERATIONS = parseInt(process.env.WEREWOLF_MAX_ITERATIONS || '50', 10);
const WARN_AT_ITERATION = parseInt(process.env.WEREWOLF_WARN_AT || '30', 10);
const MAX_DEPTH = parseInt(process.env.WEREWOLF_MAX_DEPTH || '10', 10);

/**
 * Werewolf Game Integration Tests
 *
 * Uses fixture-based testing for fast, deterministic test execution.
 * Fixtures are generated once and reused across test runs.
 *
 * Environment variables:
 * - WEREWOLF_FIXTURE_COUNT: Number of fixtures to generate (default: 5)
 * - WEREWOLF_TEST_MODEL: Model to use for generation (default: openrouter/openai/gpt-4o)
 * - WEREWOLF_MAX_ITERATIONS: Max iterations per game (default: 50)
 * - WEREWOLF_WARN_AT: Warn at iteration count (default: 30)
 * - WEREWOLF_MAX_DEPTH: Max delegation depth (default: 10)
 */

// Use the fixture runner for cleaner test organization
describeWithFixtures(
  {
    name: 'Werewolf Game',
    fixtureDir: path.join(__dirname, 'fixtures'),
    fixtureCount: FIXTURE_COUNT,
    fixturePrefix: 'werewolf-fixture',
    // Generator function for creating new fixtures
    generator: async (sessionId: string) => {
      const { executor, cleanup } = await AgentSystemBuilder.default()
        .withModel(MODEL)
        .withAgentsFrom(path.join(__dirname, '../../../examples/werewolf-game/agents'))
        .withToolsFrom(path.join(__dirname, '../../../examples/werewolf-game/tools'))
        .withStorage('filesystem', path.join(__dirname, 'fixtures'))
        .withSessionId(sessionId)
        .withSafetyLimits({
          maxIterations: MAX_ITERATIONS,
          warnAtIteration: WARN_AT_ITERATION,
          maxDepth: MAX_DEPTH,
          maxTokensEstimate: 100000,
        })
        .build();

      await executor.execute('game-master', 'Start a werewolf game and play it to completion.');
      await cleanup();
    },
  },
  ({ messages }: { messages: EventMessage[] }) => {
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
  }
);
