const express = require("express");
const rateLimit = require("express-rate-limit");
const controller = require("../controllers/ai.controller");
const { requireIntegrationKey, requireSession } = require("../middleware/ai.middleware");

const router = express.Router();
const messageLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Too many messages. Please wait a moment." }
});

const tokenLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Too many token requests. Please wait a moment." }
});

router.post("/start", requireIntegrationKey, controller.start);
router.post("/token", tokenLimiter, controller.createToken);
router.get("/ui", controller.loadUi);
router.get("/", controller.loadUi);
router.get("/history", requireSession, (req, res) => res.status(400).json({ success: false, message: "Use /session/:sessionId/history" }));
router.get("/bootstrap", requireSession, controller.bootstrap);
router.post("/message", requireSession, messageLimiter, controller.sendMessage);
router.get("/session/:sessionId/history", requireSession, controller.history);
router.delete("/session/:sessionId", requireSession, controller.terminate);

module.exports = router;