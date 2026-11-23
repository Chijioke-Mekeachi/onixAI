const crypto = require("crypto");
const AISession = require("../models/AISession");

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function requireIntegrationKey(req, res, next) {
  const configured = process.env.AI_INTEGRATION_API_KEY;
  if (!configured) {
    return res.status(503).json({ success: false, message: "AI integration is not configured" });
  }
  const supplied = req.get("x-ai-integration-key");
  if (!safeEqual(supplied, configured)) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  next();
}

async function requireSession(req, res, next) {
  try {
    const cookieName = process.env.COOKIE_NAME || "ai_session";
    const token = req.cookies?.[cookieName];
    if (!token) return res.status(401).json({ success: false, message: "AI session is not authenticated" });

    const session = await AISession.findOne({
      accessTokenHash: hash(token),
      status: "active",
      expiresAt: { $gt: new Date() }
    }).select("+accessTokenHash");

    if (!session) return res.status(401).json({ success: false, message: "AI session has expired or is invalid" });
    req.aiSession = session;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { hash, requireIntegrationKey, requireSession };