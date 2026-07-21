import {prisma} from "../config/db.js";
import jwt from "jsonwebtoken";

export const protect = async(req, res, next) => {
    try{
        const access_token = req.cookies.access_token;

        if(!access_token) {
            return res.status(401).json({
                status:'Unauthorized',
                message:"Please login in order to perform this operation"
            });
        }

        let decode;
        try{
            decode = jwt.verify(access_token, process.env.JWT_ACCESS_SECRET);
        } catch(e) {
            console.log(e);

            return res.status(401).json({
                status:'failed',
                message:'Invalid or expired access token, please log in'
            });
        }

        const user = await prisma.user.findUnique({
            where:{
                id: decode.id
            },
            include:{
                roles: true
            }
        });

        if(!user || user.deletedAt) {
            return res.status(401).json({
                status:'failed',
                message:'User no longer exists, please log in'
            });
        }

        const {password, ...safeUser} = user;

        req.user = safeUser;

        next();
    } catch(e) {
        console.error(e);

        return res.status(500).json({
            status:'failed',
            error: process.env.NODE_ENV === 'production'
            ? "Internal Server error"
            : e.message
        });
    }
}

export const requiredRole = (...allowedRoles) => {
   return (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                status: 'failed',
                message: 'Please log in to perform this operation'
            });
        }
        

        const userRoles = req.user.roles.map(r => r.role);
        const hasPermission = allowedRoles.some(role => userRoles.includes(role));

        if (!hasPermission) {
            return res.status(403).json({
                status: 'failed',
                message: 'You do not have permission to perform this action'
            });
        }

        next();
    } catch (e) {
        console.error(e);

        return res.status(500).json({
            status: 'failed',
            error: (process.env.NODE_ENV === 'production')
                ? "Internal server error"
                : e.message
        });
    }
   };
};