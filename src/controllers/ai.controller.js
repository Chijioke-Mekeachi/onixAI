const path = require("path");
const AISession = require("../models/AISession");
const AIConversation = require("../models/AIConversation");
const { createSession } = require("../services/session.service");
const { generateReply } = require("../services/ai.service");
const { hash } = require("../middleware/ai.middleware");
const { cookieOptions } = require("../utils/cookie");

const publicDir = path.join(__dirname, "..", "public", "ai");

async function start(req, res, next) {
  try {
    const { uuid, username } = req.body || {};
    if (typeof uuid !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)) {
      return res.status(400).json({ success: false, message: "A valid UUID is required" });
    }
    if (typeof username !== "string" || username.trim().length < 1 || username.trim().length > 80) {
      return res.status(400).json({ success: false, message: "Username must be between 1 and 80 characters" });
    }

    const data = await createSession({ userUuid: uuid, username: username.trim() });
    res.status(201).json({
      success: true,
      message: "AI session initialized successfully",
      data: {
        sessionId: data.sessionId,
        username: data.username,
        launchUrl: data.launchUrl,
        expiresAt: data.expiresAt
      }
    });
  } catch (error) { next(error); }
}

async function createToken(req, res, next) {
  try {
    const { username } = req.body || {};
    if (typeof username !== "string" || username.trim().length < 1 || username.trim().length > 80) {
      return res.status(400).json({ success: false, message: "Username must be between 1 and 80 characters" });
    }

    const { v4: uuidv4 } = require("uuid");
    const userUuid = uuidv4();
    const data = await createSession({ userUuid, username: username.trim() });

    const cookieName = process.env.COOKIE_NAME || "ai_session";
    res.cookie(cookieName, data.accessToken, cookieOptions(req, Math.max(0, data.expiresAt.getTime() - Date.now())));

    res.status(201).json({
      success: true,
      message: "Session token generated successfully",
      data: {
        token: data.launchToken,
        sessionId: data.sessionId,
        username: data.username,
        launchUrl: data.launchUrl,
        expiresAt: data.expiresAt
      }
    });
  } catch (error) { next(error); }
}

async function loadUi(req, res, next) {
  try {
    const token = req.query.token;
    const cookieName = process.env.COOKIE_NAME || "ai_session";

    if (typeof token === "string" && token.length >= 20) {
      const session = await AISession.findOneAndUpdate({
        launchTokenHash: hash(token),
        launchTokenConsumedAt: null,
        launchTokenExpiresAt: { $gt: new Date() },
        status: "active",
        expiresAt: { $gt: new Date() }
      }, { $set: { launchTokenConsumedAt: new Date() }, $unset: { launchTokenHash: 1 } }, { new: true })
        .select("+accessTokenHash");

      if (session) {
        // Rotate the access token at launch so the browser receives it only as an HttpOnly cookie.
        const accessToken = require("crypto").randomBytes(32).toString("base64url");
        session.accessTokenHash = hash(accessToken);
        await session.save();
        res.cookie(cookieName, accessToken, cookieOptions(req, Math.max(0, session.expiresAt.getTime() - Date.now())));
      }
    }

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.sendFile(path.join(publicDir, "index.html"), (err) => {
      if (err) next(err);
    });
  } catch (error) { next(error); }
}

async function bootstrap(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.json({ success: true, data: { sessionId: req.aiSession.sessionId, username: req.aiSession.username } });
}

async function sendMessage(req, res, next) {
  try {
    const message = req.body?.message;
    const maxLength = Number(process.env.MAX_MESSAGE_LENGTH || 8000);
    if (typeof message !== "string" || !message.trim() || message.length > maxLength) {
      return res.status(400).json({ success: false, message: `Message must contain 1-${maxLength} characters` });
    }
    const answer = await generateReply(req.aiSession, message.trim());
    res.json({ success: true, data: { message: answer } });
  } catch (error) { next(error); }
}

async function history(req, res, next) {
  try {
    if (req.params.sessionId !== req.aiSession.sessionId) {
      return res.status(403).json({ success: false, message: "You cannot access this conversation" });
    }
    const messages = await AIConversation.find({ sessionId: req.aiSession.sessionId })
      .sort({ timestamp: 1 }).limit(500).select("role content timestamp -_id").lean();
    res.json({ success: true, data: { messages } });
  } catch (error) { next(error); }
}

async function terminate(req, res, next) {
  try {
    if (req.params.sessionId !== req.aiSession.sessionId) {
      return res.status(403).json({ success: false, message: "You cannot terminate this session" });
    }
    req.aiSession.status = "terminated";
    await req.aiSession.save();
    res.clearCookie(process.env.COOKIE_NAME || "ai_session", cookieOptions(req, 0));
    res.json({ success: true, message: "AI session terminated" });
  } catch (error) { next(error); }
}

module.exports = { start, createToken, loadUi, bootstrap, sendMessage, history, terminate };