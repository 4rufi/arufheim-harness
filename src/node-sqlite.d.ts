declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    close(): void;
    prepare(sql: string): StatementSync;
    transaction<TArgs extends unknown[]>(
      fn: (...args: TArgs) => void,
    ): (...args: TArgs) => void;
  }

  export interface StatementSync {
    run(...params: unknown[]): unknown;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  }
}
