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


## Phase 46.1: Typing Indicator for Comments (Completed)
- [x] Add comment:typing:start and comment:typing:stop events to socket server
- [x] Create TypingIndicator component with animated dots
- [x] Add typing state management to useSocket hook (startTypingComment, stopTypingComment, getTypingUsersForTask)
- [x] Create TaskComments component with full comment functionality
- [x] Integrate typing indicator in TaskDetailPanel
- [x] Debounce typing detection (2 second timeout)
- [x] Show "User is typing..." with animated dots (Russian: "печатает")
- [x] Filter out current user from typing display


## Phase 47: Task Priority & Deadlines System (In Progress)
### 1. Priority System
- [x] Add priority field to tasks schema (critical, high, medium, low)
- [x] Create PriorityBadge component with color coding
- [x] Create PrioritySelector component for selection
- [x] Add priority selection in TaskDetailPanel
- [x] Show priority badges in task list sidebar
- [ ] Add task sorting by priority

### 2. Deadline System
- [x] Add deadline field to tasks schema
- [x] Create TaskDeadlineBadge component with status indication (overdue, due soon, on track)
- [x] Create TaskDeadlineIndicator for compact sidebar display
- [x] Add DatePicker for deadline selection in TaskDetailPanel
- [x] Show deadline badges in task list sidebar
- [ ] Add deadline filtering (today, this week, overdue)

### 3. Task Dependencies
- [x] Add dependencies field (array of task IDs) to schema
- [x] Create UI for linking tasks in TaskDetailPanel
- [x] Show dependency status (completed/pending) with visual indicators
- [x] Show dependency icon (Link2) in task list sidebar
- [ ] Block task completion if predecessors not done
- [ ] Show dependency lines on Timeline

### 4. Notifications
- [x] Create deadline approaching notification helper
- [x] Create overdue task notification helper
- [x] Create task unblocked notification helper
- [ ] Scheduled job to check deadlines and send notifications


## Phase 48: Deadline Filters, Priority Sorting & Timeline Dependencies (Completed)

### 1. Deadline Filters in Sidebar
- [x] Create FilterChip component with counter badges
- [x] Add filter options: "Все", "Сегодня", "Эта неделя", "Просроченные"
- [x] Create TaskFiltersBar component integrating filters and sorting
- [x] Save selected filter to localStorage
- [x] Add animation when switching filters (AnimatePresence)

### 2. Priority Sorting
- [x] Create SortDropdown component
- [x] Add sort options: "По приоритету", "По дедлайну", "По названию", "По дате создания"
- [x] Add ascending/descending toggle
- [x] Apply sorting via sortTasks utility function
- [x] Save selected sort to localStorage

### 3. Timeline Dependencies Visualization
- [x] Create DependencyLines component with SVG arrows
- [x] Color-code dependencies (green = completed, red = blocking, gray = pending)
- [x] Add tooltip on hover showing dependency info
- [x] Create DependencyLegend component
- [ ] Enable drag&drop to create dependencies on Timeline (future)

### 4. Overdue Tasks Indicator in Dashboard
- [x] Create OverdueTasksWidget for dashboard
- [x] Create OverdueHeaderIndicator for header
- [x] Quick actions: "Отметить выполненной", "Перенести на сегодня"
- [x] Create useOverdueTasks hook for calculating overdue tasks

### 5. Subtasks/Checklist
- [x] Subtasks table already exists in database schema
- [x] Backend CRUD already implemented (subtaskRouter)
- [x] Create SubtasksChecklist component with checkboxes
- [x] Show progress indicator (3/5 completed) with SubtaskProgress
- [x] Add drag&drop for reordering subtasks (Reorder from framer-motion)
- [x] Add reorderSubtasks API endpoint


## Phase 48.1: TaskFiltersBar Integration (Completed)
- [x] Import TaskFiltersBar in ProjectView
- [x] Add filter/sort state management (filteredTaskIds state)
- [x] Place TaskFiltersBar above DraggableSidebar
- [x] Apply filters and sorting to task list (via filteredTaskIds prop)
- [x] Test filter and sort functionality - all 113 tests passing


## Phase 48.2: OverdueTasksWidget Dashboard Integration (Completed)
- [x] Import OverdueTasksWidget in Dashboard
- [x] Add getOverdue API endpoint in taskRouter
- [x] Add getOverdueTasks function in db.ts
- [x] Place widget above Timeline section
- [x] Add quick actions (Mark Complete, Reschedule to Today)
- [x] Navigate to task on click
- [x] Test overdue tasks display - all 113 tests passing


## Phase 48.3: SubtasksChecklist in TaskDetailPanel (Completed)
- [x] Import SubtasksChecklist in ProjectView
- [x] Create SubtasksSection wrapper component with tRPC mutations
- [x] Add subtasks section to TaskDetailPanel (before Comments)
- [x] Connect subtask CRUD operations (create, update, delete, reorder)
- [x] Test subtask management - all 113 tests passing


## Phase 48.4: Subtask Progress Indicator in Task List (Completed)
- [x] Subtasks already fetched with task data (getFullProject includes subtasks)
- [x] Created SubtaskProgress component with tooltip
- [x] Added SubtaskProgress to SortableTask in DraggableSidebar
- [x] Show "completed/total" format with color coding (green=all done, amber=partial, gray=none)
- [x] All 113 tests passing


## Phase 48.5: Subtask Templates System (Completed)
- [x] Create subtask_templates table in database schema
- [x] Create subtask_template_items table for template items
- [x] Add backend CRUD for templates (create, list, delete, saveAsTemplate, applyTemplate)
- [x] Add "Apply template" procedure with usage count tracking
- [x] Create SubtaskTemplateSelector component with dropdown menu
- [x] Add "Save as template" dialog with name, category, description
- [x] Add "Manage templates" dialog for viewing/deleting templates
- [x] Group templates by category with icons (Development, Design, Marketing, etc.)
- [x] Show usage count and item count for each template
- [x] Integrate template selector into SubtasksChecklist header
- [x] All 113 tests passing


### Phase 49: Team Collaboration (Completed)
### 49.1 User Assignment
- [x] Add assignedTo (userId) field to tasks schema
- [x] Create UserSelector component with avatars
- [x] Display assignee in task list (AssigneeAvatar component)
- [x] Add team.assignTask and team.getMyTasks API endpoints
### 49.2 Team Members Management
- [x] Create team management page (/project/:id/team)
- [x] Implement roles: Owner, Admin, Editor, Viewer
- [x] Add invite by email/link functionality
- [x] Create JoinProject page for accepting invitations
- [x] Team router with full CRUD for members and invitations
### 49.3 Activity Feed
- [x] Create ActivityFeed component for Dashboard
- [x] Add icons and colors for different event types
- [x] Create team.getDashboardActivity and team.getProjectActivity endpoints
- [x] Activity logging for all team actions
- [x] All 152 tests passing

## Phase 50: Advanced Analytics

### 50.1 Progress Dashboard
- [ ] Burndown/Burnup charts (Recharts)
- [ ] Velocity tracking (tasks/week)
- [ ] Completion rate by blocks
- [ ] Projected completion date

### 50.2 Project Statistics
- [ ] Task distribution by priority (pie chart)
- [ ] Task completion time (histogram)
- [ ] Plan vs Actual comparison
- [ ] Top-5 longest tasks

### 50.3 Export Reports
- [ ] PDF report with charts
- [ ] Excel export with details
- [ ] Report content configuration

## Phase 51: Template System Enhancement

### 51.1 Template Customization
- [ ] Parameterized templates (variables)
- [ ] Preview before applying
- [ ] Partial application option

### 51.2 Community Templates
- [ ] Publish own templates
- [ ] Categories and tags
- [ ] Ratings and reviews
- [ ] Search and filtering

### 51.3 Template Editor
- [ ] Visual template editor
- [ ] Drag&drop for structure
- [ ] Copy existing project as template

## Phase 52: AI Enhancements

### 52.1 Smart Suggestions
- [ ] AI hints when creating tasks
- [ ] Automatic priority detection
- [ ] Deadline suggestions based on similar tasks
- [ ] Risk detection

### 52.2 AI Summary
- [ ] Executive summary with one button
- [ ] Weekly progress report auto-generation
- [ ] Bottleneck analysis and recommendations

### 52.3 Contextual AI Chat
- [ ] Quick commands (/summarize, /analyze, /suggest)
- [ ] Full project context in chat
- [ ] Chat history saving

## Phase 53: Mobile & PWA

### 53.1 Responsive Design
- [ ] Mobile-first adaptation of all pages
- [ ] Swipe gestures for navigation
- [ ] Bottom navigation bar
- [ ] Collapsible panels

### 53.2 PWA Features
- [ ] Service Worker for offline mode
- [ ] Push notifications
- [ ] Background sync
- [ ] Add to Home Screen prompt

### 53.3 Touch Optimization
- [ ] Enlarged touch targets
- [ ] Long press for context menu
- [ ] Pull-to-refresh

