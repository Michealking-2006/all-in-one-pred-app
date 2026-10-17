// Generates the secrets for the admin dashboard (/mingt-t).
//   node scripts/admin-setup.mjs "a long passphrase of your choice"
// Paste the printed lines into Vercel -> Project Settings -> Environment Variables
// (Production), then redeploy. Nothing is stored by this script.
import crypto from "node:crypto";
import { hashPassword } from "../api/_admin.js";

const password = process.argv[2];
if (!password || password.length < 12) {
  console.error('Usage: node scripts/admin-setup.mjs "a passphrase of at least 12 characters"');
  process.exit(1);
}

function base32(buffer) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "", out = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  for (let i = 0; i + 5 <= bits.length; i += 5) out += alphabet[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

const totpSecret = base32(crypto.randomBytes(20));
console.log("\nAdd these to Vercel (Production). Keep them secret.\n");
console.log("ADMIN_EMAIL=you@example.com            # optional: also required at sign-in");
console.log(`ADMIN_PASSWORD_HASH=${hashPassword(password)}`);
console.log(`ADMIN_SESSION_SECRET=${crypto.randomBytes(48).toString("base64url")}`);
console.log(`ADMIN_TOTP_SECRET=${totpSecret}`);
console.log("SUPABASE_SERVICE_ROLE_KEY=...           # Supabase -> Project Settings -> API (service_role, never in the app)");
console.log("\nTwo-factor: add the secret to an authenticator app (Google Authenticator, 1Password, Authy) as a");
console.log("time-based account, or open this link on your phone:\n");
console.log(`otpauth://totp/Scoutwave%20Admin?secret=${totpSecret}&issuer=Scoutwave\n`);
console.log("Then open /mingt-t on your site and sign in with the passphrase and the 6-digit code.\n");
