import { Router, Response } from 'express';
import { prisma } from '../db';
import { authenticate, requireAdminOrStaff } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

const WORK_STATUS_DISPLAY: Record<string, string> = {
  received: 'Recibido',
  diagnosing: 'Diagnosticando',
  in_repair: 'En Reparación',
  waiting_parts: 'Esperando Piezas',
  completed: 'Completado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

// ── INJECTOR PARTS ────────────────────────────────────────────────────────────

type PartRow = {
  id: number; name: string; description: string; partNumber: string;
  stock: number; minStock: number; price: unknown; isActive: boolean; createdAt: Date;
};

function fmtPart(p: PartRow) {
  return {
    id: p.id, name: p.name, description: p.description, part_number: p.partNumber,
    stock: p.stock, min_stock: p.minStock, price: p.price,
    is_active: p.isActive, is_low_stock: p.stock <= p.minStock, created_at: p.createdAt,
  };
}

// GET /api/injectors/parts/low_stock/ — before /:id/
router.get('/parts/low_stock/', authenticate, requireAdminOrStaff, async (_req: AuthRequest, res: Response): Promise<void> => {
  const parts = await prisma.injectorPart.findMany({ where: { isActive: true } });
  res.json(parts.filter(p => p.stock <= p.minStock).map(fmtPart));
});

// GET /api/injectors/parts/
router.get('/parts/', authenticate, requireAdminOrStaff, async (req: AuthRequest, res: Response): Promise<void> => {
  const where: Record<string, unknown> = { isActive: true };
  if (req.query.search) {
    const q = req.query.search as string;
    where.OR = [{ name: { contains: q } }, { partNumber: { contains: q } }];
    delete where.isActive;
    (where as Record<string, unknown>).AND = [{ isActive: true }];
  }
  const parts = await prisma.injectorPart.findMany({ where, orderBy: { name: 'asc' } });
  res.json(parts.map(fmtPart));
});

// POST /api/injectors/parts/
router.post('/parts/', authenticate, requireAdminOrStaff, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, description, part_number, stock, min_stock, price, is_active } = req.body as Record<string, unknown>;
  if (!name) { res.status(400).json({ detail: 'name es requerido.' }); return; }
  const p = await prisma.injectorPart.create({
    data: {
      name: name as string, description: (description as string) ?? '',
      partNumber: (part_number as string) ?? '', stock: (stock as number) ?? 0,
      minStock: (min_stock as number) ?? 2, price: (price as number) ?? 0,
      isActive: is_active !== undefined ? (is_active as boolean) : true,
    },
  });
  res.status(201).json(fmtPart(p));
});

// GET /api/injectors/parts/:id/
router.get('/parts/:id/', authenticate, requireAdminOrStaff, async (req: AuthRequest, res: Response): Promise<void> => {
  const p = await prisma.injectorPart.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!p) { res.status(404).json({ detail: 'Not found.' }); return; }
  res.json(fmtPart(p));
});

// PATCH /api/injectors/parts/:id/
router.patch('/parts/:id/', authenticate, requireAdminOrStaff, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, description, part_number, stock, min_stock, price, is_active } = req.body as Record<string, unknown>;
  try {
    const p = await prisma.injectorPart.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(name !== undefined ? { name: name as string } : {}),
        ...(description !== undefined ? { description: description as string } : {}),
        ...(part_number !== undefined ? { partNumber: part_number as string } : {}),
        ...(stock !== undefined ? { stock: stock as number } : {}),
        ...(min_stock !== undefined ? { minStock: min_stock as number } : {}),
        ...(price !== undefined ? { price: price as number } : {}),
        ...(is_active !== undefined ? { isActive: is_active as boolean } : {}),
      },
    });
    res.json(fmtPart(p));
  } catch { res.status(404).json({ detail: 'Not found.' }); }
});

// DELETE /api/injectors/parts/:id/
router.delete('/parts/:id/', authenticate, requireAdminOrStaff, async (req: AuthRequest, res: Response): Promise<void> => {
  try { await prisma.injectorPart.delete({ where: { id: parseInt(req.params.id) } }); res.status(204).send(); }
  catch { res.status(404).json({ detail: 'Not found.' }); }
});

// ── INJECTOR WORKS ────────────────────────────────────────────────────────────

