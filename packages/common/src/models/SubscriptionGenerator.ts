import {z} from "zod/v4";

const Base = {
    id: z.number(),
    name: z.string().nonempty(),
    filterIds: z.array(z.number()).optional(),
};

const Json = {
    type: z.literal("json"),
    content: z.json(),
};

const Url = {
    type: z.literal("url"),
    url: z.string().nonempty(),
};

export const SubscriptionGeneratorSchema = z.discriminatedUnion("type", [
    z.object({...Base, ...Json}),
    z.object({...Base, ...Url}),
]);

export const SubscriptionGeneratorCreateSchema = z.discriminatedUnion("type", [
    z.object({...Base, ...Json}).omit({id: true}),
    z.object({...Base, ...Url}).omit({id: true}),
]);

export type SubscriptionGenerator = z.infer<typeof SubscriptionGeneratorSchema>;

export type SubscriptionGeneratorCreate = z.infer<typeof SubscriptionGeneratorCreateSchema>;