import type { AutoRegionGroupConfig, GroupConfig, MatchRule, ProxyInfo } from '@/types'

export const REGION_KEYWORD_MAP: Record<string, string[]> = {
  HK: ['HK', 'Hong Kong', '香港', '港'],
  TW: ['TW', 'Taiwan', '台湾', '台灣', '台北'],
  JP: ['JP', 'Japan', '日本', '东京', '大阪', 'Tokyo', 'Osaka'],
  KR: ['KR', 'Korea', '韩国', '韓國', '首尔', 'Seoul'],
  SG: ['SG', 'Singapore', '新加坡', '狮城'],
  US: ['US', 'USA', 'United States', '美国', '纽约', '洛杉矶', 'New York', 'Los Angeles', 'Seattle', 'Chicago'],
  GB: ['GB', 'UK', 'United Kingdom', '英国', '英國', '伦敦', 'London'],
  DE: ['DE', 'Germany', '德国', '德國', '法兰克福', 'Frankfurt'],
  FR: ['FR', 'France', '法国', '法國', '巴黎', 'Paris'],
  NL: ['NL', 'Netherlands', '荷兰', '荷蘭', '阿姆斯特丹'],
  CA: ['CA', 'Canada', '加拿大', '多伦多', 'Toronto'],
  AU: ['AU', 'Australia', '澳大利亚', '澳洲', 'Sydney'],
  IN: ['IN', 'India', '印度', 'Mumbai'],
  BR: ['BR', 'Brazil', '巴西'],
  RU: ['RU', 'Russia', '俄罗斯', 'Moscow'],
  TR: ['TR', 'Turkey', '土耳其'],
  AR: ['AR', 'Argentina', '阿根廷'],
  PH: ['PH', 'Philippines', '菲律宾'],
  ID: ['ID', 'Indonesia', '印尼', '印度尼西亚'],
  MY: ['MY', 'Malaysia', '马来西亚'],
  TH: ['TH', 'Thailand', '泰国'],
  VN: ['VN', 'Vietnam', '越南'],
}

export const REGION_EMOJI: Record<string, string> = {
  HK: '🇭🇰', TW: '🇹🇼', JP: '🇯🇵', KR: '🇰🇷',
  SG: '🇸🇬', US: '🇺🇸', GB: '🇬🇧', DE: '🇩🇪',
  FR: '🇫🇷', NL: '🇳🇱', CA: '🇨🇦', AU: '🇦🇺',
  IN: '🇮🇳', BR: '🇧🇷', RU: '🇷🇺', TR: '🇹🇷',
  AR: '🇦🇷', PH: '🇵🇭', ID: '🇮🇩', MY: '🇲🇾',
  TH: '🇹🇭', VN: '🇻🇳',
}

export function matchesRule(tag: string, type: string, rule: MatchRule): boolean {
  if (rule.proxy_type && rule.proxy_type.length > 0 && !rule.proxy_type.includes(type)) {
    return false
  }
  if (rule.pattern) {
    let pattern = rule.pattern
    const flags = rule.match_case ? '' : 'i'
    if (!rule.regex) {
      pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (rule.match_whole_word) pattern = `\\b${pattern}\\b`
    }
    if (!new RegExp(pattern, flags).test(tag)) return false
  }
  return true
}

export function detectRegion(tag: string, regionMap: Record<string, string>): string | null {
  const lower = tag.toLowerCase()
  for (const [kw, region] of Object.entries(regionMap)) {
    if (lower.includes(kw.toLowerCase())) return region
  }
  for (const [region, keywords] of Object.entries(REGION_KEYWORD_MAP)) {
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) return region
    }
  }
  return null
}

export function regionLabel(region: string, useEmoji: boolean): string {
  if (useEmoji && REGION_EMOJI[region]) return `${REGION_EMOJI[region]} ${region}`
  return region
}

/** Returns filtered proxy list for the group, or null if any import is not yet available. */
export function computeGroupProxies(
  group: GroupConfig,
  subscriptionPreviews: Record<string, ProxyInfo[]>,
  groupResults: Record<string, ProxyInfo[]>,
): ProxyInfo[] | null {
  let proxies: ProxyInfo[]
  if (group.imports.length === 0) {
    proxies = Object.values(subscriptionPreviews).flat()
  } else {
    proxies = []
    for (const imp of group.imports) {
      if (subscriptionPreviews[imp]) {
        proxies.push(...subscriptionPreviews[imp])
      } else if (groupResults[imp]) {
        proxies.push(...groupResults[imp])
      } else {
        return null
      }
    }
  }
  if (group.include) proxies = proxies.filter((p) => matchesRule(p.tag, p.type, group.include!))
  if (group.exclude) proxies = proxies.filter((p) => !matchesRule(p.tag, p.type, group.exclude!))
  return proxies
}

/** Returns per-region breakdown for an auto_region group given its (already filtered) proxy list. */
export function computeRegionBreakdown(
  group: AutoRegionGroupConfig,
  proxies: ProxyInfo[],
): { label: string; count: number }[] {
  const buckets: Record<string, ProxyInfo[]> = {}
  const unmatched: ProxyInfo[] = []
  for (const proxy of proxies) {
    const region = detectRegion(proxy.tag, group.region_map)
    if (region) {
      if (!buckets[region]) buckets[region] = []
      buckets[region].push(proxy)
    } else {
      unmatched.push(proxy)
    }
  }

  let orderedRegions: string[]
  let othersProxies: ProxyInfo[]
  if (group.regions === 'auto') {
    orderedRegions = Object.keys(buckets).sort((a, b) => buckets[b].length - buckets[a].length)
    othersProxies = unmatched
  } else {
    const specifiedSet = new Set(group.regions)
    orderedRegions = group.regions.filter((r) => buckets[r])
    othersProxies = [
      ...unmatched,
      ...Object.entries(buckets).filter(([r]) => !specifiedSet.has(r)).flatMap(([, ps]) => ps),
    ]
  }

  const result: { label: string; count: number }[] = orderedRegions.map((r) => ({
    label: regionLabel(r, group.use_emoji),
    count: buckets[r].length,
  }))
  if (othersProxies.length > 0) {
    const othersLabel = group.sub_group_tag.replace('{region}', group.others_tag)
    result.push({ label: othersLabel, count: othersProxies.length })
  }
  return result
}
