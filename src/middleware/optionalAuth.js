import jwt from "jsonwebtoken";
import {prisma} from "../config/db.js";

export const optionalAuth = async(req, res, next) => {
    try{
        const access_token = req.cookies.access_token;

        if(!access_token) {
            return next();
        }

        let decoded;

        try{
            decoded = jwt.verify(access_token, process.env.JWT_ACCESS_SECRET);
        } catch(e) {
            return next();
        }

        const user = await prisma.user.findUnique({
            where:{
                id:decoded.id
            },
            include:{
                roles: true
            }
        });

        if(user && !user.deletedAt) {
            const {password, ...safeUser} = user;
        }

        next();
    }catch(e) {
        console.error(e);
        next();
    }
}