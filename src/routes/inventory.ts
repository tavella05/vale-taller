import { Router, Response } from 'express';
import path from 'path';
import multer from 'multer';
import { prisma } from '../db';
import { authenticate, requireAdminOrStaff } from '../middleware/auth';
import { AuthRequest } from '../types';

const storage = multer.diskStorage({
  destination: path.join(process.cwd(), 'media/products'),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

const router = Router();

// ── CATEGORIES ────────────────────────────────────────────────────────────────

type CatWithCount = { id: number; name: string; description: string; _count?: { products: number } };

function fmtCat(c: CatWithCount) {
  return { id: c.id, name: c.name, description: c.description, product_count: c._count?.products ?? 0 };
}

const catInclude = { _count: { select: { products: { where: { isActive: true } } } } } as const;

router.get('/categories/', authenticate, requireAdminOrStaff, async (_req: AuthRequest, res: Response): Promise<void> => {
  const cats = await prisma.category.findMany({ orderBy: { name: 'asc' }, include: catInclude });
  res.json(cats.map(fmtCat));
});

router.post('/categories/', authenticate, requireAdminOrStaff, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, description } = req.body as Record<string, string>;
  if (!name) { res.status(400).json({ detail: 'name es requerido.' }); return; }
  const c = await prisma.category.create({ data: { name, description: description ?? '' }, include: catInclude });
  res.status(201).json(fmtCat(c));
});

router.get('/categories/:id/', authenticate, requireAdminOrStaff, async (req: AuthRequest, res: Response): Promise<void> => {
  const c = await prisma.category.findUnique({ where: { id: parseInt(req.params.id) }, include: catInclude });
  if (!c) { res.status(404).json({ detail: 'Not found.' }); return; }
  res.json(fmtCat(c));
});

router.put('/categories/:id/', authenticate, requireAdminOrStaff, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, description } = req.body as Record<string, string>;
  try {
    const c = await prisma.category.update({ where: { id: parseInt(req.params.id) }, data: { name, description: description ?? '' }, include: catInclude });
    res.json(fmtCat(c));
  } catch { res.status(404).json({ detail: 'Not found.' }); }
});

router.patch('/categories/:id/', authenticate, requireAdminOrStaff, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, description } = req.body as Record<string, string | undefined>;
  try {
    const c = await prisma.category.update({
      where: { id: parseInt(req.params.id) },
      data: { ...(name !== undefined ? { name } : {}), ...(description !== undefined ? { description } : {}) },
      include: catInclude,
    });
    res.json(fmtCat(c));
  } catch { res.status(404).json({ detail: 'Not found.' }); }
});

router.delete('/categories/:id/', authenticate, requireAdminOrStaff, async (req: AuthRequest, res: Response): Promise<void> => {
  try { await prisma.category.delete({ where: { id: parseInt(req.params.id) } }); res.status(204).send(); }
  catch { res.status(404).json({ detail: 'Not found.' }); }
});

// ── PRODUCTS ──────────────────────────────────────────────────────────────────

type ProdWithCat = {
  id: number; categoryId: number; name: string; description: string; sku: string;
  price: unknown; stock: number; minStock: number; image: string | null;
  isActive: boolean; createdAt: Date; updatedAt: Date;
  category?: { name: string } | null;
};

function fmtProduct(p: ProdWithCat) {
  return {
    id: p.id, category: p.categoryId, category_name: p.category?.name ?? '',
    name: p.name, description: p.description, sku: p.sku,
    price: p.price, stock: p.stock, min_stock: p.minStock,
    image: p.image ? `/media/products/${path.basename(p.image)}` : null,
    is_active: p.isActive, is_low_stock: p.stock <= p.minStock,
    created_at: p.createdAt, updated_at: p.updatedAt,
  };
}

// GET /api/inventory/products/low_stock/ — before /:id/
router.get('/products/low_stock/', authenticate, requireAdminOrStaff, async (_req: AuthRequest, res: Response): Promise<void> => {
  const all = await prisma.product.findMany({ where: { isActive: true }, include: { category: true } });
  res.json(all.filter(p => p.stock <= p.minStock).map(fmtProduct));
});

// GET /api/inventory/products/stats/ — before /:id/
router.get('/products/stats/', authenticate, requireAdminOrStaff, async (_req: AuthRequest, res: Response): Promise<void> => {
  const all = await prisma.product.findMany({ where: { isActive: true } });
  res.json({
    total_products: all.length,
    low_stock_count: all.filter(p => p.stock <= p.minStock).length,
    out_of_stock: all.filter(p => p.stock === 0).length,
    total_value: all.reduce((sum, p) => sum + p.stock * Number(p.price), 0),
  });
});

