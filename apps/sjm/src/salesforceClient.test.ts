import test from "node:test";
import assert from "node:assert/strict";

import { resolveProfileId } from "./salesforceClient";

test("resolveProfileId returns the System Administrator profile id from SOQL", async () => {
  const http = {
    get: async (_url: string, options: { params: { q: string } }) => {
      assert.match(options.params.q, /System Administrator/);
      return {
        data: {
          records: [{ Id: "00e123456789ABC", Name: "System Administrator" }]
        }
      };
    }
  };

  const profileId = await resolveProfileId(http as any);
  assert.equal(profileId, "00e123456789ABC");
});

test("resolveProfileId throws when the profile does not exist", async () => {
  const http = {
    get: async () => ({ data: { records: [] } })
  };

  await assert.rejects(() => resolveProfileId(http as any, "Missing Profile"), {
    message: "Could not find Salesforce profile: Missing Profile"
  });
});
