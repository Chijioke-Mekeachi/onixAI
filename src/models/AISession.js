const mongoose = require("mongoose");

const aiSessionSchema = new mongoose.Schema({
  userUuid: { type: String, required: true, index: true },
  username: { type: String, required: true, trim: true },
  sessionId: { type: String, required: true, unique: true, index: true },
  status: { type: String, enum: ["active", "terminated", "expired"], default: "active", index: true },
  launchTokenHash: { type: String, default: null, select: false },
  launchTokenExpiresAt: { type: Date, default: null },
  launchTokenConsumedAt: { type: Date, default: null },
  accessTokenHash: { type: String, required: true, select: false },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }
}, { versionKey: false });

module.exports = mongoose.model("AISession", aiSessionSchema, "ai_sessions");