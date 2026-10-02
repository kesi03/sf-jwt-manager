import axios, { AxiosInstance } from "axios";
import type { EnvConfig } from "./config";
import { buildNames } from "./naming";

export interface SalesforceClientOptions {
  env: EnvConfig;
  accessToken: string;
}

export async function resolveProfileId(
  http: Pick<AxiosInstance, "get">,
  profileName = "System Administrator"
): Promise<string> {
  const safeName = profileName.replace(/'/g, "\\'");
  const q = `SELECT Id, Name FROM Profile WHERE Name = '${safeName}' LIMIT 1`;
  const res = await http.get("/query", { params: { q } });
  const profile = res.data.records?.[0];

  if (!profile?.Id) {
    throw new Error(`Could not find Salesforce profile: ${profileName}`);
  }

  return profile.Id;
}

export class SalesforceClient {
  private readonly http: AxiosInstance;
  private readonly env: EnvConfig;

  constructor(opts: SalesforceClientOptions) {
    this.env = opts.env;
    this.http = axios.create({
      baseURL: `${this.env.sfInstanceUrl}/services/data/v${this.env.sfApiVersion}`,
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        "Content-Type": "application/json"
      }
    });
  }

  async getProfileId(): Promise<string> {
    if (this.env.sfProfileId) {
      return this.env.sfProfileId;
    }

    return resolveProfileId(this.http, this.env.sfProfileName);
  }

  async createUser(): Promise<string> {
    const names = buildNames(this.env);
    const profileId = await this.getProfileId();

    const payload = {
      Username: names.sfUsername,
      Alias: this.env.keyName.slice(0, 8),
      LastName: this.env.keyName,
      Email: names.sfUsername,
      TimeZoneSidKey: "Europe/Stockholm",
      LocaleSidKey: "sv_SE",
      EmailEncodingKey: "UTF-8",
      ProfileId: profileId
    };

    const res = await this.http.post("/sobjects/User", payload);
    return res.data.id;
  }

  async findUserByUsername(username: string): Promise<any | null> {
    const q = `SELECT Id, Username FROM User WHERE Username = '${username}'`;
    const res = await this.http.get(`/query`, {
      params: { q }
    });
    return res.data.records?.[0] ?? null;
  }

  async listUsersByPattern(prefix: string): Promise<any[]> {
    const q = `SELECT Id, Username, Email, Alias FROM User WHERE Username LIKE '${prefix}%'`;
    const res = await this.http.get("/query", { params: { q } });
    return res.data.records ?? [];
  }

  async createConnectedApp(): Promise<string> {
    const names = buildNames(this.env);

    const payload = {
      Name: names.connectedAppName,
      DeveloperName: names.connectedAppName.replace(/-/g, "_"),
      ContactEmail: names.sfUsername,
      Description: `JWT Integration for ${names.prefix}`,
      OptionsAllowAdminApprovedUsersOnly: true
      // TODO: add other Connected App fields as needed
    };

    const url = `${this.env.sfInstanceUrl}/services/data/v${this.env.sfApiVersion}/tooling/sobjects/ConnectedApplication`;
    const res = await axios.post(url, payload, {
      headers: {
        Authorization: this.http.defaults.headers.Authorization as string,
        "Content-Type": "application/json"
      }
    });

    return res.data.id;
  }

  async findConnectedAppByName(name: string): Promise<any | null> {
    const q = `SELECT Id, Name FROM ConnectedApplication WHERE Name = '${name}'`;
    const url = `${this.env.sfInstanceUrl}/services/data/v${this.env.sfApiVersion}/tooling/query`;
    const res = await axios.get(url, {
      params: { q },
      headers: {
        Authorization: this.http.defaults.headers.Authorization as string
      }
    });
    return res.data.records?.[0] ?? null;
  }

  async listConnectedAppsByPattern(prefix: string): Promise<any[]> {
    const q = `SELECT Id, Name, DeveloperName, CreatedDate FROM ConnectedApplication WHERE Name LIKE '${prefix}%'`;
    const url = `${this.env.sfInstanceUrl}/services/data/v${this.env.sfApiVersion}/tooling/query`;
    const res = await axios.get(url, {
      params: { q },
      headers: {
        Authorization: this.http.defaults.headers.Authorization as string
      }
    });
    return res.data.records ?? [];
  }

  async uploadPublicCertToConnectedApp(
    connectedAppId: string,
    publicCertPem: string
  ): Promise<void> {
    // NOTE: this is illustrative; adjust field names to match your org.
    const url = `${this.env.sfInstanceUrl}/services/data/v${this.env.sfApiVersion}/sobjects/ConnectedApplication/${connectedAppId}`;

    const payload = {
      // e.g. Certificate or similar field
      Certificate: publicCertPem
    };

    await axios.patch(url, payload, {
      headers: {
        Authorization: this.http.defaults.headers.Authorization as string,
        "Content-Type": "application/json"
      }
    });
  }

  async findCertificateByName(name: string): Promise<any | null> {
    const q = `SELECT Id, Name FROM UserAuthCertificate WHERE Name = '${name}'`;
    const res = await this.http.get("/query", { params: { q } });
    return res.data.records?.[0] ?? null;
  }

  async listCertificatesByPattern(prefix: string): Promise<any[]> {
    const q = `SELECT Id, Name, CreatedDate FROM UserAuthCertificate WHERE Name LIKE '${prefix}%'`;
    const res = await this.http.get("/query", { params: { q } });
    return res.data.records ?? [];
  }

  async updateCertificate(certId: string, newPublicPem: string): Promise<void> {
    await this.http.patch(`/sobjects/UserAuthCertificate/${certId}`, {
      CertificateChain: newPublicPem
    });
  }

  async deleteUser(userId: string): Promise<void> {
    await this.http.delete(`/sobjects/User/${userId}`);
  }

  async deleteConnectedApp(appId: string): Promise<void> {
    const url = `${this.env.sfInstanceUrl}/services/data/v${this.env.sfApiVersion}/tooling/sobjects/ConnectedApplication/${appId}`;
    await axios.delete(url, {
      headers: {
        Authorization: this.http.defaults.headers.Authorization as string
      }
    });
  }

  async deleteCertificate(certId: string): Promise<void> {
    await this.http.delete(`/sobjects/UserAuthCertificate/${certId}`);
  }
}