type WorkRow = {
  id: number; customerName: string; customerPhone: string; customerEmail: string;
  customerId: number | null; vehicleMake: string; vehicleModel: string; vehicleYear: number | null;
  injectorQuantity: number; diagnosis: string; workDone: string; status: string;
  price: unknown; receivedAt: Date; completedAt: Date | null;
  assignedToId: number | null; notes: string;
  customer?: { firstName: string; lastName: string } | null;
  assignedTo?: { firstName: string; lastName: string } | null;
  partsUsed?: Array<{ id: number; partId: number; quantity: number; part?: { name: string } | null }>;
};

function fmtWork(w: WorkRow) {
  return {
    id: w.id, customer_name: w.customerName, customer_phone: w.customerPhone,
    customer_email: w.customerEmail, customer: w.customerId,
    vehicle_make: w.vehicleMake, vehicle_model: w.vehicleModel, vehicle_year: w.vehicleYear,
    injector_quantity: w.injectorQuantity, diagnosis: w.diagnosis, work_done: w.workDone,
    status: w.status, status_display: WORK_STATUS_DISPLAY[w.status] ?? w.status,
    price: w.price, received_at: w.receivedAt, completed_at: w.completedAt,
    assigned_to: w.assignedToId,
    assigned_to_name: w.assignedTo ? `${w.assignedTo.firstName} ${w.assignedTo.lastName}`.trim() : '',
    notes: w.notes,
    parts_used_detail: (w.partsUsed ?? []).map(u => ({
      id: u.id, part: u.partId, part_name: u.part?.name ?? '', quantity: u.quantity,
    })),
  };
}

const workInclude = { customer: true, assignedTo: true, partsUsed: { include: { part: true } } } as const;

// GET /api/injectors/works/stats/ — before /:id/
router.get('/works/stats/', authenticate, requireAdminOrStaff, async (_req: AuthRequest, res: Response): Promise<void> => {
  const today = new Date();
  const y = today.getFullYear(), m = today.getMonth();
  const [totalActive, inRepair, waitingParts, completedMonth] = await Promise.all([
    prisma.injectorWork.count({ where: { status: { notIn: ['delivered', 'cancelled'] } } }),
    prisma.injectorWork.count({ where: { status: 'in_repair' } }),
    prisma.injectorWork.count({ where: { status: 'waiting_parts' } }),
    prisma.injectorWork.count({
      where: {
        status: { in: ['completed', 'delivered'] },
        completedAt: { gte: new Date(y, m, 1), lte: new Date(y, m + 1, 0, 23, 59, 59) },
      },
    }),
  ]);
  res.json({ total_active: totalActive, in_repair: inRepair, waiting_parts: waitingParts, completed_this_month: completedMonth });
});

// GET /api/injectors/works/
router.get('/works/', authenticate, requireAdminOrStaff, async (req: AuthRequest, res: Response): Promise<void> => {
  const where: Record<string, unknown> = {};
  if (req.query.status) where.status = req.query.status as string;
  if (req.query.search) {
    const q = req.query.search as string;
    where.OR = [
      { customerName: { contains: q } },
      { customerPhone: { contains: q } },
      { vehicleMake: { contains: q } },
      { vehicleModel: { contains: q } },
    ];
  }
  const rows = await prisma.injectorWork.findMany({ where, include: workInclude, orderBy: { receivedAt: 'desc' } });
  res.json(rows.map(fmtWork));
});

// POST /api/injectors/works/
router.post('/works/', authenticate, requireAdminOrStaff, async (req: AuthRequest, res: Response): Promise<void> => {
  const b = req.body as Record<string, unknown>;
  if (!b.customer_name || !b.customer_phone || !b.vehicle_make || !b.vehicle_model) {
    res.status(400).json({ detail: 'customer_name, customer_phone, vehicle_make, vehicle_model son requeridos.' }); return;
  }
  const w = await prisma.injectorWork.create({
    data: {
      customerName: b.customer_name as string,
      customerPhone: b.customer_phone as string,
      customerEmail: (b.customer_email as string) ?? '',
      customerId: b.customer ? parseInt(b.customer as string) : null,
      vehicleMake: b.vehicle_make as string,
      vehicleModel: b.vehicle_model as string,
      vehicleYear: b.vehicle_year ? (b.vehicle_year as number) : null,
      injectorQuantity: (b.injector_quantity as number) ?? 1,
      diagnosis: (b.diagnosis as string) ?? '',
      workDone: (b.work_done as string) ?? '',
      status: (b.status as string) ?? 'received',
      price: (b.price as number) ?? 0,
      assignedToId: b.assigned_to ? parseInt(b.assigned_to as string) : null,
      notes: (b.notes as string) ?? '',
    },
    include: workInclude,
  });
  res.status(201).json(fmtWork(w));
});

