import { relations } from "drizzle-orm";
import { 
  users, 
  projects, 
  aiRequests, 
  aiSessions, 
  aiUsageStats 
} from "./schema";

// AI Requests relations
export const aiRequestsRelations = relations(aiRequests, ({ one }) => ({
  user: one(users, {
    fields: [aiRequests.userId],
    references: [users.id],
  }),
  session: one(aiSessions, {
    fields: [aiRequests.sessionId],
    references: [aiSessions.id],
  }),
}));

// AI Sessions relations
export const aiSessionsRelations = relations(aiSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [aiSessions.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [aiSessions.projectId],
    references: [projects.id],
  }),
  requests: many(aiRequests),
}));

// AI Usage Stats relations
export const aiUsageStatsRelations = relations(aiUsageStats, ({ one }) => ({
  user: one(users, {
    fields: [aiUsageStats.userId],
    references: [users.id],
  }),
}));
