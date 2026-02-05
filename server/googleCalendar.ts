/**
 * Google Calendar Integration for MYDON Roadmap Hub
 * Uses MCP server for Google Calendar operations
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  attendees?: string[];
  reminders?: number[];
}

interface TaskDeadline {
  taskId: number;
  taskTitle: string;
  projectName: string;
  deadline: Date;
  description?: string;
}

/**
 * Execute MCP CLI command
 */
async function mcpCall(server: string, tool: string, input: object): Promise<any> {
  const inputJson = JSON.stringify(input).replace(/'/g, "'\\''");
  const command = `manus-mcp-cli tool call ${tool} --server ${server} --input '${inputJson}'`;
  
  try {
    const { stdout, stderr } = await execAsync(command, { timeout: 60000 });
    if (stderr) {
      console.warn('MCP stderr:', stderr);
    }
    // Parse the output - MCP CLI returns JSON
    try {
      return JSON.parse(stdout);
    } catch {
      return stdout;
    }
  } catch (error) {
    console.error('MCP call error:', error);
    throw error;
  }
}

/**
 * Create a calendar event for a task deadline
 */
export async function createTaskDeadlineEvent(task: TaskDeadline): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    // Format dates for Google Calendar (RFC3339)
    const startTime = new Date(task.deadline);
    startTime.setHours(9, 0, 0, 0); // Default to 9 AM
    
    const endTime = new Date(task.deadline);
    endTime.setHours(10, 0, 0, 0); // 1 hour duration
    
    const event: CalendarEvent = {
      summary: `📋 ${task.taskTitle} - ${task.projectName}`,
      description: task.description || `Дедлайн задачи "${task.taskTitle}" из проекта "${task.projectName}"`,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      reminders: [1440, 60], // 1 day and 1 hour before
    };

    const result = await mcpCall('google-calendar', 'google_calendar_create_events', {
      events: [event]
    });

    return {
      success: true,
      eventId: result?.events?.[0]?.id || result?.id
    };
  } catch (error: any) {
    console.error('Error creating calendar event:', error);
    return {
      success: false,
      error: error.message || 'Failed to create calendar event'
    };
  }
}

/**
 * Create multiple calendar events for project milestones
 */
export async function createProjectMilestones(
  projectName: string,
  milestones: Array<{ title: string; date: Date; description?: string }>
): Promise<{ success: boolean; created: number; errors: string[] }> {
  const results = {
    success: true,
    created: 0,
    errors: [] as string[]
  };

  for (const milestone of milestones) {
    try {
      const startTime = new Date(milestone.date);
      startTime.setHours(9, 0, 0, 0);
      
      const endTime = new Date(milestone.date);
      endTime.setHours(10, 0, 0, 0);

      await mcpCall('google-calendar', 'google_calendar_create_events', {
        events: [{
          summary: `🎯 ${milestone.title} - ${projectName}`,
          description: milestone.description || `Milestone: ${milestone.title}`,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          reminders: [1440, 60]
        }]
      });

      results.created++;
    } catch (error: any) {
      results.errors.push(`${milestone.title}: ${error.message}`);
    }
  }

  results.success = results.errors.length === 0;
  return results;
}

/**
 * Search for existing events related to a project
 */
export async function searchProjectEvents(projectName: string): Promise<any[]> {
  try {
    const now = new Date();
    const threeMonthsLater = new Date(now);
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

    const result = await mcpCall('google-calendar', 'google_calendar_search_events', {
      q: projectName,
      time_min: now.toISOString(),
      time_max: threeMonthsLater.toISOString(),
      max_results: 50
    });

    return result?.events || [];
  } catch (error) {
    console.error('Error searching calendar events:', error);
    return [];
  }
}

/**
 * Delete a calendar event
 */
export async function deleteCalendarEvent(eventId: string): Promise<boolean> {
  try {
    await mcpCall('google-calendar', 'google_calendar_delete_events', {
      events: [{ event_id: eventId }]
    });
    return true;
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    return false;
  }
}

/**
 * Update a calendar event
 */
export async function updateCalendarEvent(
  eventId: string, 
  updates: Partial<CalendarEvent>
): Promise<boolean> {
  try {
    await mcpCall('google-calendar', 'google_calendar_update_events', {
      events: [{
        event_id: eventId,
        ...updates
      }]
    });
    return true;
  } catch (error) {
    console.error('Error updating calendar event:', error);
    return false;
  }
}
