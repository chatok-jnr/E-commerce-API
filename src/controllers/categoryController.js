import { prisma } from "../config/db.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/AppError.js";

export const createCategory = catchAsync(async (req, res) => {
    const { name, description } = req.body;

    if (!name) {
        throw new AppError('A name is required', 400);
    }

    const normalizedName = name.toUpperCase();

    const isExist = await prisma.category.findUnique({
        where: { name: normalizedName }
    });

    if (isExist) {
        throw new AppError('Category with this name already exist', 409);
    }

    const category = await prisma.category.create({
        data: { name: normalizedName, description }
    });

    return res.status(201).json({
        status: 'success',
        category
    });
});

export const getCategories = catchAsync(async (req, res) => {
    const categories = await prisma.category.findMany({});

    return res.status(200).json({
        status: 'success',
        categories
    });
});

export const getCategory = catchAsync(async (req, res) => {
    const normalizedName = req.params.name.toUpperCase();

    const category = await prisma.category.findUnique({
        where: { name: normalizedName },
        select: { name: true, description: true }
    });

    if (!category) {
        throw new AppError(`Category with ${req.params.name} name is not found`, 404);
    }

    return res.status(200).json({
        status: 'success',
        category
    });
});

export const updateCategory = catchAsync(async (req, res) => {
    const { description } = req.body;

    if (!description) {
        throw new AppError('Missing Description', 400);
    }

    const normalizedName = req.params.name.toUpperCase();

    const isExist = await prisma.category.findUnique({
        where: { name: normalizedName }
    });

    if (!isExist) {
        throw new AppError(`Category "${req.params.name}" not found`, 404);
    }

    await prisma.category.update({
        where: { name: normalizedName },
        data: { description }
    });

    return res.status(200).json({
        status: 'success',
        message: 'Update successfully'
    });
});

export const deleteCategory = catchAsync(async (req, res) => {
    const normalizedName = req.params.name.toUpperCase();

    const category = await prisma.category.findUnique({
        where: { name: normalizedName },
        include: { _count: { select: { products: true } } }
    });

    if (!category) {
        throw new AppError(`Category "${req.params.name}" not found`, 404);
    }

    // Block deletion if products still reference this category
    if (category._count.products > 0) {
        throw new AppError(
            `Cannot delete category "${category.name}" - it still has ${category._count.products} product(s) assigned. Reassign or delete them first.`,
            409
        );
    }

    await prisma.category.delete({ where: { name: normalizedName } });

    return res.status(200).json({
        status: 'success',
        message: `Category "${category.name}" deleted successfully`
    });
});