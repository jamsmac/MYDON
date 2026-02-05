# MYDON Roadmap Hub - TODO

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
- [x] Section creation and management
- [x] Task creation and management
- [x] Subtask creation and management

## Phase 3: AI Integration (BYOK)
- [x] Settings page with AI provider configuration
- [x] Support for 5 providers (Anthropic, OpenAI, Google, Groq, Mistral)
- [x] API key storage and management
- [x] Default provider selection
- [x] AI chat panel component
- [x] Actual AI API calls implementation (using built-in Manus LLM)
- [x] Streaming responses

## Phase 4: Dashboard Features
- [x] Progress calculation across all projects
- [x] Gantt chart timeline visualization
- [x] Zoom controls (week/month/quarter)
- [x] Today marker on timeline
- [ ] Overdue tasks indicator
- [ ] Activity feed

## Phase 5: Advanced Features
- [ ] Project templates
- [x] Import/export roadmaps
- [x] Markdown/PDF export
- [ ] Collaboration features


## Phase 6: Critical Features (Completed)

### Full CRUD for Project Structure
- [x] Add block creation UI with form
- [x] Add section creation within blocks
- [x] Add task creation within sections
- [x] Add subtask creation within tasks
- [x] Edit/delete functionality for all levels
- [x] Status management for tasks

### Contextual AI Chat
- [x] AI chat available at block level
- [x] AI chat available at section level
- [x] AI chat available at task level
- [x] Pass current context (block/section/task content) to AI
- [x] Show context indicator in chat

### Save AI Responses
- [x] "Save as note" button on AI responses
- [x] "Save as document" button on AI responses
- [x] Notes storage in database
- [x] Documents storage in database
- [x] View saved notes/documents in task panel


## Phase 7: Drag-and-Drop Feature (Completed)
- [x] Install dnd-kit library
- [x] Implement drag-and-drop for tasks
- [x] Implement drag-and-drop for sections between blocks
- [x] Add visual feedback (drag handles, drop zones)
- [x] Update database when items are moved


## Phase 8: Streaming AI Responses (Completed)
- [x] Server-side streaming endpoint
- [x] Frontend streaming handler
- [x] Real-time text rendering with Streamdown
- [x] Loading states and error handling


## Phase 9: Project Export Feature (Completed)
- [x] Server-side Markdown export endpoint
- [x] Server-side PDF export endpoint
- [x] Export UI with format selection
- [x] Include all blocks, sections, tasks, notes, and documents
- [x] Progress statistics in export


## Phase 10: Import Roadmap Feature (Completed)
- [x] Markdown parser for roadmap structure
- [x] JSON parser for roadmap structure
- [x] Server-side import endpoint
- [x] File upload UI in Dashboard
- [x] Preview before import
- [x] Error handling for invalid formats
- [x] Template download buttons (MD and JSON)


## Phase 11: Google Services Integration (Completed)

### Google Drive Integration
- [x] Save roadmap projects to Google Drive
- [x] Load roadmap from Google Drive
- [x] UI for Google Drive connection (dropdown menu)
- [x] Shareable links for saved files
- [ ] Automatic sync of changes (future enhancement)

### NotebookLM Integration
- [x] "Create source in NotebookLM" button for each project
- [x] Export project to Google Drive and open NotebookLM
- [ ] Direct API integration (requires Enterprise API access)

### Google Docs Integration
- [x] Export final documents directly to Google Docs (as Markdown)
- [x] Shareable links for exported documents
- [ ] Attach Google Docs to tasks (future enhancement)

### Google Calendar Integration
- [x] Add task deadlines to Google Calendar
- [x] Create project milestones in calendar
- [x] Calendar event creation UI (CalendarDialog component)
- [x] Search project events in calendar


## Future Enhancements
- [ ] Project templates (startup, product launch, marketing campaign)
- [ ] Deadline notifications (email/push)
- [ ] Multi-AI model comparison
- [ ] Agent system with specialized agents
- [ ] Collaboration features (roles, comments, @mentions)
- [ ] Activity feed
- [ ] Automatic Google Drive sync
- [ ] Direct NotebookLM Enterprise API integration
- [ ] Attach Google Docs to tasks


