// Prints a Web Push (VAPID) key pair. Run once:  node scripts/generate-vapid.mjs
// Put the three lines in Vercel's environment variables and redeploy. Keep the private key secret
// and never change it later (devices that subscribed with the old public key would stop receiving alerts).
import crypto from "node:crypto";
const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const jwk = privateKey.export({ format: "jwk" });
const b64url = (buf) => Buffer.from(buf).toString("base64url");
const pub = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]);
void publicKey;
console.log(`VAPID_PUBLIC_KEY=${b64url(pub)}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
console.log("VAPID_SUBJECT=mailto:you@example.com   # change to a real contact address for your site");
