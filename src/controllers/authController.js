import bcrypt from "bcrypt";
import crypto, { hash } from "crypto";
import {prisma} from "../config/db.js";
import { genAccessToken, genRefreshToken } from "../utils/jwtService.js";
import { error } from "console";
import jwt from "jsonwebtoken";

export const register = async (req, res) => {
    try{

        const {name, email, password, profileImage, bio, dob} = req.body;

         // Checking if all of the required fieled is available or not?
        if(!name || !email || !password) {
            return res.status(400).json({
                status:'failed',
                message:"name, email, password required"
            });
        }

        const isExist = await prisma.user.findUnique({
            where:{
                email: email
            }
        });

        if(isExist) {
            return res.status(409).json({
                message:"User with this email already exists"
            });
        }

        // Encrytpting password
        const salt = await bcrypt.genSalt(10);
        const hashPassword = await bcrypt.hash(password, salt); // encrypting password

        // Save user in db
        const user = await prisma.user.create({
            data:{
                name: name,
                email: email,
                profileImage: profileImage,
                password: hashPassword,
                bio: bio,
                dob: dob,
                roles: {
                    create: {role: "CUSTOMER"}
                }
            },
            include:{roles:true}
        });
    
        const {password: _, roles, ...safeUser} = user;

        const access_token = genAccessToken(user.id);
        const refresh_token = genRefreshToken(user.id);

        const hashedRefreshToken = crypto.createHash("sha256").update(refresh_token).digest("hex");
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await prisma.refreshToken.create({
            data:{
                userId: user.id,
                token: hashedRefreshToken,
                expiresAt: expiresAt
            }
        });

        res.cookie("access_token",access_token, {
            httpOnly: true,
            secure: (process.env.NODE_ENV === 'development' ? false : true),
            maxAge: 15 * 60 * 1000
        });

         res.cookie("refresh_token",refresh_token, {
            httpOnly: true,
            secure: (process.env.NODE_ENV === 'development' ? false : true),
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
    
        return res.status(201).json({
            status:'success',
            message:'Profile created successfully',
            user: {
                ...safeUser,
                role: roles.map(r => r.role)
            }
        });
    } catch(e) {
        console.error(e);

        if (e.code === 'P2002') {
            return res.status(409).json({
                status: 'failed',
                message: "User with this email already exists"
            });
        }

        return res.status(500).json({
            status: 'failed',
            error: (process.env.NODE_ENV === "development") ? e.message : "Internal Server Error",
            path: "/auth/register",
            method: "post"
        });
    }
}

export const login = async (req, res) => {
    try{
        const {email, password} = req.body;
        if(!email || !password) {
            return res.status(400).json({
                status:'failed',
                message:'email and password required'
            });
        }

        const user = await prisma.user.findUnique({
            where:{
                email: email
            },
            include:{
                roles: true
            }
        });
        
        if(!user) {

            await bcrypt.compare(password, "$2b$10$CwTycUXWue0Thq9StjUM0uJ8Z6r4z6q6z9b0.f8g0G8p4kX5q5q5q");

            return res.status(400).json({
                status:'failed',
                message:'wrong credential'
            });
        }

        if(user.deletedAt !== null) {
            return res.status(403).json({
                status:'failed',
                message:'This account no longer exists.'
            });
        }

        const isPassValid = await bcrypt.compare(password, user.password);

        if(!isPassValid) {
            return res.status(400).json({
                status:'failed',
                message:'wrong credential'
            });
        }

        const access_token = genAccessToken(user.id);
        const refresh_token = genRefreshToken(user.id);

        const hashedRefreshToken = crypto.createHash("sha256").update(refresh_token).digest("hex");
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await prisma.refreshToken.create({
            data:{
                userId: user.id,
                token: hashedRefreshToken,
                expiresAt: expiresAt
            }
        });

        res.cookie("access_token",access_token, {
            httpOnly: true,
            secure: (process.env.NODE_ENV === 'development' ? false : true),
            maxAge: 15 * 60 * 1000
        });

         res.cookie("refresh_token",refresh_token, {
            httpOnly: true,
            secure: (process.env.NODE_ENV === 'development' ? false : true),
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        
        
        return res.status(200).json({
            status:'success',
            message:'Login successfull',
            user: {
               id: user.id,
               name: user.name,
               email: user.email,
               bio: user.bio,
               profileImage: user.profileImage,
               dob: user.dob,
               createdAt: user.createdAt,
               updatedAt: user.updatedAt,
               role: user.roles.map(r => r.role)
            }
        });
    } catch(e) {
        console.error(e);

        return res.status(500).json({
            status: 'failed',
            error: (process.env.NODE_ENV === "development") ? e.message : "Internal Server Error",
            path: "/auth/login",
            method: "post"
        });
    }
}

export const logout = async (req, res) => {
    try {
        const refresh_token = req.cookies.refresh_token;

        if(refresh_token) {
            const hashedToken = crypto.createHash("sha256").update(refresh_token).digest("hex");
        
            await prisma.refreshToken.updateMany({
                where: {
                    token: hashedToken,
                    revoked: false
                },
                data:{
                    revoked: true
                }
            });
        }

        res.clearCookie("access_token");
        res.clearCookie("refresh_token");

        return res.status(200).json({
            status:'success',
            message:'Logged out successfully'
        });
    } catch(e) {
        console.error(e);

        return res.status(500).json({
            status:'failed',
            error: (process.env.NODE_ENV === 'development' ? e.message : "Internal server error"),
            path:"/auth/logout",
            method: "POST"
        });
    }
}

export const refresh = async (req, res) => {
    try{
        const incomingToken = req.cookies.refresh_token;

        if(!incomingToken) {
            return res.status(401).json({
                status:'failed',
                message:'Refresh token missing, please log in'
            });
        }

        let decode
        try {
            decode = jwt.verify(incomingToken, process.env.JWT_REFRESH_SECRET);
            console.log(`Debug = ${decode.id}`);
        } catch(e) {

            console.log(e);

            return res.status(401).json({
                status:'failed',
                message:'Invalid or expired refresh token, please log in'
            });
        }

        const hashedIncoming = crypto.createHash("sha256").update(incomingToken).digest("hex");

        const storedToken = await prisma.refreshToken.findUnique({
            where:{
                token: hashedIncoming
            }
        });

        if(!storedToken || storedToken.revoked || storedToken.expiresAt < new Date()) {
            if(storedToken) {
                await prisma.refreshToken.updateMany({
                    where: {userId: storedToken.userId},
                    data: {revoked: true}
                });
            }

            return res.status(401).json({
                status:'failed',
                message:'Invalid session, please login in again'
            });
        }

        // Rotat: revoke old, issue new
        const newAccessToken = genAccessToken(decode.id);
        const newRefreshToken = genRefreshToken(decode.id);
        const hashedNewToken = crypto.createHash("sha256").update(newRefreshToken).digest("hex");

        const newExpiresAt = new Date();
        newExpiresAt.setDate(newExpiresAt.getDate() + 7);

        await prisma.$transaction([
            prisma.refreshToken.update({
                where: {id: storedToken.id},
                data: {revoked: true}
            }),
            prisma.refreshToken.create({
                data: {
                    userId: decode.id,
                    token: hashedNewToken,
                    expiresAt: newExpiresAt
                }
            })
        ]);

        res.cookie("access_token", newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: "strict",
            maxAge: 15 * 60 * 1000
        });

        res.cookie("refresh_token", newRefreshToken, {
            httpOnly:true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        return res.status(200).json({
            status:'success',
            message: 'Token refreshed'
        });
    } catch(e) {

        console.error(e);

        return  res.status(500).json({
            status:'failed',
            error: (process.env.NODE_ENV === 'development' ? e.message : "Internal Server Error"),
            path:"/auth/refresh",
            method:"POST"
        });
    }
}