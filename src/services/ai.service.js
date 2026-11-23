
const AIConversation = require("../models/AIConversation");

async function generateReply(session, userMessage) {
  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) {
    const error = new Error("Missing AI_API_KEY configuration");
    error.status = 503;
    throw error;
  }

  const baseUrl = (
    process.env.AI_BASE_URL ||
    "https://generativelanguage.googleapis.com/v1beta/openai"
  ).replace(/\/+$/, "");

  const model = process.env.AI_MODEL || "gemini-2.5-flash";
  const limit = Math.max(
    1,
    Math.min(Number(process.env.MAX_HISTORY_MESSAGES || 30), 100)
  );

  const history = await AIConversation.find({
    sessionId: session.sessionId
  })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();

  history.reverse();

  const messages = [
    {
      role: "system",
      content:
        process.env.AI_SYSTEM_PROMPT ||
        "You are a helpful assistant."
    },
    ...history.map(item => ({
      role: item.role,
      content: item.content
    })),
    {
      role: "user",
      content: userMessage
    }
  ];

  let response;

  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
  model,
  messages,
  reasoning_effort: "low"
}),
signal: AbortSignal.timeout(120000)
    });
  } catch (cause) {
    console.error("AI provider connection failed:", cause);

    const error = new Error(
      "Unable to connect to the AI provider. Check network connectivity and API configuration."
    );
    error.status = 502;
    throw error;
  }

  const rawResponse = await response.text();

  let payload;

  try {
    payload = JSON.parse(rawResponse);
  } catch {
    payload = {};
  }

  if (!response.ok) {
    console.error("AI provider error:", {
      status: response.status,
      response: rawResponse
    });

    const error = new Error(
      payload?.error?.message ||
      `AI provider returned HTTP ${response.status}`
    );

    error.status = 502;
    throw error;
  }

  const answer = payload?.choices?.[0]?.message?.content;

  if (typeof answer !== "string" || !answer.trim()) {
    console.error("Unexpected AI provider response:", payload);

    const error = new Error("AI provider returned an empty response");
    error.status = 502;
    throw error;
  }

  await AIConversation.create([
    {
      sessionId: session.sessionId,
      userUuid: session.userUuid,
      role: "user",
      content: userMessage
    },
    {
      sessionId: session.sessionId,
      userUuid: session.userUuid,
      role: "assistant",
      content: answer.trim()
    }
  ]);

  return answer.trim();
}

module.exports = { generateReply };