## Phase 54: Integrations

### 54.1 Calendar Sync
- [ ] Google Calendar integration
- [ ] Export deadlines to iCal
- [ ] Two-way synchronization

### 54.2 External Tools
- [ ] Notion import
- [ ] Trello import
- [ ] Webhook system for automations

### 54.3 API
- [ ] REST API documentation (Swagger)
- [ ] API keys management
- [ ] Rate limiting


## Phase 50: Advanced Analytics (Completed)
### 50.1 Progress Dashboard
- [x] Install Recharts library
- [x] BurnupChart component with scope line
- [x] VelocityChart with bar chart and moving average
- [x] BlockCompletionChart with horizontal bars
- [x] ProjectedCompletion card with on-track status
### 50.2 Project Statistics
- [x] PriorityDistributionChart (pie chart)
- [x] CompletionTimeHistogram (bar chart)
- [x] PlanVsActualChart (table with status)
- [x] TopLongestTasks (ranked list)
### 50.3 Export Reports
- [x] Markdown report generation (generatePdfReport)
- [x] CSV export with all task details (generateExcelData)
- [x] Analytics page (/project/:id/analytics)
- [x] Export dropdown with PDF and Excel options
- [x] 170 tests passing


## Phase 51: Template System Enhancement (Completed)
### 51.1 Parameterized Templates
- [x] Add variables field to templates schema
- [x] Create TemplateVariable type (name, type, default, description)
- [x] Variable substitution engine with {{variable}} syntax
- [x] Preview with variable values (TemplatePreview component)
- [x] TemplateVariableEditor component for editing variables
### 51.2 Community Templates
- [x] Add isPublic, categoryId, rating fields to templates
- [x] Create templateCategories table
- [x] Create templateTags and templateTagAssignments tables
- [x] Create templateRatings table
- [x] Community templates API (list, rate, publish, use)
### 51.3 Template UI
- [x] TemplatePreview component with structure visualization
- [x] TemplateVariableEditor with drag&drop support
- [x] TemplateRating component (1-5 stars with reviews)
- [x] TemplateCard component for gallery
- [x] CommunityTemplates gallery page (/templates)
- [x] Copy project as template (createFromProject)
- [x] Category and tag filters with search
- [x] 205 tests passing


## Phase 52: AI Enhancements (Completed)
### 52.1 Smart Suggestions
- [x] SmartSuggestions component for task creation
- [x] AI suggestions with title, description, priority, subtasks
- [x] Similar task detection (findSimilarTasks API)
### 52.2 Auto-Priority Detection
- [x] PriorityDetector component with auto-detection
- [x] Keyword-based detection (urgent, critical, etc.)
- [x] Deadline proximity analysis
- [x] Confidence score display
### 52.3 Risk Detection
- [x] RiskDetectionPanel component
- [x] Detect overdue tasks with severity levels
- [x] Detect blocked tasks (dependencies)
- [x] Scope creep detection (too many in-progress)
- [x] Risk status management (open/mitigated/resolved/accepted)
### 52.4 Executive Summary
- [x] ExecutiveSummary component with dialog
- [x] Key metrics display (progress, tasks, risks)
- [x] Achievements, challenges, recommendations
- [x] Export to Markdown
### 52.5 Quick Commands
- [x] QuickCommands component with popover
- [x] /summarize - context summary
- [x] /analyze - SWOT analysis
- [x] /suggest - improvement suggestions
- [x] /risks - risk analysis
### 52.6 Chat History
- [x] AIChatHistory component
- [x] Search through conversations
- [x] Export to Markdown/JSON
- [x] AIToolbar integration component
- [x] 218 tests passing


## Phase 53: Mobile & PWA (Completed)
### 53.1 PWA Setup
- [x] Create PWA manifest.json with icons and shortcuts
- [x] Create Service Worker for offline caching (sw.js)
- [x] Add PWAInstallPrompt component with iOS instructions
- [x] Add PWAUpdateNotification component
- [x] Create offline.html fallback page
### 53.2 Mobile-First Responsive Design
- [x] Create useMobile, useOrientation, useTouchDevice hooks
- [x] Create MobileLayout wrapper component
- [x] Add safe area insets for notched devices
- [x] Add mobile-specific CSS styles in index.css
### 53.3 Bottom Navigation
- [x] Create BottomNavBar component with FAB
- [x] Create ProjectBottomNav for project view
- [x] Badge support for notifications count
### 53.4 Touch Optimization
- [x] Create useSwipe hook for gesture detection
- [x] Create usePullToRefresh hook
- [x] Create SwipeableTaskCard component
- [x] Touch-friendly button sizes (min 44px)
- [x] Haptic feedback CSS classes
- [x] 235 tests passing


## Phase 54: Integrations (Completed)
### 54.1 Google Calendar Integration
- [x] Create iCal format generator (icalRouter.ts)
- [x] Export tasks with deadlines as calendar events (VEVENT)
- [x] Generate shareable calendar URL with token
- [x] Export project and all tasks endpoints
### 54.2 Webhook System
- [x] Create webhooks and webhookDeliveries tables
- [x] Implement webhook CRUD API (webhookRouter.ts)
- [x] Add 17 event triggers (task.*, project.*, member.*, deadline.*)
- [x] Webhook delivery with retry logic and signature verification
- [x] Test webhook endpoint
### 54.3 REST API
- [x] Create OpenAPI 3.0.3 specification (restApiRouter.ts)
- [x] Define schemas for Project, Block, Section, Task, Subtask
- [x] API versioning (/api/v1)
- [x] Security scheme with X-API-Key header
### 54.4 API Keys Management
- [x] Create apiKeys and apiUsage tables
- [x] Generate API keys with mr_ prefix (apiKeysRouter.ts)
- [x] 11 API scopes (projects/tasks/blocks/sections/subtasks:read/write, analytics:read)
- [x] Rate limiting (100-10000 requests/hour)
- [x] Usage tracking with endpoint breakdown
- [x] Key regeneration and expiration
- [x] 257 tests passing


## Phase 55: Integration UI & AI Components (Completed)
### 55.1 Webhooks Management UI
- [x] Create WebhooksManagement page (/settings/webhooks)
- [x] Webhook list with status indicators (active/paused)
- [x] Delivery history view with status badges
- [x] Test webhook button
- [x] Event type selection with 17 events
### 55.2 API Keys Management UI
- [x] Create ApiKeysManagement page (/settings/api-keys)
- [x] API key creation with scope selection (11 scopes)
- [x] Key list with usage stats and rate limits
- [x] Regenerate and revoke actions
- [x] Copy key to clipboard
### 55.3 Swagger UI
- [x] Create ApiDocs page (/api-docs)
- [x] OpenAPI 3.0.3 specification display
- [x] Interactive endpoint explorer
- [x] Schema definitions
### 55.4 AI Integration in ProjectView
- [x] Add AI Assistant menu item in project dropdown
- [x] Add Risk Analysis menu item
- [x] RiskAnalysisContent component with severity levels
- [x] StreamingAIChat dialog for project context
### 55.5 Settings Page
- [x] Add Integrations section to Settings page
- [x] Links to API Keys, Webhooks, API Docs
- [x] Routes registered in App.tsx
- [x] 257 tests passing


## Phase 56: Bug Fixes & Optimizations (Completed)
### 56.1 Identified Issues
- [x] Remove console.log statements from production code (googleDrive.ts)
- [ ] Fix missing aria-describedby warnings in DialogContent components (minor, non-blocking)
- [ ] ProjectView.tsx is too large (1971 lines) - needs refactoring (future improvement)
- [ ] db.ts is too large (2012 lines) - needs splitting into modules (future improvement)
- [ ] routers.ts is too large (1490 lines) - needs splitting (future improvement)

### 56.2 Performance Optimizations
- [x] Add React.lazy() for route-level code splitting (13 pages lazy loaded)
- [x] Add database indexes for tasks table (sectionId, status, deadline, assignedTo)
- [x] Add database indexes for projects table (userId, status)
- [ ] Implement query caching for frequently accessed data (future improvement)

### 56.3 Code Quality
- [x] ErrorBoundary already exists for all pages
- [x] TypeScript compiles without errors
- [x] 129 TRPCError throws for proper error handling
- [x] All 257 tests passing


## Phase 57: Gamification System (Completed)
### 57.1 Database Schema
- [x] Create userAchievements table (userId, achievementId, unlockedAt)
- [x] Create userStats table (userId, totalPoints, level, tasksCompleted, projectsCompleted, streaks)
- [x] Add indexes for efficient queries

### 57.2 Achievement System
- [x] Define 13 achievements across 4 categories:
  - Tasks: first_task, task_master_10, task_master_50, task_master_100
  - Streaks: streak_3, streak_7, streak_30
  - Projects: first_project, project_complete
  - Special: early_bird, night_owl, speed_demon, perfectionist
