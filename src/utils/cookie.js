/**
 * Returns the right cookie options depending on whether the request
 * is arriving over HTTPS (e.g. a Cloudflare / ngrok tunnel) or plain HTTP
 * (local dev on localhost).
 *
 * Over HTTPS the cookie must be SameSite=None; Secure so browsers accept it
 * in cross-site iframes or cross-origin fetches.
 * Over HTTP (localhost) SameSite=Lax works fine and Secure must be false.
 */
function cookieOptions(req, maxAge) {
  const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";
  const configuredSameSite = process.env.COOKIE_SAME_SITE;

  // Allow full override from env, otherwise auto-detect
  const sameSite = configuredSameSite || (isSecure ? "none" : "lax");
  const secure = isSecure || process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: "/api/v1/ai",
    maxAge
  };
}

module.exports = { cookieOptions };