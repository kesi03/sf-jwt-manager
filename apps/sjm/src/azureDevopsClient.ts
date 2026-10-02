import axios, { AxiosInstance } from "axios";
import type { EnvConfig, VariablesPayload } from "./config";
import { buildNames } from "./naming";

export interface AzureDevOpsClientOptions {
  env: EnvConfig;
}

export class AzureDevOpsClient {
  private readonly http: AxiosInstance;
  private readonly env: EnvConfig;

  constructor(opts: AzureDevOpsClientOptions) {
    this.env = opts.env;
    const collectionUri = this.env.azdoOrgUrl.replace(/\/+$/, "");

    this.http = axios.create({
      baseURL: `${collectionUri}/${this.env.azdoProject}/_apis`,
      headers: {
        Authorization: `Basic ${Buffer.from(`:${this.env.azdoPat}`).toString("base64")}`
      }
    });
  }

  async uploadPrivateKeySecureFile(privateKeyPem: string): Promise<void> {
    const names = buildNames(this.env);
    const filename = names.secureFileName;
    const collectionUri = this.env.azdoOrgUrl.replace(/\/+$/, "");

    const url = `${collectionUri}/${this.env.azdoProject}/_apis/distributedtask/securefiles?api-version=7.2-preview.1`;

    const boundary = "----sf-jwt-manager-boundary";
    const body =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n` +
      privateKeyPem +
      `\r\n--${boundary}--\r\n`;

    await axios.post(url, body, {
      headers: {
        Authorization: this.http.defaults.headers.Authorization as string,
        "Content-Type": `multipart/form-data; boundary=${boundary}`
      }
    });
  }

  async listSecureFiles(): Promise<any[]> {
    const collectionUri = this.env.azdoOrgUrl.replace(/\/+$/, "");
    const url = `${collectionUri}/${this.env.azdoProject}/_apis/distributedtask/securefiles?api-version=7.2-preview.1`;
    const res = await axios.get(url, {
      headers: {
        Authorization: this.http.defaults.headers.Authorization as string
      }
    });
    return res.data.value ?? [];
  }

  async listSecureFilesByPrefix(prefix: string): Promise<any[]> {
    const files = await this.listSecureFiles();
    return files.filter((file: any) => String(file.name ?? "").startsWith(prefix));
  }

  async findSecureFileByName(name: string): Promise<any | null> {
    const files = await this.listSecureFiles();
    return files.find((f: any) => f.name === name) ?? null;
  }

  async deleteSecureFile(fileId: string): Promise<void> {
    const collectionUri = this.env.azdoOrgUrl.replace(/\/+$/, "");
    const url = `${collectionUri}/${this.env.azdoProject}/_apis/distributedtask/securefiles/${fileId}?api-version=7.2-preview.1`;
    await axios.delete(url, {
      headers: {
        Authorization: this.http.defaults.headers.Authorization as string
      }
    });
  }

  async replaceSecureFile(fileId: string, privateKeyPem: string): Promise<void> {
    await this.deleteSecureFile(fileId);
    await this.uploadPrivateKeySecureFile(privateKeyPem);
  }

  async createVariableGroup(vars: VariablesPayload): Promise<void> {
    const names = buildNames(this.env);
    const collectionUri = this.env.azdoOrgUrl.replace(/\/+$/, "");

    const url = `${collectionUri}/_apis/distributedtask/variablegroups?api-version=7.2-preview.1`;

    const payload = {
      name: names.variableGroupName,
      type: "Vsts",
      variables: {
        instanceUrl: { value: vars.instanceUrl },
        clientId: { value: vars.clientId },
        email: { value: vars.email },
        certName: { value: vars.certName }
      }
    };

    await axios.post(url, payload, {
      headers: {
        Authorization: this.http.defaults.headers.Authorization as string,
        "Content-Type": "application/json"
      }
    });
  }

  async listVariableGroups(): Promise<any[]> {
    const collectionUri = this.env.azdoOrgUrl.replace(/\/+$/, "");
    const url = `${collectionUri}/_apis/distributedtask/variablegroups?api-version=7.2-preview.1`;
    const res = await axios.get(url, {
      headers: {
        Authorization: this.http.defaults.headers.Authorization as string
      }
    });
    return res.data.value ?? [];
  }

  async listVariableGroupsByPrefix(prefix: string): Promise<any[]> {
    const groups = await this.listVariableGroups();
    return groups.filter((group: any) => String(group.name ?? "").startsWith(prefix));
  }

  async findVariableGroupByName(name: string): Promise<any | null> {
    const groups = await this.listVariableGroups();
    return groups.find((g: any) => g.name === name) ?? null;
  }

  async deleteVariableGroup(groupId: number): Promise<void> {
    const collectionUri = this.env.azdoOrgUrl.replace(/\/+$/, "");
    const url = `${collectionUri}/_apis/distributedtask/variablegroups/${groupId}?api-version=7.2-preview.1`;
    await axios.delete(url, {
      headers: {
        Authorization: this.http.defaults.headers.Authorization as string
      }
    });
  }
}
