# MYDON AI Platform Architecture

## Overview

MYDON is evolving from a roadmap management tool into a comprehensive AI-powered planning platform with subscription-based access to multiple AI providers, an intelligent orchestrator system, and developer-friendly admin tools.

## Core Components

### 1. Subscription & Authentication System

```
┌─────────────────────────────────────────────────────────────┐
│                    User Authentication                       │
├─────────────────────────────────────────────────────────────┤
│  - Manus OAuth (existing)                                   │
│  - Subscription Plans: Free, Pro, Enterprise                │
│  - AI Integration Keys (BYOK per provider)                  │
│  - Usage Tracking & Limits                                  │
└─────────────────────────────────────────────────────────────┘
```

**Subscription Tiers:**
| Plan | Price | Credits/Month | AI Integrations | Features |
|------|-------|---------------|-----------------|----------|
| Free | $0 | 1,000 | Platform AI only | Basic roadmap |
| Pro | $19/mo | 10,000 | +Claude, GPT, Perplexity | Full features |
| Enterprise | $99/mo | Unlimited | All + Custom MCP | Admin panel |

### 2. AI Orchestrator System

```
┌─────────────────────────────────────────────────────────────┐
│                      ORCHESTRATOR                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Router    │──│   Agents    │──│   Skills    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                │                │                 │
│         ▼                ▼                ▼                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ MCP Servers │  │ AI Providers│  │  Webhooks   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

**Components:**
- **Router**: Analyzes incoming requests and routes to appropriate agent
- **Agents**: Specialized AI entities (Code Agent, Research Agent, Writing Agent)
- **Skills**: Reusable capabilities that agents can invoke
- **MCP Servers**: External tool integrations (Claude Code, Codex, etc.)

### 3. Agent Types

| Agent | Specialization | Primary Model | Fallback |
|-------|---------------|---------------|----------|
| Code Agent | Programming, debugging | Claude Code / Codex | GPT-4 |
| Research Agent | Information gathering | Perplexity | Gemini |
| Writing Agent | Content creation | Claude Sonnet | GPT-4 |
| Planning Agent | Roadmap generation | Claude Sonnet | GPT-4 |
| Analysis Agent | Data analysis | GPT-4 | Claude |

### 4. Database Schema Extensions

```sql
-- Subscription Plans
CREATE TABLE subscription_plans (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  credits_per_month INT NOT NULL,
  features JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Subscriptions
CREATE TABLE user_subscriptions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  plan_id INT NOT NULL,
  status ENUM('active', 'cancelled', 'expired') DEFAULT 'active',
  start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  end_date TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
);

-- AI Integrations (BYOK)
CREATE TABLE ai_integrations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  provider VARCHAR(50) NOT NULL,
  api_key TEXT,
  is_active BOOLEAN DEFAULT true,
  usage_stats JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Agents
CREATE TABLE agents (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT,
  system_prompt TEXT,
  model_preference VARCHAR(50),
  capabilities JSON,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Skills
CREATE TABLE skills (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  trigger_patterns JSON,
  agent_id INT,
  handler_code TEXT,
  is_active BOOLEAN DEFAULT true,
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- MCP Servers
CREATE TABLE mcp_servers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  auth_type ENUM('none', 'api_key', 'oauth') DEFAULT 'api_key',
  auth_config JSON,
  status ENUM('active', 'inactive', 'error') DEFAULT 'inactive',
  last_health_check TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orchestrator Config
CREATE TABLE orchestrator_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  routing_rules JSON,
  fallback_behavior JSON,
  logging_level ENUM('debug', 'info', 'warn', 'error') DEFAULT 'info',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 5. Admin Panel Structure

```
/admin
├── /dashboard          # System overview, metrics
├── /agents             # Manage AI agents
│   ├── /create
│   ├── /[id]/edit
│   └── /[id]/test
├── /skills             # Configure skills
├── /mcp-servers        # MCP server management
├── /orchestrator       # Routing rules editor
├── /users              # User management
├── /subscriptions      # Subscription analytics
├── /logs               # System logs viewer
└── /database           # Database explorer
```

### 6. Universal AI Assistant

```
┌─────────────────────────────────────────────────────────────┐
│  FloatingAIButton (fixed bottom-right)                      │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  [AI Icon] + Keyboard shortcut: Cmd+K                   ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  AIAssistantModal                                           │
├─────────────────────────────────────────────────────────────┤
│  Context: [Current Page/Block/Section/Task]                 │
│  ─────────────────────────────────────────────────────────  │
│  Chat History                                               │
│  ─────────────────────────────────────────────────────────  │
│  Quick Actions: [Summarize] [Expand] [Translate] [Code]     │
│  ─────────────────────────────────────────────────────────  │
│  [Input field]                              [Send]          │
└─────────────────────────────────────────────────────────────┘
```

### 7. Enhanced Task Management

**New Capabilities:**
- Add tasks/subtasks at any level with inline buttons
- Split tasks into subtasks
- Merge multiple tasks
- Convert between task/section/subtask
- Bulk operations with multi-select
- Quick inline editing

## Implementation Priority

1. **Phase 1**: Database schema extensions + basic subscription system
2. **Phase 2**: AI Orchestrator core + agent management
3. **Phase 3**: Admin panel foundation
4. **Phase 4**: Enhanced task management
5. **Phase 5**: Universal AI button
6. **Phase 6**: External AI provider integrations

## API Endpoints

### Subscription
- `POST /api/trpc/subscription.subscribe`
- `POST /api/trpc/subscription.cancel`
- `GET /api/trpc/subscription.status`

### AI Integrations
- `POST /api/trpc/aiIntegration.connect`
- `DELETE /api/trpc/aiIntegration.disconnect`
- `GET /api/trpc/aiIntegration.list`

### Orchestrator
- `POST /api/trpc/orchestrator.route`
- `GET /api/trpc/orchestrator.agents`
- `POST /api/trpc/orchestrator.executeSkill`

### Admin
- `GET /api/trpc/admin.dashboard`
- `CRUD /api/trpc/admin.agents`
- `CRUD /api/trpc/admin.skills`
- `CRUD /api/trpc/admin.mcpServers`
