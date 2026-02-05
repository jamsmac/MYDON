/**
 * Google Drive Integration for MYDON Roadmap Hub
 * Uses rclone for file operations with Google Drive
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

const RCLONE_CONFIG = '/home/ubuntu/.gdrive-rclone.ini';
const RCLONE_REMOTE = 'manus_google_drive';
const ROADMAP_FOLDER = 'MYDON_Roadmaps';

interface DriveFile {
  name: string;
  path: string;
  modTime: string;
  size: number;
  isDir: boolean;
}

interface ProjectExport {
  id: number;
  name: string;
  description: string | null;
  status: string | null;
  createdAt: Date | number;
  updatedAt: Date | number;
  blocks: BlockExport[];
}

interface BlockExport {
  number: number;
  title: string;
  titleRu: string | null;
  sections: SectionExport[];
}

interface SectionExport {
  title: string;
  tasks: TaskExport[];
}

interface TaskExport {
  title: string;
  description: string | null;
  status: string | null;
  notes: string | null;
  summary: string | null;
  subtasks: SubtaskExport[];
}

interface SubtaskExport {
  title: string;
  status: string | null;
}

/**
 * Execute rclone command
 */
async function rclone(command: string): Promise<string> {
  const fullCommand = `rclone ${command} --config ${RCLONE_CONFIG}`;
  try {
    const { stdout, stderr } = await execAsync(fullCommand, { timeout: 60000 });
    if (stderr && !stderr.includes('NOTICE')) {
      console.warn('rclone stderr:', stderr);
    }
    return stdout;
  } catch (error) {
    console.error('rclone error:', error);
    throw error;
  }
}

/**
 * Ensure the MYDON_Roadmaps folder exists in Google Drive
 */
export async function ensureRoadmapFolder(): Promise<void> {
  try {
    await rclone(`mkdir "${RCLONE_REMOTE}:${ROADMAP_FOLDER}"`);
  } catch (error) {
    // Folder might already exist, which is fine
  }
}

/**
 * List all roadmap files in Google Drive
 */
export async function listRoadmapFiles(): Promise<DriveFile[]> {
  try {
    await ensureRoadmapFolder();
    const output = await rclone(`lsjson "${RCLONE_REMOTE}:${ROADMAP_FOLDER}"`);
    const files = JSON.parse(output || '[]');
    return files.map((f: any) => ({
      name: f.Name,
      path: `${ROADMAP_FOLDER}/${f.Name}`,
      modTime: f.ModTime,
      size: f.Size,
      isDir: f.IsDir
    }));
  } catch (error) {
    console.error('Error listing roadmap files:', error);
    return [];
  }
}

/**
 * Save project to Google Drive as JSON
 */
export async function saveProjectToDrive(project: ProjectExport): Promise<{ success: boolean; path: string; link?: string }> {
  try {
    await ensureRoadmapFolder();
    
    // Create a safe filename
    const safeName = project.name.replace(/[^a-zA-Z0-9а-яА-ЯёЁ\s-]/g, '').replace(/\s+/g, '_');
    const filename = `${safeName}_${project.id}.json`;
    const tempPath = `/tmp/roadmap_${project.id}.json`;
    
    // Write to temp file
    await fs.writeFile(tempPath, JSON.stringify(project, null, 2), 'utf-8');
    
    // Upload to Google Drive
    const remotePath = `${RCLONE_REMOTE}:${ROADMAP_FOLDER}/${filename}`;
    await rclone(`copyto "${tempPath}" "${remotePath}"`);
    
    // Clean up temp file
    await fs.unlink(tempPath);
    
    // Get shareable link
    let link: string | undefined;
    try {
      link = (await rclone(`link "${remotePath}"`)).trim();
    } catch (e) {
      // Link generation is optional, continue without it
    }
    
    return {
      success: true,
      path: `${ROADMAP_FOLDER}/${filename}`,
      link
    };
  } catch (error) {
    console.error('Error saving project to Drive:', error);
    throw error;
  }
}

/**
 * Load project from Google Drive
 */
export async function loadProjectFromDrive(filename: string): Promise<ProjectExport | null> {
  try {
    const remotePath = `${RCLONE_REMOTE}:${ROADMAP_FOLDER}/${filename}`;
    const tempPath = `/tmp/roadmap_download_${Date.now()}.json`;
    
    // Download from Google Drive
    await rclone(`copyto "${remotePath}" "${tempPath}"`);
    
    // Read the file
    const content = await fs.readFile(tempPath, 'utf-8');
    
    // Clean up temp file
    await fs.unlink(tempPath);
    
    return JSON.parse(content);
  } catch (error) {
    console.error('Error loading project from Drive:', error);
    return null;
  }
}

