# AI Assistant Backend

Node.js + Express + MongoDB backend. It hosts a minimal HTML/CSS/JavaScript chat UI and exposes it through an iframe launch URL.

## Requirements

- Node.js 20+
- MongoDB (local or Atlas)
- An OpenAI-compatible chat-completions API key

## Run locally

```bash
npm install
cp .env.example .env
```

Edit `.env` and set at least:

- `MONGODB_URI`
- `AI_INTEGRATION_API_KEY` — a long random secret used only by your trusted main backend
- `AI_API_KEY`
- `AI_MODEL`
- `AI_SYSTEM_PROMPT`
- `ALLOWED_ORIGINS` and `FRAME_ANCESTORS`

Then:

```bash
npm run dev
```

Health check: `GET http://localhost:8080/health`

## Main application integration

Call this endpoint from your **trusted main application backend**, not directly from browser JavaScript. The integration key must never be exposed in the frontend bundle.

```bash
curl -X POST http://localhost:8080/api/v1/ai/start \
  -H "Content-Type: application/json" \
  -H "x-ai-integration-key: YOUR_AI_INTEGRATION_API_KEY" \
  -d '{"uuid":"550e8400-e29b-41d4-a716-446655440000","username":"Trevor"}'
```

The response contains `data.launchUrl`. Return that URL to your authenticated frontend and set it as the iframe `src`:

```jsx
<iframe
  src={launchUrl}
  title="AI Assistant"
  style={{ width: "100%", height: "650px", border: 0, borderRadius: "12px" }}
  allow="clipboard-write"
/>
```

The launch URL contains a single-use token that expires quickly. The UI endpoint consumes it and sets an HttpOnly session cookie. Do not store or reuse the launch URL.

## API

All API routes use `/api/v1/ai`.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/start` | Create session; requires `x-ai-integration-key` |
| GET | `/ui?token=...` | Consume launch token and serve iframe UI |
| POST | `/message` | Send a message; requires iframe session cookie |
| GET | `/session/:sessionId/history` | Retrieve own session history |
| DELETE | `/session/:sessionId` | Terminate own session |

The UI assets are served under `/api/v1/ai/assets/`.

## Data

- `ai_sessions`: user UUID, username, session ID, status, token hashes and expiry.
- `ai_conversations`: one document per user/assistant message.

A TTL index removes expired session documents. Conversation documents are retained unless you configure a retention policy.

## Security notes

1. A UUID and username are identifiers, not proof of identity. The main application backend must authenticate the user and verify that the UUID belongs to that user before calling `/start`.
2. Keep `AI_INTEGRATION_API_KEY` and `AI_API_KEY` on the server only.
3. Restrict `ALLOWED_ORIGINS` and `FRAME_ANCESTORS` to your real frontend origins.
4. Use HTTPS in production. Cross-site iframe cookies may be blocked by browser third-party-cookie policies; prefer serving the app and API on the same site.
5. Add your application's real user-database verification inside `start` before creating a session. This project cannot verify a UUID against an unspecified external user collection.
6. Configure backup, monitoring, and a conversation retention/deletion policy before production use.

## Notes

The AI provider integration uses the OpenAI-compatible `/chat/completions` endpoint. For a provider with a different API contract, update `src/services/ai.service.js`.
# onixAI
# onixAI
