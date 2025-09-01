#!/usr/bin/env tsx
/**
 * Demonstration of Docling MCP server integration for document conversion
 * 
 * Docling is a powerful document processing library that converts various formats
 * (PDF, DOCX, PPTX, images, etc.) to markdown and other formats.
 * 
 * Prerequisites:
 * - Python with uvx installed: pip install uvx
 * - Or use pipx: pipx install uvx
 * 
 * The Docling MCP server will be automatically installed via uvx when run.
 */

import * as path from 'path';
import { fileURLToPath } from 'url';
import { AgentSystemBuilder } from '../src';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('📄 Docling MCP Server Demo - Document to Markdown Conversion\n');

  try {
    // Build system with Docling MCP server
    const builder = AgentSystemBuilder.default()
      .withMCPServers({
        docling: {
          command: 'uvx',
          args: ['--from=docling-mcp', 'docling-mcp-server'],
          description: 'Document processing and conversion to markdown'
        }
      })
      .withAgentsFrom(path.join(__dirname, '07-mcp-docling', 'agents'))
      .withSessionId('docling-demo');

    console.log('🔄 Initializing Docling MCP server (this may take a moment on first run)...\n');
    
    const { executor, toolRegistry, cleanup } = await builder.build();

    // List available Docling tools
    console.log('📋 Available Docling Tools:');
    const doclingTools = toolRegistry.list().filter(t => t.name.startsWith('docling.'));
    
    if (doclingTools.length === 0) {
      console.log('❌ No Docling tools found. Make sure uvx is installed.');
      console.log('   Install with: pip install uvx');
      await cleanup();
      return;
    }

    doclingTools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });
    console.log();

    // Demo 1: Direct tool usage - Create and export a document
    console.log('=== Demo 1: Create Document Programmatically ===\n');
    
    const createDoc = toolRegistry.get('docling.create_new_docling_document');
    const addTitle = toolRegistry.get('docling.add_title_to_docling_document');
    const addSection = toolRegistry.get('docling.add_section_heading_to_docling_document');
    const addParagraph = toolRegistry.get('docling.add_paragraph_to_docling_document');
    const exportMarkdown = toolRegistry.get('docling.export_docling_document_to_markdown');

    if (createDoc && addTitle && exportMarkdown) {
      // Create a new document
      console.log('1. Creating new document...');
      const docResult = await createDoc.execute({
        prompt: 'This is a demo document created via MCP'
      });
      
      // Extract document key from result
      const docKey = extractDocumentKey(docResult.content);
      
      if (docKey) {
        console.log(`   ✓ Document created with key: ${docKey}`);

        // Add title
        if (addTitle) {
          console.log('2. Adding title...');
          await addTitle.execute({
            document_key: docKey,
            title: 'Docling MCP Integration Demo'
          });
          console.log('   ✓ Title added');
        }

        // Add section
        if (addSection) {
          console.log('3. Adding section...');
          await addSection.execute({
            document_key: docKey,
            section_heading: 'Introduction',
            section_level: 1
          });
          console.log('   ✓ Section added');
        }

        // Add paragraph
        if (addParagraph) {
          console.log('4. Adding content...');
          await addParagraph.execute({
            document_key: docKey,
            paragraph: 'This document demonstrates the integration between the agent orchestration system and Docling MCP server. Docling provides powerful document processing capabilities including PDF parsing, OCR, and conversion to various formats.'
          });
          console.log('   ✓ Content added');
        }

        // Export to markdown
        console.log('5. Exporting to markdown...');
        const markdownResult = await exportMarkdown.execute({
          document_key: docKey
        });
        
        console.log('\n📝 Generated Markdown:\n');
        console.log('---');
        console.log(formatContent(markdownResult.content));
        console.log('---\n');
      }
    }

    // Demo 2: Agent-based document processing
    console.log('=== Demo 2: Agent-Based Document Processing ===\n');
    
    const result = await executor.execute(
      'document-processor',
      `Create a technical documentation page about MCP (Model Context Protocol) with:
       - A main title
       - An overview section explaining what MCP is
       - A features section with a list of key capabilities
       - A conclusion
       
       Export the final document as markdown.`
    );

    console.log('Agent Response:\n');
    console.log(result);

    // Demo 3: Convert existing document (if path provided)
    console.log('\n=== Demo 3: Document Conversion ===\n');
    
    const convertDoc = toolRegistry.get('docling.convert_document_into_docling_document');
    if (convertDoc) {
      console.log('To convert an existing document (PDF, DOCX, etc.), use:');
      console.log('  const result = await convertDoc.execute({');
      console.log('    source: "/path/to/document.pdf"');
      console.log('  });');
      console.log('\nThen export to markdown using the document key from the result.');
      console.log('\nExample documents to try:');
      console.log('  - PDF files: Technical papers, reports, documentation');
      console.log('  - DOCX files: Word documents');
      console.log('  - PPTX files: PowerPoint presentations');
      console.log('  - Images: Screenshots, scanned documents (OCR will be applied)');
    }

    // Cleanup
    await cleanup();
    console.log('\n✅ Demo complete - MCP connections closed');

  } catch (error) {
    console.error('❌ Error:', error);
    console.log('\n💡 Troubleshooting tips:');
    console.log('1. Make sure Python is installed');
    console.log('2. Install uvx: pip install uvx');
    console.log('3. Check network connection (docling-mcp will be downloaded on first run)');
  }
}

// Helper function to extract document key from result
function extractDocumentKey(content: unknown): string | null {
  if (typeof content === 'object' && content !== null) {
    const obj = content as Record<string, unknown>;
    
    // Try different possible response formats
    if ('document_key' in obj) {
      return String(obj.document_key);
    }
    if ('key' in obj) {
      return String(obj.key);
    }
    
    // Check if it's an array of content blocks
    if (Array.isArray(content)) {
      for (const item of content) {
        if (typeof item === 'object' && item !== null) {
          const result = extractDocumentKey(item);
          if (result) return result;
        }
      }
    }
    
    // Check nested content
    if ('content' in obj) {
      return extractDocumentKey(obj.content);
    }
    
    // Look for text that contains the key
    if ('text' in obj && typeof obj.text === 'string') {
      const match = obj.text.match(/document[_\s]?key[:\s]+([a-f0-9]{32})/i);
      if (match) return match[1];
    }
  }
  
  if (typeof content === 'string') {
    // Try to extract from string
    const match = content.match(/([a-f0-9]{32})/);
    if (match) return match[1];
  }
  
  return null;
}

// Helper function to format content for display
function formatContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  
  if (Array.isArray(content)) {
    return content
      .map(item => {
        if (typeof item === 'object' && item !== null && 'text' in item) {
          return String(item.text);
        }
        return String(item);
      })
      .join('\n');
  }
  
  if (typeof content === 'object' && content !== null) {
    const obj = content as Record<string, unknown>;
    if ('text' in obj) {
      return String(obj.text);
    }
    if ('content' in obj) {
      return formatContent(obj.content);
    }
  }
  
  return JSON.stringify(content, null, 2);
}

main();