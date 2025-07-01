import {z} from "zod/v4";
import {regexString} from "./commonSchema";

export const FilterSchema = z.object({
    tag: z.string().nonempty(),
    subscriptions: z.array(z.string()).optional(),
    includeTypes: z.array(z.string()).optional(),
    excludeTypes: z.array(z.string()).optional(),
    includePattern: regexString.optional().nullable(),
    excludePattern: regexString.optional().nullable(),
})
export type Filter = z.infer<typeof FilterSchema>;