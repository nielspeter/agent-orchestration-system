/**
 * Dynamic Skills System Demo
 *
 * Demonstrates how agents load domain expertise on-demand using the skill tool.
 *
 * This example shows:
 * 1. Dynamic skill loading based on task requirements
 * 2. Multiple skills in a single session
 * 3. Conversation history as cache (no need to reload)
 * 4. Resource references from skills
 *
 * Skills used (from ../udbud/skills/):
 * - danish-tender-guidelines: Marker system and compliance rules
 * - architecture-analyzer: Architecture pattern recognition and risk assessment
 * - complexity-calculator: Effort estimation formulas and complexity scoring
 */

import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentSystemBuilder } from '@agent-system/core';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('Dynamic Skills System Demo');
  console.log('='.repeat(80) + '\n');

  // Build agent system with skills registry
  const { executor, cleanup } = await AgentSystemBuilder.default()
    .withAgentsFrom(path.join(__dirname, 'agents'))
    .withSkillsFrom(path.join(__dirname, '../udbud/skills')) // Load real udbud skills
    .withModel(process.env.MODEL || 'anthropic/claude-haiku-4-5')
    .withConsole({ enabled: true, color: true })
    .build();

  try {
    // =============================================================================
    // Scenario 1: Analyze Tender - Loads Multiple Skills Dynamically
    // =============================================================================
    console.log('\n' + '-'.repeat(80));
    console.log('Scenario 1: Full Tender Analysis (Dynamic Skill Loading)');
    console.log('-'.repeat(80) + '\n');

    const sampleTenderPath = path.join(__dirname, 'sample-data/sample-tender.md');

    const analysis = await executor.execute(
      'tender-analyst',
      `Analyze this Danish public tender document and produce a technical analysis.

The tender document is at: ${sampleTenderPath}

Your task:
1. Load the danish-tender-guidelines skill to understand the marker system
2. Read the tender document
3. Load the architecture-analyzer skill to analyze the technical architecture
4. Load the complexity-calculator skill to estimate development effort
5. Produce a brief TEKNISK-ANALYSE summary (not a full file, just key points)

Focus on:
- Architecture pattern and complexity score
- Integration complexity assessment
- Development effort estimate with methodology
- Use proper markers ([FAKTA], [ESTIMAT], etc.)

Keep the analysis concise for demo purposes.`
    );

    console.log('\n📊 Analysis Result:\n');
    console.log(analysis);

    // =============================================================================
    // Scenario 2: Follow-up Question - Uses Cached Skills (No Reload)
    // =============================================================================
    console.log('\n' + '-'.repeat(80));
    console.log('Scenario 2: Follow-up Question (Conversation Cache)');
    console.log('-'.repeat(80) + '\n');
    console.log('ℹ️  Skills are already in conversation history - no need to reload!\n');

    const followUp = await executor.execute(
      'tender-analyst',
      `Based on your previous analysis, answer this follow-up question:

What are the TOP 3 technical risks for this project?

Use the architecture-analyzer skill knowledge (already in context) to identify anti-patterns or risk factors.
Mark your risk assessments properly with [ESTIMAT].

Be concise - just list the 3 risks with brief explanations.`
    );

    console.log('\n🚨 Top 3 Risks:\n');
    console.log(followUp);

    // =============================================================================
    // Scenario 3: Resource Reference - Read Skill Reference Documents
    // =============================================================================
    console.log('\n' + '-'.repeat(80));
    console.log('Scenario 3: Resource Reference (Skill Reference Docs)');
    console.log('-'.repeat(80) + '\n');

    const resourceDemo = await executor.execute(
      'tender-analyst',
      `The danish-tender-guidelines skill has reference documentation.

Without loading any new skills (you already have it in context):
1. What reference documents are available in the danish-tender-guidelines skill?
2. Pick one reference document and briefly explain when you would use it

Be concise.`
    );

    console.log('\n📚 Reference Documentation:\n');
    console.log(resourceDemo);

    // =============================================================================
    // Summary: Skill Usage Statistics
    // =============================================================================
    console.log('\n' + '='.repeat(80));
    console.log('Demo Complete - Key Takeaways');
    console.log('='.repeat(80) + '\n');

    console.log('✅ Demonstrated:');
    console.log('   1. Dynamic skill loading based on task requirements');
    console.log('   2. Multiple skills (3) loaded in a single session');
    console.log('   3. Conversation history as cache (follow-up used cached skills)');
    console.log('   4. Resource references from skills\n');

    console.log('📦 Skills Used:');
    console.log('   - danish-tender-guidelines: Marker system and compliance rules');
    console.log('   - architecture-analyzer: Architecture patterns and risk assessment');
    console.log('   - complexity-calculator: Effort estimation and complexity scoring\n');

    console.log('💡 Key Benefit:');
    console.log('   Skills are loaded ONCE and cached in conversation history.');
    console.log('   No separate cache mechanism needed - conversation context IS the cache!\n');
  } finally {
    await cleanup();
  }
}

// Run the demo
main().catch((error) => {
  console.error('Demo failed:', error);
  process.exit(1);
});
