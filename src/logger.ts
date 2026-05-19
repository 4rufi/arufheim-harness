import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export interface LogEntry {
  timestamp: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export class JsonlLogger {
  constructor(private readonly repoPath: string) {}

  get logFilePath(): string {
    return path.join(this.repoPath, ".harness", "logs", "harness.jsonl");
  }

  async log(
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      eventType,
      payload,
    };

    await mkdir(path.dirname(this.logFilePath), { recursive: true });
    await appendFile(this.logFilePath, `${JSON.stringify(entry)}\n`, "utf8");
  }
}