- [x] Points system (10-200 points per achievement)
- [x] Level calculation (100 points per level)

### 57.3 Gamification Router
- [x] getAchievements - list all achievements with unlock status
- [x] getStats - user statistics (points, level, streaks, tasks completed)
- [x] getLeaderboard - top performers ranking
- [x] checkAchievements - trigger achievement checks on task/project completion
- [x] updateStreak - daily streak tracking
- [x] getRecentActivity - achievement unlock history

### 57.4 UI Components
- [x] Badge component with tooltip and unlock status
- [x] BadgeGrid component with category grouping
- [x] AchievementNotification component with animation
- [x] useAchievementNotifications hook for queue management
- [x] UserStatsCard component with level progress
- [x] CompactStats component for sidebar/header
- [x] Leaderboard component with rankings
- [x] CompactLeaderboard component

### 57.5 Gamification Page
- [x] Create GamificationPage at /achievements
- [x] User stats overview with level progress
- [x] Achievements tab with BadgeGrid
- [x] Leaderboard tab with rankings
- [x] Category summary cards
- [x] Add route to App.tsx
- [x] Add Trophy icon link in Dashboard header

### 57.6 Tests
- [x] 31 gamification tests covering:
  - Achievement definitions (13 achievements, unique IDs/codes)
  - Task milestones (1, 10, 50, 100 tasks)
  - Streak achievements (3, 7, 30 days)
  - Project achievements
  - Special achievements
  - Level calculation
  - Streak logic
  - Points calculation
  - Leaderboard ranking
- [x] 288 total tests passing


## Phase 57.5: Achievement Trigger Integration (Completed)
### 57.5.1 Backend Integration
- [x] Add achievement check to task.update mutation when status changes to 'completed'
- [x] Add achievement check to project.create mutation
- [x] Add achievement check to project.update mutation when status changes to 'completed'
- [x] Update streak on task completion
- [x] Create achievementService.ts for internal achievement checks

### 57.5.2 Frontend Integration
- [x] Add AchievementNotificationProvider to App.tsx
- [x] Create useAchievementTrigger hook for mutations
- [x] Create useAchievementNotifications hook for notification queue
- [x] Show achievement popup when new achievements are unlocked
- [x] Integrate achievement triggers in ProjectView (task completion)
- [x] Integrate achievement triggers in Dashboard (project creation)

### 57.5.3 Tests
- [x] 19 achievement integration tests
- [x] 307 total tests passing


## Phase 58: AI Router System with Caching
### 58.1 Database Tables (Completed)
- [x] Add aiCache table (cache AI requests with MD5 keys)
- [x] Add aiRequests table (history of all requests)
- [x] Add aiSessions table (chat sessions)
- [x] Add aiUsageStats table (daily usage statistics)
- [x] Add indexes for query optimization
- [x] Add relations for new tables
- [x] Database already synced (9 AI tables exist)


### 58.2 AI Cache Utility (Phase 2) - Completed
- [x] Install npm packages (openai, @anthropic-ai/sdk, @google/generative-ai, uuid)
- [x] Create server/utils/aiCache.ts with AICache class
- [x] Implement generateKey() - MD5 hash generation
- [x] Implement get() - cache retrieval with TTL check
- [x] Implement set() - cache storage with TTL
- [x] Implement cleanup() - expired entries removal
- [x] Implement getStats() - cache statistics
- [x] Implement getSessionContext() - session message history
- [x] 11 AI Cache tests passing
- [x] 318 total tests passing


### 58.3 AI Router Service (Phase 3) - Completed
- [x] Create AI provider adapters (GPT-4, Claude, Gemini, Builtin)
- [x] Create AI Router service with routing logic
- [x] Implement task-based model selection (7 task types)
- [x] Add fallback mechanism between providers
- [x] Add request logging to aiRequests table
- [x] Add usage tracking to aiUsageStats table
- [x] Integrate with AICache for caching
- [x] Write tests for AI Router (15 new tests)
- [x] 333 total tests passing


### 58.4 AI tRPC Procedures (Phase 4) - Completed
- [x] Create aiTrpcRouter.ts with tRPC procedures
- [x] Add ai.chat procedure for sending messages
- [x] Add ai.getSessions procedure for listing chat sessions
- [x] Add ai.getSessionMessages procedure for message history
- [x] Add ai.getUsageStats procedure for usage statistics
- [x] Add ai.getCacheStats procedure for cache statistics
- [x] Add ai.getProviders procedure for available providers
- [x] Add ai.quickChat procedure for single messages
- [x] Add ai.createSession, updateSession, deleteSession procedures
- [x] Add ai.getSessionContext procedure
- [x] Add to main router as aiRouter
- [x] Write tests for AI tRPC procedures (22 new tests)
- [x] 355 total tests passing


### 58.5 AI Chat UI (Phase 5) - Completed
- [x] Create AIChatPage component with message input
- [x] Add conversation history display with Streamdown markdown rendering
- [x] Create session sidebar for managing chat sessions (create/rename/delete)
- [x] Add task type selector (chat, reasoning, coding, translation, summarization, creative)
- [x] Add usage statistics display (requests, cached, tokens, cost)
- [x] Add cache statistics badge
- [x] Add route /ai-chat to App.tsx
- [x] Add Bot icon navigation link to Dashboard header
- [x] 355 total tests passing


### 58.6 AI Streaming Responses (Phase 6) - Completed
- [x] Streaming LLM helper already exists in llmStream.ts
- [x] Add /api/ai/stream endpoint for streaming responses
- [x] Update AIChatPage to handle streaming with fetch ReadableStream
- [x] Add real-time token display during generation
- [x] Handle stream errors and cancellation with AbortController
- [x] Add cancel button during streaming
- [x] 355 total tests passing


### 58.7 AI Chat UX Redesign (Phase 7) - Completed
- [x] Create floating AI chat button component (bottom-right corner with pulse indicator)
- [x] Create popup quick input modal (compact 96w with task selector)
- [x] Add dockable side panel mode (slide-in from right, 96w)
- [x] Add expandable fullscreen mode (max-w-4xl centered)
- [x] Persist user preference for chat mode (localStorage)
- [x] Add smooth animations (slide-in, fade-in, hover scale)
- [x] Integrate with existing AI streaming
- [x] Keyboard shortcuts: Ctrl+K toggle, Esc close
- [x] 355 total tests passing


### 58.8 AI Project Context Integration (Phase 8) - Completed
- [x] Create ProjectContextProvider to track current project
- [x] Create useProjectContext hook for accessing project data
- [x] Update AIChatWidget to include project context in requests
- [x] Update /api/ai/stream to build context-aware system prompts
- [x] Display current project context badge in chat header (all modes)
- [x] Auto-set project context when viewing ProjectView
- [x] Auto-clear project context when leaving ProjectView
- [x] 355 total tests passing


### 58.9 AI Quick Prompts (Phase 9)
- [ ] Create quick prompt buttons component
- [ ] Add prompts: Analyze Progress, Suggest Next Tasks, Find Blockers, Generate Report
- [ ] Show prompts only when project context is available
- [ ] Integrate into AIChatWidget (all modes)
- [ ] Auto-send prompt on click


### 59. Relations System Implementation - Completed
#### 59.1 Database Tables
- [x] Add tags table to schema.ts
- [x] Add taskTags junction table to schema.ts
- [x] Add entityRelations table to schema.ts
- [x] Add viewConfigs table to schema.ts
- [x] Add kanbanColumns table to schema.ts
- [x] Add lookupFields table to schema.ts
- [x] Add rollupFields table to schema.ts
- [x] Update relations.ts with new relations
- [x] Database migration completed

#### 59.2 Utility Services
- [x] Create server/utils/relationResolver.ts (entity linking, unlinking, related entities)
- [x] Create server/utils/lookupCalculator.ts (lookup field calculations)
- [x] Create server/utils/rollupCalculator.ts (rollup aggregations: sum, avg, count, min, max, etc.)

#### 59.3 tRPC Router
- [x] Create server/relationsRouter.ts with 15 endpoints
- [x] createRelationDefinition, getRelatedEntities, linkRecords, unlinkRecords
- [x] createLookupField, calculateLookup, createRollupField, calculateRollup
- [x] createTag, getTags, updateTag, deleteTag
- [x] addTagToTask, removeTagFromTask, getTaskTags
- [x] Integrated into appRouter

#### 59.4 Frontend Components
- [x] Create TagSelector component (tag management, create, add, remove)
- [x] Create TagBadges component (compact tag display)
- [x] Create RelationPicker component (entity linking UI)
- [x] Create RelationBadges component (compact relation display)

#### 59.5 Tests
- [x] 379 total tests passing (24 new relations tests)


## Phase 60: Task Tagging Integration
- [x] Integrate TagSelector into task detail panel
- [x] Add tag display (TagBadges) in task list view
- [x] Connect to relationsRouter for tag operations
- [x] Add tag filtering capability in task list
  - [x] Add tag filter state to FilterContext
  - [x] Add tag filter dropdown to FilterBar
  - [x] Update MainContent to filter tasks by selected tags
  - [x] Add getAllTaskTags endpoint for efficient filtering
  - [x] Create useTaskTagsCache hook for client-side tag lookup


