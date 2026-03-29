import { z } from 'zod/v4'

const Base = {
    id: z.number(),
    name: z.string().nonempty(),
}

const Json = z.object({
    ...Base,
    type: z.literal('json'),
    content: z.union([z.json(), z.string()]).transform((val, ctx) => {
        try {
            switch (typeof val) {
                case 'object':
                    return val
                case 'string':
                    return JSON.parse(val)
            }
        } catch (err) {
            ctx.addIssue({
                code: 'custom',
                message: 'Invalid JSON',
                input: val,
            })
        }
    }),
})

const Url = z.object({
    ...Base,
    type: z.literal('url'),
    url: z.url(),
})

export const GeneratorSchema = z.discriminatedUnion('type', [Json, Url])
export const GeneratorCreateOrUpdateSchema = z.discriminatedUnion('type', [Json.omit({ id: true }), Url.omit({ id: true })])

export type Generator = z.infer<typeof GeneratorSchema>
export type GeneratorCreateOrUpdate = z.input<typeof GeneratorCreateOrUpdateSchema>
