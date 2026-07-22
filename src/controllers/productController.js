import { prisma } from "../config/db.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/AppError.js";

export const createProduct = catchAsync(async (req, res) => {
    const { name, description, price, stock, categoryId } = req.body;

    if (!name || !price || !stock || !categoryId) {
        throw new AppError('name, price, stock, category required', 400);
    }

    if (typeof price !== 'number' || typeof stock !== 'number') {
        throw new AppError('price and stock must be numbers', 400);
    }

    if (stock < 0 || price < 1) {
        throw new AppError('stock cannot be negative and price must be at least 1', 400);
    }

    const isCategoryExist = await prisma.category.findUnique({
        where: { id: categoryId }
    });

    if (!isCategoryExist) {
        throw new AppError('Enter a valid or available category', 404);
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
});

export const getProducts = catchAsync(async (req, res) => {
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
        throw new AppError('page and limit must be positive numbers', 400);
    }

    const where = { deletedAt: null };

    if (categoryId) where.categoryId = categoryId;
    if (ownerId) where.ownerId = ownerId;

    if (search) {
        where.name = { contains: search, mode: 'insensitive' };
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
                owner: { select: { name: true, id: true } },
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
});

export const getProduct = catchAsync(async (req, res) => {
    const product = await prisma.product.findUnique({
        where: { id: req.params.id, deletedAt: null },
        select: {
            id: true,
            name: true,
            description: true,
            price: true,
            stock: true,
            category: { select: { id: true, name: true } },
            images: { orderBy: { serialNo: 'asc' } }
        }
    });

    if (!product) {
        throw new AppError('Product not found', 404);
    }

    return res.status(200).json({
        status: 'success',
        product
    });
});

export const uploadImageForProduct = catchAsync(async (req, res) => {
    const { productId } = req.params;

    const product = await prisma.product.findUnique({ where: { id: productId } });

    if (!product) {
        throw new AppError('Product not found', 404);
    }

    if (!req.files || req.files.length === 0) {
        throw new AppError('No images provided', 400);
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
});

export const updateProduct = catchAsync(async (req, res) => {
    const product = await prisma.product.findUnique({
        where: { id: req.params.id, ownerId: req.user.id }
    });

    if (!product) {
        throw new AppError('Product not found', 404);
    }

    const { name, description, price, stock, categoryId } = req.body;

    // Build a partial update from only the fields that were provided
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
            throw new AppError('category not found', 404);
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
});

export const deleteProduct = catchAsync(async (req, res) => {
    const existProduct = await prisma.product.findUnique({
        where: { id: req.params.id, ownerId: req.user.id }
    });

    if (!existProduct) {
        throw new AppError('Product not found', 404);
    }

    if (existProduct.deletedAt) {
        throw new AppError('Product already deleted', 409);
    }

    // Soft delete — keep the row for historical order references
    await prisma.product.update({
        where: { id: req.params.id },
        data: { deletedAt: new Date() }
    });

    return res.status(200).json({
        status: 'success',
        message: 'product deleted successfully'
    });
});