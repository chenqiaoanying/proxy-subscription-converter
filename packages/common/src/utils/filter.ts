import type { ReadonlyDeep } from 'type-fest'
import type { Filter } from '../models/Filter'
import type { Subscription, Proxy } from '../models/Subscription'

export function applyFilterToProxies(filter: ReadonlyDeep<Filter>, subscriptions: ReadonlyDeep<Subscription[]>): Proxy[] {
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
    )
}
