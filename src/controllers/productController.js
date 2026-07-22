import {prisma} from "../config/db.js";

export const createProduct = async (req, res) => {
    try {
        const { name, description, price, stock, categoryId } = req.body;

        if (!name || !price || !stock || !categoryId) {
            return res.status(400).json({
                status: "failed",
                message: 'name, price, stock, category required'
            });
        }

        if (typeof price !== 'number' || typeof stock !== 'number') {
            return res.status(400).json({
                status: "failed",
                message: 'price and stock must be numbers'
            });
        }

        if (stock < 0 || price < 1) {
            return res.status(400).json({
                status: 'failed',
                message: 'stock cannot be negative and price must be at least 1'
            });
        }

        const isCategoryExist = await prisma.category.findUnique({
            where: { id: categoryId }
        });

        if (!isCategoryExist) {
            return res.status(404).json({
                status: "failed",
                message: 'Enter a valid or available category'
            });
        }

        const product = await prisma.product.create({
            data: {
                name,
                description,
                price,
                stock,
                ownerId: req.user.id,
                categoryId
            }
        });

        return res.status(201).json({
            status: 'success',
            message: 'Product created successfully',
            product
        });

    } catch (e) {
        console.error(e);
        return res.status(500).json({
            status: "failed",
            error: process.env.NODE_ENV === 'production' ? "Internal server error" : e.message
        });
    }
};

export const getProducts = async (req, res) => {
    try {
        const {
            categoryId,
            ownerId,
            search,
            minPrice,
            maxPrice,
            page = 1,
            limit = 20
        } = req.query;

        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);

        if (isNaN(pageNum) || pageNum < 1 || isNaN(limitNum) || limitNum < 1) {
            return res.status(400).json({
                status: 'failed',
                message: 'page and limit must be positive numbers'
            });
        }

        const where = { deletedAt: null };

        if (categoryId) where.categoryId = categoryId;
        if (ownerId) where.ownerId = ownerId;

        if (search) {
            where.name = {
                contains: search,
                mode: 'insensitive'
            };
        }

        if (minPrice || maxPrice) {
            where.price = {};
            if (minPrice) where.price.gte = parseFloat(minPrice);
            if (maxPrice) where.price.lte = parseFloat(maxPrice);
        }

        const skip = (pageNum - 1) * limitNum;

        const [products, totalCount] = await prisma.$transaction([
            prisma.product.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    name: true,
                    price: true,
                    stock: true,
                    owner: {
                        select: { name: true, id: true }
                    },
                    category: { select: { id: true, name: true } },
                    images: { orderBy: { serialNo: 'asc' } }
                }
            }),
            prisma.product.count({ where })
        ]);

        return res.status(200).json({
            status: 'success',
            products,
            pagination: {
                page: pageNum,
                limit: limitNum,
                totalCount,
                totalPages: Math.ceil(totalCount / limitNum)
            }
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({
            status: 'failed',
            error: process.env.NODE_ENV === 'production' ? "Internal server error" : e.message
        });
    }
};

export const getProduct = async (req, res) => {
    try {
        const product = await prisma.product.findUnique({
            where: {
                id: req.params.id,
                deletedAt: null
            },
            select: {
                id: true,
                name: true,
                description: true,
                price: true,
                stock: true,
                category: {
                    select: { id: true, name: true }
                },
                images: {
                    orderBy: { serialNo: 'asc' }
                }
            }
        });

        if (!product) {
            return res.status(404).json({
                status: 'failed',
                message: 'Product not found'
            });
        }

        return res.status(200).json({
            status: 'success',
            product
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({
            status: 'failed',
            error: process.env.NODE_ENV === 'production' ? "Internal server error" : e.message
        });
    }
};

export const uploadImageForProduct = async (req, res) => {
    try {
        const { productId } = req.params;

        const product = await prisma.product.findUnique({
            where: { id: productId }
        });

        if (!product) {
            return res.status(404).json({
                status: 'failed',
                message: 'Product not found'
            });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                status: 'failed',
                message: 'No images provided'
            });
        }

        const imageRecords = await prisma.$transaction(
            req.files.map((file, index) =>
                prisma.productImage.create({
                    data: {
                        productId,
                        url: `/uploads/product-images/${file.filename}`,
                        serialNo: index + 1
                    }
                })
            )
        );

        return res.status(201).json({
            status: 'success',
            message: 'Images uploaded successfully',
            images: imageRecords
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({
            status: 'failed',
            error: process.env.NODE_ENV === 'production' ? "Internal server error" : e.message
        });
    }
};

export const updateProduct = async (req, res) => {
    try {
        const product = await prisma.product.findUnique({
            where: {
                id: req.params.id,
                ownerId: req.user.id
            }
        });

        if (!product) {
            return res.status(404).json({
                status: 'failed',
                message: 'Product not found'
            });
        }

        const { name, description, price, stock, categoryId } = req.body;

        const updProd = {};
        if (name) updProd.name = name;
        if (description) updProd.description = description;
        if (price && price > 0) updProd.price = price;
        if (stock !== undefined && stock >= 0) updProd.stock = stock;

        if (categoryId) {
            const isExist = await prisma.category.findUnique({
                where: { id: categoryId },
                select: { id: true }
            });

            if (!isExist) {
                return res.status(404).json({
                    status: 'failed',
                    message: 'category not found'
                });
            }

            updProd.categoryId = categoryId;
        }

        const updatedProduct = await prisma.product.update({
            where: { id: req.params.id },
            data: updProd
        });

        return res.status(200).json({
            status: 'success',
            product: updatedProduct
        });

    } catch (e) {
        console.error(e);
        return res.status(500).json({
            status: 'failed',
            error: process.env.NODE_ENV === 'production' ? "Internal server error" : e.message
        });
    }
};

export const deleteProduct = async (req, res) => {
    try {
        const existProduct = await prisma.product.findUnique({
            where: {
                id: req.params.id,
                ownerId: req.user.id
            }
        });

        if (!existProduct) {
            return res.status(404).json({
                status: 'failed',
                message: 'Product not found'
            });
        }

        if (existProduct.deletedAt) {
            return res.status(409).json({
                status: "failed",
                message: 'Product already deleted'
            });
        }

        await prisma.product.update({
            where: { id: req.params.id },
            data: { deletedAt: new Date() }
        });

        return res.status(200).json({
            status: 'success',
            message: 'product deleted successfully'
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({
            status: 'failed',
            error: process.env.NODE_ENV === 'production' ? "Internal server error" : e.message
        });
    }
};