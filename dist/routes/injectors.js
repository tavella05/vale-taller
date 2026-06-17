"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const WORK_STATUS_DISPLAY = {
    received: 'Recibido',
    diagnosing: 'Diagnosticando',
    in_repair: 'En Reparación',
    waiting_parts: 'Esperando Piezas',
    completed: 'Completado',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
};
function fmtPart(p) {
    return {
        id: p.id, name: p.name, description: p.description, part_number: p.partNumber,
        stock: p.stock, min_stock: p.minStock, price: p.price,
        is_active: p.isActive, is_low_stock: p.stock <= p.minStock, created_at: p.createdAt,
    };
}
// GET /api/injectors/parts/low_stock/ — before /:id/
router.get('/parts/low_stock/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (_req, res) => {
    const parts = await db_1.prisma.injectorPart.findMany({ where: { isActive: true } });
    res.json(parts.filter(p => p.stock <= p.minStock).map(fmtPart));
});
// GET /api/injectors/parts/
router.get('/parts/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (req, res) => {
    const where = { isActive: true };
    if (req.query.search) {
        const q = req.query.search;
        where.OR = [{ name: { contains: q } }, { partNumber: { contains: q } }];
        delete where.isActive;
        where.AND = [{ isActive: true }];
    }
    const parts = await db_1.prisma.injectorPart.findMany({ where, orderBy: { name: 'asc' } });
    res.json(parts.map(fmtPart));
});
// POST /api/injectors/parts/
router.post('/parts/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (req, res) => {
    const { name, description, part_number, stock, min_stock, price, is_active } = req.body;
    if (!name) {
        res.status(400).json({ detail: 'name es requerido.' });
        return;
    }
    const p = await db_1.prisma.injectorPart.create({
        data: {
            name: name, description: description ?? '',
            partNumber: part_number ?? '', stock: stock ?? 0,
            minStock: min_stock ?? 2, price: price ?? 0,
            isActive: is_active !== undefined ? is_active : true,
        },
    });
    res.status(201).json(fmtPart(p));
});
// GET /api/injectors/parts/:id/
router.get('/parts/:id/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (req, res) => {
    const p = await db_1.prisma.injectorPart.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!p) {
        res.status(404).json({ detail: 'Not found.' });
        return;
    }
    res.json(fmtPart(p));
});
// PATCH /api/injectors/parts/:id/
router.patch('/parts/:id/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (req, res) => {
    const { name, description, part_number, stock, min_stock, price, is_active } = req.body;
    try {
        const p = await db_1.prisma.injectorPart.update({
            where: { id: parseInt(req.params.id) },
            data: {
                ...(name !== undefined ? { name: name } : {}),
                ...(description !== undefined ? { description: description } : {}),
                ...(part_number !== undefined ? { partNumber: part_number } : {}),
                ...(stock !== undefined ? { stock: stock } : {}),
                ...(min_stock !== undefined ? { minStock: min_stock } : {}),
                ...(price !== undefined ? { price: price } : {}),
                ...(is_active !== undefined ? { isActive: is_active } : {}),
            },
        });
        res.json(fmtPart(p));
    }
    catch {
        res.status(404).json({ detail: 'Not found.' });
    }
});
// DELETE /api/injectors/parts/:id/
router.delete('/parts/:id/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (req, res) => {
    try {
        await db_1.prisma.injectorPart.delete({ where: { id: parseInt(req.params.id) } });
        res.status(204).send();
    }
    catch {
        res.status(404).json({ detail: 'Not found.' });
    }
});
function fmtWork(w) {
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
const workInclude = { customer: true, assignedTo: true, partsUsed: { include: { part: true } } };
// GET /api/injectors/works/stats/ — before /:id/
router.get('/works/stats/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (_req, res) => {
    const today = new Date();
    const y = today.getFullYear(), m = today.getMonth();
    const [totalActive, inRepair, waitingParts, completedMonth] = await Promise.all([
        db_1.prisma.injectorWork.count({ where: { status: { notIn: ['delivered', 'cancelled'] } } }),
        db_1.prisma.injectorWork.count({ where: { status: 'in_repair' } }),
        db_1.prisma.injectorWork.count({ where: { status: 'waiting_parts' } }),
        db_1.prisma.injectorWork.count({
            where: {
                status: { in: ['completed', 'delivered'] },
                completedAt: { gte: new Date(y, m, 1), lte: new Date(y, m + 1, 0, 23, 59, 59) },
            },
        }),
    ]);
    res.json({ total_active: totalActive, in_repair: inRepair, waiting_parts: waitingParts, completed_this_month: completedMonth });
});
// GET /api/injectors/works/
router.get('/works/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (req, res) => {
    const where = {};
    if (req.query.status)
        where.status = req.query.status;
    if (req.query.search) {
        const q = req.query.search;
        where.OR = [
            { customerName: { contains: q } },
            { customerPhone: { contains: q } },
            { vehicleMake: { contains: q } },
            { vehicleModel: { contains: q } },
        ];
    }
    const rows = await db_1.prisma.injectorWork.findMany({ where, include: workInclude, orderBy: { receivedAt: 'desc' } });
    res.json(rows.map(fmtWork));
});
// POST /api/injectors/works/
router.post('/works/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (req, res) => {
    const b = req.body;
    if (!b.customer_name || !b.customer_phone || !b.vehicle_make || !b.vehicle_model) {
        res.status(400).json({ detail: 'customer_name, customer_phone, vehicle_make, vehicle_model son requeridos.' });
        return;
    }
    const w = await db_1.prisma.injectorWork.create({
        data: {
            customerName: b.customer_name,
            customerPhone: b.customer_phone,
            customerEmail: b.customer_email ?? '',
            customerId: b.customer ? parseInt(b.customer) : null,
            vehicleMake: b.vehicle_make,
            vehicleModel: b.vehicle_model,
            vehicleYear: b.vehicle_year ? b.vehicle_year : null,
            injectorQuantity: b.injector_quantity ?? 1,
            diagnosis: b.diagnosis ?? '',
            workDone: b.work_done ?? '',
            status: b.status ?? 'received',
            price: b.price ?? 0,
            assignedToId: b.assigned_to ? parseInt(b.assigned_to) : null,
            notes: b.notes ?? '',
        },
        include: workInclude,
    });
    res.status(201).json(fmtWork(w));
});
// GET /api/injectors/works/:id/
router.get('/works/:id/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (req, res) => {
    const w = await db_1.prisma.injectorWork.findUnique({ where: { id: parseInt(req.params.id) }, include: workInclude });
    if (!w) {
        res.status(404).json({ detail: 'Not found.' });
        return;
    }
    res.json(fmtWork(w));
});
// PATCH /api/injectors/works/:id/update_status/ — before /:id/
router.patch('/works/:id/update_status/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (req, res) => {
    const valid = ['received', 'diagnosing', 'in_repair', 'waiting_parts', 'completed', 'delivered', 'cancelled'];
    const b = req.body;
    if (!valid.includes(b.status)) {
        res.status(400).json({ status: 'Estado inválido.' });
        return;
    }
    const completedAt = b.status === 'completed' ? new Date() : undefined;
    try {
        const w = await db_1.prisma.injectorWork.update({
            where: { id: parseInt(req.params.id) },
            data: {
                status: b.status,
                ...(completedAt ? { completedAt } : {}),
                ...(b.diagnosis !== undefined ? { diagnosis: b.diagnosis } : {}),
                ...(b.work_done !== undefined ? { workDone: b.work_done } : {}),
                ...(b.notes !== undefined ? { notes: b.notes } : {}),
                ...(b.price !== undefined ? { price: b.price } : {}),
            },
            include: workInclude,
        });
        res.json(fmtWork(w));
    }
    catch {
        res.status(404).json({ detail: 'Not found.' });
    }
});
// PATCH /api/injectors/works/:id/
router.patch('/works/:id/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (req, res) => {
    const b = req.body;
    try {
        const w = await db_1.prisma.injectorWork.update({
            where: { id: parseInt(req.params.id) },
            data: {
                ...(b.customer_name !== undefined ? { customerName: b.customer_name } : {}),
                ...(b.customer_phone !== undefined ? { customerPhone: b.customer_phone } : {}),
                ...(b.customer_email !== undefined ? { customerEmail: b.customer_email } : {}),
                ...(b.vehicle_make !== undefined ? { vehicleMake: b.vehicle_make } : {}),
                ...(b.vehicle_model !== undefined ? { vehicleModel: b.vehicle_model } : {}),
                ...(b.vehicle_year !== undefined ? { vehicleYear: b.vehicle_year } : {}),
                ...(b.injector_quantity !== undefined ? { injectorQuantity: b.injector_quantity } : {}),
                ...(b.diagnosis !== undefined ? { diagnosis: b.diagnosis } : {}),
                ...(b.work_done !== undefined ? { workDone: b.work_done } : {}),
                ...(b.status !== undefined ? { status: b.status } : {}),
                ...(b.price !== undefined ? { price: b.price } : {}),
                ...(b.assigned_to !== undefined ? { assignedToId: b.assigned_to ? parseInt(b.assigned_to) : null } : {}),
                ...(b.notes !== undefined ? { notes: b.notes } : {}),
            },
            include: workInclude,
        });
        res.json(fmtWork(w));
    }
    catch {
        res.status(404).json({ detail: 'Not found.' });
    }
});
// DELETE /api/injectors/works/:id/
router.delete('/works/:id/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (req, res) => {
    try {
        await db_1.prisma.injectorWork.delete({ where: { id: parseInt(req.params.id) } });
        res.status(204).send();
    }
    catch {
        res.status(404).json({ detail: 'Not found.' });
    }
});
exports.default = router;
//# sourceMappingURL=injectors.js.map