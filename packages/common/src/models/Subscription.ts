import {z} from "zod/v4";


export const ProxySchema = z.object({
    tag: z.string().nonempty(),
    type: z.string().transform((val) => val.toLowerCase()),
}).catchall(z.any());

export const DataUsageSchema = z.object({
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
    id: z.number(),
    name: z.string({message: '无效的名称'}).nonempty("名称不能为空"),
    url: z.url({message: "无效的URL"}),
    userAgent: z.string({message: "'无效的User-Agent'"}).optional(),
    dataUsage: DataUsageSchema.optional(),
    proxies: z.array(ProxySchema)
});

export const SubscriptionCreateOrUpdateSchema = SubscriptionSchema.omit({id: true, dataUsage: true, proxies: true});

export type Proxy = z.infer<typeof ProxySchema>;

export type DataUsage = z.infer<typeof DataUsageSchema>;

export type Subscription = z.infer<typeof SubscriptionSchema>;

export type SubscriptionCreateOrUpdate = z.input<typeof SubscriptionCreateOrUpdateSchema>;