## Phase 61: Default Tag Templates
- [x] Create default tags configuration (Urgent, MVP, Blocker, etc.)
- [x] Add seedDefaultTags function to relationsRouter
- [x] Integrate default tags creation into project creation flow
- [x] Add getDefaultTagTemplates endpoint for UI preview

## Phase 62: Tag Management Page
- [x] Add sortOrder field to tags schema
- [x] Add reorderTags endpoint to relationsRouter
- [x] Add archiveTag endpoint to relationsRouter
- [x] Create TagManagement page component with drag-and-drop reordering
- [x] Add tag editing dialog with color picker (15 colors)
- [x] Add archive/unarchive functionality with toggle
- [x] Add create new tag functionality
- [x] Add seed default tags button for existing projects
- [x] Add route /project/:id/tags to App.tsx
- [x] Add "Управление тегами" menu item in ProjectView dropdown
- [x] 379 total tests passing


## Phase 63: Tag-Based Task Grouping
- [x] Add groupBy state to FilterContext (none, tag, status, priority)
- [x] Add grouping toggle dropdown to FilterBar
- [x] Update MainContent to render tasks grouped by tags
- [x] Show tag header with color badge for each group
- [x] Handle tasks with multiple tags (show in each group)
- [x] Handle tasks with no tags ("Без тегов" group)
- [x] Add grouping by status (В работе, Не начато, Готово)
- [x] Add grouping by priority (based on tag keywords)
- [x] Maintain existing filter and sort functionality within groups
- [x] 379 total tests passing


## Phase 64: Collapsible Tag Groups
- [x] Add collapsed state management for groups
- [x] Add chevron toggle icon to group headers
- [x] Animate collapse/expand transitions
- [x] Add "Развернуть все" / "Свернуть все" buttons
- [x] Persist collapsed state in localStorage
- [x] Show task count when group is collapsed
- [x] 379 total tests passing

## Phase 65: Persist Grouping Mode
- [ ] Add groupingMode field to viewConfigs or project settings
- [ ] Create API endpoint to save grouping preference
- [ ] Create API endpoint to load grouping preference
- [ ] Update FilterContext to sync with database
- [ ] Load saved preference on project open


## Phase 66: AI Decision Finalization System (CRITICAL)

### Part 2: Финализация Итогов ⭐
- [x] Create ai_decision_records table (sessionId, taskId, projectId, question, aiResponse, finalDecision, keyPoints, actionItems, decisionType, tags, status)
- [x] Create aiDecisionRouter.ts with endpoints:
  - [x] finalize() - save decision
  - [x] getContextDecisions() - for AI context injection
  - [x] getFormattedContext() - formatted string for AI prompts
  - [x] generateSummary() - AI extracts key points
  - [x] getDecisions() - list all decisions
  - [x] getDecision() - get single decision
  - [x] updateDecision() - update status/content
  - [x] deleteDecision() - remove decision
  - [x] getStats() - statistics by status/type/importance
- [x] Create FinalizeDecisionModal component:
  - [x] Auto-fill question from conversation
  - [x] AI-generated summary as final decision
  - [x] Key points extraction with priority (high/medium/low)
  - [x] Action items with subtask checkbox
  - [x] Decision type selector (6 types)
  - [x] Importance selector (4 levels)
  - [x] Tags input with add/remove
- [x] Create AIResponseActions component:
  - [x] ✅ Финализировать итоги (main button)
  - [x] 💾 Сохранить в документ
  - [x] 📝 Создать подзадачу
  - [x] 📋 Копировать
  - [x] Compact and full modes
- [x] AI Context Integration:
  - [x] useAIContext hook for context management
  - [x] buildPromptWithContext() helper
  - [x] DecisionContextBadge component
  - [x] Format: "=== ПРОШЛЫЕ РЕШЕНИЯ ===" section
- [x] 13 tests passing for aiDecision


### Part 1: Floating AI Chat Button
- [x] Create FloatingAIChatButton component:
  - [x] Position: fixed, bottom: 24px, right: 24px, z-index: 9999
  - [x] Always visible on ALL pages (Dashboard, Projects, Tasks)
  - [x] Indicators: 🟢 context loaded, 💬 unread messages
- [x] Three modes:
  - [x] Minimized: only button with pulse animation
  - [x] Popup: window 420x650px bottom-right corner
  - [x] Dockable: side panel full height (resizable width)
- [x] Create FloatingAIChatContent component:
  - [x] Message input with send button
  - [x] Message history with AI/User distinction
  - [x] Streamdown markdown rendering
  - [x] AIResponseActions integration for each AI message
  - [x] DecisionContextBadge showing loaded context
- [x] Mode switching:
  - [x] Click button to toggle popup
  - [x] Button to switch between popup and docked
  - [x] Keyboard shortcut (Cmd/Ctrl + J)
  - [x] Escape to minimize
- [x] Persist state in localStorage:
  - [x] Docked panel width
  - [x] Chat history (last 50 messages)
- [x] 21 tests passing for floatingChat


### Part 4: Decision Log Dashboard
- [x] Create DecisionLogDashboard page component at /decisions
- [x] Display all finalized decisions in card/list view
- [x] Add filters:
  - [x] By decision type (technical/business/design/etc)
  - [x] By status (active/implemented/obsolete)
  - [x] By importance (critical/high/medium/low)
- [x] Add search by content
- [x] Add timeline view showing decisions chronologically
- [x] Add export options:
  - [x] Export as Markdown
- [x] Add decision detail modal/panel
- [x] Add quick actions (mark implemented, archive, delete)
- [x] Add statistics summary (total, by type, by status)
- [x] Add route /decisions to App.tsx
- [x] Add navigation link in Dashboard header
- [x] 413 total tests passing

### Part 3: AI Suggested Actions
- [x] Create SuggestedActions component with 7 action types:
  - [x] create_subtask: Создать подзадачу
  - [x] set_deadline: Установить дедлайн
  - [x] update_status: Обновить статус
  - [x] add_tag: Добавить тег
  - [x] set_priority: Установить приоритет
  - [x] create_note: Создать заметку
  - [x] assign_task: Назначить задачу
- [x] Add generateSuggestedActions endpoint to aiDecisionRouter (AI-powered)
- [x] Create parseActionsFromResponse helper (fast local parsing)
- [x] Two-stage generation: fast local + AI-powered refinement
- [x] Integrate SuggestedActions into FloatingAIChatContent
- [x] Show confidence indicators (high/medium/low) with colors
- [x] Execute actions on click with toast feedback
- [x] Compact and expanded view modes
- [x] 413 total tests passing


## Phase 67: Task Router Integration for Suggested Actions
- [x] Review existing task router endpoints (create, update, delete)
- [x] Use existing subtask.create endpoint for subtasks
- [x] Use existing task.update endpoint for status/deadline/priority
- [x] Update SuggestedActions component to use real mutations:
  - [x] create_subtask → trpc.subtask.create
  - [x] set_deadline → trpc.task.update with deadline field
  - [x] update_status → trpc.task.update with status field
  - [x] set_priority → trpc.task.update with priority field
  - [x] add_tag → trpc.relations.createTag + addTagToTask
  - [x] create_note → trpc.task.update with notes field
- [x] Handle taskId conversion (string to number) with parseTaskId helper
- [x] Add parseDeadlineToTimestamp for relative dates (завтра, через неделю)
- [x] Add mapStatusToEnum and mapPriorityToEnum helpers
- [x] Add success/error feedback with toast notifications
- [x] 413 total tests passing

## Phase 68: AI Chat Context from Routes
- [x] Create AIChatContextProvider to manage current project/task context
- [x] Extract projectId from route params (/project/:id)
- [x] Extract taskId from TaskPanel selection state
- [x] Update FloatingAIChatButton to consume context
- [x] Pass context to FloatingAIChatContent and SuggestedActions
- [x] Show current context in chat header (project name, task title)
- [x] Auto-update context when navigating between projects/tasks
- [x] Clear task context when task panel is closed
- [x] Include context in AI prompts via getContextForPrompt()
- [x] Add getContextSummary() for human-readable context display
- [x] 413 total tests passing


## Phase 69: AI Session Persistence (Completed)
- [x] Create ai_sessions table (id, userId, projectId, taskId, title, createdAt, updatedAt)
- [x] Create ai_messages table (id, sessionId, role, content, metadata, createdAt)
- [x] Create aiSessionRouter with endpoints:
  - [x] createSession - create new chat session
  - [x] getSessions - list user's sessions with filters
  - [x] getSession - get session with messages
  - [x] addMessage - add message to session
  - [x] updateSession - update session title
  - [x] deleteSession - delete session and messages
  - [x] getOrCreateSession - get active session or create new
  - [x] clearSession - clear all messages in session
  - [x] markMessageFinalized - mark message as finalized
