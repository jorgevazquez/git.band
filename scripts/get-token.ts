// One-time helper that prints instructions for obtaining a Puter auth token.
//
// The published @heyputer/puter.js (v1.0.x) is browser-first and does not
// expose a programmatic `getAuthToken()` you can call from a headless Node
// process. The simplest reliable path is to grab the token from puter.com's
// Local Storage after signing in.

const lines = [
  "",
  "  Puter auth token — manual steps",
  "  ───────────────────────────────",
  "",
  "  1. Open https://puter.com/ in a regular browser and sign in.",
  "  2. Open DevTools (Cmd+Opt+I on macOS).",
  "  3. Go to Application → Storage → Local Storage → https://puter.com/.",
  "  4. Copy the value of the key:  puter.auth.token",
  "  5. Paste it into your .env file as:",
  "",
  "       PUTER_AUTH_TOKEN=<paste-here>",
  "",
  "  6. Also add the same value to your Claude Code MCP config under the",
  "     `puter-dalle` server's `env` block (see README.md).",
  "",
  "  Tokens are long-lived but can be revoked from puter.com → Settings.",
  "  If image generation later fails with an auth error, repeat these steps.",
  "",
];

process.stdout.write(lines.join("\n"));
