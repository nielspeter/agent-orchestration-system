import { describe, expect, it } from 'vitest';
import path from 'path';
import fs from 'fs';

export interface FixtureConfig {
  name: string;
  fixtureDir: string;
  fixtureCount: number;
  fixturePrefix?: string;
  fixtureBasePath?: string; // Optional base path for fixtures
  generator?: (sessionId: string) => Promise<void>;
  validateCompletion?: (messages: any[]) => boolean;
}

export interface FixtureData {
  sessionId: string;
  messages: any[];
  events: any;
}

/**
 * Higher-order test runner that manages fixture lifecycle and provides
 * a clean API for fixture-based testing. Inspired by Jest/Vitest patterns.
 *
 * @example
 * describeWithFixtures({
 *   name: 'My Game',
 *   fixtureDir: 'my-game',
 *   fixtureCount: 3
 * }, ({ messages, events }) => {
 *   it('should complete', () => {
 *     expect(messages).toHaveLength(greaterThan(10));
 *   });
 * });
 */
export function describeWithFixtures(
  config: FixtureConfig,
  testSuite: (fixture: FixtureData) => void
) {
  // Allow configurable base path, default to fixture directory directly
  const fixturesDir = config.fixtureBasePath
    ? path.join(config.fixtureBasePath, config.fixtureDir)
    : path.isAbsolute(config.fixtureDir)
      ? config.fixtureDir
      : path.join(process.cwd(), config.fixtureDir);
  const prefix = config.fixturePrefix || 'fixture';

  // Setup phase: Ensure fixtures exist
  describe(`${config.name} - Fixture Setup`, () => {
    it(`should have ${config.fixtureCount} fixtures ready`, async () => {
      // Create fixtures directory if needed
      if (!fs.existsSync(fixturesDir)) {
        fs.mkdirSync(fixturesDir, { recursive: true });
      }

      // Check and generate missing fixtures
      for (let i = 1; i <= config.fixtureCount; i++) {
        const sessionId = `${prefix}-${String(i).padStart(3, '0')}`;
        const fixturePath = path.join(fixturesDir, sessionId);
        const eventsPath = path.join(fixturePath, 'events.jsonl');

        if (!fs.existsSync(eventsPath)) {
          if (config.generator) {
            console.log(`Generating fixture ${i}/${config.fixtureCount}: ${sessionId}`);
            await config.generator(sessionId);
          } else {
            console.log(
              `Fixture ${i}/${config.fixtureCount}: ${sessionId} - No generator provided, skipping`
            );
          }
        } else {
          console.log(
            `Fixture ${i}/${config.fixtureCount}: ${sessionId} - Already exists, skipping`
          );
        }
      }

      // Verify all fixtures exist
      const fixtures = fs.readdirSync(fixturesDir).filter((f) => f.startsWith(prefix));

      expect(fixtures.length).toBe(config.fixtureCount);
    }, 600000); // 10 minute timeout for generation
  });

  // Test phase: Run tests against each fixture using describe.each
  const fixtureIds = Array.from(
    { length: config.fixtureCount },
    (_, i) => `${prefix}-${String(i + 1).padStart(3, '0')}`
  );

  describe.each(fixtureIds)(`${config.name} - %s`, (sessionId) => {
    // Load fixture immediately - don't wait for beforeAll
    const fixtureData = loadFixture(fixturesDir, sessionId);

    testSuite({
      sessionId,
      messages: fixtureData.messages,
      events: fixtureData.events,
    });
  });
}

/**
 * Load and parse a fixture from disk
 */
function loadFixture(fixturesDir: string, sessionId: string): FixtureData {
  const fixturePath = path.join(fixturesDir, sessionId, 'events.jsonl');

  if (!fs.existsSync(fixturePath)) {
    return { sessionId, messages: [], events: {} };
  }

  const jsonlContent = fs.readFileSync(fixturePath, 'utf-8');
  const lines = jsonlContent
    .trim()
    .split('\n')
    .filter((line) => line);
  const messages = lines
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  // Parse events will be done by GameEventParser
  return { sessionId, messages, events: {} };
}