## Phase 12: Free AI Models & Smart Selection

### Free AI Providers
- [ ] Gemini Free API integration
- [ ] Hugging Face Inference API integration
- [ ] Deepseek API integration
- [ ] Ollama local LLM support
- [ ] Cohere Free tier integration
- [ ] Perplexity Free tier integration

### Smart Model Selection System
- [ ] Question type analyzer (simple, analysis, code, creative)
- [ ] Model recommendation engine
- [ ] Cost estimation per request
- [ ] Auto-select based on question context
- [ ] Manual override option

### Settings UI Updates
- [ ] Free models category in settings
- [ ] Provider priority configuration
- [ ] API key management for all providers
- [ ] Cost tracking dashboard

### Chat UI Updates
- [ ] Auto-select toggle button
- [ ] Model recommendation display
- [ ] Cost/free indicator per message
- [ ] Explanation of model choice


## Phase 13: Platform-First AI & Credit System (In Progress)

### Database
- [x] Create user_credits table (userId, credits, usedCredits)
- [x] Create credit_transactions table for history
- [x] Add initial credits on user registration (1000 credits)

### AI Router
- [x] Create smart model selection logic
- [x] Analyze task type (simple, analysis, code, creative)
- [x] Select model based on credits balance
- [x] Track credit usage per request
- [x] Return model metadata with response

### Credit System
- [x] Define credit costs per model/operation
- [x] Free tier: Gemini Flash (2 cr), Cohere Light (1 cr)
- [x] Standard tier: GPT-4o-mini (10 cr), Claude Haiku (8 cr), DeepSeek (5 cr)
- [x] Premium tier: GPT-4o (30 cr), Claude Sonnet (35 cr), Gemini Pro (25 cr)

### UI Updates
- [x] Credits widget in header (shows balance with color coding)
- [x] Show credits balance in popover with transaction history
- [x] Show model used + credits spent after each AI response
- [x] Simplified Settings page with Platform/BYOK toggle
- [x] BYOK provider configuration only shown when BYOK mode enabled
- [x] Credit costs table displayed in Platform mode


## Phase 14: Gantt Chart Activation
- [x] Set deadlines for all 7 blocks (Feb 2026 - Aug 2027)
- [x] Set deadlines for key tasks in each block
- [x] Verify Gantt chart timeline displays correctly


## Phase 15: Comprehensive TechRent Roadmap Update
- [x] Clear existing 7 blocks and replace with 12-block structure
- [x] Block 1: Исследование и анализ (4 недели) - 30 tasks
- [x] Block 2: Стратегия и планирование (3 недели) - 23 tasks
- [x] Block 3: Финансовое моделирование (2 недели) - 37 tasks
- [x] Block 4: Pitch Deck и бизнес-план (2 недели) - 24 tasks
- [x] Block 5: Юридическая структура (4 недели) - 20 tasks
- [x] Block 6: Привлечение финансирования (2-3 месяца) - 20 tasks
- [x] Block 7: Запуск операций (2-3 месяца) - 44 tasks
- [x] Block 8: Маркетинг и продажи - 36 tasks
- [x] Block 9: Первые 100 дней работы - 19 tasks
- [x] Block 10: Масштабирование (месяцы 4-12) - 12 tasks
- [x] Block 11: Связь с экосистемой MAYDON - 21 tasks
- [x] Block 12: Долгосрочная стратегия (годы 2-5) - 18 tasks
- [x] Set deadlines for all blocks (Feb 2026 - Feb 2031)
- [x] Verify timeline on Gantt chart

**Total: 12 blocks, 44 sections, 304 tasks**


## Phase 16: Clickable Dashboard Widgets
- [x] Make "Проектов" widget clickable (show all projects)
- [x] Make "Активных" widget clickable (filter active projects)
- [x] Make "Завершённых" widget clickable (filter completed projects)
- [x] Make "Просроченных" widget clickable (filter overdue projects)
- [x] Add visual feedback on hover and active state (ring highlight)
- [x] Filter projects list in place when widget clicked
- [x] Show active filter indicator with "Reset filter" button


