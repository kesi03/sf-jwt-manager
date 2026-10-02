import type { EnvConfig } from "./config";

export function buildPrefix(env: EnvConfig): string {
  return `${env.environment}-${env.keyName}-${env.azdoProject}`;
}

export function buildNames(env: EnvConfig) {
  const prefix = buildPrefix(env);

  return {
    prefix,
    sfUsername: `${prefix}@example.com`,
    connectedAppName: `${prefix}-jwt-app`,
    certName: `${prefix}-cert`,
    secureFileName: `${prefix}-private.pem`,
    variableGroupName: `${prefix}-jwt-vars`,
    auditLogFile: `audit-${prefix}.json`
  };
}
