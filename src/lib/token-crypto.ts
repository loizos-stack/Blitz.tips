import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * AES-256-GCM for OAuth tokens held in the database.
 *
 * Lifted out of x-api.ts when TikTok needed the same thing. Two copies of a
 * cipher is how one of them quietly ends up with a different IV length or a
 * missing auth tag, and the bug is invisible until something cannot be
 * decrypted months later.
 *
 * Each integration gets its own instance so it can have its own key override
 * while still falling back to AUTH_SECRET.
 */

export interface TokenCrypto {
  encrypt(plain: string): string;
  /** null on anything malformed — see below. */
  decrypt(blob: string): string | null;
}

/**
 * `envNames` are tried in order, first non-empty wins. Put the integration's
 * own override first and AUTH_SECRET last.
 */
export function makeTokenCrypto(envNames: string[], label: string): TokenCrypto {
  function key(): Buffer {
    const material = envNames.map((n) => process.env[n]).find((v) => v && v.length > 0);
    if (!material) {
      throw new Error(`No ${envNames.join(" or ")} — cannot encrypt ${label} tokens.`);
    }
    // SHA-256 of the secret gives exactly the 32 bytes AES-256 wants, whatever
    // length the secret happens to be.
    return createHash("sha256").update(material).digest();
  }

  return {
    /** iv:tag:ciphertext, all base64url. Self-describing, so no schema changes. */
    encrypt(plain: string): string {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key(), iv);
      const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
      return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64url")).join(":");
    },

    /**
     * Returns null rather than throwing on anything malformed — a rotated
     * AUTH_SECRET makes every stored token undecryptable, and that should
     * surface as "reconnect the account", not as a 500 on the admin page.
     */
    decrypt(blob: string): string | null {
      try {
        const [ivB64, tagB64, dataB64] = blob.split(":");
        if (!ivB64 || !tagB64 || !dataB64) return null;
        const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64url"));
        decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
        return Buffer.concat([
          decipher.update(Buffer.from(dataB64, "base64url")),
          decipher.final(),
        ]).toString("utf8");
      } catch {
        return null;
      }
    },
  };
}
