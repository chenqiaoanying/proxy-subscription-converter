import {z} from "zod/v4";

export const regexString = z.string().pipe(z.transform((val, ctx) => {
    try {
        return RegExp(val);
    } catch (e) {
        ctx.issues.push({
            code: "custom",
            message: "非法的正则表达式",
            input: val,
        });
    }
}));