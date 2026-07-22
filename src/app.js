import express from "express";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import categoreyRoutes from "./routes/categoryRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";

const app = express();

app.use(cookieParser());

// Middleware for parse req body
app.use(express.json());
app.use(express.urlencoded());

// Routes for endpoints
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/categories", categoreyRoutes);
app.use("/products", productRoutes);
app.use("/cart", cartRoutes);

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