- [x] Update FloatingAIChatContent to:
  - [x] Load active session on mount
  - [x] Save messages to database after each exchange
  - [x] Auto-create session on first message
- [x] Add session management UI:
  - [x] Session list sidebar/dropdown
  - [x] New session button
  - [x] Session title editing
  - [x] Delete session with confirmation
  - [x] Switch between sessions
  - [x] Pin/archive sessions
- [x] 427 total tests passing


## Phase 70: AI Session Search (Completed)
- [x] Add searchSessions endpoint to aiSessionRouter
  - [x] Search by session title
  - [x] Search by message content
  - [x] Return matching sessions with snippet preview
- [x] Update FloatingAIChatContent sessions view:
  - [x] Add search input field
  - [x] Filter sessions as user types
  - [x] Highlight matching text in results
  - [x] Show "no results" state
  - [x] Show match type indicator (title/content)
- [x] Add tests for search functionality
- [x] 430 total tests passing


## Phase 71: AI Session Auto-Title Generation (Completed)
- [x] Add generateSessionTitle endpoint to aiSessionRouter
  - [x] Accept sessionId and use first few messages as context
  - [x] Use LLM to generate concise, meaningful title
  - [x] Update session title in database
- [x] Integrate auto-title in FloatingAIChatContent:
  - [x] Trigger title generation after first AI response
  - [x] Show loading state while generating
  - [x] Update UI with new title
- [x] Add manual "regenerate title" option in session menu (Wand2 icon)
- [x] Add tests for title generation
- [x] 432 total tests passing


## Phase 72: Admin Panel Overhaul - Stage 1 (Completed)

### 1. New Sidebar Navigation Structure
- [x] Replace horizontal tabs with collapsible sidebar menu
- [x] Create AdminLayout component with sidebar
- [x] Add icon + short name for each section
- [x] Implement collapse/expand functionality
- [x] Group sections:
  - [x] 📊 Dashboard (Overview)
  - [x] 🤖 AI Configuration (Agents, Skills, Prompts, MCP, Orchestrator)
  - [x] 👥 Users (List, Roles)
  - [x] 💰 Credits (Balance, Limits, Tariffs)
  - [x] 📁 Content (Projects, Templates)
  - [x] 🎨 UI Settings (Branding, Navbar, Localization)
  - [x] 🔗 Integrations (Webhooks, API Keys, Notifications)
  - [x] 📋 Logs & Analytics

### 2. Admin Dashboard
- [x] Stats cards: users, AI requests today, credits spent, active projects, errors
- [x] Mini chart: credits usage last 7 days
- [x] Last 5 AI requests table
- [x] System status (API providers online/offline)
- [x] Quick actions: create agent, invite user, view logs

### 3. Fix Skills Creation
- [x] Create working modal with fields: Name, Slug, Description, Type, System Prompt
- [x] Skills list with cards: edit/delete/clone/toggle active

### 4. Fix MCP Server Creation
- [x] Create working modal: Name, URL, Transport type, Auth config, Description
- [x] Add "Test Connection" button
- [x] Status indicator (green/red)
- [x] Server list with enable/disable toggle

### 5. Improve Agents
- [x] Show bound skills as chips/badges on agent cards
- [x] Add Active/Inactive toggle
- [x] Add "Clone Agent" button
- [x] Add "Test" button (opens mini-chat with agent)

**448 total tests passing**


## Phase 73: Admin Panel Overhaul - Stage 2 (Users + Credits + Billing)

### 1. User Management (/admin → Users → List)
- [ ] Users table: Avatar, Name, Email, Role, Status, Registration date, Last login, Credits used, AI requests
- [ ] Filters: by role, status, date
- [ ] Search by name/email
- [ ] Actions: Change role, Block, Delete, Reset password
- [ ] "Invite User" button with modal: email, role, credit limit
- [ ] Click user → detail page with activity history

### 2. Roles and Permissions (/admin → Users → Roles)
- [ ] 4 preset roles: Admin, Manager, User, Viewer
- [ ] Permissions table for each role:
  - [ ] Projects: create / edit / delete / view only
  - [ ] AI: use chat / create agents / configure skills
  - [ ] Admin: access / full access / no access
  - [ ] Credits: unlimited / limited / no access
- [ ] "Create Custom Role" button
- [ ] Visual permissions matrix with toggles

### 3. Credits Balance and History (/admin → Credits → Balance)
- [ ] Current platform balance (large number)
- [ ] Usage chart: day/week/month toggle
- [ ] Transactions table: Date, User, Type (AI request / top-up / gift / deduction), Model, Tokens, Credits, Balance after
- [ ] Filters by user, type, date
- [ ] Export to CSV
- [ ] "Add Credits" button → user selection, amount, reason

### 4. Limits Policies (/admin → Credits → Policies)
- [ ] Global daily limit per user
- [ ] Limit per request (max tokens)
- [ ] Limits by role (Admin = unlimited, User = 100/day, Viewer = 10/day)
- [ ] Limit per project
- [ ] Notification at 80% limit
- [ ] Block at 100% limit
- [ ] Toggle: allow limit override (with warning)
- [ ] All settings via sliders and inputs

### 5. Pricing Plans (/admin → Credits → Plans)
- [ ] Plans list: Free, Pro, Enterprise (cards)
- [ ] For each plan: Name, Price, Credits/month, Max projects, Max users, Available AI models, Support priority
- [ ] CRUD for plans (create, edit, delete)
- [ ] Assign plan to user
- [ ] Visual plan comparison table

### 6. Model Costs (/admin → Credits → Model Costs)
- [ ] Table: Model name, Credits per 1K input tokens, Credits per 1K output tokens
- [ ] Inline cost editing
- [ ] Enable/disable models for different plans

### Database Tables Needed
- [ ] user_roles (id, name, permissions JSON, isSystem, createdAt)
- [ ] user_invitations (id, email, role, creditLimit, token, status, invitedBy, createdAt, expiresAt)
- [ ] credit_limits (id, roleId, dailyLimit, perRequestLimit, projectLimit, notifyAt, blockAt)
- [ ] pricing_plans (id, name, price, creditsPerMonth, maxProjects, maxUsers, features JSON, isActive)
- [ ] model_pricing (id, modelName, inputCostPer1K, outputCostPer1K, isEnabled, planRestrictions JSON)



## Phase 74: Admin Panel Overhaul - Stage 3 (Content, UI, Prompts)

### 1. Prompts Library (/admin → AI Configuration → Prompts)
- [x] List all system prompts as cards
- [x] For each prompt: Name, Category (analysis/code/translation/creative/custom), Prompt text, Version, Updated date, Linked agents
- [x] CRUD: create, edit, delete, clone
- [x] Versioning: prompt change history (Version History button)
- [x] "Test Prompt" button → mini-chat for testing
- [x] Prompt templates: ready-made prompts for quick start
- [x] Variables in prompts: {{project_name}}, {{user_name}}, {{context}} — highlighting

### 2. Projects Management (/admin → Content → Projects)
- [x] Table of all platform projects: Name, Owner, Status, Tasks, Progress, AI requests, Created date
- [x] Filters: by owner, status, date
- [x] Actions: Archive, Restore, Transfer to another user, Delete
- [x] Project statistics (tasks count, blocks, AI requests)
- [x] Export list to CSV

### 3. Templates Management (/admin → Content → Templates)
- [x] List of project templates
- [ ] Create template from existing project ("Save as Template" button)
- [x] Edit template: blocks structure, sections, tasks
- [x] Template categorization (Business, Development, Marketing, Education...)
- [x] Publish template (available to all users / team only)
- [x] Template preview

### 4. Branding Settings (/admin → UI Settings → Branding)
- [ ] Logo upload (replaces standard MYDON)
- [ ] Platform name (replaces "MYDON Roadmap Hub" with custom)
- [ ] Primary color (color picker → applies to all buttons, accents)
- [ ] Dark/Light theme toggle
- [ ] Favicon upload
- [ ] Real-time preview of changes (mini-preview on right)

### 5. Navbar Settings (/admin → UI Settings → Navbar)
- [ ] List of all navbar elements with toggle enable/disable:
  - [ ] AI Chat button
  - [ ] Achievements button
  - [ ] Daily Briefing
  - [ ] Notifications
  - [ ] Credits
  - [ ] Settings
- [ ] Drag-and-drop to change order
- [ ] Add custom link to navbar

### 6. Localization (/admin → UI Settings → Localization)
- [ ] Default interface language selection (Russian, English, Uzbek)
- [ ] Table of all system text strings with editing capability
- [ ] Text search
- [ ] Export/import language files (JSON)

