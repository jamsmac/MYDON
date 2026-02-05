# MAYDON Roadmap Hub - TODO

## Phase 1: Core Infrastructure
- [x] Database schema for multi-project (projects, blocks, sections, tasks, subtasks)
- [x] Database schema for AI settings (BYOK mode)
- [x] Database schema for chat messages
- [x] tRPC routers for all entities
- [x] Manus OAuth integration

## Phase 2: Multi-Project Management
- [x] Dashboard page with project overview
- [x] Project creation dialog
- [x] Project view page with sidebar navigation
- [x] Block creation and management
- [ ] Section creation and management
- [ ] Task creation and management
- [ ] Subtask creation and management

## Phase 3: AI Integration (BYOK)
- [x] Settings page with AI provider configuration
- [x] Support for 5 providers (Anthropic, OpenAI, Google, Groq, Mistral)
- [x] API key storage and management
- [x] Default provider selection
- [x] AI chat panel component
- [x] Actual AI API calls implementation (using built-in Manus LLM)
- [ ] Streaming responses

## Phase 4: Dashboard Features
- [x] Progress calculation across all projects
- [x] Gantt chart timeline visualization
- [x] Zoom controls (week/month/quarter)
- [x] Today marker on timeline
- [ ] Overdue tasks indicator
- [ ] Activity feed

## Phase 5: Advanced Features
- [ ] Project templates
- [ ] Import/export roadmaps
- [ ] Markdown/PDF export
- [ ] Collaboration features


## Phase 6: Critical Features (Current Sprint)

### Full CRUD for Project Structure
- [ ] Add block creation UI with form
- [ ] Add section creation within blocks
- [ ] Add task creation within sections
- [ ] Add subtask creation within tasks
- [ ] Edit/delete functionality for all levels
- [ ] Status management for tasks

### Contextual AI Chat
- [ ] AI chat available at block level
- [ ] AI chat available at section level
- [ ] AI chat available at task level
- [ ] Pass current context (block/section/task content) to AI
- [ ] Show context indicator in chat

### Save AI Responses
- [ ] "Save as note" button on AI responses
- [ ] "Save as document" button on AI responses
- [ ] Notes storage in database
- [ ] Documents storage in database
- [ ] View saved notes/documents in task panel


## Phase 7: Drag-and-Drop Feature
- [ ] Install dnd-kit library
- [ ] Implement drag-and-drop for tasks
- [ ] Implement drag-and-drop for sections between blocks
- [ ] Add visual feedback (drag handles, drop zones)
- [ ] Update database when items are moved


## Phase 8: Streaming AI Responses
- [ ] Server-side streaming endpoint
- [ ] Frontend streaming handler
- [ ] Real-time text rendering with Streamdown
- [ ] Loading states and error handling


## Phase 9: Project Export Feature
- [ ] Server-side Markdown export endpoint
- [ ] Server-side PDF export endpoint
- [ ] Export UI with format selection
- [ ] Include all blocks, sections, tasks, notes, and documents
- [ ] Progress statistics in export
