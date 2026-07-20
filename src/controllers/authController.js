import bcrypt from "bcrypt";
import crypto from "crypto";
import {prisma} from "../config/db.js";
import { genAccessToken, genRefreshToken } from "../utils/jwtService.js";

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
            path: "/auth",
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
            }
        });
        
        if(!user) {
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
        
        

        const roles = await prisma.userRole.findMany({
            where:{
                userId: user.id
            }
        });

        return res.status(201).json({
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
            path: "/auth",
            method: "post"
        });
    }
}