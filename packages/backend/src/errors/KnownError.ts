export class KnownError extends Error {
    constructor(message: string, cause?: unknown) {
        super(message, {
            cause
        });
        this.name = 'KnownError';
    }
}
