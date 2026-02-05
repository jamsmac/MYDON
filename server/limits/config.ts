// Subscription Plan Limits Configuration

export interface PlanLimits {
  maxProjects: number;
  maxAiRequestsPerDay: number;
  maxTeamMembers: number;
  canExportPdf: boolean;
  canExportExcel: boolean;
  canUseAdvancedAi: boolean;
  canUseCustomTemplates: boolean;
  canUseSso: boolean;
  canUseApi: boolean;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: {
    maxProjects: 3,
    maxAiRequestsPerDay: 10,
    maxTeamMembers: 1,
    canExportPdf: false,
    canExportExcel: false,
    canUseAdvancedAi: false,
    canUseCustomTemplates: false,
    canUseSso: false,
    canUseApi: false,
  },
  pro: {
    maxProjects: -1, // unlimited
    maxAiRequestsPerDay: -1, // unlimited
    maxTeamMembers: 5,
    canExportPdf: true,
    canExportExcel: true,
    canUseAdvancedAi: true,
    canUseCustomTemplates: false,
    canUseSso: false,
    canUseApi: false,
  },
  enterprise: {
    maxProjects: -1, // unlimited
    maxAiRequestsPerDay: -1, // unlimited
    maxTeamMembers: -1, // unlimited
    canExportPdf: true,
    canExportExcel: true,
    canUseAdvancedAi: true,
    canUseCustomTemplates: true,
    canUseSso: true,
    canUseApi: true,
  },
};

export function getPlanLimits(plan: string | null | undefined): PlanLimits {
  return PLAN_LIMITS[plan || 'free'] || PLAN_LIMITS.free;
}

export function isUnlimited(value: number): boolean {
  return value === -1;
}
