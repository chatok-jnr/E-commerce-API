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