/**
 * Delete project from Google Drive
 */
export async function deleteProjectFromDrive(filename: string): Promise<boolean> {
  try {
    const remotePath = `${RCLONE_REMOTE}:${ROADMAP_FOLDER}/${filename}`;
    await rclone(`deletefile "${remotePath}"`);
    return true;
  } catch (error) {
    console.error('Error deleting project from Drive:', error);
    return false;
  }
}

/**
 * Check if Google Drive is connected and accessible
 */
export async function checkDriveConnection(): Promise<{ connected: boolean; email?: string }> {
  try {
    const output = await rclone(`about "${RCLONE_REMOTE}:" --json`);
    const info = JSON.parse(output);
    return {
      connected: true,
      email: info.email || undefined
    };
  } catch (error) {
    console.error('Drive connection check failed:', error);
    return { connected: false };
  }
}

/**
 * Get shareable link for a file
 */
export async function getShareableLink(filename: string): Promise<string | null> {
  try {
    const remotePath = `${RCLONE_REMOTE}:${ROADMAP_FOLDER}/${filename}`;
    const link = await rclone(`link "${remotePath}"`);
    return link.trim();
  } catch (error) {
    console.error('Error getting shareable link:', error);
    return null;
  }
}

/**
 * Export project as Google Docs document
 */
export async function exportToGoogleDocs(
  project: ProjectExport
): Promise<{ success: boolean; path: string; link?: string }> {
  try {
    await ensureRoadmapFolder();
    
    // Create markdown content
    const markdown = generateProjectMarkdown(project);
    
    // Create a safe filename
    const safeName = project.name.replace(/[^a-zA-Z0-9а-яА-ЯёЁ\s-]/g, '').replace(/\s+/g, '_');
    const filename = `${safeName}_${project.id}.md`;
    const tempPath = `/tmp/roadmap_doc_${project.id}.md`;
    
    // Write to temp file
    await fs.writeFile(tempPath, markdown, 'utf-8');
    
    // Upload to Google Drive (Google Drive will convert .md to Google Docs format)
    const remotePath = `${RCLONE_REMOTE}:${ROADMAP_FOLDER}/Documents/${filename}`;
    await rclone(`mkdir "${RCLONE_REMOTE}:${ROADMAP_FOLDER}/Documents"`);
    await rclone(`copyto "${tempPath}" "${remotePath}"`);
    
    // Clean up temp file
    await fs.unlink(tempPath);
    
    // Get shareable link
    let link: string | undefined;
    try {
      link = (await rclone(`link "${remotePath}"`)).trim();
    } catch (e) {
      // Link generation is optional, continue without it
    }
    
    return {
      success: true,
      path: `${ROADMAP_FOLDER}/Documents/${filename}`,
      link
    };
  } catch (error) {
    console.error('Error exporting to Google Docs:', error);
    throw error;
  }
}

/**
 * Generate markdown content from project data
 */
function generateProjectMarkdown(project: ProjectExport): string {
  const lines: string[] = [];
  
  // Header
  lines.push(`# ${project.name}`);
  lines.push('');
  if (project.description) {
    lines.push(project.description);
    lines.push('');
  }
  lines.push(`**Статус:** ${project.status || 'Активен'}`);
  lines.push(`**Дата создания:** ${new Date(project.createdAt).toLocaleDateString('ru-RU')}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  
  // Blocks
  for (const block of project.blocks) {
    lines.push(`## ${block.number.toString().padStart(2, '0')}. ${block.title}`);
    if (block.titleRu) {
      lines.push(`*${block.titleRu}*`);
    }
    lines.push('');
    
    // Sections
    for (const section of block.sections) {
      lines.push(`### ${section.title}`);
      lines.push('');
      
      // Tasks
      for (const task of section.tasks) {
        const statusIcon = task.status === 'completed' ? '✅' : 
                          task.status === 'in_progress' ? '⏳' : '⬜';
        lines.push(`- ${statusIcon} **${task.title}**`);
        
        if (task.description) {
          lines.push(`  - ${task.description}`);
        }
        
        // Subtasks
        for (const subtask of task.subtasks) {
          const subtaskIcon = subtask.status === 'completed' ? '✅' : '⬜';
          lines.push(`  - ${subtaskIcon} ${subtask.title}`);
        }
      }
      lines.push('');
    }
  }
  
  // Footer
  lines.push('---');
  lines.push(`*Экспортировано из MYDON Roadmap Hub ${new Date().toLocaleString('ru-RU')}*`);
  
  return lines.join('\n');
}
