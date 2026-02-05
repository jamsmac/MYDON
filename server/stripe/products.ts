// Stripe Products and Pricing Configuration
// These IDs should be created in Stripe Dashboard and updated here

export interface PlanFeature {
  name: string;
  included: boolean;
  limit?: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  nameRu: string;
  description: string;
  descriptionRu: string;
  priceMonthly: number;
  priceYearly: number;
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
  features: PlanFeature[];
  highlighted?: boolean;
  badge?: string;
  badgeRu?: string;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    nameRu: 'Бесплатный',
    description: 'Perfect for getting started',
    descriptionRu: 'Идеально для начала работы',
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      { name: 'Up to 3 projects', included: true, limit: '3' },
      { name: 'Basic roadmap templates', included: true },
      { name: 'Task management', included: true },
      { name: 'AI Assistant (limited)', included: true, limit: '10 requests/day' },
      { name: 'Export to PDF', included: false },
      { name: 'Team collaboration', included: false },
      { name: 'Priority support', included: false },
      { name: 'Custom integrations', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    nameRu: 'Профессиональный',
    description: 'Best for professionals and small teams',
    descriptionRu: 'Лучший выбор для профессионалов и небольших команд',
    priceMonthly: 19,
    priceYearly: 190,
    highlighted: true,
    badge: 'Most Popular',
    badgeRu: 'Популярный',
    features: [
      { name: 'Unlimited projects', included: true },
      { name: 'All roadmap templates', included: true },
      { name: 'Advanced task management', included: true },
      { name: 'AI Assistant (unlimited)', included: true },
      { name: 'Export to PDF/Excel', included: true },
      { name: 'Team collaboration (up to 5)', included: true, limit: '5 members' },
      { name: 'Priority support', included: true },
      { name: 'Custom integrations', included: false },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    nameRu: 'Корпоративный',
    description: 'For large teams and organizations',
    descriptionRu: 'Для крупных команд и организаций',
    priceMonthly: 49,
    priceYearly: 490,
    features: [
      { name: 'Unlimited projects', included: true },
      { name: 'All roadmap templates', included: true },
      { name: 'Advanced task management', included: true },
      { name: 'AI Assistant (unlimited + priority)', included: true },
      { name: 'Export to all formats', included: true },
      { name: 'Unlimited team members', included: true },
      { name: 'Dedicated support', included: true },
      { name: 'Custom integrations & API', included: true },
      { name: 'SSO & advanced security', included: true },
      { name: 'Custom branding', included: true },
    ],
  },
];

export const FEATURES_LIST_RU: Record<string, string> = {
  'Up to 3 projects': 'До 3 проектов',
  'Basic roadmap templates': 'Базовые шаблоны roadmap',
  'Task management': 'Управление задачами',
  'AI Assistant (limited)': 'AI Ассистент (ограниченно)',
  'Export to PDF': 'Экспорт в PDF',
  'Team collaboration': 'Командная работа',
  'Priority support': 'Приоритетная поддержка',
  'Custom integrations': 'Пользовательские интеграции',
  'Unlimited projects': 'Неограниченные проекты',
  'All roadmap templates': 'Все шаблоны roadmap',
  'Advanced task management': 'Расширенное управление задачами',
  'AI Assistant (unlimited)': 'AI Ассистент (безлимит)',
  'Export to PDF/Excel': 'Экспорт в PDF/Excel',
  'Team collaboration (up to 5)': 'Командная работа (до 5 человек)',
  'AI Assistant (unlimited + priority)': 'AI Ассистент (безлимит + приоритет)',
  'Export to all formats': 'Экспорт во все форматы',
  'Unlimited team members': 'Неограниченное количество участников',
  'Dedicated support': 'Выделенная поддержка',
  'Custom integrations & API': 'Интеграции и API',
  'SSO & advanced security': 'SSO и расширенная безопасность',
  'Custom branding': 'Собственный брендинг',
};

export function getFeatureNameRu(name: string): string {
  return FEATURES_LIST_RU[name] || name;
}
