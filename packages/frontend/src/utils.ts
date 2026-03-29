import type { DeepReadonly } from 'vue'
import type { Filter, Subscription, Proxy } from '@psc/common'

export function formatBytes(bytes: number): string {
    if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(1) + ' GB'
    if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1) + ' MB'
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return bytes + ' B'
}

export function applyFilterToProxies(filter: DeepReadonly<Filter>, subscriptions: DeepReadonly<Subscription[]>): Proxy[] {
    const { subscriptionIds, proxyTypeFilterMode, proxyTypes, includePattern, excludePattern } = filter
    const parsedIncludeRegex = includePattern && includePattern.length > 0 ? new RegExp(includePattern) : null
    const parsedExcludeRegex = excludePattern && excludePattern.length > 0 ? new RegExp(excludePattern) : null
    const selectedSubscriptions = subscriptionIds == null || subscriptionIds.length === 0 ? subscriptions : subscriptions.filter(s => subscriptionIds.includes(s.id))
    return selectedSubscriptions.flatMap(sub =>
        sub.proxies.filter(proxy => {
            if (proxyTypes.length > 0 && proxyTypeFilterMode === 'include' && !proxyTypes.includes(proxy.type)) return false
            if (proxyTypes.length > 0 && proxyTypeFilterMode === 'exclude' && proxyTypes.includes(proxy.type)) return false
            if (parsedIncludeRegex && !parsedIncludeRegex.test(proxy.tag)) return false
            return !(parsedExcludeRegex && parsedExcludeRegex.test(proxy.tag))
        })
    ) as Proxy[]
}
