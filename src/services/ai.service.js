const AIConversation = require("../models/AIConversation");

async function generateReply(session, userMessage) {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    const error = new Error("AI provider is not configured (missing AI_API_KEY)");
    error.status = 503;
    throw error;
  }

  const baseUrl = (process.env.AI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai").replace(/\/+$/, "");
  const model = process.env.AI_MODEL || "gemini-2.5-flash";
  const limit = Math.max(1, Math.min(Number(process.env.MAX_HISTORY_MESSAGES || 30), 100));

  const history = await AIConversation.find({ sessionId: session.sessionId })
    .sort({ timestamp: -1 }).limit(limit).lean();
  history.reverse();

  const messages = [
    { role: "system", content: process.env.AI_SYSTEM_PROMPT || "You are a helpful assistant." },
    ...history.map(item => ({ role: item.role, content: item.content })),
    { role: "user", content: userMessage }
  ];

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({ model, messages, temperature: 0.7 })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `AI provider returned HTTP ${response.status}`;
    const error = new Error(message);
    error.status = 502;
    throw error;
  }

  const answer = payload?.choices?.[0]?.message?.content;
  if (typeof answer !== "string" || !answer.trim()) {
    const error = new Error("AI provider returned an empty response");
    error.status = 502;
    throw error;
  }

  await AIConversation.create([
    { sessionId: session.sessionId, userUuid: session.userUuid, role: "user", content: userMessage },
    { sessionId: session.sessionId, userUuid: session.userUuid, role: "assistant", content: answer.trim() }
  ]);

  return answer.trim();
}

module.exports = { generateReply };