#!/usr/bin/env tsx
/**
 * Docling MCP server example - Convert documents to markdown
 * 
 * Prerequisites:
 * - Python with uvx: pip install uvx
 */

import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';
import { AgentSystemBuilder } from '../src';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('📄 Docling Document Conversion Example\n');

  try {
    // Setup with Docling MCP server
    // Run in temp directory to avoid .env file conflicts
    const builder = AgentSystemBuilder.default()
      .withMCPServers({
        docling: {
          command: 'uvx',
          args: ['--from=docling-mcp', 'docling-mcp-server'],
          cwd: os.tmpdir(), // Run in temp directory to avoid .env conflicts
          description: 'Document conversion to markdown'
        }
      })
      .withAgentsFrom(path.join(__dirname, '07-mcp-docling', 'agents'));

    const { executor, toolRegistry, cleanup } = await builder.build();

    // Check if Docling tools are available
    const doclingTools = toolRegistry.list().filter(t => t.name.startsWith('docling.'));
    
    if (doclingTools.length === 0) {
      console.log('❌ No Docling tools found.');
      console.log('   Make sure uvx is installed: pip install uvx');
      await cleanup();
      return;
    }

    console.log(`✓ Found ${doclingTools.length} Docling tools\n`);

    // Simple demo: Create a document and export to markdown
    const createDoc = toolRegistry.get('docling.create_new_docling_document');
    const addTitle = toolRegistry.get('docling.add_title_to_docling_document');
    const exportMd = toolRegistry.get('docling.export_docling_document_to_markdown');

    if (createDoc && addTitle && exportMd) {
      // Create document
      const doc = await createDoc.execute({ prompt: 'Demo document' });
      const docKey = extractKey(doc.content);
      
      if (docKey) {
        // Add title
        await addTitle.execute({
          document_key: docKey,
          title: 'Docling Demo'
        });

        // Export to markdown
        const markdown = await exportMd.execute({ document_key: docKey });
        console.log('Generated Markdown:\n');
        console.log(formatContent(markdown.content));
      }
    }

    console.log('\n---\n');

    // Agent demo
    const result = await executor.execute(
      'document-processor',
      'Create a simple README about Docling with a title and description. Export as markdown.'
    );

    console.log('Agent result:\n', result);

    // Convert a real PDF document
    console.log('\n📄 Converting a real PDF...\n');
    const convertDoc = toolRegistry.get('docling.convert_document_into_docling_document');
    
    if (convertDoc && exportMd) {
      const pdfUrl = 'https://ml-site.cdn-apple.com/papers/the-illusion-of-thinking.pdf';
      console.log(`Converting: ${pdfUrl}\n`);
      
      const converted = await convertDoc.execute({ source: pdfUrl });
      const pdfKey = extractKey(converted.content);
      
      if (pdfKey) {
        const pdfMarkdown = await exportMd.execute({ document_key: pdfKey });
        console.log('First 500 chars of converted PDF:\n');
        const content = formatContent(pdfMarkdown.content);
        console.log(content.substring(0, 500) + '...\n');
      }
    }

    await cleanup();
    console.log('\n✅ Done');

  } catch (error) {
    console.error('Error:', error);
  }
}

function extractKey(content: unknown): string | null {
  const str = JSON.stringify(content);
  const match = str.match(/([a-f0-9]{32})/);
  return match ? match[1] : null;
}

function formatContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(item => 
      typeof item === 'object' && item !== null && 'text' in item 
        ? String(item.text) 
        : String(item)
    ).join('\n');
  }
  return JSON.stringify(content, null, 2);
}

main().catch(console.error);