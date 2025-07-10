export class Lazy<T> {
    private instance: T | null = null;
    private readonly resolver: () => T;

    constructor(resolver: () => T) {
        this.resolver = resolver;
    }
    get value(): T {
        if (this.instance === null) {
            this.instance = this.resolver();
        }
        return this.instance;
    }
}

export class AsyncLazy<T> {
    private instance?: T;
    private initializing?: Promise<T>;

    private factory: () => Promise<T>;

    constructor(factory: () => Promise<T>) {
        this.factory = factory;
    }

    async getValue(): Promise<T> {
        if (this.instance !== undefined) {
            return this.instance;
        }
        if (!this.initializing) {
            this.initializing = this.factory().then((v) => {
                this.instance = v;
                return v;
            });
        }
        return this.initializing;
    }
}

/*
export function lazy(_target: any, key: string, descriptor: PropertyDescriptor) {
    const original = descriptor.get!;
    const privateProp = Symbol(key);
    descriptor.get = function () {
        if (!(privateProp in this)) {
            Object.defineProperty(this, privateProp, {
                value: original.call(this),
                writable: false,
                enumerable: false,
            });
        }
        return this[privateProp];
    };
}*/
