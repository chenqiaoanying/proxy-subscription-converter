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

export const UrlTestOptionsSchema = z.object({
  url: z.string().optional(),
  interval: z.string().optional(),
  tolerance: z.number().int().optional(),
  idle_timeout: z.string().optional(),
  interrupt_exist_connections: z.boolean().optional(),
})

export const StaticGroupConfigSchema = z.preprocess(
  (v: unknown) => v && typeof v === 'object' && 'subscriptions' in v && !('imports' in v)
    ? { ...(v as object), imports: (v as Record<string, unknown>).subscriptions }
    : v,
  z.object({
    tag: z.string(),
    type: z.enum(['selector', 'urltest']).default('selector'),
    include: MatchRuleSchema.nullable().optional(),
    exclude: MatchRuleSchema.nullable().optional(),
    imports: z.array(z.string()).default([]),
    urltest_options: UrlTestOptionsSchema.nullable().optional(),
  })
)

export const AutoRegionGroupConfigSchema = z.preprocess(
  (v: unknown) => v && typeof v === 'object' && 'subscriptions' in v && !('imports' in v)
    ? { ...(v as object), imports: (v as Record<string, unknown>).subscriptions }
    : v,
  z.object({
    group_tag: z.string(),
    type: z.literal('auto_region'),
    group_type: z.enum(['selector', 'urltest']).default('selector'),
    sub_group_tag: z.string(),
    sub_group_type: z.enum(['selector', 'urltest']).default('urltest'),
    imports: z.array(z.string()).default([]),
    regions: z.union([z.array(z.string()), z.literal('auto')]).default('auto'),
    others_tag: z.string().default('Others'),
    region_map: z.record(z.string(), z.string()).default({}),
    use_emoji: z.boolean().default(false),
    include: MatchRuleSchema.nullable().optional(),
    exclude: MatchRuleSchema.nullable().optional(),
    group_urltest_options: UrlTestOptionsSchema.nullable().optional(),
    sub_group_urltest_options: UrlTestOptionsSchema.nullable().optional(),
  })
)

export const GroupConfigSchema = z.union([AutoRegionGroupConfigSchema, StaticGroupConfigSchema])

export const SubscriptionConfigSchema = z.object({
  url: z.string(),
  enabled: z.boolean().default(true),
  user_agent: z.string().nullable().optional(),
})

export const SubscriberConfigSchema = z.object({
  subscriptions: z.record(z.string(), SubscriptionConfigSchema).default({}),
  groups: z.array(GroupConfigSchema).default([]),
})

export const TARGET_FORMATS = ['sing-box', 'clash'] as const
export const TargetFormatSchema = z.enum(TARGET_FORMATS)
export type TargetFormat = z.infer<typeof TargetFormatSchema>

export const UrlTemplateSchema = z.object({
  type: z.literal('url'),
  value: z.string().default(''),
})

export const ObjectTemplateSchema = z.object({
  type: z.literal('object'),
  value: z.record(z.unknown()).default({}),
})

export const InlineTemplateSchema = z.object({
  type: z.literal('inline'),
  value: z.string().default(''),
})

export const TemplateSourceSchema = z.preprocess((v) => {
  if (v == null) return v
  if (typeof v === 'object' && !Array.isArray(v) && 'type' in (v as object)) {
    return v
  }
  if (typeof v === 'string') return { type: 'url', value: v }
  if (typeof v === 'object' && !Array.isArray(v)) {
    return { type: 'object', value: v }
  }
  return v
}, z.discriminatedUnion('type', [
  UrlTemplateSchema,
  ObjectTemplateSchema,
  InlineTemplateSchema,
]).nullable())

export const ConfigTemplateValueSchema = TemplateSourceSchema

export const ConfigTemplateMapSchema = z.record(
  TargetFormatSchema,
  TemplateSourceSchema,
)

export const ConfigDataSchema = z.object({
  subscriber: SubscriberConfigSchema.default({ subscriptions: {}, groups: [] }),
  config_template: ConfigTemplateMapSchema.default({}),
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
export type UrlTestOptions = z.infer<typeof UrlTestOptionsSchema>
export type StaticGroupConfig = z.infer<typeof StaticGroupConfigSchema>
export type AutoRegionGroupConfig = z.infer<typeof AutoRegionGroupConfigSchema>
export type GroupConfig = z.infer<typeof GroupConfigSchema>
export type SubscriptionConfig = z.infer<typeof SubscriptionConfigSchema>
export type SubscriberConfig = z.infer<typeof SubscriberConfigSchema>
export type UrlTemplate = z.infer<typeof UrlTemplateSchema>
export type ObjectTemplate = z.infer<typeof ObjectTemplateSchema>
export type InlineTemplate = z.infer<typeof InlineTemplateSchema>
export type TemplateSource = z.infer<typeof TemplateSourceSchema>
export type ConfigTemplateValue = TemplateSource
export type ConfigTemplateMap = z.infer<typeof ConfigTemplateMapSchema>
export type ConfigData = z.infer<typeof ConfigDataSchema>
export type ConfigListItem = z.infer<typeof ConfigListItemSchema>
export type ConfigOut = z.infer<typeof ConfigOutSchema>

// ---------------------------------------------------------------------------
// Proxy preview
// ---------------------------------------------------------------------------

export interface ProxyInfo {
  tag: string
  type: string
}

// ---------------------------------------------------------------------------
// Subscription user info (from subscription-userinfo header)
// ---------------------------------------------------------------------------

export interface SubscriptionUserInfo {
  upload: number
  download: number
  total: number
  expire: number | null  // Unix timestamp in seconds
}

// ---------------------------------------------------------------------------
// Helper defaults
// ---------------------------------------------------------------------------

export function emptyMatchRule(): MatchRule {
  return { pattern: null, proxy_type: [], regex: false, match_case: false, match_whole_word: false }
}

export function emptyGroup(): StaticGroupConfig {
  return { tag: '', type: 'selector', include: null, exclude: null, imports: [] }
}

export function emptySubscription(): SubscriptionConfig {
  return { url: '', enabled: true, user_agent: null }
}

export function emptyConfigData(): ConfigData {
  return { subscriber: { subscriptions: {}, groups: [] }, config_template: {} }
}
