export class Filter {
    tag: string = "";
    subscriptions: string[] = [];
    includeTypes: string[] = [];
    excludeTypes: string[] = [];
    includePattern: string | null = null;
    excludePattern: string | null = null;
}