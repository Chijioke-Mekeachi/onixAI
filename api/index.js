
require("dotenv").config();

const app = require("../src/app");
const connectDatabase = require("../src/config/database");

module.exports = async (req, res) => {
    try {
        await connectDatabase();
        return app(req, res);
    } catch (error) {
        console.error("Vercel database connection failed:", error);

        return res.status(503).json({
            success: false,
            message: "Database connection unavailable"
        });
    }
};
