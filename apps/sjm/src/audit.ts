import fs from "fs";
import path from "path";
import type { EnvConfig } from "./config";
import { buildNames } from "./naming";

export interface AuditEntry {
  timestamp?: string;
  environment?: string;
  operation: string;
  success: boolean;
  details: any;
}

export class AuditLog {
  private readonly filePath: string;
  private readonly env: EnvConfig;

  constructor(env: EnvConfig) {
    this.env = env;
    const names = buildNames(env);
    this.filePath = path.join(process.cwd(), names.auditLogFile);

    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, "[]", "utf-8");
    }
  }

  write(entry: AuditEntry): void {
    const content = fs.readFileSync(this.filePath, "utf-8");
    const arr = JSON.parse(content) as unknown[];

    arr.push({
      ...entry,
      timestamp: new Date().toISOString(),
      environment: this.env.environment
    });

    fs.writeFileSync(this.filePath, JSON.stringify(arr, null, 2), "utf-8");
  }
}
