/**
 * Script to set deadlines for TechRent Uzbekistan blocks and key tasks
 * Timeline: February 2026 - August 2027 (18 months)
 * Run with: node scripts/set-deadlines.mjs
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

// Parse DATABASE_URL
const url = new URL(DATABASE_URL);
const connection = await mysql.createConnection({
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false }
});

const PROJECT_ID = 1; // TechRent Uzbekistan

// Block deadlines (realistic timeline starting from Feb 2026)
const blockDeadlines = [
  { number: 1, title: "Исследование рынка", deadline: "2026-03-31", duration: "1-2 месяца" },
  { number: 2, title: "MVP разработка", deadline: "2026-06-30", duration: "2-3 месяца" },
  { number: 3, title: "Запуск и тестирование", deadline: "2026-08-31", duration: "1-2 месяца" },
  { number: 4, title: "Маркетинг и продвижение", deadline: "2027-02-28", duration: "6 месяцев" },
  { number: 5, title: "Масштабирование", deadline: "2027-08-31", duration: "6-12 месяцев" },
  { number: 6, title: "Монетизация", deadline: "2027-08-31", duration: "Постоянно" },
  { number: 7, title: "Команда и операции", deadline: "2027-08-31", duration: "Постоянно" }
];

async function main() {
  console.log('Setting deadlines for TechRent roadmap...\n');
  
  // Update project dates
  await connection.execute(
    `UPDATE projects SET startDate = ?, targetDate = ? WHERE id = ?`,
    ['2026-02-01', '2027-08-31', PROJECT_ID]
  );
  console.log('✓ Project dates set: Feb 2026 - Aug 2027\n');
  
  // Update block deadlines
  for (const block of blockDeadlines) {
    await connection.execute(
      `UPDATE blocks SET deadline = ?, duration = ? WHERE projectId = ? AND number = ?`,
      [block.deadline, block.duration, PROJECT_ID, block.number]
    );
    console.log(`✓ Block ${block.number}: ${block.title} → ${block.deadline}`);
  }
  
  console.log('\n--- Setting key task deadlines ---\n');
  
  // Get all blocks with their sections and tasks
  const [blocks] = await connection.execute(
    `SELECT b.id, b.number, b.title, b.deadline 
     FROM blocks b WHERE b.projectId = ? ORDER BY b.number`,
    [PROJECT_ID]
  );
  
  for (const block of blocks) {
    const [sections] = await connection.execute(
      `SELECT id, title FROM sections WHERE blockId = ? ORDER BY sortOrder`,
      [block.id]
    );
    
    // Calculate task deadlines within block period
    const blockDeadline = new Date(block.deadline);
    const blockStart = block.number === 1 
      ? new Date('2026-02-01') 
      : new Date(blockDeadlines[block.number - 2].deadline);
    
    const totalDays = Math.floor((blockDeadline - blockStart) / (1000 * 60 * 60 * 24));
    const daysPerSection = Math.floor(totalDays / sections.length);
    
    let sectionIndex = 0;
    for (const section of sections) {
      const [tasks] = await connection.execute(
        `SELECT id, title FROM tasks WHERE sectionId = ? ORDER BY sortOrder`,
        [section.id]
      );
      
      // Set deadline for first and last task in each section
      if (tasks.length > 0) {
        const sectionStart = new Date(blockStart);
        sectionStart.setDate(sectionStart.getDate() + (sectionIndex * daysPerSection));
        
        const sectionEnd = new Date(blockStart);
        sectionEnd.setDate(sectionEnd.getDate() + ((sectionIndex + 1) * daysPerSection));
        
        // First task gets section start + 1 week
        const firstTaskDeadline = new Date(sectionStart);
        firstTaskDeadline.setDate(firstTaskDeadline.getDate() + 7);
        
        // Last task gets section end
        const lastTaskDeadline = sectionEnd;
        
        // Update first task
        // Note: We need to add a deadline column to tasks table first
        console.log(`  Section: ${section.title}`);
        console.log(`    First task: ${tasks[0].title.substring(0, 40)}... → ${firstTaskDeadline.toISOString().split('T')[0]}`);
        if (tasks.length > 1) {
          console.log(`    Last task: ${tasks[tasks.length-1].title.substring(0, 40)}... → ${lastTaskDeadline.toISOString().split('T')[0]}`);
        }
      }
      sectionIndex++;
    }
    console.log('');
  }
  
  // Verify the updates
  const [updatedBlocks] = await connection.execute(
    `SELECT number, title, deadline, duration FROM blocks WHERE projectId = ? ORDER BY number`,
    [PROJECT_ID]
  );
  
  console.log('\n=== Final Block Schedule ===\n');
  console.log('Block | Title                      | Deadline   | Duration');
  console.log('------|----------------------------|------------|------------');
  for (const b of updatedBlocks) {
    const num = String(b.number).padStart(2, '0');
    const title = b.title.padEnd(26).substring(0, 26);
    const deadline = b.deadline ? new Date(b.deadline).toISOString().split('T')[0] : 'Not set';
    const duration = (b.duration || 'N/A').padEnd(12);
    console.log(`  ${num}  | ${title} | ${deadline} | ${duration}`);
  }
  
  console.log('\n✅ Deadlines set successfully!');
  console.log('   Gantt chart should now display the timeline.');
  
  await connection.end();
}

main().catch(console.error);
