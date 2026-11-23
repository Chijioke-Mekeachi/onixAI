const mongoose = require("mongoose");

const aiConversationSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  userUuid: { type: String, required: true, index: true },
  role: { type: String, enum: ["user", "assistant"], required: true },
  content: { type: String, required: true, maxlength: 20000 },
  timestamp: { type: Date, default: Date.now, index: true }
}, { versionKey: false });

aiConversationSchema.index({ sessionId: 1, timestamp: 1 });

module.exports = mongoose.model("AIConversation", aiConversationSchema, "ai_conversations");