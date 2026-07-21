import express from "express";
import authRoutes from "./routes/authRoutes.js";
import cookieParser from "cookie-parser";

const app = express();

app.use(cookieParser());

// Middleware for parse req body
app.use(express.json());
app.use(express.urlencoded());

// Routes for endpoints
app.use("/auth", authRoutes);

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    console.log(`Server is running at port: ${PORT}`)
});



// ==============================
// ---------For Database---------
// ==============================

// Hanldes unhandles promise rejections (e.g., database connection errors)
process.on("unhandledRejection", (err) => {
    server.close(async () => {
        await disconnectDb();
        process.exit(1);
    });
});

// Handle uncaught exception
process.on("uncaughtException", async (err) => {
    console.error("Uncaught Exception", err);
    await disconnectDb();
    process.exit(1);
});

// Gracefull shutdown
process.on("SIGTERM", async () => {
    console.log("SIGTERM received, shutting donw gracefully");
    server.close(async () => {
        await disconnectDb();
        process.exit(0);
    });
});