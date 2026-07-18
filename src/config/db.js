import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
    log:
        process.env.NODE_ENV === "development"
            ? ["query", "error", "warn"]
            : ["error"],
});

const connectDb = async () => {
    try {
        await prisma.$connect();
        console.log("DB connected via Prisma");
    } catch (error) {
        console.error(`Database connection error: ${error.message}`);
        process.exit(1);
    }
};

const disconnectDb = async () => {
    await prisma.$disconnect();
};

export { prisma, connectDb, disconnectDb };