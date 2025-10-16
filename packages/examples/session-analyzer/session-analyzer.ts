#!/usr/bin/env tsx
/**
 * Session Analysis Example - Analyze agent conversation logs
 *
 * This example demonstrates using the session-analyzer agent to:
 * 1. List available session files
 * 2. Analyze specific sessions
 * 3. Generate comprehensive reports with summaries, flow diagrams, and message logs
 *
 * The session-analyzer agent reads JSONL files and creates markdown reports
 * containing metrics, Mermaid diagrams, and detailed message tracking.
 */

import * as dotenv from 'dotenv';
import { AgentSystemBuilder } from '@agent-system/core';
import * as fs from 'fs/promises';
import * as path from 'node:path';
import * as readline from 'readline/promises';

// Load environment variables
dotenv.config({ path: '../../.env' });

async function listSessions(): Promise<string[]> {
  const logsDir = path.join(process.cwd(), 'logs');

  try {
    const files = await fs.readdir(logsDir);
    return files
      .filter((f) => f.endsWith('.jsonl'))
      .sort((a, b) => a.localeCompare(b))
      .reverse(); // Most recent first
  } catch {
    return [];
  }
}

async function formatSessionInfo(sessionFile: string): Promise<string> {
  const logsDir = path.join(process.cwd(), 'logs');
  const filePath = path.join(logsDir, sessionFile);

  try {
    const stats = await fs.stat(filePath);
    const sizeKB = (stats.size / 1024).toFixed(1);
    sessionFile = sessionFile.replace('.jsonl', '');
    return `${sessionFile} (${sizeKB} KB)`;
  } catch {
    return sessionFile;
  }
}

async function main() {
  console.log('📊 Session Analysis Tool\n');
  console.log('This tool analyzes agent conversation logs and generates comprehensive reports.\n');

  try {
    // Build system with session-analyzer agent
    const builder = AgentSystemBuilder.minimal()
      .withAgentsFrom('session-analyzer/agents')
      .withBuiltinTools('read', 'write', 'list');

    const { executor, cleanup } = await builder.build();

    // Get available sessions
    const sessions = await listSessions();

    if (sessions.length === 0) {
      console.log('❌ No session files found in logs folder');
      await cleanup();
      return;
    }

    console.log(`Found ${sessions.length} session file(s):\n`);

    // Display available sessions
    for (let i = 0; i < Math.min(sessions.length, 10); i++) {
      const info = await formatSessionInfo(sessions[i]);
      console.log(`  ${i + 1}. ${info}`);
    }

    if (sessions.length > 10) {
      console.log(`  ... and ${sessions.length - 10} more`);
    }

    // Interactive selection
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log('\nOptions:');
    console.log('  - Enter a number to analyze a specific session');
    console.log('  - Enter "all" to analyze all sessions');
    console.log('  - Enter "recent" to analyze the 3 most recent sessions');
    console.log('  - Press Enter to analyze the most recent session');
    console.log('  - Enter "q" to quit\n');

    const answer = await rl.question('Your choice: ');
    rl.close();

    let sessionsToAnalyze: string[] = [];

    if (answer.toLowerCase() === 'q') {
      console.log('\n👋 Goodbye!');
      await cleanup();
      return;
    } else if (answer.toLowerCase() === 'all') {
      sessionsToAnalyze = sessions;
      console.log(`\n🔄 Analyzing all ${sessions.length} sessions...`);
    } else if (answer.toLowerCase() === 'recent') {
      sessionsToAnalyze = sessions.slice(0, 3);
      console.log('\n🔄 Analyzing 3 most recent sessions...');
    } else if (answer === '') {
      sessionsToAnalyze = [sessions[0]];
      console.log('\n🔄 Analyzing most recent session...');
    } else {
      const num = parseInt(answer);
      if (num >= 1 && num <= sessions.length) {
        sessionsToAnalyze = [sessions[num - 1]];
        console.log(`\n🔄 Analyzing session #${num}...`);
      } else {
        console.log('\n❌ Invalid selection');
        await cleanup();
        return;
      }
    }

    // Analyze selected sessions
    for (const sessionFile of sessionsToAnalyze) {
      console.log(`\n📝 Analyzing: ${sessionFile}`);
      console.log('─'.repeat(50));

      const startTime = Date.now();

      try {
        await executor.execute(
          'session-analyzer',
          `Analyze the session file: logs/${sessionFile} and create a comprehensive report with summary, flow diagram, and detailed message log.`
        );
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n✅ Analysis complete in ${duration}s`);

        // Check if report was created
        const reportPath = path.join(
          process.cwd(),
          'session-analysis',
          sessionFile.replace('.jsonl', '.md')
        );

        try {
          await fs.access(reportPath);
          console.log(
            `📄 Report saved to: session-analysis/${sessionFile.replace('.jsonl', '.md')}`
          );
        } catch {
          console.log('⚠️  Report file not found - check the result above');
        }
      } catch (error) {
        console.error(`❌ Error analyzing session: ${error}`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Analysis Summary');
    console.log('='.repeat(50));
    console.log(`Sessions analyzed: ${sessionsToAnalyze.length}`);
    console.log('Reports location: session-analysis/');

    // List generated reports
    try {
      const analysisDir = path.join(process.cwd(), 'session-analysis');
      const reports = await fs.readdir(analysisDir);
      const mdReports = reports.filter((f) => f.endsWith('.md'));

      if (mdReports.length > 0) {
        console.log(`\nGenerated reports (${mdReports.length} total):`);
        mdReports.slice(0, 5).forEach((report) => {
          console.log(`  - ${report}`);
        });
        if (mdReports.length > 5) {
          console.log(`  ... and ${mdReports.length - 5} more`);
        }
      }
    } catch {
      // Analysis directory doesn't exist yet
    }

    await cleanup();
    console.log('\n✨ Done!');
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Interrupted by user');
  process.exit(0);
});

main().catch(console.error);
