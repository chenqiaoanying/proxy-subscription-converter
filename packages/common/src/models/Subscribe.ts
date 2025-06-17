export class Proxy {
    tag: string;
    type: string;

    [key: string]: any;

    constructor(data: Record<string, any>) {
        this.tag = data.tag;
        this.type = data.type;
        Object.assign(this, data);
    }
}