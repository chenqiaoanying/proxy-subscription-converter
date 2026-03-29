import { z } from 'zod/v4'
import { regexString } from './commonSchema'

export const FilterSchema = z.object({
    id: z.number(),
    tag: z.string().nonempty(),
    type: z.enum(['selector', 'urltest']),
    subscriptionIds: z.array(z.number()).optional(),
    proxyTypeFilterMode: z.enum(['all', 'include', 'exclude']).default('all'),
    proxyTypes: z.union([z.array(z.string()), z.string().transform(val => [val])]).transform(val => val.flatMap(v => v.split(',').map(v => v.toLowerCase().trim())).filter(v => v.length > 0)),
    includePattern: regexString.optional().nullable(),
    excludePattern: regexString.optional().nullable(),
    options: z.record(z.string(), z.any()).optional(),
})

export const FilterCreateOrUpdateSchema = FilterSchema.omit({ id: true })

export type Filter = z.infer<typeof FilterSchema>
export type FilterCreateOrUpdate = z.infer<typeof FilterCreateOrUpdateSchema>