## Phase 17: Project Search
- [x] Add search input field above projects list
- [x] Filter projects by name as user types
- [x] Show "no results" message when search has no matches
- [x] Clear search button (X icon in input field)


## Phase 18: MAYDON Universal Planner Enhancement (Business-First + Personal Goals)

### AI-Powered Quick Start
- [ ] "Describe your goal" input on dashboard
- [ ] AI asks 3-5 clarifying questions (scope, timeline, resources)
- [ ] Auto-generates structured roadmap with blocks, sections, tasks
- [ ] Works for both business and personal goals

### Template Library
**Business Templates (Primary):**
- [ ] "Launch a Startup" (market research, MVP, funding, launch)
- [ ] "Product Development Cycle" (discovery, design, development, testing, release)
- [ ] "Marketing Campaign" (strategy, content, channels, analytics)
- [ ] "Team Hiring Plan" (job posting, screening, interviews, onboarding)
- [ ] "Business Expansion" (market analysis, localization, partnerships)

**Personal Templates (Secondary):**
- [ ] Career: "Transition to IT", "Get Promoted"
- [ ] Education: "Learn English B2", "Master Python"
- [ ] Health: "Lose Weight", "Build Fitness Habit"
- [ ] Finance: "Save for Goal", "Start Investing"

### Daily Briefing
- [ ] Morning summary: today's tasks across all projects, priorities, deadlines
- [ ] Progress forecast: "At current pace, Project X completes by [date]"
- [ ] Evening review: completed tasks, productivity insights

### Smart Adaptive Planning
- [ ] Stuck task detection (3+ postponements → suggest breakdown)
- [ ] Pace adjustment (ahead/behind schedule → recommendations)
- [ ] Overload warning (too many active projects)
- [ ] Google Calendar integration for deadline sync

### Smart Reminders
- [ ] Context-aware notifications
- [ ] Streak tracking for recurring tasks
- [ ] Adaptive frequency (not spammy)


## Phase 19: Rename to MYDON
- [x] Update all MAYDON references to MYDON in codebase
- [x] Update Google Drive folder name to MYDON_Roadmaps
- [x] Update export reports footer
- [x] Update AI assistant system prompts
- [x] Add AI Generator component to Dashboard
- [x] Test AI roadmap generation


## Phase 20: AI Goal Generator (Completed)
- [x] Create AIGoalGenerator component with multi-step dialog
- [x] Step 1: Category selection (Business, Career, Education, Health, Finance)
- [x] Step 2: Goal description input with examples
- [x] Step 3: Clarifying questions based on category
- [x] Step 4: AI roadmap generation with loading state
- [x] Step 5: Preview generated roadmap structure
- [x] Create project from generated roadmap (blocks, sections, tasks)
- [x] Integration with credit system (uses platform AI)
- [x] Backend generateRoadmap procedure with structured JSON output
- [x] Backend createFromRoadmap procedure to save to database


