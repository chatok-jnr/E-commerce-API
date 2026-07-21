import {prisma} from "../config/db.js";

export const getMe = async (req, res) => {
    try{
        const user = req.user;
        return res.status(200).json({
            status:'success',
            user:{
                name: user.name,
                email: user.email,
                profileImage: user.profileImage || null,
                bio: user.bio || null,
                dob: user.dob || null,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                roles: user.roles
            }
        });
    } catch(e) {

        console.error(e);

        return res.status(500).json({
            status:'failed',
            error: process.env.NODE_ENV === 'production' 
            ? "Internal server error" 
            : e.message
        });
    }
}

export const updateMe = async (req, res) => {
    try{
        const {name, bio, dob, profileImage} = req.body;
        let updateData = {};
        if(name) updateData.name = name;
        if(bio) updateData.bio = bio;
        if(dob) updateData.dob = dob;
        if(profileImage) updateData.profileImage = profileImage;

        const user = await prisma.user.update({
            where:{
                id:req.user.id
            },
            data: updateData
        });

        const {password, deletedAt, ...safeUser} = user;

        return res.status(200).json({
            status:'success',
            user: safeUser
        });
    } catch(e) {
        console.error(e);

        return res.status(500).json({
            status:'failed',
            error: process.env.NODE_ENV === 'production'
            ? "Internal server error"
            : e.message
        });
    }
}

export const uploadMyProfileImage = async (req, res) => {
    try{
        if(!req.file) {
            return res.status(400).json({
                status: "failed",
                message: "No image file provided"
            });
        }

        const imageUrl = `/upload/profile-images/${req.file.filename}`;

        const user = await prisma.user.update({
            where: {
                id: req.user.id
            },
            data:{
                profileImage: imageUrl
            }
        });

        const {password, deleteAt, ...safeUser} = user;

        return res.status(200).json({
            status:'success',
            message: 'Profile image updated',
            user: safeUser
        });
    } catch(e) {
        console.error(e);

        return res.status(500).json({
            status:'failed',
            message: process.env.NODE_ENV === 'production'
                ? "Internal server error"
                : e.message
        });
    } 
}