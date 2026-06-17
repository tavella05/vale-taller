"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const storage = multer_1.default.diskStorage({
    destination: path_1.default.join(process.cwd(), 'media/products'),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = (0, multer_1.default)({ storage });
const router = (0, express_1.Router)();
function fmtCat(c) {
    return { id: c.id, name: c.name, description: c.description, product_count: c._count?.products ?? 0 };
}
const catInclude = { _count: { select: { products: { where: { isActive: true } } } } };
router.get('/categories/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (_req, res) => {
    const cats = await db_1.prisma.category.findMany({ orderBy: { name: 'asc' }, include: catInclude });
    res.json(cats.map(fmtCat));
});
router.post('/categories/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (req, res) => {
    const { name, description } = req.body;
    if (!name) {
        res.status(400).json({ detail: 'name es requerido.' });
        return;
    }
    const c = await db_1.prisma.category.create({ data: { name, description: description ?? '' }, include: catInclude });
    res.status(201).json(fmtCat(c));
});
router.get('/categories/:id/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (req, res) => {
    const c = await db_1.prisma.category.findUnique({ where: { id: parseInt(req.params.id) }, include: catInclude });
    if (!c) {
        res.status(404).json({ detail: 'Not found.' });
        return;
    }
    res.json(fmtCat(c));
});
router.put('/categories/:id/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (req, res) => {
    const { name, description } = req.body;
    try {
        const c = await db_1.prisma.category.update({ where: { id: parseInt(req.params.id) }, data: { name, description: description ?? '' }, include: catInclude });
        res.json(fmtCat(c));
    }
    catch {
        res.status(404).json({ detail: 'Not found.' });
    }
});
router.patch('/categories/:id/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (req, res) => {
    const { name, description } = req.body;
    try {
        const c = await db_1.prisma.category.update({
            where: { id: parseInt(req.params.id) },
            data: { ...(name !== undefined ? { name } : {}), ...(description !== undefined ? { description } : {}) },
            include: catInclude,
        });
        res.json(fmtCat(c));
    }
    catch {
        res.status(404).json({ detail: 'Not found.' });
    }
});
router.delete('/categories/:id/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (req, res) => {
    try {
        await db_1.prisma.category.delete({ where: { id: parseInt(req.params.id) } });
        res.status(204).send();
    }
    catch {
        res.status(404).json({ detail: 'Not found.' });
    }
});
function fmtProduct(p) {
    return {
        id: p.id, category: p.categoryId, category_name: p.category?.name ?? '',
        name: p.name, description: p.description, sku: p.sku,
        price: p.price, stock: p.stock, min_stock: p.minStock,
        image: p.image ? `/media/products/${path_1.default.basename(p.image)}` : null,
        is_active: p.isActive, is_low_stock: p.stock <= p.minStock,
        created_at: p.createdAt, updated_at: p.updatedAt,
    };
}
// GET /api/inventory/products/low_stock/ — before /:id/
router.get('/products/low_stock/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (_req, res) => {
    const all = await db_1.prisma.product.findMany({ where: { isActive: true }, include: { category: true } });
    res.json(all.filter(p => p.stock <= p.minStock).map(fmtProduct));
});
// GET /api/inventory/products/stats/ — before /:id/
router.get('/products/stats/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (_req, res) => {
    const all = await db_1.prisma.product.findMany({ where: { isActive: true } });
    res.json({
        total_products: all.length,
        low_stock_count: all.filter(p => p.stock <= p.minStock).length,
        out_of_stock: all.filter(p => p.stock === 0).length,
        total_value: all.reduce((sum, p) => sum + p.stock * Number(p.price), 0),
    });
});
// GET /api/inventory/products/
router.get('/products/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (req, res) => {
    const where = {};
    if (req.query.category)
        where.categoryId = parseInt(req.query.category);
    if (req.query.low_stock === 'true') {
        const all = await db_1.prisma.product.findMany({ where: { isActive: true, ...where }, include: { category: true } });
        res.json(all.filter(p => p.stock <= p.minStock).map(fmtProduct));
        return;
    }
    if (req.query.search) {
        const q = req.query.search;
        where.OR = [
            { name: { contains: q } },
            { sku: { contains: q } },
            { category: { name: { contains: q } } },
        ];
    }
    const products = await db_1.prisma.product.findMany({ where, include: { category: true }, orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }] });
    res.json(products.map(fmtProduct));
});
// POST /api/inventory/products/
router.post('/products/', auth_1.authenticate, auth_1.requireAdminOrStaff, upload.single('image'), async (req, res) => {
    const body = req.body;
    const { name, description, category, sku, price, stock, min_stock, is_active } = body;
    if (!name || !category) {
        res.status(400).json({ detail: 'name y category son requeridos.' });
        return;
    }
    const p = await db_1.prisma.product.create({
        data: {
            name, description: description ?? '', categoryId: parseInt(category),
            sku: sku ?? '', price: parseFloat(price ?? '0'), stock: parseInt(stock ?? '0'),
            minStock: parseInt(min_stock ?? '5'), isActive: is_active !== 'false',
            image: req.file ? req.file.path : null,
        },
        include: { category: true },
    });
    res.status(201).json(fmtProduct(p));
});
// GET /api/inventory/products/:id/
router.get('/products/:id/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (req, res) => {
    const p = await db_1.prisma.product.findUnique({ where: { id: parseInt(req.params.id) }, include: { category: true } });
    if (!p) {
        res.status(404).json({ detail: 'Not found.' });
        return;
    }
    res.json(fmtProduct(p));
});
// PATCH /api/inventory/products/:id/
router.patch('/products/:id/', auth_1.authenticate, auth_1.requireAdminOrStaff, upload.single('image'), async (req, res) => {
    const body = req.body;
    try {
        const p = await db_1.prisma.product.update({
            where: { id: parseInt(req.params.id) },
            data: {
                ...(body.name !== undefined ? { name: body.name } : {}),
                ...(body.description !== undefined ? { description: body.description } : {}),
                ...(body.category !== undefined ? { categoryId: parseInt(body.category) } : {}),
                ...(body.sku !== undefined ? { sku: body.sku } : {}),
                ...(body.price !== undefined ? { price: parseFloat(body.price) } : {}),
                ...(body.stock !== undefined ? { stock: parseInt(body.stock) } : {}),
                ...(body.min_stock !== undefined ? { minStock: parseInt(body.min_stock) } : {}),
                ...(body.is_active !== undefined ? { isActive: body.is_active !== 'false' } : {}),
                ...(req.file ? { image: req.file.path } : {}),
            },
            include: { category: true },
        });
        res.json(fmtProduct(p));
    }
    catch {
        res.status(404).json({ detail: 'Not found.' });
    }
});
// DELETE /api/inventory/products/:id/
router.delete('/products/:id/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (req, res) => {
    try {
        await db_1.prisma.product.delete({ where: { id: parseInt(req.params.id) } });
        res.status(204).send();
    }
    catch {
        res.status(404).json({ detail: 'Not found.' });
    }
});
function fmtMovement(m) {
    return {
        id: m.id, product: m.productId, product_name: m.product?.name ?? '',
        movement_type: m.movementType, quantity: m.quantity, reason: m.reason,
        created_at: m.createdAt, created_by: m.createdById,
        created_by_name: m.createdBy ? `${m.createdBy.firstName} ${m.createdBy.lastName}`.trim() : '',
    };
}
// GET /api/inventory/movements/
router.get('/movements/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (req, res) => {
    const where = {};
    if (req.query.product)
        where.productId = parseInt(req.query.product);
    const rows = await db_1.prisma.stockMovement.findMany({ where, include: { product: true, createdBy: true }, orderBy: { createdAt: 'desc' } });
    res.json(rows.map(fmtMovement));
});
// POST /api/inventory/movements/
router.post('/movements/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (req, res) => {
    const { product, movement_type, quantity, reason } = req.body;
    if (!product || !movement_type || quantity === undefined) {
        res.status(400).json({ detail: 'product, movement_type y quantity son requeridos.' });
        return;
    }
    const productId = parseInt(product);
    const qty = parseInt(quantity);
    const prod = await db_1.prisma.product.findUnique({ where: { id: productId } });
    if (!prod) {
        res.status(404).json({ detail: 'Producto no encontrado.' });
        return;
    }
    let newStock = prod.stock;
    if (movement_type === 'entry')
        newStock += qty;
    else if (movement_type === 'exit')
        newStock -= qty;
    else if (movement_type === 'adjustment')
        newStock = qty;
    const [movement] = await db_1.prisma.$transaction([
        db_1.prisma.stockMovement.create({
            data: { productId, movementType: movement_type, quantity: qty, reason: reason ?? '', createdById: req.user.userId },
            include: { product: true, createdBy: true },
        }),
        db_1.prisma.product.update({ where: { id: productId }, data: { stock: newStock } }),
    ]);
    res.status(201).json(fmtMovement(movement));
});
exports.default = router;
//# sourceMappingURL=inventory.js.map