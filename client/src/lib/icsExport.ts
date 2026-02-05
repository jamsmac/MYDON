/**
 * ICS Calendar Export Utility
 * Generates iCalendar (.ics) files for syncing deadlines with Google Calendar
 */

import { Block } from '@/data/roadmapData';
import { BlockDeadline } from '@/contexts/DeadlineContext';

interface CalendarEvent {
  uid: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  reminder?: number; // minutes before
  location?: string;
  url?: string;
}

/**
 * Escapes special characters in ICS text fields
 */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Formats a date to ICS date format (YYYYMMDD)
 */
function formatIcsDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Formats a date to ICS datetime format (YYYYMMDDTHHMMSSZ)
 */
function formatIcsDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

/**
 * Generates a unique identifier for calendar events
 */
function generateUid(blockId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${blockId}-${timestamp}-${random}@techrent-roadmap`;
}

/**
 * Creates an ICS VEVENT component
 */
function createVEvent(event: CalendarEvent): string {
  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${formatIcsDateTime(new Date())}`,
    `DTSTART;VALUE=DATE:${formatIcsDate(event.startDate)}`,
    `DTEND;VALUE=DATE:${formatIcsDate(new Date(event.endDate.getTime() + 86400000))}`, // Add 1 day for all-day event
    `SUMMARY:${escapeIcsText(event.title)}`,
  ];

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  }

  if (event.location) {
    lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  }

  if (event.url) {
    lines.push(`URL:${event.url}`);
  }

  // Add reminder/alarm
  if (event.reminder) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcsText(event.title)}`,
      `TRIGGER:-PT${event.reminder}M`,
      'END:VALARM'
    );
  }

  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

/**
 * Creates a complete ICS calendar file content
 */
function createIcsCalendar(events: CalendarEvent[]): string {
  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TechRent Roadmap Manager//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:TechRent Uzbekistan - Дедлайны',
    'X-WR-TIMEZONE:Asia/Tashkent',
  ].join('\r\n');

  const footer = 'END:VCALENDAR';

  const eventStrings = events.map(createVEvent);

  return [header, ...eventStrings, footer].join('\r\n');
}

/**
 * Converts block deadlines to calendar events
 */
export function blocksToCalendarEvents(
  blocks: Block[],
  deadlines: Record<string, BlockDeadline>,
  getBlockProgress: (blockId: string) => { completed: number; total: number; percentage: number }
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  blocks.forEach(block => {
    const deadline = deadlines[block.id];
    if (!deadline) return;

    const progress = getBlockProgress(block.id);
    const deadlineDate = new Date(deadline.deadline);
    
    // Create main deadline event
    events.push({
      uid: generateUid(block.id),
      title: `📋 Дедлайн: ${block.titleRu}`,
      description: [
        `Блок ${String(block.number).padStart(2, '0')}: ${block.titleRu}`,
        `${block.title}`,
        '',
        `Прогресс: ${progress.percentage}% (${progress.completed}/${progress.total} задач)`,
        `Длительность: ${block.duration}`,
        '',
        'Секции:',
        ...block.sections.map(s => `• ${s.title}`),
      ].join('\\n'),
      startDate: deadlineDate,
      endDate: deadlineDate,
      reminder: deadline.reminderDays * 24 * 60, // Convert days to minutes
    });
  });

  return events;
}

/**
 * Exports deadlines to an ICS file and triggers download
 */
export function exportDeadlinesToIcs(
  blocks: Block[],
  deadlines: Record<string, BlockDeadline>,
  getBlockProgress: (blockId: string) => { completed: number; total: number; percentage: number }
): void {
  const events = blocksToCalendarEvents(blocks, deadlines, getBlockProgress);
  
  if (events.length === 0) {
    throw new Error('Нет дедлайнов для экспорта');
  }

  const icsContent = createIcsCalendar(events);
  
  // Create and download file
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'techrent-deadlines.ics';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports a single block deadline to ICS
 */
export function exportSingleDeadlineToIcs(
  block: Block,
  deadline: BlockDeadline,
  progress: { completed: number; total: number; percentage: number }
): void {
  const event: CalendarEvent = {
    uid: generateUid(block.id),
    title: `📋 Дедлайн: ${block.titleRu}`,
    description: [
      `Блок ${String(block.number).padStart(2, '0')}: ${block.titleRu}`,
      `${block.title}`,
      '',
      `Прогресс: ${progress.percentage}% (${progress.completed}/${progress.total} задач)`,
      `Длительность: ${block.duration}`,
    ].join('\\n'),
    startDate: new Date(deadline.deadline),
    endDate: new Date(deadline.deadline),
    reminder: deadline.reminderDays * 24 * 60,
  };

  const icsContent = createIcsCalendar([event]);
  
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `techrent-${block.id}-deadline.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates a Google Calendar URL for adding an event
 */
export function generateGoogleCalendarUrl(
  block: Block,
  deadline: BlockDeadline,
  progress: { completed: number; total: number; percentage: number }
): string {
  const deadlineDate = new Date(deadline.deadline);
  const dateStr = formatIcsDate(deadlineDate);
  
  const title = encodeURIComponent(`📋 Дедлайн: ${block.titleRu}`);
  const details = encodeURIComponent([
    `Блок ${String(block.number).padStart(2, '0')}: ${block.titleRu}`,
    `${block.title}`,
    '',
    `Прогресс: ${progress.percentage}% (${progress.completed}/${progress.total} задач)`,
    `Длительность: ${block.duration}`,
  ].join('\n'));

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dateStr}/${dateStr}&details=${details}`;
}
