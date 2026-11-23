require("dotenv").config();
const app = require("./src/app");
const connectDatabase = require("./src/config/database");

const PORT = Number(process.env.PORT || 8080);

(async () => {
  try {
    await connectDatabase();
    app.listen(PORT, () => {
      console.log(`AI backend listening on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
})();