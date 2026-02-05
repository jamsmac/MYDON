/**
 * Default Tags Configuration
 * Pre-defined tags that are automatically created for new projects
 */

export interface DefaultTag {
  name: string;
  nameRu: string; // Russian translation
  color: string;
  icon?: string;
  tagType: 'label' | 'category' | 'status' | 'sprint' | 'epic' | 'component' | 'custom';
  description?: string;
}

/**
 * Default tags to create for every new project
 * These provide a starting point for task organization
 */
export const DEFAULT_PROJECT_TAGS: DefaultTag[] = [
  // Priority labels
  {
    name: 'Urgent',
    nameRu: 'Срочно',
    color: '#ef4444', // red-500
    icon: 'alert-triangle',
    tagType: 'label',
    description: 'High priority tasks requiring immediate attention',
  },
  {
    name: 'MVP',
    nameRu: 'MVP',
    color: '#8b5cf6', // violet-500
    icon: 'star',
    tagType: 'label',
    description: 'Minimum Viable Product - core features',
  },
  {
    name: 'Blocker',
    nameRu: 'Блокер',
    color: '#dc2626', // red-600
    icon: 'ban',
    tagType: 'label',
    description: 'Blocking other tasks from progressing',
  },
  
  // Categories
  {
    name: 'Bug',
    nameRu: 'Баг',
    color: '#f97316', // orange-500
    icon: 'bug',
    tagType: 'category',
    description: 'Bug fix or issue resolution',
  },
  {
    name: 'Feature',
    nameRu: 'Фича',
    color: '#22c55e', // green-500
    icon: 'sparkles',
    tagType: 'category',
    description: 'New feature development',
  },
  {
    name: 'Improvement',
    nameRu: 'Улучшение',
    color: '#3b82f6', // blue-500
    icon: 'trending-up',
    tagType: 'category',
    description: 'Enhancement to existing functionality',
  },
  {
    name: 'Documentation',
    nameRu: 'Документация',
    color: '#6366f1', // indigo-500
    icon: 'file-text',
    tagType: 'category',
    description: 'Documentation tasks',
  },
  
  // Sprint tags
  {
    name: 'Sprint 1',
    nameRu: 'Спринт 1',
    color: '#0ea5e9', // sky-500
    icon: 'calendar',
    tagType: 'sprint',
    description: 'First sprint tasks',
  },
  {
    name: 'Sprint 2',
    nameRu: 'Спринт 2',
    color: '#14b8a6', // teal-500
    icon: 'calendar',
    tagType: 'sprint',
    description: 'Second sprint tasks',
  },
  
  // Status labels
  {
    name: 'Needs Review',
    nameRu: 'На проверку',
    color: '#eab308', // yellow-500
    icon: 'eye',
    tagType: 'status',
    description: 'Ready for review',
  },
  {
    name: 'On Hold',
    nameRu: 'На паузе',
    color: '#64748b', // slate-500
    icon: 'pause-circle',
    tagType: 'status',
    description: 'Temporarily paused',
  },
];

/**
 * Get default tags with Russian names based on locale preference
 */
export function getDefaultTags(useRussian: boolean = true): Array<{
  name: string;
  color: string;
  icon?: string;
  tagType: DefaultTag['tagType'];
  description?: string;
}> {
  return DEFAULT_PROJECT_TAGS.map(tag => ({
    name: useRussian ? tag.nameRu : tag.name,
    color: tag.color,
    icon: tag.icon,
    tagType: tag.tagType,
    description: tag.description,
  }));
}

/**
 * Minimal set of essential tags for quick project setup
 */
export const ESSENTIAL_TAGS: DefaultTag[] = [
  DEFAULT_PROJECT_TAGS[0], // Urgent
  DEFAULT_PROJECT_TAGS[1], // MVP
  DEFAULT_PROJECT_TAGS[2], // Blocker
  DEFAULT_PROJECT_TAGS[3], // Bug
  DEFAULT_PROJECT_TAGS[4], // Feature
];

export function getEssentialTags(useRussian: boolean = true): Array<{
  name: string;
  color: string;
  icon?: string;
  tagType: DefaultTag['tagType'];
  description?: string;
}> {
  return ESSENTIAL_TAGS.map(tag => ({
    name: useRussian ? tag.nameRu : tag.name,
    color: tag.color,
    icon: tag.icon,
    tagType: tag.tagType,
    description: tag.description,
  }));
}
