# NotebookLM Integration Research

## Findings

### NotebookLM Enterprise API (Google Cloud)
- NotebookLM Enterprise has an API for adding sources programmatically
- API is in Preview/Pre-GA stage
- Requires Google Cloud setup and authentication
- Methods available:
  - `notebooks.sources.batchCreate` - Add sources in batch
  - `notebooks.sources.uploadFile` - Upload single file
  - `notebooks.sources.get` - Retrieve a source
  - `notebooks.sources.batchDelete` - Delete sources

### Supported Source Types
- Google Docs
- Google Slides
- PDF files
- Text files (.txt, .md)
- Word documents (.docx)
- PowerPoint (.pptx)
- Excel (.xlsx)
- Audio files (MP3, WAV, etc.)
- Images (PNG, JPG)
- Web content
- YouTube videos

### Integration Approach for MAYDON
Since NotebookLM Enterprise API requires Google Cloud setup which may not be available,
we can implement a simpler approach:

1. **Export to Google Drive** - Already implemented
2. **Generate NotebookLM-compatible format** - Export project as markdown/PDF
3. **Provide direct link to NotebookLM** - Open NotebookLM with instructions to add the exported file

### Alternative: Manual Integration Flow
1. User clicks "Create NotebookLM Source"
2. System exports project to Google Drive
3. System opens NotebookLM in new tab
4. User manually adds the Google Drive file as source

This approach works without requiring Enterprise API access.
