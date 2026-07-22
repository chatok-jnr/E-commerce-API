import express from "express";
import cookieParser from "cookie-parser";
import { errorHandler } from "./middleware/errorHandles.js";
import { AppError } from "./utils/AppError.js";
import { disconnectDb } from "./config/db.js"; // adjust path/export name to match your db.js
import { stripeWebhook } from "./controllers/webhookController.js";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";

const app = express();

app.use(cookieParser());

// This MUST be registered BEFORE express.json(), and needs express.raw()
app.post("/webhooks/stripe", express.raw({ type: "application/json" }), stripeWebhook);

// Middleware to parse req body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes for endpoints
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/categories", categoryRoutes);
app.use("/products", productRoutes);
app.use("/cart", cartRoutes);
app.use("/orders", orderRoutes);

// Catch-all for unmatched routes — keeps 404s in the same JSON shape as every other error
app.use((req, res, next) => {
    next(new AppError(`Route ${req.originalUrl} not found`, 404));
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    console.log(`Server is running at port: ${PORT}`);
});

// ==============================
// ---------For Database---------
// ==============================

// Handles unhandled promise rejections (e.g., database connection errors)
process.on("unhandledRejection", (err) => {
    console.error("Unhandled Rejection:", err);
    server.close(async () => {
        await disconnectDb();
        process.exit(1);
    });
});

// Handle uncaught exceptions
process.on("uncaughtException", async (err) => {
    console.error("Uncaught Exception:", err);
    await disconnectDb();
    process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
    console.log("SIGTERM received, shutting down gracefully");
    server.close(async () => {
        await disconnectDb();
        process.exit(0);
    });
});