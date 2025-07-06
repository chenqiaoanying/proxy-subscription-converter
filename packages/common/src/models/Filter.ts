import {z} from "zod/v4";
import {regexString} from "./commonSchema";

export const FilterSchema = z.object({
    id: z.number(),
    tag: z.string().nonempty(),
    subscriptionIds: z.array(z.number()).optional(),
    includeTypes: z.array(z.string().nonempty()).optional(),
    excludeTypes: z.array(z.string().nonempty()).optional(),
    includePattern: regexString.optional().nullable(),
    excludePattern: regexString.optional().nullable(),
})

export const FilterCreateOrUpdateSchema = FilterSchema.omit({id: true});

export type Filter = z.infer<typeof FilterSchema>;
export type FilterCreateOrUpdate = z.infer<typeof FilterCreateOrUpdateSchema>;