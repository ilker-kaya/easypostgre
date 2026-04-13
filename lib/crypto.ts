import { createHash, randomBytes } from "crypto";

export function generateSecret(length = 32) {
  return randomBytes(length).toString("hex");
}

export function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