// GET /api/injectors/works/:id/
router.get('/works/:id/', authenticate, requireAdminOrStaff, async (req: AuthRequest, res: Response): Promise<void> => {
  const w = await prisma.injectorWork.findUnique({ where: { id: parseInt(req.params.id) }, include: workInclude });
  if (!w) { res.status(404).json({ detail: 'Not found.' }); return; }
  res.json(fmtWork(w));
});

// PATCH /api/injectors/works/:id/update_status/ — before /:id/
router.patch('/works/:id/update_status/', authenticate, requireAdminOrStaff, async (req: AuthRequest, res: Response): Promise<void> => {
  const valid = ['received', 'diagnosing', 'in_repair', 'waiting_parts', 'completed', 'delivered', 'cancelled'];
  const b = req.body as Record<string, unknown>;
  if (!valid.includes(b.status as string)) { res.status(400).json({ status: 'Estado inválido.' }); return; }
  const completedAt = b.status === 'completed' ? new Date() : undefined;
  try {
    const w = await prisma.injectorWork.update({
      where: { id: parseInt(req.params.id) },
      data: {
        status: b.status as string,
        ...(completedAt ? { completedAt } : {}),
        ...(b.diagnosis !== undefined ? { diagnosis: b.diagnosis as string } : {}),
        ...(b.work_done !== undefined ? { workDone: b.work_done as string } : {}),
        ...(b.notes !== undefined ? { notes: b.notes as string } : {}),
        ...(b.price !== undefined ? { price: b.price as number } : {}),
      },
      include: workInclude,
    });
    res.json(fmtWork(w));
  } catch { res.status(404).json({ detail: 'Not found.' }); }
});

// PATCH /api/injectors/works/:id/
router.patch('/works/:id/', authenticate, requireAdminOrStaff, async (req: AuthRequest, res: Response): Promise<void> => {
  const b = req.body as Record<string, unknown>;
  try {
    const w = await prisma.injectorWork.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(b.customer_name !== undefined ? { customerName: b.customer_name as string } : {}),
        ...(b.customer_phone !== undefined ? { customerPhone: b.customer_phone as string } : {}),
        ...(b.customer_email !== undefined ? { customerEmail: b.customer_email as string } : {}),
        ...(b.vehicle_make !== undefined ? { vehicleMake: b.vehicle_make as string } : {}),
        ...(b.vehicle_model !== undefined ? { vehicleModel: b.vehicle_model as string } : {}),
        ...(b.vehicle_year !== undefined ? { vehicleYear: b.vehicle_year as number } : {}),
        ...(b.injector_quantity !== undefined ? { injectorQuantity: b.injector_quantity as number } : {}),
        ...(b.diagnosis !== undefined ? { diagnosis: b.diagnosis as string } : {}),
        ...(b.work_done !== undefined ? { workDone: b.work_done as string } : {}),
        ...(b.status !== undefined ? { status: b.status as string } : {}),
        ...(b.price !== undefined ? { price: b.price as number } : {}),
        ...(b.assigned_to !== undefined ? { assignedToId: b.assigned_to ? parseInt(b.assigned_to as string) : null } : {}),
        ...(b.notes !== undefined ? { notes: b.notes as string } : {}),
      },
      include: workInclude,
    });
    res.json(fmtWork(w));
  } catch { res.status(404).json({ detail: 'Not found.' }); }
});

// DELETE /api/injectors/works/:id/
router.delete('/works/:id/', authenticate, requireAdminOrStaff, async (req: AuthRequest, res: Response): Promise<void> => {
  try { await prisma.injectorWork.delete({ where: { id: parseInt(req.params.id) } }); res.status(204).send(); }
  catch { res.status(404).json({ detail: 'Not found.' }); }
});

export default router;
