/**
 * Export utilities for generating project reports in Markdown and PDF formats
 */

interface Subtask {
  id: number;
  title: string;
  status: string | null;
}

interface Task {
  id: number;
  title: string;
  description: string | null;
  status: string | null;
  notes: string | null;
  summary: string | null;
  subtasks: Subtask[];
}

interface Section {
  id: number;
  title: string;
  description: string | null;
  tasks: Task[];
}

interface Block {
  id: number;
  number: number;
  title: string;
  titleRu: string | null;
  description: string | null;
  icon: string | null;
  deadline: Date | null;
  sections: Section[];
}

interface Project {
  id: number;
  name: string;
  description: string | null;
  status: string | null;
  startDate: Date | null;
  targetDate: Date | null;
  blocks: Block[];
}

function getStatusEmoji(status: string | null): string {
  switch (status) {
    case 'completed': return '✅';
    case 'in_progress': return '🔄';
    case 'not_started': return '⬜';
    default: return '⬜';
  }
}

function getStatusText(status: string | null): string {
  switch (status) {
    case 'completed': return 'Готово';
    case 'in_progress': return 'В работе';
    case 'not_started': return 'Не начато';
    default: return 'Не начато';
  }
}

function formatDate(date: Date | null): string {
  if (!date) return 'Не указана';
  return new Date(date).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function calculateProgress(project: Project): { total: number; completed: number; inProgress: number; percentage: number } {
  let total = 0;
  let completed = 0;
  let inProgress = 0;

  for (const block of project.blocks) {
    for (const section of block.sections) {
      for (const task of section.tasks) {
        total++;
        if (task.status === 'completed') completed++;
        else if (task.status === 'in_progress') inProgress++;
      }
    }
  }

  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, inProgress, percentage };
}

/**
 * Generate Markdown report for a project
 */
export function generateMarkdownReport(project: Project): string {
  const progress = calculateProgress(project);
  const generatedAt = new Date().toLocaleString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  let md = '';

  // Header
  md += `# ${project.name}\n\n`;
  
  if (project.description) {
    md += `> ${project.description}\n\n`;
  }

  // Metadata
  md += `---\n\n`;
  md += `**Статус проекта:** ${getStatusText(project.status)}\n\n`;
  md += `**Дата начала:** ${formatDate(project.startDate)}\n\n`;
  md += `**Целевая дата:** ${formatDate(project.targetDate)}\n\n`;
  md += `**Отчёт сгенерирован:** ${generatedAt}\n\n`;
  md += `---\n\n`;

  // Progress Summary
  md += `## 📊 Прогресс\n\n`;
  md += `| Метрика | Значение |\n`;
  md += `|---------|----------|\n`;
  md += `| Всего задач | ${progress.total} |\n`;
  md += `| Выполнено | ${progress.completed} |\n`;
  md += `| В работе | ${progress.inProgress} |\n`;
  md += `| Не начато | ${progress.total - progress.completed - progress.inProgress} |\n`;
  md += `| **Прогресс** | **${progress.percentage}%** |\n\n`;

  // Progress bar visualization
  const filledBars = Math.round(progress.percentage / 5);
  const emptyBars = 20 - filledBars;
  md += `\`[${'█'.repeat(filledBars)}${'░'.repeat(emptyBars)}]\` ${progress.percentage}%\n\n`;

  // Blocks
  md += `---\n\n`;
  md += `## 📋 Дорожная карта\n\n`;

  for (const block of project.blocks) {
    const blockIcon = block.icon || '📁';
    const blockTitle = block.titleRu || block.title;
    
    md += `### ${blockIcon} Блок ${String(block.number).padStart(2, '0')}: ${blockTitle}\n\n`;
    
    if (block.description) {
      md += `${block.description}\n\n`;
    }

    if (block.deadline) {
      md += `**Дедлайн:** ${formatDate(block.deadline)}\n\n`;
    }

    if (block.sections.length === 0) {
      md += `*Нет разделов*\n\n`;
      continue;
    }

    for (const section of block.sections) {
      md += `#### ${section.title}\n\n`;
      
      if (section.description) {
        md += `${section.description}\n\n`;
      }

      if (section.tasks.length === 0) {
        md += `*Нет задач*\n\n`;
        continue;
      }

      // Tasks table
      md += `| Статус | Задача | Описание |\n`;
      md += `|--------|--------|----------|\n`;

      for (const task of section.tasks) {
        const statusEmoji = getStatusEmoji(task.status);
        const description = task.description ? task.description.substring(0, 100) + (task.description.length > 100 ? '...' : '') : '-';
        md += `| ${statusEmoji} | ${task.title} | ${description.replace(/\n/g, ' ')} |\n`;
      }

      md += `\n`;

      // Task details with notes and summaries
      for (const task of section.tasks) {
        if (task.notes || task.summary || task.subtasks.length > 0) {
          md += `<details>\n`;
          md += `<summary><strong>${getStatusEmoji(task.status)} ${task.title}</strong></summary>\n\n`;

          if (task.description) {
            md += `**Описание:** ${task.description}\n\n`;
          }

          if (task.subtasks.length > 0) {
            md += `**Подзадачи:**\n`;
            for (const subtask of task.subtasks) {
              const checkbox = subtask.status === 'completed' ? '[x]' : '[ ]';
              md += `- ${checkbox} ${subtask.title}\n`;
            }
            md += `\n`;
          }

          if (task.notes) {
            md += `**Заметки:**\n\n${task.notes}\n\n`;
          }

          if (task.summary) {
            md += `**Итоговый документ:**\n\n${task.summary}\n\n`;
          }

          md += `</details>\n\n`;
        }
      }
    }

    md += `---\n\n`;
  }

  // Footer
  md += `\n---\n\n`;
  md += `*Этот отчёт был автоматически сгенерирован платформой MYDON Roadmap Hub*\n`;

  return md;
}

