#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { loadEnv, buildVariablesPayload } from "./config";
import { buildNames } from "./naming";
import { AuditLog } from "./audit";
import { generateRsaKeyPair } from "./crypto";
import { SalesforceClient } from "./salesforceClient";
import { AzureDevOpsClient } from "./azureDevopsClient";

interface SetupArgs {
  sfAccessToken?: string;
}

type YargsBuilder = (y: any) => any;

function resolveSfAccessToken(argv: SetupArgs): string {
  const token = argv.sfAccessToken ?? process.env.SF_ACCESS_TOKEN;

  if (!token) {
    throw new Error(
      "Missing Salesforce OAuth access token. Provide --sf-access-token or set SF_ACCESS_TOKEN."
    );
  }

  return token;
}

const sfTokenOption: YargsBuilder = (y) =>
  y.option("sf-access-token", {
    type: "string",
    demandOption: false,
    describe: "Salesforce OAuth access token"
  });

yargs(hideBin(process.argv))
  .command<SetupArgs>(
    ["provision", "setup full"],
    "Create user, connected app, cert, secure file, variable group",
    sfTokenOption,
    async (argv: SetupArgs) => {
      const env = loadEnv();
      const names = buildNames(env);
      const audit = new AuditLog(env);
      const sfAccessToken = resolveSfAccessToken(argv);

      const sf = new SalesforceClient({ env, accessToken: sfAccessToken });
      const az = new AzureDevOpsClient({ env });

      try {
        console.log(`Provisioning integration: ${names.prefix}`);

        const userId = await sf.createUser();
        console.log(`Created Salesforce user: ${userId}`);

        const appId = await sf.createConnectedApp();
        console.log(`Created Connected App: ${appId}`);

        const { privateKeyPem, publicKeyPem } = generateRsaKeyPair();
        console.log("Generated RSA keypair.");

        await sf.uploadPublicCertToConnectedApp(appId, publicKeyPem);
        console.log("Uploaded public cert to Connected App.");

        await az.uploadPrivateKeySecureFile(privateKeyPem);
        console.log("Uploaded private key as secure file in Azure DevOps.");

        const vars = buildVariablesPayload(env, names.sfUsername, appId, names.certName);
        await az.createVariableGroup(vars);
        console.log("Created variable group in Azure DevOps.");

        audit.write({
          operation: "setup_full",
          success: true,
          details: {
            userId,
            connectedAppId: appId,
            certName: names.certName,
            secureFileName: names.secureFileName,
            variableGroupName: names.variableGroupName
          }
        });
      } catch (err: any) {
        audit.write({
          operation: "setup_full",
          success: false,
          details: { error: err?.message ?? String(err) }
        });
        console.error("Error during setup_full:", err?.message ?? err);
        process.exitCode = 1;
      }
    }
  )
  .command<SetupArgs>(
    ["rotate", "rotate keys"],
    "Generate new keypair and update Salesforce cert + Azure DevOps secure file",
    sfTokenOption,
    async (argv: SetupArgs) => {
      const env = loadEnv();
      const names = buildNames(env);
      const audit = new AuditLog(env);
      const sfAccessToken = resolveSfAccessToken(argv);

      const sf = new SalesforceClient({ env, accessToken: sfAccessToken });
      const az = new AzureDevOpsClient({ env });

      try {
        console.log(`Rotating keys for integration: ${names.prefix}`);

        const cert = await sf.findCertificateByName(names.certName);
        const file = await az.findSecureFileByName(names.secureFileName);

        if (!cert) throw new Error("Certificate not found");
        if (!file) throw new Error("Secure file not found");

        const { privateKeyPem, publicKeyPem } = generateRsaKeyPair();
        console.log("Generated new RSA keypair.");

        await sf.updateCertificate(cert.Id, publicKeyPem);
        console.log("Updated Salesforce certificate.");

        await az.replaceSecureFile(file.id, privateKeyPem);
        console.log("Replaced Azure DevOps secure file.");

        audit.write({
          operation: "rotate_keys",
          success: true,
          details: {
            certId: cert.Id,
            secureFileId: file.id,
            secureFileName: names.secureFileName
          }
        });
      } catch (err: any) {
        audit.write({
          operation: "rotate_keys",
          success: false,
          details: { error: err?.message ?? String(err) }
        });
        console.error("Error during rotate_keys:", err?.message ?? err);
        process.exitCode = 1;
      }
    }
  )
  .command<SetupArgs>(
    ["delete", "delete full"],
    "Delete user, connected app, cert, secure file, variable group",
    sfTokenOption,
    async (argv: SetupArgs) => {
      const env = loadEnv();
      const names = buildNames(env);
      const audit = new AuditLog(env);
      const sfAccessToken = resolveSfAccessToken(argv);

      const sf = new SalesforceClient({ env, accessToken: sfAccessToken });
      const az = new AzureDevOpsClient({ env });

      try {
        console.log(`Deleting integration: ${names.prefix}`);

        const user = await sf.findUserByUsername(names.sfUsername);
        const app = await sf.findConnectedAppByName(names.connectedAppName);
        const cert = await sf.findCertificateByName(names.certName);
        const file = await az.findSecureFileByName(names.secureFileName);
        const group = await az.findVariableGroupByName(names.variableGroupName);

        if (user) {
          await sf.deleteUser(user.Id);
          console.log(`Deleted user: ${user.Id}`);
        }
        if (app) {
          await sf.deleteConnectedApp(app.Id);
          console.log(`Deleted connected app: ${app.Id}`);
        }
        if (cert) {
          await sf.deleteCertificate(cert.Id);
          console.log(`Deleted certificate: ${cert.Id}`);
        }
        if (file) {
          await az.deleteSecureFile(file.id);
          console.log(`Deleted secure file: ${file.id}`);
        }
        if (group) {
          await az.deleteVariableGroup(group.id);
          console.log(`Deleted variable group: ${group.id}`);
        }

        audit.write({
          operation: "delete_full",
          success: true,
          details: {
            userId: user?.Id,
            connectedAppId: app?.Id,
            certId: cert?.Id,
            secureFileId: file?.id,
            variableGroupId: group?.id
          }
        });
      } catch (err: any) {
        audit.write({
          operation: "delete_full",
          success: false,
          details: { error: err?.message ?? String(err) }
        });
        console.error("Error during delete_full:", err?.message ?? err);
        process.exitCode = 1;
      }
    }
  )
  .command<SetupArgs>(
    "list integrations",
    "List Salesforce and Azure DevOps integration records as a table",
    sfTokenOption,
    async (argv: SetupArgs) => {
      const env = loadEnv();
      const names = buildNames(env);
      const sfAccessToken = resolveSfAccessToken(argv);
      const sf = new SalesforceClient({ env, accessToken: sfAccessToken });
      const az = new AzureDevOpsClient({ env });

      const [users, apps, certificates, secureFiles, variableGroups] = await Promise.all([
        sf.listUsersByPattern(names.prefix),
        sf.listConnectedAppsByPattern(names.prefix),
        sf.listCertificatesByPattern(names.prefix),
        az.listSecureFilesByPrefix(names.prefix),
        az.listVariableGroupsByPrefix(names.prefix)
      ]);

      const rows = users.length
        ? users.map((user: any) => ({
            username: user.Username,
            email: user.Email,
            userId: user.Id,
            connectedApp: apps.find((app: any) => app.Name === names.connectedAppName)?.Name ?? "—",
            certificate: certificates.find((cert: any) => cert.Name === names.certName)?.Name ?? "—",
            secureFile: secureFiles.find((file: any) => file.name === names.secureFileName)?.name ?? "—",
            variableGroup: variableGroups.find((group: any) => group.name === names.variableGroupName)?.name ?? "—"
          }))
        : [
            {
              username: "—",
              email: "—",
              userId: "—",
              connectedApp: apps.find((app: any) => app.Name === names.connectedAppName)?.Name ?? "—",
              certificate: certificates.find((cert: any) => cert.Name === names.certName)?.Name ?? "—",
              secureFile: secureFiles.find((file: any) => file.name === names.secureFileName)?.name ?? "—",
              variableGroup: variableGroups.find((group: any) => group.name === names.variableGroupName)?.name ?? "—"
            }
          ];

      console.table(rows);
    }
  )
  .command(
    "list azdo-securefiles",
    "List Azure DevOps secure files",
    () => {},
    async () => {
      const env = loadEnv();
      const az = new AzureDevOpsClient({ env });
      const files = await az.listSecureFiles();
      console.log(JSON.stringify(files, null, 2));
    }
  )
  .command(
    "list azdo-variablegroups",
    "List Azure DevOps variable groups",
    () => {},
    async () => {
      const env = loadEnv();
      const az = new AzureDevOpsClient({ env });
      const groups = await az.listVariableGroups();
      console.log(JSON.stringify(groups, null, 2));
    }
  )
  .demandCommand(1)
  .strict()
  .help()
  .parse();
