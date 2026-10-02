import { generateKeyPairSync } from "crypto";

export interface KeyPair {
  privateKeyPem: string;
  publicKeyPem: string;
}

export function generateRsaKeyPair(): KeyPair {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem"
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem"
    }
  });

  return {
    privateKeyPem: privateKey,
    publicKeyPem: publicKey
  };
}
