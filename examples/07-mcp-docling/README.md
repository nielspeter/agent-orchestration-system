# Docling MCP Server Example

This example demonstrates integration with the [Docling](https://github.com/docling-project/docling) MCP server for document processing and conversion.

## What is Docling?

Docling is a powerful document processing library that:
- Converts PDFs, DOCX, PPTX, XLSX, images, and more to markdown
- Provides advanced PDF understanding with layout analysis
- Supports OCR for scanned documents
- Integrates with AI systems via MCP (Model Context Protocol)

## Prerequisites

1. **Python** must be installed on your system
2. **Install uvx** (Python package runner):
   ```bash
   pip install uvx
   # or
   pipx install uvx
   ```

The Docling MCP server will be automatically downloaded and run via uvx when you run the example.

## Running the Example

```bash
npx tsx examples/07-mcp-docling.ts
```

## What the Example Does

### Demo 1: Direct Tool Usage
Creates a document programmatically using Docling tools:
- Creates a new document
- Adds title and sections
- Adds content
- Exports to markdown

### Demo 2: Agent-Based Processing
Uses the `document-processor` agent to:
- Create structured technical documentation
- Handle complex document creation tasks
- Export to markdown automatically

### Demo 3: Document Conversion
Shows how to convert existing documents:
- PDFs → Markdown
- Word documents → Markdown
- PowerPoints → Markdown
- Images → Markdown (with OCR)

## Converting Your Own Documents

To convert your own documents, modify the example or use the agent:

```typescript
// In the example code
const convertDoc = toolRegistry.get('docling.convert_document_into_docling_document');
const result = await convertDoc.execute({
  source: '/path/to/your/document.pdf'
});

// Then export to markdown
const markdown = await exportMarkdown.execute({
  document_key: result.document_key
});
```

Or via the agent:
```typescript
const result = await executor.execute(
  'document-processor',
  'Convert /path/to/document.pdf to markdown'
);
```

## Sample Documents to Try

You can test with various document types:

1. **PDF Files**
   - Research papers
   - Technical documentation
   - Reports with tables and figures

2. **Office Documents**
   - `.docx` - Word documents
   - `.pptx` - PowerPoint presentations
   - `.xlsx` - Excel spreadsheets

3. **Images**
   - Screenshots
   - Scanned documents (OCR will be applied)
   - Technical diagrams

4. **Web Content**
   - `.html` files
   - Saved web pages

## Available Docling Tools

The MCP server provides numerous tools:

- `docling.create_new_docling_document` - Create new documents
- `docling.convert_document_into_docling_document` - Convert existing documents
- `docling.add_title_to_docling_document` - Add titles
- `docling.add_section_heading_to_docling_document` - Add sections
- `docling.add_paragraph_to_docling_document` - Add paragraphs
- `docling.add_table_in_html_format_to_docling_document` - Add tables
- `docling.export_docling_document_to_markdown` - Export to markdown
- `docling.save_docling_document` - Save to disk
- And many more...

## Troubleshooting

### "No Docling tools found"
- Make sure Python is installed: `python --version`
- Install uvx: `pip install uvx`
- Check network connection (docling-mcp will be downloaded)

### "Failed to start MCP server"
- Try running manually: `uvx --from=docling-mcp docling-mcp-server`
- Check Python path is in your system PATH
- On Windows, you might need to use `py` instead of `python`

### Document conversion fails
- Ensure the document path is correct and accessible
- Check the document isn't corrupted
- For PDFs, complex layouts might need adjustment

## Learn More

- [Docling Documentation](https://github.com/docling-project/docling)
- [Docling MCP Server](https://github.com/docling-project/docling-mcp)
- [MCP Protocol](https://modelcontextprotocol.com)