// GET /api/inventory/products/
router.get('/products/', authenticate, requireAdminOrStaff, async (req: AuthRequest, res: Response): Promise<void> => {
  const where: Record<string, unknown> = {};
  if (req.query.category) where.categoryId = parseInt(req.query.category as string);
  if (req.query.low_stock === 'true') {
    const all = await prisma.product.findMany({ where: { isActive: true, ...where }, include: { category: true } });
    res.json(all.filter(p => p.stock <= p.minStock).map(fmtProduct));
    return;
  }
  if (req.query.search) {
    const q = req.query.search as string;
    where.OR = [
      { name: { contains: q } },
      { sku: { contains: q } },
      { category: { name: { contains: q } } },
    ];
  }
  const products = await prisma.product.findMany({ where, include: { category: true }, orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }] });
  res.json(products.map(fmtProduct));
});

// POST /api/inventory/products/
router.post('/products/', authenticate, requireAdminOrStaff, upload.single('image'), async (req: AuthRequest, res: Response): Promise<void> => {
  const body = req.body as Record<string, string>;
  const { name, description, category, sku, price, stock, min_stock, is_active } = body;
  if (!name || !category) { res.status(400).json({ detail: 'name y category son requeridos.' }); return; }
  const p = await prisma.product.create({
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
router.get('/products/:id/', authenticate, requireAdminOrStaff, async (req: AuthRequest, res: Response): Promise<void> => {
  const p = await prisma.product.findUnique({ where: { id: parseInt(req.params.id) }, include: { category: true } });
  if (!p) { res.status(404).json({ detail: 'Not found.' }); return; }
  res.json(fmtProduct(p));
});

// PATCH /api/inventory/products/:id/
router.patch('/products/:id/', authenticate, requireAdminOrStaff, upload.single('image'), async (req: AuthRequest, res: Response): Promise<void> => {
  const body = req.body as Record<string, string | undefined>;
  try {
    const p = await prisma.product.update({
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
  } catch { res.status(404).json({ detail: 'Not found.' }); }
});

// DELETE /api/inventory/products/:id/
router.delete('/products/:id/', authenticate, requireAdminOrStaff, async (req: AuthRequest, res: Response): Promise<void> => {
  try { await prisma.product.delete({ where: { id: parseInt(req.params.id) } }); res.status(204).send(); }
  catch { res.status(404).json({ detail: 'Not found.' }); }
});

// ── STOCK MOVEMENTS ───────────────────────────────────────────────────────────

type MovWithRel = {
  id: number; productId: number; movementType: string; quantity: number;
  reason: string; createdAt: Date; createdById: number | null;
  product?: { name: string } | null;
  createdBy?: { firstName: string; lastName: string } | null;
};

function fmtMovement(m: MovWithRel) {
  return {
    id: m.id, product: m.productId, product_name: m.product?.name ?? '',
    movement_type: m.movementType, quantity: m.quantity, reason: m.reason,
    created_at: m.createdAt, created_by: m.createdById,
    created_by_name: m.createdBy ? `${m.createdBy.firstName} ${m.createdBy.lastName}`.trim() : '',
  };
}

// GET /api/inventory/movements/
router.get('/movements/', authenticate, requireAdminOrStaff, async (req: AuthRequest, res: Response): Promise<void> => {
  const where: Record<string, unknown> = {};
  if (req.query.product) where.productId = parseInt(req.query.product as string);
  const rows = await prisma.stockMovement.findMany({ where, include: { product: true, createdBy: true }, orderBy: { createdAt: 'desc' } });
  res.json(rows.map(fmtMovement));
});

// POST /api/inventory/movements/
router.post('/movements/', authenticate, requireAdminOrStaff, async (req: AuthRequest, res: Response): Promise<void> => {
  const { product, movement_type, quantity, reason } = req.body as Record<string, unknown>;
  if (!product || !movement_type || quantity === undefined) {
    res.status(400).json({ detail: 'product, movement_type y quantity son requeridos.' }); return;
  }
  const productId = parseInt(product as string);
  const qty = parseInt(quantity as string);
  const prod = await prisma.product.findUnique({ where: { id: productId } });
  if (!prod) { res.status(404).json({ detail: 'Producto no encontrado.' }); return; }
  let newStock = prod.stock;
  if (movement_type === 'entry') newStock += qty;
  else if (movement_type === 'exit') newStock -= qty;
  else if (movement_type === 'adjustment') newStock = qty;
  const [movement] = await prisma.$transaction([
    prisma.stockMovement.create({
      data: { productId, movementType: movement_type as string, quantity: qty, reason: (reason as string) ?? '', createdById: req.user!.userId },
      include: { product: true, createdBy: true },
    }),
    prisma.product.update({ where: { id: productId }, data: { stock: newStock } }),
  ]);
  res.status(201).json(fmtMovement(movement));
});

export default router;