### Database Tables Needed
- [ ] system_prompts (id, name, slug, category, content, version, linkedAgents, isActive, createdBy, createdAt, updatedAt)
- [ ] prompt_versions (id, promptId, version, content, changedBy, createdAt)
- [ ] project_templates (id, name, slug, description, category, structure JSON, isPublic, teamId, createdBy, createdAt, updatedAt)
- [ ] ui_settings (id, key, value JSON, updatedBy, updatedAt)
- [ ] navbar_items (id, name, icon, path, isEnabled, order, isCustom, createdAt)
- [ ] localization_strings (id, key, locale, value, updatedBy, updatedAt)



## Phase 74: Admin Panel Overhaul - Stage 4 (FINAL: UI Settings, Integrations, Logs)

### 1. Branding Settings (/admin → UI → Branding)
- [x] Platform name field (replaces "MYDON Roadmap Hub")
- [x] Color picker for accent color
- [x] Dark/Light theme toggle
- [x] Mini preview of changes on right side
- [x] Save and Reset to Default buttons

### 2. Navbar Settings (/admin → UI → Navbar)
- [x] List of navbar elements with toggle show/hide
- [x] Drag-and-drop or arrows for reordering
- [x] Add custom link button (name, URL, icon)
- [x] Preview of navbar at top

### 3. Localization (/admin → UI → Localization)
- [x] Default language selector (Russian, English, Uzbek)
- [x] Table of strings: Key | Russian | English | Uzbek
- [x] Search by key or text
- [x] Inline editing for each string
- [x] Export/Import JSON buttons
- [x] Translation progress bar per language

### 4. Webhooks (/admin → Integrations → Webhooks)
- [x] List webhooks: Name, URL, Events, Status, Last call
- [x] Create webhook: Name, URL, Secret, Event selection
- [x] Test button sends test payload
- [x] Call history (last 50)

### 5. API Keys Management (/admin → Integrations → API Keys)
- [x] Table: Provider, Key (hidden), Status, Date added
- [x] Verify key button (test API request)
- [x] Add new key (provider, key)
- [x] Global keys vs BYOK distinction

### 6. Notifications (/admin → Integrations → Notifications)
- [x] Email SMTP settings (host, port, login, password)
- [x] Email templates: Invite, Reset password, Low balance, Task overdue
- [x] Send test email button
- [x] Telegram/Slack placeholders (Coming soon)

### 7. Extended Logs & Analytics (/admin → Logs)
- [x] Logs table with filters (user, type, model, status, date)
- [x] AI requests line chart over time
- [x] Top 5 users by requests (bar chart)
- [x] Model usage breakdown (pie chart)
- [x] Average cost and response time metrics
- [x] Export to CSV button
- [ ] Auto-alerts for >10 errors per hour (future enhancement)

### 8. Global Admin Search
- [x] Search field at top of admin (Ctrl+/)
- [x] Search across agents, skills, users, projects, prompts, settings
- [x] Results with links to corresponding sections


## Phase 75: Analytics Time Period Filter

- [x] Add time period filter to AdminLogs analytics section
- [x] Support preset periods: Today, Yesterday, Last 7 days, Last 30 days, This month, Last month, Custom range
- [x] Update backend to filter by date range
- [x] Apply filter to all analytics data (charts, metrics, logs table)


## Phase 76: Admin Panel UX Improvements

- [x] Add admin panel quick access from main app header (for admins only)
- [x] Reorganize sidebar navigation - reduce clutter (8 groups → 6)
- [x] Group related items into collapsible sections (only active group expanded)
- [x] Add visual hierarchy and cleaner design
- [x] Improve sidebar icons and labels


## Phase 77: Admin Panel Breadcrumbs

- [x] Create reusable AdminBreadcrumbs component
- [x] Define breadcrumb mapping for all admin routes
- [x] Integrate breadcrumbs into AdminLayout header
- [x] Style breadcrumbs with proper separators and hover states
- [x] Make breadcrumb items clickable for navigation


## Phase 77: Admin Panel Breadcrumbs

- [x] Create reusable AdminBreadcrumbs component
- [x] Define breadcrumb mapping for all admin routes
- [x] Integrate breadcrumbs into AdminLayout header
- [x] Style breadcrumbs with proper separators and hover states
- [x] Make breadcrumb items clickable for navigation


## Phase 78: Admin Sidebar Favorites

- [x] Add favorites state with localStorage persistence
- [x] Add star icon to each menu item (click to toggle favorite)
- [x] Create "Избранное" section at top of sidebar
- [x] Show favorited pages in the favorites section
- [x] Visual feedback for starred items (filled vs outline star)


## Phase 79: Favorites Drag-and-Drop Reordering

- [x] Install @dnd-kit/core and @dnd-kit/sortable libraries
- [x] Implement sortable favorites list with drag handles
- [x] Save reordered favorites to localStorage
- [x] Visual feedback during drag (opacity, shadow)
- [x] Keyboard accessibility for reordering


## Phase 80: Model Selector + Cost Tracking + Activity Feed

### 1. Model Selector (AI Chat)
- [x] Add model dropdown before send button in AI Chat
- [x] Show provider icon, name, cost per request for each model
- [x] Remember last selection in localStorage
- [x] Filter models based on BYOK vs Platform mode
- [x] Log selected model in AI request logs

### 2. Cost Tracking (/usage)
- [x] Create /usage page with current credit balance
- [x] Add spending chart for last 30 days
- [x] Table of recent requests with model, tokens, cost
- [x] Overall statistics (total requests, avg cost, most used model)
- [x] Show remaining daily limit if set
- [x] Add "Top up credits" placeholder link

### 3. Activity Feed (Dashboard)
- [x] Create activity_log table in database
- [x] Record events: project created, task completed, AI request, decision finalized, block added
- [x] Display last 20 events on Dashboard
- [x] Show icon, text, relative time for each event
- [x] Add filter by type (all/projects/tasks/AI/decisions)

### 4. Overdue Tasks Indicator
- [x] Add "Overdue Tasks" card on Dashboard with red icon
- [x] Click card to show list of overdue tasks
- [x] Badge on notifications icon in navbar if overdue tasks exist
- [x] Highlight overdue tasks in red within projects
- [x] Logic: deadline < today AND status != completed

### 5. Dashboard Improvements
- [x] Make stat cards clickable with navigation
- [x] Add "Credits" card linking to /usage
- [x] Add "AI Decisions" card linking to /decisions


## Phase 81: AI Model Comparison Feature

### Backend
- [x] Create compareModels procedure in usageRouter
- [x] Send same prompt to multiple models in parallel
- [x] Return responses with model info, tokens, cost, response time
- [x] Log all comparison requests in AI logs

### Frontend
- [x] Create ModelComparison component with side-by-side layout
- [x] Model selection checkboxes (select 2-4 models to compare)
- [x] Display responses in columns with model name, cost, time
- [x] Highlight differences in responses
- [x] Add "Compare Mode" toggle button in AI Chat
- [x] Show total cost before sending comparison request



## Phase 82: Save AI Model Comparison Results

### Database
- [ ] Create model_comparisons table (id, userId, prompt, results JSON, createdAt)
- [ ] Store model responses, tokens, cost, response time in results