## Phase 21: Project Templates Library
- [x] Create templates database table (id, name, description, category, structure JSON, authorId, isPublic, usageCount)
- [x] Create template_categories table for organizing templates
- [x] Backend: saveAsTemplate procedure (copy project structure to template)
- [x] Backend: getTemplates procedure (list public templates + user's own)
- [x] Backend: createFromTemplate procedure (create project from template)
- [x] Backend: deleteTemplate procedure (only for template author)
- [x] UI: "Save as Template" button in project view header
- [x] UI: Save template dialog (name, description, category, public/private toggle)
- [x] UI: Template Library browser in Dashboard (grid view with categories)
- [x] UI: Template preview dialog (show structure before creating)
- [x] UI: "Use Template" button to create project from template
- [x] Show template usage count and author info
- [x] Test full flow: save template → browse library → create from template


## Phase 22: Daily Briefing Feature
- [x] Backend: getDailyBriefing procedure (today's tasks, overdue, progress stats)
- [x] Backend: Calculate completion forecast based on current pace
- [x] Backend: Get tasks due today across all projects
- [x] Backend: Get overdue tasks count and list
- [x] UI: Daily Briefing dialog/panel component
- [x] UI: Today's tasks section with quick complete action
- [x] UI: Project progress overview with forecasts
- [x] UI: Overdue tasks warning section
- [x] UI: "Good morning" greeting with date
- [x] Add Daily Briefing button to Dashboard header
- [x] Test full Daily Briefing flow


## Phase 23: AI Pitch Deck Generator
- [x] Design pitch deck slide structure (Problem, Solution, Market, Business Model, Team, Traction, Roadmap, Ask)
- [x] Backend: generatePitchDeck procedure using LLM to create slide content from project data
- [x] Backend: Store generated pitch decks in database
- [x] Backend: getPitchDecks procedure to list user's pitch decks
- [x] UI: PitchDeckGenerator component with project selection
- [x] UI: Slide preview with navigation
- [ ] UI: Export to slides format (using slides mode) - placeholder added
- [x] UI: Add "Generate Pitch Deck" button to project view
- [x] Test full pitch deck generation flow


## Phase 24: PowerPoint Export for Pitch Deck
- [x] Install pptxgenjs library for PPTX generation
- [x] Create server-side PPTX generation utility
- [x] Create backend endpoint for exporting pitch deck to PPTX
- [x] Update PitchDeckGenerator UI with download button
- [x] Style slides with professional design (colors, fonts, layouts)
- [x] Test export and download functionality


## Phase 25: Pitch Deck Slide Editing
- [x] Backend: Create updatePitchDeck procedure to save edited slides
- [x] UI: Add edit mode toggle button to slide preview
- [x] UI: Create inline editing for slide title, content, and bullets
- [x] UI: Add save/cancel buttons for edit mode
- [x] UI: Show visual feedback when changes are saved
- [x] Test editing and saving slides


## Phase 26: Team Photo Upload for Pitch Deck
- [ ] Design team member data structure (name, role, photo URL)
- [ ] Create file upload endpoint for team photos using S3 storage
- [ ] Update PitchDeckGenerator UI with team member section in edit mode
- [ ] Add photo upload button with preview for each team member
- [ ] Allow adding/removing team members dynamically
- [ ] Update PowerPoint export to include team photos
- [ ] Test team photo upload, display, and export


## Phase 27: User Registration & Subscription System
- [x] Create subscription_plans table (id, name, price, features, limits)
- [x] Create user_subscriptions table (userId, planId, status, startDate, endDate)
- [x] Create ai_integrations table (userId, provider, apiKey, isActive, usageStats)
- [x] Backend: Subscription management procedures (subscribe, cancel, upgrade)
- [ ] Backend: Check subscription limits before AI operations
- [ ] UI: Subscription plans page with pricing cards
- [ ] UI: User profile page with subscription status
- [x] UI: AI integrations management (connect Claude Code, Codex, Perplexity, etc.)
- [x] Support for BYOK (Bring Your Own Key) per integration
- [ ] Fallback to platform credits when user not subscribed to specific AI

## Phase 28: AI Orchestrator System
- [x] Create agents table (id, name, type, capabilities, systemPrompt, modelPreference)
- [x] Create skills table (id, name, description, triggerPatterns, agentId)
- [x] Create mcp_servers table (id, name, endpoint, authConfig, status)
- [x] Create orchestrator_config table (routingRules, fallbackBehavior, logging)
- [x] Backend: Orchestrator service that routes requests to appropriate agents
- [x] Backend: Agent capability matching based on task type
- [x] Backend: MCP server integration for external tools
- [x] Backend: Skill triggering based on user input patterns
- [x] Backend: Fallback chain when primary agent unavailable
- [x] Logging and analytics for AI operations

## Phase 29: Developer Admin Panel
- [x] Create admin role check middleware
- [x] Admin Dashboard with system overview (users, AI usage, costs)
- [x] AI Agents management page (create, edit, delete agents)
- [x] Skills configuration page (define triggers, assign to agents)
- [x] MCP Servers management (add, configure, test connections)
- [x] Orchestrator rules editor (routing logic, priorities)
- [ ] Hooks configuration (pre/post processing, webhooks)
- [ ] Database management UI (view tables, run queries)
- [x] System logs viewer with filtering
- [ ] API usage analytics and cost tracking

## Phase 30: Enhanced Roadmap Task Management
- [ ] Add "Add Task" button at any level (block, section, task)
- [ ] Add "Add Subtask" button on tasks
- [ ] Add "Add Section" button within blocks
- [ ] Add "Split Task" feature (divide task into subtasks)
- [ ] Add "Merge Tasks" feature (combine multiple tasks)
- [ ] Add "Convert to Section" (promote task to section)
- [ ] Add "Convert to Task" (demote section to task)
- [ ] Drag-and-drop for reordering at all levels
- [ ] Bulk actions (select multiple, change status, delete)
- [ ] Quick inline editing for task names

## Phase 31: Universal AI Assistant Button
- [x] Create FloatingAIButton component (fixed position, always visible)
- [x] Create AIAssistantModal component (full-featured chat interface)
- [x] Auto-detect current page/context (project, block, section, task)
- [x] Pass relevant context to AI automatically
- [x] Support for quick actions (summarize, expand, translate, etc.)
- [ ] History of conversations per context
- [ ] Keyboard shortcut to open (Cmd/Ctrl + K)
- [x] Minimize/maximize states
- [x] Integration with orchestrator for smart routing

## Phase 32: AI Provider Integrations
- [ ] Claude Code integration (via API or MCP)
- [ ] OpenAI Codex integration
- [ ] Perplexity API integration
- [ ] GitHub Copilot integration (if available)
- [ ] Cursor-style inline code suggestions
- [ ] Multi-model comparison mode
- [ ] Cost estimation before execution
- [ ] Usage tracking per provider



## Phase 33: Advanced Task Management (Completed)
- [x] Backend: Split task into subtasks procedure
- [x] Backend: Merge multiple tasks procedure
- [x] Backend: Convert task to section procedure
- [x] Backend: Convert section to task procedure
- [x] Backend: Bulk status change procedure
- [x] Backend: Bulk delete procedure
- [x] UI: Split task dialog with subtask input
- [x] UI: Merge tasks dialog with task selection
- [x] UI: Convert buttons in task/section context menu
- [x] UI: Multi-select mode for bulk operations
- [x] UI: Bulk action toolbar
- [ ] Quick inline editing for task names


## Phase 34: Drag & Drop Functionality (Completed)
- [x] Install @dnd-kit/core and @dnd-kit/sortable libraries
- [x] Create DraggableTask component with drag handle
- [x] Create DroppableSection component for task drops
- [x] Implement task reordering within same section
- [x] Implement task moving between different sections
- [x] Create DraggableSection component
- [x] Implement section reordering within blocks
- [x] Add visual feedback during drag (ghost element, drop zones)
- [x] Backend: Update sortOrder on task/section reorder
- [x] Persist drag changes to database


## Phase 35: Inline Task Editing (Completed)
- [x] Create InlineEditableText component
- [x] Add double-click handler to task title
- [x] Show input field on double-click
- [x] Save on Enter or blur
- [x] Cancel on Escape
- [x] Update task title via API
- [x] Add visual feedback during editing


## Phase 36: Inline Section Editing (Completed)
- [x] Add onUpdateSectionTitle callback to DraggableSidebar
- [x] Update SortableSection to use InlineEditableText
- [x] Add updateSection mutation in ProjectView
- [x] Test double-click editing for sections


## Phase 37: Inline Block Editing (Completed)
- [x] Add onUpdateBlockTitle callback to DraggableSidebar
- [x] Update block rendering to use InlineEditableText
- [x] Add updateBlock mutation in ProjectView
- [x] Test double-click editing for blocks


## Phase 38: Stripe Integration & Pricing Page (Completed)
- [x] Add Stripe feature to project via webdev_add_feature
- [x] Create pricing plans page with 3 tiers (Free, Pro, Enterprise)
- [x] Design pricing cards with feature comparison
- [x] Implement Stripe checkout session creation
- [x] Add webhook handler for subscription events
- [x] Update user subscription status on payment success
- [x] Add subscription management UI (cancel, upgrade)
- [x] Show current plan in user profile


## Phase 39: Subscription Limits System (Completed)
- [x] Create limits configuration file with plan-based restrictions
- [x] Add daily AI usage tracking table to database
- [x] Create checkLimit middleware for backend procedures
- [x] Implement project count limit (3 for free, unlimited for paid)
- [x] Implement AI requests limit (10/day for free, unlimited for paid)
- [x] Add limit check before project creation
- [x] Add limit check before AI operations
- [x] Create UI component for showing usage stats
- [x] Add upgrade prompts when limits reached
- [x] Show remaining AI requests in header


## Phase 40: UX Improvements (Completed)
- [x] Inline editing for task dates (dueDate field added)
- [x] Keyboard shortcuts (Cmd+K for AI, Cmd+N for new project, Cmd+/ for search)
- [x] Visual drop zone indicators (already in DraggableSidebar)

## Phase 41: Collaboration (Completed)
- [x] Invite team members by email
- [x] User roles (Owner, Editor, Viewer)
- [x] Comments on tasks
- [x] @mentions in comments

## Phase 42: Notifications (In Progress)
- [x] Notification center in header
- [x] Notifications database schema (notifications, notification_preferences, email_digest_queue)
- [x] Notifications backend router (list, markAsRead, markAllAsRead, delete, clearAll)
- [x] NotificationCenter component with bell icon and unread count
- [x] Notification preferences page (/settings/notifications)
- [x] Telegram integration backend (connect, disconnect, test)
- [ ] Email digest (daily/weekly) - needs email service setup
- [ ] Telegram bot webhook handler
- [ ] Browser push notifications - service worker needed

## Phase 43: Calendar
- [ ] Google Calendar sync
- [ ] Built-in calendar view
- [ ] Drag tasks to reschedule

## Phase 44: Import/Export
- [ ] Import from Notion/Trello
- [ ] Export to PDF report
- [ ] Automatic backups

## Phase 45: Analytics
- [ ] Task completion charts
- [ ] Audit log

## Phase 42.1: Enhanced Notification Panel Design (Completed)
- [x] Redesign notification panel with better visual hierarchy
- [x] Add colorful icons for each notification type (10 types with unique colors)
- [x] Add user avatars for user-related notifications (initials + color based on name)
- [x] Add gradient backgrounds for notification categories
- [x] Add smooth animations and transitions
- [x] Add time grouping (Today, Yesterday, Earlier)
- [x] Add hover effects and micro-interactions
- [x] Add filter chips for notification types
- [x] Add colored left border for visual categorization

## Phase 42.2: Notification Search (Completed)
- [x] Add search bar to notification panel header
- [x] Filter notifications by title and message content
- [x] Add clear search button
- [x] Show "no results" state when search has no matches
- [x] Highlight matching text in search results
- [x] Show search results count
- [x] Search across title, message, project name, task name, and user name

## Phase 42.3: Notification Search Keyboard Shortcut (Completed)
- [x] Add Ctrl+F shortcut to open search when panel is open
- [x] Show keyboard hint in search button tooltip
- [x] Escape key to close search bar
- [x] Platform-aware shortcut display (⌘ on Mac, Ctrl on Windows/Linux)


## Phase 46: Real-time Collaboration (In Progress)
- [x] Install Socket.io server and client libraries
- [x] Set up WebSocket server alongside Express
- [x] Create socket authentication middleware
- [x] Implement presence system (who is viewing project)
- [x] Show online users avatars in project header (PresenceAvatars component)
- [x] Implement live task updates (create, update, delete)
- [x] Broadcast changes to all project viewers
- [x] Add conflict resolution for simultaneous edits (EditingIndicator component)
- [x] Show "editing" indicator when someone is editing a task
- [ ] Add cursor/selection visibility (optional - future enhancement)
- [ ] Write tests for real-time features
