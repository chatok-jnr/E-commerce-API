import {prisma} from "../config/db.js";

export const createCategory = async (req, res) => {
    try{
        
       const {name, description} = req.body;

        if(!name) {
            return res.status(400).json({
                status: "Missing",
                message: "A name is required"
            });
        }

        const normalizedName = name.toUpperCase();

        const isExist = await prisma.category.findUnique({
            where: {
                name: normalizedName
            }
        });

        if(isExist) {
            return res.status(409).json({
                status:'Conflict',
                message:'Category with this name already exist'
            });
        }

        const category = await prisma.category.create({
            data:{
                name: normalizedName,
                description: description
            }
        });

        return res.status(201).json({
            status:'success',
            category            
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

export const getCategories = async (req, res) => {
    try{
        const categories = await prisma.category.findMany({
        });

        return res.status(200).json({
            status:'success',
            categories
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

export const getCategory = async(req, res) => {
    try{

        const normalizedName = req.params.name.toUpperCase();

        const category = await prisma.category.findUnique({
            where:{
                name: normalizedName
            },
            select:{
                name: true,
                description: true
            }
        });

        if(!category) {
            return res.status(404).json({
                status:"Not found",
                message:`Category with ${req.params.name} name is not found`
            });
        }

        return res.status(200).json({
            status:'success',
            category
        });
    } catch(e) {
        console.error(e);

        return res.status(500).json({
            status:'failed',
            message:process.env.NODE_ENV === 'production'
                ? "Internal server error"
                : e.message
        });
    }
}

export const updateCategory = async (req, res) => {
    try {
        const description = req.body.description;
        if(!description) {
            return res.status(400).json({
                status:'failed',
                message:'Missing Description'
            });
        }

        const normalizedName = req.params.name.toUpperCase();
        const isExist = await prisma.category.findUnique({
            where:{
                name: normalizedName
            }
        });

        if(!isExist) {
            return res.status(404).json({
                status:'failed',
                message: `Category "${req.params.name}" not found`
            });
        }

        await prisma.category.update({
            where:{
                name: normalizedName
            },
            data:{
                description: description
            }
        });

        return res.status(200).json({
            message:'Update successfully'
        });
    } catch(e) {
        console.error(e);

        return res.status(500).json({
            status:'failed',
            message:process.env.NODE_ENV === 'production'
                ? "Internal server error"
                : e.message
        });
    }
}


export const deleteCategory = async(req, res) => {
    try{

       const normalizedName = req.params.name.toUpperCase();
       
       const category = await prisma.category.findUnique({
            where:{
                name: normalizedName
            },
            include:{
                _count:{
                    select: {products: true}
                }
            }
       });

       if(!category) {
        return res.status(404).json({
            status: 'failed',
            message: `Category "${req.params.name}" not found`
        });
       }

       if(category._count.products > 0) {
        return res.status(409).json({
            status:'failed',
            message:`Cannot delete category "${category.name}" - it still has ${category._count.products} product(s) assigned. Reassign or delete them first.`
        });
       }

       await prisma.category.delete({
        where:{
            name: normalizedName
        }
       });

       return res.status(200).json({
        status:'success',
        message:`Category "${category.name}" deleted successfully`
       });
    } catch(e) {
        console.error(e);

        return res.status(500).json({
            status:'failed',
            messgae:process.env.NODE_ENV === 'production'
                ? "Internal server error"
                : e.message
        });
    }
}