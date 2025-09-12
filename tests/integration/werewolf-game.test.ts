import { describe, expect, it, beforeAll } from 'vitest';
import { AgentSystemBuilder } from '@/config';
import path from 'path';
import fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

// Configuration
const FIXTURE_COUNT = 5; // How many game fixtures we want
const FIXTURES_DIR = path.join(__dirname, '../fixtures/werewolf-games');

/**
 * Werewolf Game Fixture-Based Tests
 *
 * This test suite:
 * 1. Ensures we have FIXTURE_COUNT game recordings
 * 2. Generates missing fixtures automatically
 * 3. Runs all tests against all fixtures
 *
 * Benefits:
 * - Fast: Tests run in seconds, not minutes
 * - Comprehensive: Tests multiple game variations
 * - Cost-effective: API calls only when generating new fixtures
 * - Deterministic: Same games tested every time
 */

// Setup Phase: Ensure all fixtures exist
describe('Werewolf Game Fixture Setup', () => {
  it(`should have ${FIXTURE_COUNT} fixtures ready`, async () => {
    // Create fixtures directory if it doesn't exist
    if (!fs.existsSync(FIXTURES_DIR)) {
      fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    }

    // Check existing fixtures
    const existingFixtures = fs
      .readdirSync(FIXTURES_DIR)
      .filter((f) => f.startsWith('werewolf-fixture-'))
      .sort();

    console.log(`Found ${existingFixtures.length} existing fixtures`);

    // Generate missing fixtures
    for (let i = 1; i <= FIXTURE_COUNT; i++) {
      const sessionId = `werewolf-fixture-${String(i).padStart(3, '0')}`;
      const fixturePath = path.join(FIXTURES_DIR, sessionId);

      // Check if fixture exists
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

        // Run game to generate fixture
        await executor.execute('game-master', 'Start a werewolf game and play it to completion.');

        await cleanup();
        console.log(`✓ Generated fixture ${sessionId}`);
      }
    }

    // Verify all fixtures now exist
    const finalFixtures = fs
      .readdirSync(FIXTURES_DIR)
      .filter((f) => f.startsWith('werewolf-fixture-'));

    expect(finalFixtures.length).toBe(FIXTURE_COUNT);
  }, 600000); // 10 minutes timeout for generating all fixtures
});

// Test Phase: Run tests against all fixtures
for (let fixtureNum = 1; fixtureNum <= FIXTURE_COUNT; fixtureNum++) {
  const sessionId = `werewolf-fixture-${String(fixtureNum).padStart(3, '0')}`;

  describe(`Werewolf Game Tests - ${sessionId}`, () => {
    let messages: any[];
    let result: any;

    beforeAll(async () => {
      // ONLY load fixture messages directly from JSONL - NO AgentSystemBuilder!
      const fixturePath = path.join(FIXTURES_DIR, sessionId, 'events.jsonl');

      // Read the JSONL file directly
      if (fs.existsSync(fixturePath)) {
        const jsonlContent = fs.readFileSync(fixturePath, 'utf-8');
        const lines = jsonlContent
          .trim()
          .split('\n')
          .filter((line) => line);
        messages = lines.map((line) => JSON.parse(line));
        result = messages.length > 0;
      } else {
        messages = [];
        result = false;
      }
    });

    it('should complete the game successfully', () => {
      expect(result).toBeTruthy();
      expect(messages.length).toBeGreaterThan(10);

      // Verify game reached a conclusion
      const hasVictory = messages.some((msg: any) => {
        const content = msg.data?.content || '';
        return /victory|wins|game.*over|completed/i.test(content);
      });
      expect(hasVictory).toBe(true);
    });

    it('should delegate to role agents instead of simulating', () => {
      const taskDelegations = messages.filter(
        (msg: any) => msg.type === 'tool_call' && msg.data?.tool === 'Task'
      );

      const assistantMessages = messages.filter(
        (msg: any) => msg.type === 'assistant' && msg.data?.content
      );

      const simulatedPatterns = [
        /alice says.*:/i,
        /bob says.*:/i,
        /charlie says.*:/i,
        /"[^"]*"\s*[-–—]\s*(alice|bob|charlie)/i,
      ];

      const simulatedResponses = assistantMessages.filter((msg: any) =>
        simulatedPatterns.some((pattern) => pattern.test(msg.data?.content || ''))
      );

      expect(taskDelegations.length).toBeGreaterThan(0);
      expect(simulatedResponses.length).toBe(0);
    });

    it('should assign exactly one of each role', () => {
      const gameEvents = extractGameEvents(messages);

      expect(gameEvents.roleAssignments).toBeDefined();
      const roles = Object.values(gameEvents.roleAssignments);
      expect(roles).toHaveLength(3);
      expect(roles.filter((r: any) => r === 'werewolf')).toHaveLength(1);
      expect(roles.filter((r: any) => r === 'seer')).toHaveLength(1);
      expect(roles.filter((r: any) => r === 'villager')).toHaveLength(1);
    });

    it('should follow werewolf kill rules', () => {
      const gameEvents = extractGameEvents(messages);

      if (gameEvents.nightKills.length > 0) {
        const werewolf = Object.entries(gameEvents.roleAssignments).find(
          ([_, role]) => role === 'werewolf'
        )?.[0];

        // Werewolf should be the killer
        expect(gameEvents.nightKills[0].killer).toBe(werewolf);
        // Werewolf can't kill themselves
        expect(gameEvents.nightKills[0].victim).not.toBe(werewolf);
      }
    });

    it('should have consistent game state', () => {
      const gameEvents = extractGameEvents(messages);

      // Dead players should not be in alive players
      gameEvents.deadPlayers.forEach((dead) => {
        expect(gameEvents.alivePlayers).not.toContain(dead);
      });

      // Total players should be 3
      const totalPlayers = gameEvents.alivePlayers.length + gameEvents.deadPlayers.length;
      expect(totalPlayers).toBeLessThanOrEqual(3);
    });
  });
}

