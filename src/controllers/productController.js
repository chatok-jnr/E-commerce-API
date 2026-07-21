import {prisma} from "../config/db.js";

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