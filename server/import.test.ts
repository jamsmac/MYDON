import { describe, it, expect } from 'vitest';
import { 
  parseMarkdownRoadmap, 
  parseJsonRoadmap, 
  parseRoadmap,
  generateMarkdownTemplate,
  generateJsonTemplate
} from './import';

describe('Import Parser', () => {
  describe('parseMarkdownRoadmap', () => {
    it('should parse basic markdown roadmap', () => {
      const markdown = `# Test Project

This is a test description.

## 01. First Block / Первый блок

### Section One
- [ ] Task 1
- [x] Task 2 (completed)
  - [ ] Subtask 1
  - [x] Subtask 2

## 02. Second Block

### Another Section
- [ ] Another task
`;

      const result = parseMarkdownRoadmap(markdown);

      expect(result.name).toBe('Test Project');
      expect(result.description).toBe('This is a test description.');
      expect(result.blocks).toHaveLength(2);
      
      // First block
      expect(result.blocks[0].number).toBe('01');
      expect(result.blocks[0].title).toBe('First Block');
      expect(result.blocks[0].titleRu).toBe('Первый блок');
      expect(result.blocks[0].sections).toHaveLength(1);
      expect(result.blocks[0].sections![0].title).toBe('Section One');
      expect(result.blocks[0].sections![0].tasks).toHaveLength(2);
      
      // Task statuses
      expect(result.blocks[0].sections![0].tasks![0].status).toBe('not_started');
      expect(result.blocks[0].sections![0].tasks![1].status).toBe('completed');
      
      // Subtasks
      expect(result.blocks[0].sections![0].tasks![1].subtasks).toHaveLength(2);
      expect(result.blocks[0].sections![0].tasks![1].subtasks![0].completed).toBe(false);
      expect(result.blocks[0].sections![0].tasks![1].subtasks![1].completed).toBe(true);
      
      // Second block
      expect(result.blocks[1].number).toBe('02');
      expect(result.blocks[1].title).toBe('Second Block');
    });

    it('should handle blocks without sections', () => {
      const markdown = `# Project

## 01. Block One
- [ ] Direct task
`;

      const result = parseMarkdownRoadmap(markdown);
      
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].sections).toHaveLength(1);
      expect(result.blocks[0].sections![0].title).toBe('Задачи');
      expect(result.blocks[0].sections![0].tasks).toHaveLength(1);
    });

    it('should handle different block number formats', () => {
      const markdown = `# Project

## 1. Block One
## 02) Block Two
## 3. Block Three
`;

      const result = parseMarkdownRoadmap(markdown);
      
      expect(result.blocks).toHaveLength(3);
      expect(result.blocks[0].number).toBe('01');
      expect(result.blocks[1].number).toBe('02');
      expect(result.blocks[2].number).toBe('03');
    });
  });

  describe('parseJsonRoadmap', () => {
    it('should parse valid JSON roadmap', () => {
      const json = JSON.stringify({
        name: 'JSON Project',
        description: 'A test project',
        blocks: [
          {
            number: '01',
            title: 'First Block',
            titleRu: 'Первый блок',
            sections: [
              {
                title: 'Section 1',
                tasks: [
                  {
                    title: 'Task 1',
                    description: 'Task description',
                    status: 'in_progress',
                    subtasks: [
                      { title: 'Subtask 1', completed: true }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      });

      const result = parseJsonRoadmap(json);

      expect(result.name).toBe('JSON Project');
      expect(result.description).toBe('A test project');
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].title).toBe('First Block');
      expect(result.blocks[0].sections![0].tasks![0].status).toBe('in_progress');
      expect(result.blocks[0].sections![0].tasks![0].subtasks![0].completed).toBe(true);
    });

    it('should throw error for missing name', () => {
      const json = JSON.stringify({ blocks: [] });
      
      expect(() => parseJsonRoadmap(json)).toThrow('missing or invalid "name"');
    });

    it('should throw error for missing blocks', () => {
      const json = JSON.stringify({ name: 'Test' });
      
      expect(() => parseJsonRoadmap(json)).toThrow('missing or invalid "blocks"');
    });

    it('should auto-generate block numbers if missing', () => {
      const json = JSON.stringify({
        name: 'Test',
        blocks: [
          { title: 'Block 1' },
          { title: 'Block 2' }
        ]
      });

      const result = parseJsonRoadmap(json);
      
      expect(result.blocks[0].number).toBe('01');
      expect(result.blocks[1].number).toBe('02');
    });
  });

  describe('parseRoadmap (auto-detect)', () => {
    it('should detect JSON from filename', () => {
      const json = JSON.stringify({ name: 'Test', blocks: [] });
      
      const result = parseRoadmap(json, 'roadmap.json');
      
      expect(result.name).toBe('Test');
    });

    it('should detect Markdown from filename', () => {
      const markdown = '# Test Project\n\n## 01. Block';
      
      const result = parseRoadmap(markdown, 'roadmap.md');
      
      expect(result.name).toBe('Test Project');
    });

    it('should detect JSON from content starting with {', () => {
      const json = JSON.stringify({ name: 'Auto Detected', blocks: [] });
      
      const result = parseRoadmap(json);
      
      expect(result.name).toBe('Auto Detected');
    });

    it('should fall back to Markdown for other content', () => {
      const markdown = '# Markdown Project';
      
      const result = parseRoadmap(markdown);
      
      expect(result.name).toBe('Markdown Project');
    });
  });

  describe('Template generators', () => {
    it('should generate valid Markdown template', () => {
      const template = generateMarkdownTemplate();
      
      expect(template).toContain('# Название проекта');
      expect(template).toContain('## 01.');
      expect(template).toContain('### ');
      expect(template).toContain('- [ ]');
      
      // Should be parseable
      const result = parseMarkdownRoadmap(template);
      expect(result.name).toBe('Название проекта');
      expect(result.blocks.length).toBeGreaterThan(0);
    });

    it('should generate valid JSON template', () => {
      const template = generateJsonTemplate();
      
      // Should be valid JSON
      const parsed = JSON.parse(template);
      expect(parsed.name).toBe('Название проекта');
      expect(Array.isArray(parsed.blocks)).toBe(true);
      
      // Should be parseable by our parser
      const result = parseJsonRoadmap(template);
      expect(result.name).toBe('Название проекта');
      expect(result.blocks.length).toBeGreaterThan(0);
    });
  });
});
