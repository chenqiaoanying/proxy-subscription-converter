import {z} from "zod/v4";

const Base = {
    id: z.number(),
    name: z.string().nonempty(),
    filterIds: z.array(z.number()).optional(),
};

const Json = z.object({
    ...Base,
    type: z.literal("json"),
    content: z.union([z.json(), z.string()]).transform((val, ctx) => {
        try {
            switch (typeof val) {
                case "object":
                    return val;
                case "string":
                    return JSON.parse(val);
            }
        } catch (err) {
            ctx.addIssue({
                code: "custom",
                message: "Invalid JSON",
                input: val,
            })
        }
    }),
});

const Url = z.object({
    ...Base,
    type: z.literal("url"),
    url: z.url(),
});

export const SubscriptionGeneratorSchema = z.discriminatedUnion("type", [
    Json, Url,
]);

export const SubscriptionGeneratorCreateOrUpdateSchema = z.discriminatedUnion("type", [
    Json.omit({id: true}),
    Url.omit({id: true}),
]);

export type SubscriptionGenerator = z.infer<typeof SubscriptionGeneratorSchema>;

export type SubscriptionGeneratorCreateOrUpdate = z.input<typeof SubscriptionGeneratorCreateOrUpdateSchema>;
