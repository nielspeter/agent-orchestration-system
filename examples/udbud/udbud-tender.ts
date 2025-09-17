/**
 * Udbud Tender Example
 *
 * Demonstrates how multiple agents collaborate to analyze and prepare tender/bid documentation.
 * The orchestrator coordinates specialized agents for document conversion, technical analysis,
 * go/no-go decisions, and clarification questions.
 *
 * This example shows:
 * - Multi-agent orchestration for complex document analysis
 * - Specialized agents for different aspects of tender preparation
 * - TodoWrite for task tracking and progress visibility
 * - Structured analysis with FAKTA/ESTIMAT/ANTAGET/UKENDT distinctions
 */

import { AgentSystemBuilder } from '@/config';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTenderAnalysis() {
  console.log('🏢 Starting Udbud Tender Analysis');
  console.log('='.repeat(50));

  // Build the system with tender agents
  const system = await AgentSystemBuilder.default()
    .withAgentsFrom(path.join(__dirname, 'agents'))
    .addBuiltinTools('shell') // Add shell to the default tools
    .with({
      safety: {
        maxIterations: 30, // Tender analysis may require more iterations
        maxDepth: 5,
        warnAtIteration: 15,
      },
      console: {
        verbosity: 'verbose', // Show detailed progress including tool results
      },
    })
    .build();

  // Get command line argument for tender type or default to public
  const tenderType = process.argv[2] || 'offentlig';

  const tenderRequest = `
Analyze tender documents for a ${tenderType} (${tenderType === 'offentlig' ? 'public' : 'private'}) tender.

**Document Locations:**
- Source documents (DOCX/PDF): examples/udbud/dokumenter/udbud/
- Output directory for all generated files: examples/udbud/output/
- Converted markdown documents: examples/udbud/output/converted/

**Workflow to execute:**
1. First, use tender-setup to initialize the project:
   - Create output directory structure
   - Scan source documents
   - Generate PROJECT-CONTEXT.md and UDBUDSOVERSIGT.md in output/
   - Set up initial TODO list

2. If needed, use document-converter to convert DOCX/PDF files:
   - Convert documents from dokumenter/udbud/ to markdown
   - Save converted files in output/converted/

3. Then delegate analysis tasks (these can run in parallel):
   - technical-analyst: Create TEKNISK-ANALYSE.md in output/
   - go-no-go-analyzer: Create GO-NO-GO-BESLUTNING.md in output/
   - question-clarifier: Create SPØRGSMÅL-AFKLARINGER.md in output/

**Important Guidelines:**
- All analysis must distinguish between [FAKTA], [ESTIMAT], [ANTAGET], and [UKENDT]
- Focus on actionable insights for Nine A/S tender team
- Track progress using TodoWrite throughout the process
  `;

  console.log('\n📋 Tender Analysis Request:');
  console.log(tenderRequest);
  console.log('\n' + '='.repeat(50));

  // Execute the orchestrator agent
  console.log('\n🎯 Tender orchestrator starting analysis...\n');

  try {
    const result = await system.executor.execute('tender-orchestrator', tenderRequest);

    console.log('\n' + '='.repeat(50));
    console.log('✅ Tender Analysis Complete!');
    console.log('\n📊 Analysis Summary:');
    console.log(result);

    // List generated files
    console.log('\n📁 Generated Documents in examples/udbud/output/:');
    console.log('- output/PROJECT-CONTEXT.md - Project configuration and context');
    console.log('- output/UDBUDSOVERSIGT.md - Comprehensive tender overview');
    console.log('- output/TEKNISK-ANALYSE.md - Technical analysis for developers');
    console.log('- output/GO-NO-GO-BESLUTNING.md - Decision support for management');
    console.log('- output/SPØRGSMÅL-AFKLARINGER.md - Clarification questions');
    console.log('- output/converted/ - Converted markdown versions of tender documents');

    console.log('\n💡 Next Steps:');
    console.log('1. Review GO-NO-GO-BESLUTNING.md for decision making');
    console.log('2. Submit questions from SPØRGSMÅL-AFKLARINGER.md before deadline');
    console.log('3. Use TEKNISK-ANALYSE.md for resource planning');
    console.log('4. Update estimates based on clarification responses');
  } catch (error) {
    console.error('\n❌ Error during analysis:', error);
  } finally {
    // Cleanup
    await system.cleanup();
  }

  console.log('\n' + '='.repeat(50));
  console.log('🏁 Udbud Tender Analysis Complete');
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  runTenderAnalysis().catch(console.error);
}

export { runTenderAnalysis };
