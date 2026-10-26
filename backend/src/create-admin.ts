import { createAdmin } from "./seed.js";

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error("Usage: npm run create-admin -- you@example.com 'a-long-password'");
  process.exit(1);
}
createAdmin(email, password);
console.log(`Admin ${email.toLowerCase()} saved (existing accounts get the new password).`);
