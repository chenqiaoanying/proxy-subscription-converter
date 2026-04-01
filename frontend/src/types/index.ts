import { z } from 'zod'

// ---------------------------------------------------------------------------
// Config document sub-schemas
// ---------------------------------------------------------------------------

export const MatchRuleSchema = z.object({
  pattern: z.string().nullable().optional(),
  proxy_type: z.array(z.string()).default([]),
  regex: z.boolean().default(false),
  match_case: z.boolean().default(false),
  match_whole_word: z.boolean().default(false),
})

export const FilterConfigSchema = z.object({
  tag: z.string(),
  type: z.enum(['selector', 'urltest']).default('selector'),
  include: MatchRuleSchema.nullable().optional(),
  exclude: MatchRuleSchema.nullable().optional(),
  subscriptions: z.array(z.string()).default([]),
})

export const SubscriptionConfigSchema = z.object({
  url: z.string(),
  enabled: z.boolean().default(true),
  user_agent: z.string().nullable().optional(),
})

export const SubscriberConfigSchema = z.object({
  subscriptions: z.record(z.string(), SubscriptionConfigSchema).default({}),
  filters: z.array(FilterConfigSchema).default([]),
})

export const ConfigDataSchema = z.object({
  subscriber: SubscriberConfigSchema.default({ subscriptions: {}, filters: [] }),
  config_template: z.union([z.string(), z.record(z.unknown())]).nullable().optional(),
})

// ---------------------------------------------------------------------------
// API response schemas
// ---------------------------------------------------------------------------

export const ConfigListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const ConfigOutSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  data: ConfigDataSchema,
  created_at: z.string(),
  updated_at: z.string(),
})

// ---------------------------------------------------------------------------
// Inferred TypeScript types
// ---------------------------------------------------------------------------

export type MatchRule = z.infer<typeof MatchRuleSchema>
export type FilterConfig = z.infer<typeof FilterConfigSchema>
export type SubscriptionConfig = z.infer<typeof SubscriptionConfigSchema>
export type SubscriberConfig = z.infer<typeof SubscriberConfigSchema>
export type ConfigData = z.infer<typeof ConfigDataSchema>
export type ConfigListItem = z.infer<typeof ConfigListItemSchema>
export type ConfigOut = z.infer<typeof ConfigOutSchema>

// ---------------------------------------------------------------------------
// Helper defaults
// ---------------------------------------------------------------------------

export function emptyMatchRule(): MatchRule {
  return { pattern: null, proxy_type: [], regex: false, match_case: false, match_whole_word: false }
}

export function emptyFilter(): FilterConfig {
  return { tag: '', type: 'selector', include: null, exclude: null, subscriptions: [] }
}

export function emptySubscription(): SubscriptionConfig {
  return { url: '', enabled: true, user_agent: null }
}

export function emptyConfigData(): ConfigData {
  return { subscriber: { subscriptions: {}, filters: [] }, config_template: null }
}