// Helper function to extract game events
function extractGameEvents(messages: any[]) {
  const events = {
    roleAssignments: {} as Record<string, string>,
    nightKills: [] as Array<{ killer: string; victim: string }>,
    deadPlayers: [] as string[],
    alivePlayers: [] as string[],
    winner: null as string | null,
  };

  messages.forEach((msg) => {
    // Handle tool result events for role assignments
    if (msg.type === 'tool_result' && msg.data?.tool === 'random_roles' && msg.data?.result) {
      try {
        const result = JSON.parse(msg.data.result);
        if (result.assignments) {
          events.roleAssignments = result.assignments;
        }
      } catch {}
    }

    // Handle assistant messages with role assignments
    if (msg.type === 'assistant' && msg.data?.content) {
      const content = msg.data.content;

      // Extract role assignments from game-master's messages
      if (!Object.keys(events.roleAssignments).length) {
        // Try different patterns for role assignments
        const patterns = [
          /{alice:\s*"(\w+)",\s*bob:\s*"(\w+)",\s*charlie:\s*"(\w+)"}/i,
          /{alice:\s*\\"(\w+)\\",\s*bob:\s*\\"(\w+)\\",\s*charlie:\s*\\"(\w+)\\"}/i,
        ];

        for (const pattern of patterns) {
          const roleMatch = content.match(pattern);
          if (roleMatch) {
            events.roleAssignments = {
              alice: roleMatch[1],
              bob: roleMatch[2],
              charlie: roleMatch[3],
            };
            break;
          }
        }
      }

      // Extract kills
      const killMatch = content.match(
        /(\w+),\s*(?:the\s+)?werewolf,\s*(?:chose|decided|will)\s*(?:to\s+)?kill\s+(\w+)/i
      );
      if (killMatch) {
        const [, killer, victim] = killMatch;
        events.nightKills.push({
          killer: killer.toLowerCase(),
          victim: victim.toLowerCase(),
        });
        if (!events.deadPlayers.includes(victim.toLowerCase())) {
          events.deadPlayers.push(victim.toLowerCase());
        }
      }

      // Extract winner
      if (content.toLowerCase().includes('win') || content.toLowerCase().includes('victory')) {
        events.winner = content;
      }
    }
  });

  // Calculate alive players
  if (events.alivePlayers.length === 0) {
    const allPlayers = ['alice', 'bob', 'charlie'];
    events.alivePlayers = allPlayers.filter((p) => !events.deadPlayers.includes(p));
  }

  return events;
}