/**
 * Generate HTML report for PDF conversion
 */
export function generateHtmlReport(project: Project): string {
  const progress = calculateProgress(project);
  const generatedAt = new Date().toLocaleString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  let html = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project.name} - Отчёт</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #1e293b;
      padding: 40px;
      max-width: 900px;
      margin: 0 auto;
      background: #fff;
    }
    h1 {
      font-size: 28px;
      color: #0f172a;
      margin-bottom: 10px;
      border-bottom: 3px solid #f59e0b;
      padding-bottom: 10px;
    }
    h2 {
      font-size: 20px;
      color: #1e293b;
      margin: 30px 0 15px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    h3 {
      font-size: 16px;
      color: #334155;
      margin: 20px 0 10px;
      padding: 8px 12px;
      background: #f1f5f9;
      border-left: 4px solid #f59e0b;
    }
    h4 {
      font-size: 14px;
      color: #475569;
      margin: 15px 0 8px;
    }
    .description {
      color: #64748b;
      font-style: italic;
      margin-bottom: 20px;
      padding: 10px;
      background: #f8fafc;
      border-radius: 4px;
    }
    .metadata {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin: 20px 0;
      padding: 15px;
      background: #f8fafc;
      border-radius: 8px;
    }
    .metadata-item {
      display: flex;
      flex-direction: column;
    }
    .metadata-label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
    }
    .metadata-value {
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
    }
    .progress-section {
      margin: 30px 0;
      padding: 20px;
      background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
      border-radius: 12px;
      color: white;
    }
    .progress-title {
      color: #f59e0b;
      margin-bottom: 15px;
    }
    .progress-bar-container {
      background: #475569;
      border-radius: 10px;
      height: 20px;
      overflow: hidden;
      margin: 15px 0;
    }
    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #f59e0b 0%, #10b981 100%);
      border-radius: 10px;
      transition: width 0.3s ease;
    }
    .progress-stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      margin-top: 15px;
    }
    .stat-item {
      text-align: center;
      padding: 10px;
      background: rgba(255,255,255,0.1);
      border-radius: 8px;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #f59e0b;
    }
    .stat-label {
      font-size: 11px;
      color: #94a3b8;
      text-transform: uppercase;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      font-size: 13px;
    }
    th, td {
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    th {
      background: #f1f5f9;
      font-weight: 600;
      color: #475569;
    }
    tr:hover {
      background: #f8fafc;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    .status-completed {
      background: #d1fae5;
      color: #065f46;
    }
    .status-in_progress {
      background: #fef3c7;
      color: #92400e;
    }
    .status-not_started {
      background: #f1f5f9;
      color: #64748b;
    }
    .task-details {
      margin: 10px 0;
      padding: 15px;
      background: #f8fafc;
      border-radius: 8px;
      border-left: 3px solid #e2e8f0;
    }
    .task-details h5 {
      font-size: 13px;
      color: #1e293b;
      margin-bottom: 8px;
    }
    .task-details p {
      font-size: 12px;
      color: #64748b;
      margin-bottom: 8px;
    }
    .subtask-list {
      list-style: none;
      margin: 10px 0;
    }
    .subtask-list li {
      padding: 4px 0;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .notes-section, .summary-section {
      margin-top: 10px;
      padding: 10px;
      background: white;
      border-radius: 4px;
      font-size: 12px;
    }
    .notes-section {
      border-left: 3px solid #3b82f6;
    }
    .summary-section {
      border-left: 3px solid #10b981;
    }
    .section-label {
      font-size: 10px;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 5px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
    }
    .page-break {
      page-break-before: always;
    }
    @media print {
      body {
        padding: 20px;
      }
      .progress-section {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <h1>${project.name}</h1>
  ${project.description ? `<p class="description">${project.description}</p>` : ''}
  
  <div class="metadata">
    <div class="metadata-item">
      <span class="metadata-label">Статус</span>
      <span class="metadata-value">${getStatusText(project.status)}</span>
    </div>
    <div class="metadata-item">
      <span class="metadata-label">Дата начала</span>
      <span class="metadata-value">${formatDate(project.startDate)}</span>
    </div>
    <div class="metadata-item">
      <span class="metadata-label">Целевая дата</span>
      <span class="metadata-value">${formatDate(project.targetDate)}</span>
    </div>
    <div class="metadata-item">
      <span class="metadata-label">Отчёт сгенерирован</span>
      <span class="metadata-value">${generatedAt}</span>
    </div>
  </div>

  <div class="progress-section">
    <h2 class="progress-title">📊 Прогресс проекта</h2>
    <div class="progress-bar-container">
      <div class="progress-bar" style="width: ${progress.percentage}%"></div>
    </div>
    <div class="progress-stats">
      <div class="stat-item">
        <div class="stat-value">${progress.total}</div>
        <div class="stat-label">Всего задач</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${progress.completed}</div>
        <div class="stat-label">Выполнено</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${progress.inProgress}</div>
        <div class="stat-label">В работе</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${progress.percentage}%</div>
        <div class="stat-label">Прогресс</div>
      </div>
    </div>
  </div>

  <h2>📋 Дорожная карта</h2>
`;

  for (const block of project.blocks) {
    const blockIcon = block.icon || '📁';
    const blockTitle = block.titleRu || block.title;
    
    html += `
  <h3>${blockIcon} Блок ${String(block.number).padStart(2, '0')}: ${blockTitle}</h3>
  ${block.description ? `<p style="color: #64748b; margin: 10px 0;">${block.description}</p>` : ''}
  ${block.deadline ? `<p style="font-size: 12px; color: #f59e0b;"><strong>Дедлайн:</strong> ${formatDate(block.deadline)}</p>` : ''}
`;

    if (block.sections.length === 0) {
      html += `<p style="color: #94a3b8; font-style: italic;">Нет разделов</p>`;
      continue;
    }

    for (const section of block.sections) {
      html += `
  <h4>${section.title}</h4>
  ${section.description ? `<p style="color: #64748b; font-size: 13px; margin-bottom: 10px;">${section.description}</p>` : ''}
`;

      if (section.tasks.length === 0) {
        html += `<p style="color: #94a3b8; font-style: italic; font-size: 12px;">Нет задач</p>`;
        continue;
      }

      html += `
  <table>
    <thead>
      <tr>
        <th style="width: 100px;">Статус</th>
        <th>Задача</th>
        <th>Описание</th>
      </tr>
    </thead>
    <tbody>
`;

      for (const task of section.tasks) {
        const statusClass = `status-${task.status || 'not_started'}`;
        const description = task.description ? task.description.substring(0, 100) + (task.description.length > 100 ? '...' : '') : '-';
        
        html += `
      <tr>
        <td><span class="status-badge ${statusClass}">${getStatusEmoji(task.status)} ${getStatusText(task.status)}</span></td>
        <td><strong>${task.title}</strong></td>
        <td>${description.replace(/\n/g, ' ')}</td>
      </tr>
`;
      }

      html += `
    </tbody>
  </table>
`;

      // Task details
      for (const task of section.tasks) {
        if (task.notes || task.summary || task.subtasks.length > 0) {
          html += `
  <div class="task-details">
    <h5>${getStatusEmoji(task.status)} ${task.title}</h5>
    ${task.description ? `<p>${task.description}</p>` : ''}
`;

          if (task.subtasks.length > 0) {
            html += `
    <ul class="subtask-list">
`;
            for (const subtask of task.subtasks) {
              const checkbox = subtask.status === 'completed' ? '☑' : '☐';
              html += `      <li>${checkbox} ${subtask.title}</li>\n`;
            }
            html += `    </ul>`;
          }

          if (task.notes) {
            html += `
    <div class="notes-section">
      <div class="section-label">Заметки</div>
      ${task.notes.replace(/\n/g, '<br>')}
    </div>
`;
          }

          if (task.summary) {
            html += `
    <div class="summary-section">
      <div class="section-label">Итоговый документ</div>
      ${task.summary.replace(/\n/g, '<br>')}
    </div>
`;
          }

          html += `  </div>`;
        }
      }
    }
  }

  html += `
  <div class="footer">
    <p>Этот отчёт был автоматически сгенерирован платформой MYDON Roadmap Hub</p>
  </div>
</body>
</html>
`;

  return html;
}
