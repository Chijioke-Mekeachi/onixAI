const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const AISession = require("../models/AISession");
const { hash } = require("../middleware/ai.middleware");

function randomToken() {
  return crypto.randomBytes(32).toString("base64url");
}

async function createSession({ userUuid, username }) {
  const sessionId = uuidv4();
  const launchToken = randomToken();
  const accessToken = randomToken();
  const now = Date.now();
  const sessionMinutes = Number(process.env.SESSION_TTL_MINUTES || 120);
  const launchMinutes = Number(process.env.LAUNCH_TOKEN_TTL_MINUTES || 2);

  await AISession.create({
    userUuid,
    username,
    sessionId,
    status: "active",
    launchTokenHash: hash(launchToken),
    launchTokenExpiresAt: new Date(now + launchMinutes * 60_000),
    accessTokenHash: hash(accessToken),
    expiresAt: new Date(now + sessionMinutes * 60_000)
  });

  const publicBaseUrl = (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 8080}`).replace(/\/+$/, "");
  return {
    sessionId,
    username,
    launchToken,
    accessToken,
    launchUrl: `${publicBaseUrl}/api/v1/ai/ui?token=${encodeURIComponent(launchToken)}`,
    expiresAt: new Date(now + sessionMinutes * 60_000)
  };
}

module.exports = { createSession };