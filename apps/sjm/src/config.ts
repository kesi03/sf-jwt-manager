export interface EnvConfig {
  environment: string;      // dev/test/stage/prod
  keyName: string;
  azdoProject: string;

  sfInstanceUrl: string;
  sfApiVersion: string;
  sfProfileName: string;    // default: System Administrator
  sfProfileId?: string;     // optional if we can resolve it automatically

  azdoOrgUrl: string;
  azdoPat: string;
}

export function loadEnv(): EnvConfig {
  const azdoProject = process.env.AZDO_PROJECT ?? process.env.SYSTEM_TEAMPROJECT;
  const azdoOrgUrl = process.env.AZDO_ORG_URL ?? process.env.SYSTEM_COLLECTIONURI;
  const azdoPat = process.env.AZDO_PAT ?? process.env.SYSTEM_ACCESSTOKEN;
  const sfProfileName = process.env.SF_PROFILE_NAME ?? "System Administrator";

  const required = [
    "ENVIRONMENT",
    "KEY_NAME",
    "SF_INSTANCE_URL",
    "SF_API_VERSION"
  ];

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  if (!azdoProject) {
    throw new Error("Missing required Azure DevOps variable: AZDO_PROJECT or SYSTEM_TEAMPROJECT");
  }

  if (!azdoOrgUrl) {
    throw new Error("Missing required Azure DevOps variable: AZDO_ORG_URL or SYSTEM_COLLECTIONURI");
  }

  if (!azdoPat) {
    throw new Error("Missing required Azure DevOps variable: AZDO_PAT or SYSTEM_ACCESSTOKEN");
  }

  return {
    environment: process.env.ENVIRONMENT!,
    keyName: process.env.KEY_NAME!,
    azdoProject,
    sfInstanceUrl: process.env.SF_INSTANCE_URL!,
    sfApiVersion: process.env.SF_API_VERSION!,
    sfProfileName,
    sfProfileId: process.env.SF_PROFILE_ID,
    azdoOrgUrl,
    azdoPat
  };
}

export interface VariablesPayload {
  instanceUrl: string;
  clientId: string;
  email: string;
  certName: string;
}

export function buildVariablesPayload(
  env: EnvConfig,
  email: string,
  clientId: string,
  certName: string
): VariablesPayload {
  return {
    instanceUrl: env.sfInstanceUrl,
    clientId,
    email,
    certName
  };
}
