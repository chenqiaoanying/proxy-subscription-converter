import {z} from "zod/v4";

export const regexString = z.string().refine((val) => {
    try {
        RegExp(val);
        return true;
    } catch (e) {
        return false;
    }
}, {error: "非法的正则表达式"});