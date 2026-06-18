declare module "node:sqlite" {
  export interface RunResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  export class StatementSync {
    run(...params: Array<string | number | null>): RunResult;
    get(...params: Array<string | number | null>): unknown;
    all(...params: Array<string | number | null>): unknown[];
  }

  export class DatabaseSync {
    constructor(filename: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
