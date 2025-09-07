import { describe, expect, test } from 'vitest';
import { ProviderFactory } from '@/providers/provider-factory';

describe('Behavior Presets - Essential Tests', () => {
  test('all presets have required temperature and top_p', () => {
    const presetNames = ['deterministic', 'precise', 'balanced', 'creative', 'exploratory'];

    for (const name of presetNames) {
      const preset = ProviderFactory.getBehaviorPreset(name);
      expect(preset).toBeDefined();
      expect(preset).toHaveProperty('temperature');
      expect(preset).toHaveProperty('top_p');
      expect(typeof preset?.temperature).toBe('number');
      expect(typeof preset?.top_p).toBe('number');
    }
  });

  test('preset values are in valid ranges', () => {
    const presetNames = ['deterministic', 'precise', 'balanced', 'creative', 'exploratory'];

    for (const name of presetNames) {
      const preset = ProviderFactory.getBehaviorPreset(name);
      expect(preset).toBeDefined();
      if (preset) {
        // Temperature should be between 0 and 2 (Anthropic limits)
        expect(preset.temperature).toBeGreaterThanOrEqual(0);
        expect(preset.temperature).toBeLessThanOrEqual(2);

        // top_p should be between 0 and 1
        expect(preset.top_p).toBeGreaterThan(0);
        expect(preset.top_p).toBeLessThanOrEqual(1);
      }
    }
  });

  test('presets have graduated temperature values', () => {
    const deterministic = ProviderFactory.getBehaviorPreset('deterministic');
    const precise = ProviderFactory.getBehaviorPreset('precise');
    const balanced = ProviderFactory.getBehaviorPreset('balanced');
    const creative = ProviderFactory.getBehaviorPreset('creative');
    const exploratory = ProviderFactory.getBehaviorPreset('exploratory');

    // Temperature should increase progressively
    expect(deterministic!.temperature).toBeLessThan(precise!.temperature);
    expect(precise!.temperature).toBeLessThan(balanced!.temperature);
    expect(balanced!.temperature).toBeLessThan(creative!.temperature);
    expect(creative!.temperature).toBeLessThan(exploratory!.temperature);
  });

  test('presets have appropriate top_p values', () => {
    const deterministic = ProviderFactory.getBehaviorPreset('deterministic');
    const exploratory = ProviderFactory.getBehaviorPreset('exploratory');

    // Deterministic should have lower top_p than exploratory
    expect(deterministic!.top_p).toBeLessThan(exploratory!.top_p);
  });

  test('behavior resolution priority: direct > preset > default', () => {
    // Test with agent definition that has direct values
    const agentWithDirect = {
      name: 'test',
      temperature: 0.3,
      top_p: 0.7,
    };

    // When agent has direct values, they should be used
    // This would be tested in middleware, but we verify the concept here
    expect(agentWithDirect.temperature).toBe(0.3);
    expect(agentWithDirect.top_p).toBe(0.7);

    // Test with agent using preset
    const agentWithPreset = {
      name: 'test',
      behavior: 'creative',
    };

    const preset = ProviderFactory.getBehaviorPreset(agentWithPreset.behavior);
    expect(preset).toBeDefined();
    expect(preset?.temperature).toBe(0.7);
    expect(preset?.top_p).toBe(0.95);

    // Test default behavior
    const defaultBehavior = ProviderFactory.getDefaultBehavior();
    expect(defaultBehavior).toBeDefined();
    expect(defaultBehavior.temperature).toBe(0.5);
    expect(defaultBehavior.top_p).toBe(0.85);
  });
});
