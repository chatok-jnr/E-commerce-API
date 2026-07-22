import { prisma } from "../config/db.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/AppError.js";

export const getMe = catchAsync(async (req, res) => {
    const user = req.user;

    return res.status(200).json({
        status: 'success',
        user: {
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
});

export const updateMe = catchAsync(async (req, res) => {
    const { name, bio, dob, profileImage } = req.body;

    // Build a partial update from only the fields that were provided
    const updateData = {};
    if (name) updateData.name = name;
    if (bio) updateData.bio = bio;
    if (dob) updateData.dob = dob;
    if (profileImage) updateData.profileImage = profileImage;

    const user = await prisma.user.update({
        where: { id: req.user.id },
        data: updateData
    });

    const { password, deletedAt, ...safeUser } = user;

    return res.status(200).json({
        status: 'success',
        user: safeUser
    });
});

export const uploadMyProfileImage = catchAsync(async (req, res) => {
    if (!req.file) {
        throw new AppError('No image file provided', 400);
    }

    const imageUrl = `/upload/profile-images/${req.file.filename}`;

    const user = await prisma.user.update({
        where: { id: req.user.id },
        data: { profileImage: imageUrl }
    });

    const { password, deletedAt, ...safeUser } = user;

    return res.status(200).json({
        status: 'success',
        message: 'Profile image updated',
        user: safeUser
    });
});