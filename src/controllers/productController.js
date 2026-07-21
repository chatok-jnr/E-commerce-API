import {prisma} from "../config/db.js";

export const createProduct = async(req, res) => {
    try{

       const {name, description, price, stock, categoryId} = req.body;

       if(!name || !price || !stock || !categoryId) {
        return res.status(400).json({
            status:"failed",
            message:'name, price, stock, category required'
        });
       }

       if(typeof price !== 'number' || typeof stock !== 'number') {
        return res.status(400).json({
            status:"failed",
            message:'price and stock must be numbers'
        });
       }

       if(stock < 0 || price < 1) {
        return res.status(400).json({
            status:'failed',
            message:'stock cannot be negative and price must be at least 1'
        });
       }

       const isCategoryExist = await prisma.category.findUnique({
        where: {
            id: categoryId
        }
       });

       if(!isCategoryExist) {
        return res.status(404).json({
            status: "Not found",
            message:'Enter a valid or available category'
        });
       }


       const product = await prisma.product.create({
            data:{
                name: name,
                description: description,
                price: price,
                stock: stock,
                ownerId: req.user.id,
                categoryId: categoryId
            }
       });

       return res.status(201).json({
        status:'success',
        message:'Product created successfully',
        product
       });

    } catch(e) {
        console.error(e);

        return res.status(500).json({
            status:"failed",
            error:process.env.NODE_ENV === 'production' 
                ? "Internal server error"
                : e.message
        });
    }
}

export const uploadImageForProduct = async (req, res) => {
    try{
        const {productId} = req.params;

        const product = await prisma.product.findUnique({
            where:{
                id: productId
            }
        });

        if(!product) {
            return res.status(404).json({
                status: 'failed',
                message: 'Product not found'
            });
        }

        if(!req.files || req.files.length === 0) {
            return res.status(400).json({
                status:'failed',
                message: 'No images provided'
            }); 
        }

        const imageRecords = await prisma.$transaction(
            req.files.map((file, index) => {
                prisma.productImage.create({
                    data:{
                        productId,
                        url: `/uploads/product-images/%{file.filename}`,
                        serialNo: index + 1
                    }
                });
            })
        );

        return res.status(201).json({
            status:'success',
            message:'Images uploaded successfully',
            images: imageRecords
        });
    } catch(e) {
        console.error(e);
        return res.status(500).json({
            status:'failed',
            error: process.env.NODE_ENV === 'production'
                ? "Inernal server error"
                : e.message
        });
    }
}