### Backend
- [ ] Create saveComparison procedure in usageRouter
- [ ] Create getSavedComparisons procedure (list user's saved comparisons)
- [ ] Create getComparisonById procedure (view single comparison)
- [ ] Create deleteComparison procedure

### Frontend
- [ ] Add "Save Comparison" button after comparison completes
- [ ] Create ComparisonHistory component to list saved comparisons
- [ ] Add "View History" button in ModelComparison
- [ ] Show saved comparison details with all model responses
- [ ] Add delete button for saved comparisons



## Phase 83: Formula Engine + Alternative Views + Import/Export

### 1. Custom Fields & Formula Engine
- [ ] Create custom_fields table (projectId, name, type, options, formula)
- [ ] Create field_values table (taskId, fieldId, value)
- [ ] Backend: CRUD for custom fields
- [ ] Backend: Formula parser and evaluator
- [ ] UI: Add custom field button in project settings
- [ ] UI: Display custom fields in task details
- [ ] Support formulas: SUM, AVG, COUNT, MIN, MAX, IF, CONCAT
- [ ] Rollup fields for aggregating child data

### 2. Kanban Board View
- [x] Create KanbanBoard component with status columns
- [x] Drag-and-drop tasks between columns
- [x] Task cards with title, priority color, assignee, deadline, tags
- [x] Filters: priority, assignee, tags
- [x] Add task directly to column
- [x] Click card to open task details

### 3. Table View
- [x] Create TableView component with all tasks
- [x] Columns: Name, Status, Priority, Assignee, Deadline, Progress
- [x] Sort by any column
- [x] Inline editing of cells
- [x] Group by: status, priority, block, assignee
- [x] Export to CSV

### 4. Calendar View
- [x] Create CalendarView component
- [x] Month and week views
- [x] Tasks displayed on deadline dates
- [x] Drag-and-drop to change deadline
- [x] Color by priority
- [x] Click day to add task

### 5. View Switcher
- [x] Add view tabs: List | Kanban | Table | Calendar | Gantt
- [x] Remember last view per project
- [x] Smooth transitions between views

### 6. Improved Import/Export
- [x] Export: JSON (full), CSV (tasks), Markdown (document), HTML
- [x] ImprovedExportDialog with format selection and options
- [x] Import: JSON, Markdown parsing (existing)
- [x] Preview before import (existing)



## Phase 84: Gantt Chart View with Dependencies

### Database & Backend
- [x] Create task_dependencies table (taskId, dependsOnTaskId, type, lagDays)
- [x] Add dependency CRUD procedures to task router (getDependencies, addDependency, removeDependency)
- [x] Add endpoint to get project timeline data (getGanttData)

### Gantt Chart Component
- [x] Create GanttChartAdvanced component with timeline visualization
- [x] Display tasks as horizontal bars on timeline
- [x] Show task dependencies as arrows/lines between bars
- [x] Color-code by status (not started, in progress, completed)
- [x] Zoom controls (day, week, month, quarter)
- [x] Today marker line (red vertical line)
- [x] Hover tooltips with task details
- [x] Click task to open details
- [x] Shift+click to create dependencies between tasks

### Integration
- [x] Replace placeholder in ViewSwitcher with actual Gantt view
- [x] Integrated into ProjectViewAlternate page
- [ ] Add dependency management UI in task details panel (future)
- [ ] Support drag to adjust task dates (future)


## Phase 85: Gantt Chart Drag-and-Drop for Dates

### Drag-and-Drop Implementation
- [ ] Add mouse event handlers for drag start/move/end
- [ ] Calculate new date from drag position based on zoom level
- [ ] Update task deadline via API on drop
- [ ] Visual feedback: ghost bar showing new position during drag
- [ ] Cursor change to grab/grabbing during drag
- [ ] Snap to grid (day/week boundaries based on zoom)

### Resize Handles
- [ ] Add resize handles on task bar edges
- [ ] Drag left edge to change start date (future)
- [ ] Drag right edge to change deadline
- [ ] Visual indicator for resize mode

### Constraints & Validation
- [ ] Prevent dragging completed tasks (optional)
- [ ] Show dependency warnings when moving affects chain
- [ ] Undo support for accidental moves


## Phase 86: Custom Fields, Formula Engine & Import/Export

### 1. Custom Fields Database
- [x] Create custom_fields table (id, projectId, name, type, options, formula, rollupConfig, sortOrder, isRequired, defaultValue)
- [x] Create custom_field_values table (id, customFieldId, taskId, value, numericValue, dateValue, booleanValue, jsonValue)
- [x] Add relations and indexes

### 2. Formula Engine
- [x] Create shared/lib/formulaEngine.ts (670+ lines)
- [x] Implement functions: SUM, AVG, COUNT, MIN, MAX, IF, CONCAT, LEN, UPPER, LOWER, ROUND, FLOOR, CEIL, ABS, POWER, SQRT, MOD
- [x] Field references: {field_name}, {status}, {priority}, {deadline}, {progress}, {title}, {description}
- [x] Error handling: #ERROR!, #REF!, #DIV/0!
- [x] evaluateFormula(formula, context) function
- [x] evaluateRollup(aggregation, values) function
- [x] validateFormula(formula) function
- [x] extractFieldRefs(formula) function
- [x] getAvailableFunctions() function

### 3. Custom Fields Backend
- [x] Create customFieldsRouter with CRUD (create, update, delete, getByProject, get)
- [x] getValuesByTask / setValue for field values
- [x] evaluateFormula endpoint
- [x] evaluateRollup endpoint
- [x] validateFormula endpoint
- [x] extractFieldRefs endpoint
- [x] reorder endpoint

### 4. Custom Fields Frontend
- [x] CustomFieldsManager component for project settings
- [x] Add/Edit field dialog with type selection (13 field types)
- [x] Select type: options editor with colors
- [x] Formula type: editor with function dropdown helper
- [x] Rollup type: source field and aggregation selector
- [x] Display settings: showOnCard, showInTable, isRequired

### 5. Custom Fields Integration
- [x] CustomFieldsForm component for task details
- [x] All field type renderers (text, number, date, checkbox, select, multiselect, url, email, currency, percent, rating)
- [x] FormulaValue component with live evaluation
- [x] RollupValue component with aggregation
- [x] Compact mode for Kanban cards

### 6. Improved Import/Export
- [x] CSVImportDialog component with 3-step wizard
- [x] CSV parsing with auto-detection of delimiters
- [x] Column mapping UI with auto-mapping by name
- [x] Import preview before confirmation
- [x] Progress indicator during import
- [x] 43 tests for formula engine (529 total tests passing)


## Phase 87: CustomFieldsManager Integration

- [x] Add Custom Fields menu item to project dropdown menu
- [x] Create Custom Fields dialog with CustomFieldsManager component
- [x] Connect CustomFieldsManager component with projectId


## Phase 88: CustomFieldsForm in Task Details

- [x] Add CustomFieldsForm to task details panel
- [x] Pass projectId and taskId to component
- [x] Show custom fields section with Settings icon header


## Phase 89: Custom Field Columns in Table View

- [x] Add projectId prop to TableView
- [x] Fetch custom fields for project
- [x] Filter fields with showInTable=true
- [x] Fetch all custom field values for displayed tasks (getValuesByTasks)
- [x] Add column headers for custom fields with tooltip
- [x] Add cells for custom field values with type-specific rendering
- [x] Support all 13 field types: text, number, date, checkbox, select, multiselect, url, email, currency, percent, rating, formula, rollup


## Phase 90: Custom Fields on Kanban Cards

- [x] KanbanBoard already has projectId prop
- [x] Fetch custom fields with showOnCard=true from customFields.getByProject
- [x] Fetch custom field values for all tasks using customFields.getValuesByTasks
- [x] Build fieldValuesMap for quick lookup (taskId -> fieldId -> value)
- [x] Create CompactCustomField component for card display
- [x] Support all 13 field types with compact rendering
- [x] Pass customFields and fieldValuesMap through KanbanColumn to SortableTaskCard
- [x] Display custom fields section on cards after tags


## Phase 91: Critical UX Fixes - Dashboard Modals & AI Chat Redesign

### Dashboard Card Modals
- [x] Click "Проектов" → ProjectsFilterModal with all projects list
- [x] Click "Активных" → ProjectsFilterModal with active projects filtered
- [x] Click "Завершённых" → ProjectsFilterModal with completed projects filtered
- [x] Click "Просроченных" → ProjectsFilterModal with overdue projects filtered
- [x] Click "Кредитов" → CreditsModal with credit balance details
- [x] Click "AI Решений" → AIDecisionsModal with AI decisions summary
- [x] Each modal: title, search, project list (icon, name, description, progress bar, date, status badge)
- [x] Click project in modal → navigate to /project/:id

### AI Chat Redesign
- [x] Remove permanent AI sidebar panel from ProjectView
- [x] Add AI sparkle icon (✨) to TaskDetailPanel header
- [x] Create TaskAIPanel slide-over component (420px right panel)
- [x] Panel header: "AI • {task_name}" with project name subtitle
- [x] Panel tabs: Чат | Решения | Файлы | История
- [x] Quick action buttons under AI responses: Финализировать, Подзадачу, В описание, Копировать
- [x] Quick prompts for empty chat: Разбить на подзадачи, Оценить сложность, Найти риски, Написать ТЗ
- [x] Task context badges (status, priority) in panel header
- [x] Keep FloatingAIButton for general chat without context


## Phase 92: Inline Editing of Custom Fields in Table View

- [x] Make custom field cells clickable to enter edit mode
- [x] Text/URL/Email: click → input field, save on blur/Enter, cancel on Escape
- [x] Number/Currency/Percent: click → number input, save on blur/Enter
- [x] Date: click → date picker input, save on blur/Enter
- [x] Checkbox: direct toggle on click (no edit mode needed)
- [x] Rating: click stars to set/clear rating directly
- [x] Select: inline dropdown selector
- [x] Multiselect: dropdown with checkable options
- [x] Formula/Rollup: read-only display (no editing)
- [x] Save changes on blur or Enter key
- [x] Cancel editing on Escape key
- [x] Show visual feedback during save (opacity change)
- [x] Invalidate cache after successful save
- [x] Hover highlight on editable cells


## Phase 93: Custom Field Filtering in Table and Kanban Views

- [x] Create reusable CustomFieldFilter component (CustomFieldFilterPanel)
- [x] Support filter operators per field type (text: contains/equals, number: >/</>=/<=/=, date: before/after, boolean: is_true/is_false, select: equals/not_equals, rating: star comparison, etc.)
- [x] Filter UI: popover with field selector, operator selector, and type-specific value input
- [x] Add/remove multiple filters with AND logic
- [x] Integrate filters into TableView toolbar (button with active count badge)
- [x] Integrate filters into KanbanBoard toolbar (next to existing priority/assignee/tag filters)
- [x] Apply filters to task list before rendering using taskPassesAllFilters()
- [x] Show active filter count badge (amber color)
- [x] Clear all filters button
- [x] 529 tests passing


## Phase 94: Bulk Editing in Table View

### Backend
- [x] bulkUpdateStatus procedure (taskIds[], newStatus) - already existed
- [x] Add bulkUpdatePriority procedure (taskIds[], newPriority)
- [x] Add bulkUpdateAssignee procedure (taskIds[], assigneeId)
- [x] bulkDelete procedure (taskIds[]) - already existed
- [x] Add bulkSetValue procedure to customFieldsRouter (taskIds[], fieldId, value)

### Frontend
- [x] Checkbox column for selecting tasks (select all / individual) - already existed
- [x] Sticky bulk action toolbar with purple accent when tasks selected
- [x] Bulk status change dropdown (Не начато / В работе / Готово)
- [x] Bulk priority change dropdown (Критический / Высокий / Средний / Низкий)
- [x] Bulk assignee change dropdown with member avatars + unassign option
- [x] Bulk delete with AlertDialog confirmation
- [x] Show selected count badge
- [x] Clear selection button
- [x] Success/error toast notifications
- [x] Loading state disables buttons during mutation
- [x] 15 new tests (572 total)


## Phase 95: Bulk Custom Field Editing

### Backend
- [x] Add bulkSetValue procedure to customFieldsRouter (taskIds[], fieldId, value)

### Frontend
- [x] Add "Поля" button to bulk action toolbar with Settings2 icon
- [x] Create Popover for selecting field and entering value
- [x] Field selector dropdown (excludes formula/rollup read-only fields)
- [x] Support all editable field types: text, url, email, number, currency, percent, rating (star picker), date, checkbox, select, multiselect
- [x] Reset value state when switching fields
- [x] Apply value to all selected tasks via bulkSetValue mutation
- [x] Toast notifications on success/error
- [x] Loading state during mutation
- [x] 21 new tests (593 total)


## Phase 96: Saved Views

### Database
- [x] Create saved_views table (id, projectId, userId, name, viewType, config JSON, isDefault, icon, color, sortOrder)

### Backend
- [x] getByProject procedure - list saved views for a project
- [x] create procedure - create new saved view
- [x] update procedure - update saved view name/config
- [x] delete procedure - delete saved view
- [x] setDefault procedure - mark a view as default for the project

### Frontend - SavedViewsManager Component
- [x] Dropdown/popover showing list of saved views for current project
- [x] "Save current view" button that captures current filter/sort/group/viewType state
- [x] Name input dialog for new saved view
- [x] Click to load/apply a saved view (restores all filter/sort/group settings)
- [x] Edit saved view name
- [x] Delete saved view with confirmation
- [x] Set default view indicator (star icon)
- [x] Visual indicator of active saved view

### Integration
- [x] Integrate SavedViewsManager into ProjectViewAlternate header (next to ViewSwitcher)
- [x] TableView: expose sort/group/filter state via callback (onViewStateChange + initialViewState)
- [x] KanbanBoard: expose filter state via callback (onViewStateChange + initialViewState)
- [x] Force re-mount views with key prop when loading saved view
- [x] Toast notifications for save/load/delete actions
- [x] 40 new tests (633 total)

## Bug Fix: Popup overflow

- [x] Fix project list popup/modal overflowing beyond viewport (max-w-[calc(100vw-2rem)])
- [x] Truncate long project description text in popup cards (overflow-hidden on info container)
- [x] Ensure all modals/dialogs are constrained within the screen

## Bug Fix: Popup overflow (continued)

- [x] Investigate and fix persistent popup overflow issue on project list modal (added w-0 to flex info container, overflow-hidden to ScrollArea content, [&>*]:min-w-0 to DialogContent)

## Bug Fix: Infinite loop + SQL query error

- [x] Fix Maximum update depth exceeded in CustomFieldsForm.tsx:77 (stabilized useEffect with useMemo dataFingerprint)
- [x] Fix failed SQL query on custom_fields table (added missing minValue/maxValue columns)

## Phase 97: Keyboard Shortcuts for Table View

### Keyboard Shortcuts
- [x] Ctrl+A / Cmd+A — Select all visible tasks
- [x] Delete / Backspace — Bulk delete selected tasks (with confirmation dialog)
- [x] Arrow Up/Down — Navigate between rows (move focus/highlight)
- [x] Shift+Arrow Up/Down — Extend selection while navigating
- [x] Enter — Open focused task detail panel
- [x] Escape — Deselect all / clear focus
- [x] Space — Toggle selection of focused task
- [x] Ctrl+Click / Cmd+Click — Toggle individual task selection (already exists via checkbox)

### UI Enhancements
- [x] Visual focus indicator on the currently focused row (purple ring)
- [x] Keyboard shortcuts help tooltip (Keyboard icon in toolbar)
- [x] Prevent shortcuts from firing when user is typing in input fields
- [x] Prevent shortcuts when dialog/alert is open
- [x] Auto-scroll focused row into view
- [x] 31 new tests (664 total)

## Phase 98: Drag & Drop Task Sorting in Table View

### Backend
- [x] Tasks table already has sortOrder column
- [x] Add reorderTasksGlobal procedure (accepts ordered taskIds array)
- [x] Persist new sort order to database (sequential sortOrder values)

### Frontend
- [x] Install @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, @dnd-kit/modifiers
- [x] Add drag handle column (GripVertical icon) to Table View rows
- [x] Implement DndContext + SortableContext + SortableTableRow component
- [x] Visual feedback during drag (opacity 0.5, shadow, z-index elevation)
- [x] Disable drag when sorting/grouping/search/filters are active (tooltip explains why)
- [x] Vertical axis restriction via restrictToVerticalAxis modifier
- [x] 8px activation distance to prevent accidental drags
- [x] Toast notification on reorder success/error

### Tests
- [x] 22 new tests for Table View drag & drop (686 total)

## Phase 99: Drag & Drop for Sections and Blocks

### Sections within Blocks (already existed in DraggableSidebar)
- [x] Drag handle on section headers (GripVertical, opacity on hover)
- [x] DndContext + SortableContext for sections within each block
- [x] Visual feedback during section drag (opacity 0.5, shadow)
- [x] reorderSections backend procedure called on drop
- [x] Toast notification on success/error

### Blocks on Project Page
- [x] Add SortableBlock component with drag handle (GripVertical)
- [x] Wrap blocks in SortableContext with verticalListSortingStrategy
- [x] Visual feedback during block drag (opacity 0.5, z-50)
- [x] Add reorderBlocks backend procedure (block.reorder)
- [x] Add reorderBlocks db helper with sequential sortOrder
- [x] Persist block order to database
- [x] BlockDragOverlay component for drag preview
- [x] Wire onReorderBlocks callback in ProjectView
- [x] Toast notification on success/error

### Tests
- [x] 54 new tests for block & section drag & drop (718 total)
- [x] Fix infinite render loop bug in CustomFieldsForm.tsx (Maximum update depth exceeded) - added useRef guard + useCallback + 23 tests

### Stripe Payment Integration
- [x] Configure Stripe env vars (STRIPE_SECRET_KEY, VITE_STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET)
- [x] Install stripe npm package
- [x] Add stripe_customer_id to users table in schema
- [x] Create payments table in schema (stripe IDs only)
- [x] Create products.ts with plan definitions
- [x] Create server/stripe.ts with Stripe client initialization
- [x] Create checkout session endpoint (server/stripeRouter.ts)
- [x] Create webhook handler at /api/stripe/webhook
- [x] Create payment history endpoint (getPaymentHistory + getUpcomingInvoice)
- [x] Create billing/subscription management endpoints (createPortalSession, cancelSubscription)
- [x] Build Billing/Pricing page UI
- [x] Build Payment History page UI (/payments)
- [x] Build Payment Success/Cancel pages (SubscriptionSuccess.tsx)
- [x] Wire Stripe routes in App.tsx
- [x] Write vitest tests for Stripe integration (24 tests)
- [x] Push database migrations
- [x] Add CreditCard icon with link to /payments in Dashboard header navigation (emerald color, next to Settings)
- [x] Enhance billing page: add plan features comparison, usage stats, subscription management portal, visual polish

### Real-time Subs- [x] Socket.io: export io instance and create emitToUser helper for targeted events
- [x] Webhook handler: emit subscription:updated and payment:completed events via socket
- [x] Webhook handler: update user subscription fields in DB on checkout.session.completed
- [x] Webhook handler: handle customer.subscription.updated and customer.subscription.deleted events
- [x] SubscriptionSuccess page: poll subscription status until confirmed active (3-phase UI: verifying → confirmed → timeout)
- [x] PaymentHistory page: auto-refresh subscription status after returning from checkout (useSubscriptionStatus hook)
- [x] Write vitest tests for real-time subscription status flow (15 tests)