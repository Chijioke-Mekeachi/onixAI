const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const path = require("path");
const aiRoutes = require("./routes/ai.routes");

const app = express();
// Trust the first proxy hop (Cloudflare / ngrok / cloudflared tunnels set X-Forwarded-Proto)
app.set("trust proxy", 1);
const rawAllowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map(x => x.trim()).filter(Boolean);
const allowAllOrigins = rawAllowedOrigins.includes("*");
const allowedOrigins = allowAllOrigins ? [] : rawAllowedOrigins;
const frameAncestors = (process.env.FRAME_ANCESTORS || "'self'").split(/\s+/).filter(Boolean);

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameAncestors
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);                        // same-origin / non-browser
    if (allowAllOrigins) return callback(null, true);               // ALLOWED_ORIGINS=*
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS"));
  },
  credentials: true
}));
app.use(express.json({ limit: "20kb" }));
app.use(cookieParser());

app.get("/health", (req, res) => res.json({ success: true, status: "ok" }));
app.get("/", (req, res) => res.redirect("/api/v1/ai/ui"));
app.use("/api/v1/ai/assets", express.static(path.join(__dirname, "public", "ai"), {
  index: false,
  fallthrough: false,
  setHeaders(res) { res.setHeader("Cache-Control", "public, max-age=300"); }
}));
app.use("/api/v1/ai", aiRoutes);

app.use((req, res) => res.status(404).json({ success: false, message: "Route not found" }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error(error);
  const status = error.status || (error.type === "entity.parse.failed" ? 400 : 500);
  const isUpstreamOrConfig = status === 502 || status === 503;
  res.status(status).json({
    success: false,
    message: status >= 500 && !isUpstreamOrConfig ? "An unexpected server error occurred" : error.message
  });
});

module.exports = app;