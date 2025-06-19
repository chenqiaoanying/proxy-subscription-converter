import {z} from "zod";


export const ProxySchema = z.object({
    tag: z.string(),
    type: z.string(),
}).catchall(z.any());

export const SubscriptionInfoSchema = z.object({
    total: z.coerce.number(),
    upload: z.coerce.number(),
    download: z.coerce.number(),
    expiredAt: z.preprocess((val) => {
        switch (typeof val) {
            case "number":
                return new Date(val);
            case "string":
                if (isNaN(parseInt(val)))
                    return new Date(parseInt(val));
                else
                    return val;
            default:
                return val;
        }
    }, z.coerce.date()),
});

export const SubscriptionSchema = z.object({
    name: z.string(),
    url: z.string().url(),
    dataUsage: SubscriptionInfoSchema.optional(),
    userAgent: z.string().optional(),
    proxies: z.array(ProxySchema)
});

export type ProxyDTO = z.infer<typeof ProxySchema>;

export type SubscriptionInfoDTO = z.infer<typeof SubscriptionInfoSchema>;

export type SubscriptionDTO = z.infer<typeof SubscriptionSchema>;
