import jwt from "jsonwebtoken";
import { prisma } from "../config/db.js";

export const optionalAuth = async (req, res, next) => {
    try {
        const access_token = req.cookies.access_token;

        if (!access_token) {
            return next();
        }

        let decoded;
        try {
            decoded = jwt.verify(access_token, process.env.JWT_ACCESS_SECRET);
        } catch (e) {
            // Invalid/expired token — treat as guest rather than blocking the request
            return next();
        }

        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            include: { roles: true }
        });

        if (user && !user.deletedAt) {
            const { password, ...safeUser } = user;
            req.user = safeUser;
        }

        next();
    } catch (e) {
        // Auth is optional here — never block the request over an unexpected error
        console.error(e);
        next();
    }
};