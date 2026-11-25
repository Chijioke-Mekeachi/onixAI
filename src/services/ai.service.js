
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

  const preferredModel = process.env.AI_MODEL || "gemini-2.5-flash";

  const limit = Math.max(
    1,
    Math.min(Number(process.env.MAX_HISTORY_MESSAGES || 30), 100)
  );

  const maxRetries = 3;

  // Fetch conversation history
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

  // Fetch available models
  async function fetchAvailableModels() {
    try {
      const response = await fetch(`${baseUrl}/models`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        signal: AbortSignal.timeout(20000)
      });

      if (!response.ok) {
        throw new Error(`Models endpoint returned HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!Array.isArray(data.data)) {
        throw new Error("Invalid models response");
      }

      return data.data
        .map(item => item.id)
        .filter(Boolean);

    } catch (error) {
      console.error("Failed to fetch available models:", error.message);
      return [];
    }
  }

  const availableModels = await fetchAvailableModels();

  // Prefer configured model, then try all other models.
  const models = [
    preferredModel,
    ...availableModels.filter(model => model !== preferredModel)
  ];

  if (models.length === 0) {
    const error = new Error("No AI models are available");
    error.status = 503;
    throw error;
  }

  let answer = null;
  let successfulModel = null;
  const failures = [];

  // Try each model up to 3 times.
  for (const model of models) {
    console.log(`Trying AI model: ${model}`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `Model ${model}: attempt ${attempt}/${maxRetries}`
        );

        const response = await fetch(`${baseUrl}/chat/completions`, {
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

        const rawResponse = await response.text();

        let payload;

        try {
          payload = JSON.parse(rawResponse);
        } catch {
          payload = {};
        }

        if (!response.ok) {
          const providerMessage =
            payload?.error?.message ||
            `HTTP ${response.status}`;

          throw new Error(providerMessage);
        }

        const result = payload?.choices?.[0]?.message?.content;

        if (typeof result !== "string" || !result.trim()) {
          throw new Error("AI provider returned an empty response");
        }

        answer = result.trim();
        successfulModel = model;

        console.log(`AI response generated successfully using ${model}`);

        break;

      } catch (error) {
        console.error(
          `AI model ${model} failed (attempt ${attempt}/${maxRetries}):`,
          error.message
        );

        failures.push({
          model,
          attempt,
          error: error.message
        });

        if (attempt < maxRetries) {
          // Small delay before retrying.
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    }

    // Stop switching models when one succeeds.
    if (answer) {
      break;
    }

    console.warn(
      `Model ${model} exhausted all ${maxRetries} attempts. Switching models...`
    );
  }

  // All models failed.
  if (!answer) {
    console.error("All AI models failed:", failures);

    const error = new Error(
      "All available AI models failed. Please try again later."
    );

    error.status = 503;
    throw error;
  }

  // Save conversation only after successful generation.
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
      content: answer
    }
  ]);

  console.log(`Successful AI model: ${successfulModel}`);

  return answer;
}

module.exports = { generateReply };
