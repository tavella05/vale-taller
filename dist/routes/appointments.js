"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const STATUS_DISPLAY = {
    pending: 'Pendiente',
    confirmed: 'Confirmado',
    in_progress: 'En Proceso',
    completed: 'Completado',
    cancelled: 'Cancelado',
};
const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
// ── SERVICES ─────────────────────────────────────────────────────────────────
function fmtService(s) {
    return {
        id: s.id, name: s.name, description: s.description,
        service_type: s.serviceType, duration_minutes: s.durationMinutes,
        price: s.price, is_active: s.isActive,
    };
}
// GET /api/appointments/services/
router.get('/services/', async (_req, res) => {
    const services = await db_1.prisma.service.findMany({
        where: { isActive: true },
        orderBy: [{ serviceType: 'asc' }, { name: 'asc' }],
    });
    res.json(services.map(fmtService));
});
// POST /api/appointments/services/
router.post('/services/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (req, res) => {
    const { name, description, service_type, duration_minutes, price, is_active } = req.body;
    if (!name || !service_type) {
        res.status(400).json({ detail: 'name y service_type son requeridos.' });
        return;
    }
    const s = await db_1.prisma.service.create({
        data: {
            name: name,
            description: description ?? '',
            serviceType: service_type,
            durationMinutes: duration_minutes ?? 30,
            price: price ?? 0,
            isActive: is_active !== undefined ? is_active : true,
        },
    });
    res.status(201).json(fmtService(s));
});
// GET /api/appointments/services/:id/
router.get('/services/:id/', async (req, res) => {
    const s = await db_1.prisma.service.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!s) {
        res.status(404).json({ detail: 'Not found.' });
        return;
    }
    res.json(fmtService(s));
});
// PUT /api/appointments/services/:id/
router.put('/services/:id/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (req, res) => {
    const { name, description, service_type, duration_minutes, price, is_active } = req.body;
    try {
        const s = await db_1.prisma.service.update({
            where: { id: parseInt(req.params.id) },
            data: { name: name, description: description ?? '', serviceType: service_type, durationMinutes: duration_minutes ?? 30, price: price ?? 0, isActive: is_active !== undefined ? is_active : true },
        });
        res.json(fmtService(s));
    }
    catch {
        res.status(404).json({ detail: 'Not found.' });
    }
});
// PATCH /api/appointments/services/:id/
router.patch('/services/:id/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (req, res) => {
    const { name, description, service_type, duration_minutes, price, is_active } = req.body;
    try {
        const s = await db_1.prisma.service.update({
            where: { id: parseInt(req.params.id) },
            data: {
                ...(name !== undefined ? { name: name } : {}),
                ...(description !== undefined ? { description: description } : {}),
                ...(service_type !== undefined ? { serviceType: service_type } : {}),
                ...(duration_minutes !== undefined ? { durationMinutes: duration_minutes } : {}),
                ...(price !== undefined ? { price: price } : {}),
                ...(is_active !== undefined ? { isActive: is_active } : {}),
            },
        });
        res.json(fmtService(s));
    }
    catch {
        res.status(404).json({ detail: 'Not found.' });
    }
});
// DELETE /api/appointments/services/:id/
router.delete('/services/:id/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (req, res) => {
    try {
        await db_1.prisma.service.delete({ where: { id: parseInt(req.params.id) } });
        res.status(204).send();
    }
    catch {
        res.status(404).json({ detail: 'Not found.' });
    }
});
// ── WORKING HOURS ─────────────────────────────────────────────────────────────
function fmtWH(w) {
    return {
        id: w.id, day_of_week: w.dayOfWeek, day_name: DAY_NAMES[w.dayOfWeek],
        is_open: w.isOpen, open_time: w.openTime, close_time: w.closeTime,
        slot_duration: w.slotDuration,
    };
}
// GET /api/appointments/working-hours/
router.get('/working-hours/', async (_req, res) => {
    const hours = await db_1.prisma.workingHours.findMany({ orderBy: { dayOfWeek: 'asc' } });
    res.json(hours.map(fmtWH));
});
// POST /api/appointments/working-hours/
router.post('/working-hours/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (req, res) => {
    const { day_of_week, is_open, open_time, close_time, slot_duration } = req.body;
    const w = await db_1.prisma.workingHours.create({
        data: {
            dayOfWeek: day_of_week,
            isOpen: is_open !== undefined ? is_open : true,
            openTime: open_time ?? '09:00',
            closeTime: close_time ?? '18:00',
            slotDuration: slot_duration ?? 30,
        },
    });
    res.status(201).json(fmtWH(w));
});
// GET /api/appointments/working-hours/:id/
router.get('/working-hours/:id/', async (req, res) => {
    const w = await db_1.prisma.workingHours.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!w) {
        res.status(404).json({ detail: 'Not found.' });
        return;
    }
    res.json(fmtWH(w));
});
// PUT /api/appointments/working-hours/:id/
router.put('/working-hours/:id/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (req, res) => {
    const { day_of_week, is_open, open_time, close_time, slot_duration } = req.body;
    try {
        const w = await db_1.prisma.workingHours.update({
            where: { id: parseInt(req.params.id) },
            data: { dayOfWeek: day_of_week, isOpen: is_open !== undefined ? is_open : true, openTime: open_time ?? '09:00', closeTime: close_time ?? '18:00', slotDuration: slot_duration ?? 30 },
        });
        res.json(fmtWH(w));
    }
    catch {
        res.status(404).json({ detail: 'Not found.' });
    }
});
// PATCH /api/appointments/working-hours/:id/
router.patch('/working-hours/:id/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (req, res) => {
    const { is_open, open_time, close_time, slot_duration } = req.body;
    try {
        const w = await db_1.prisma.workingHours.update({
            where: { id: parseInt(req.params.id) },
            data: {
                ...(is_open !== undefined ? { isOpen: is_open } : {}),
                ...(open_time !== undefined ? { openTime: open_time } : {}),
                ...(close_time !== undefined ? { closeTime: close_time } : {}),
                ...(slot_duration !== undefined ? { slotDuration: slot_duration } : {}),
            },
        });
        res.json(fmtWH(w));
    }
    catch {
        res.status(404).json({ detail: 'Not found.' });
    }
});
// DELETE /api/appointments/working-hours/:id/
router.delete('/working-hours/:id/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (req, res) => {
    try {
        await db_1.prisma.workingHours.delete({ where: { id: parseInt(req.params.id) } });
        res.status(204).send();
    }
    catch {
        res.status(404).json({ detail: 'Not found.' });
    }
});
function fmtAppointment(a) {
    return {
        id: a.id, customer: a.customerId,
        customer_name: a.customer ? `${a.customer.firstName} ${a.customer.lastName}`.trim() : '',
        customer_email: a.customer?.email ?? '',
        customer_phone: a.customer?.phone ?? '',
        service: a.serviceId,
        service_name: a.service?.name ?? '',
        service_type: a.service?.serviceType ?? '',
        date: a.date, time: a.time, status: a.status,
        status_display: STATUS_DISPLAY[a.status] ?? a.status,
        vehicle_make: a.vehicleMake, vehicle_model: a.vehicleModel, vehicle_year: a.vehicleYear,
        notes: a.notes, staff_notes: a.staffNotes,
        created_at: a.createdAt, updated_at: a.updatedAt,
    };
}
// GET /api/appointments/appointments/available_slots/ — must come BEFORE /:id/
router.get('/appointments/available_slots/', async (req, res) => {
    const { date: dateStr, service: serviceId } = req.query;
    if (!dateStr || !serviceId) {
        res.status(400).json({ error: 'Parámetros date y service son requeridos.' });
        return;
    }
    const parts = dateStr.split('-');
    if (parts.length !== 3) {
        res.status(400).json({ error: 'Formato de fecha inválido. Use YYYY-MM-DD.' });
        return;
    }
    const targetDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (targetDate < today) {
        res.status(400).json({ error: 'No se pueden reservar turnos en fechas pasadas.' });
        return;
    }
    const jsDay = targetDate.getDay(); // 0=Sun
    const djangoDay = jsDay === 0 ? 6 : jsDay - 1; // 0=Mon
    const wh = await db_1.prisma.workingHours.findUnique({ where: { dayOfWeek: djangoDay } });
    if (!wh || !wh.isOpen) {
        res.json({ slots: [] });
        return;
    }
    const service = await db_1.prisma.service.findUnique({ where: { id: parseInt(serviceId) } });
    if (!service) {
        res.status(404).json({ error: 'Servicio no encontrado.' });
        return;
    }
    const booked = await db_1.prisma.appointment.findMany({
        where: { date: dateStr, status: { in: ['pending', 'confirmed', 'in_progress'] } },
        select: { time: true },
    });
    const bookedSet = new Set(booked.map(a => a.time));
    const [openH, openM] = wh.openTime.split(':').map(Number);
    const [closeH, closeM] = wh.closeTime.split(':').map(Number);
    let cur = openH * 60 + openM;
    const close = closeH * 60 + closeM;
    const slots = [];
    while (cur + service.durationMinutes <= close) {
        const t = `${Math.floor(cur / 60).toString().padStart(2, '0')}:${(cur % 60).toString().padStart(2, '0')}`;
        slots.push({ time: t, available: !bookedSet.has(t) });
        cur += wh.slotDuration;
    }
    res.json({ slots });
});
// GET /api/appointments/appointments/stats/ — must come BEFORE /:id/
router.get('/appointments/stats/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (_req, res) => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const y = today.getFullYear(), m = today.getMonth();
    const firstDay = new Date(y, m, 1).toISOString().slice(0, 10);
    const lastDay = new Date(y, m + 1, 0).toISOString().slice(0, 10);
    const [todayCount, pending, confirmed, completedMonth] = await Promise.all([
        db_1.prisma.appointment.count({ where: { date: todayStr } }),
        db_1.prisma.appointment.count({ where: { status: 'pending' } }),
        db_1.prisma.appointment.count({ where: { status: 'confirmed' } }),
        db_1.prisma.appointment.count({ where: { status: 'completed', date: { gte: firstDay, lte: lastDay } } }),
    ]);
    res.json({ today: todayCount, pending, confirmed, completed_this_month: completedMonth });
});
// GET /api/appointments/appointments/
router.get('/appointments/', auth_1.authenticate, async (req, res) => {
    const user = req.user;
    if (user.role === 'admin' || user.role === 'staff') {
        const where = {};
        if (req.query.date)
            where.date = req.query.date;
        if (req.query.status)
            where.status = req.query.status;
        if (req.query.service_type)
            where.service = { serviceType: req.query.service_type };
        const [count, rows] = await Promise.all([
            db_1.prisma.appointment.count({ where }),
            db_1.prisma.appointment.findMany({ where, include: { customer: true, service: true }, orderBy: [{ date: 'asc' }, { time: 'asc' }] }),
        ]);
        res.json({ count, results: rows.map(fmtAppointment) });
    }
    else {
        const rows = await db_1.prisma.appointment.findMany({
            where: { customerId: user.userId },
            include: { service: true },
            orderBy: { date: 'desc' },
        });
        res.json(rows.map(fmtAppointment));
    }
});
// POST /api/appointments/appointments/
router.post('/appointments/', auth_1.optionalAuth, async (req, res) => {
    const body = req.body;
    const { service, date, time, vehicle_make, vehicle_model, vehicle_year, notes, email, phone, first_name, last_name } = body;
    let customerId;
    if (req.user) {
        customerId = req.user.userId;
    }
    else {
        if (!email) {
            res.status(400).json({ email: 'El email es requerido.' });
            return;
        }
        let user = await db_1.prisma.user.findFirst({ where: { email: email } });
        if (!user) {
            user = await db_1.prisma.user.create({
                data: {
                    username: email, email: email,
                    firstName: first_name ?? '', lastName: last_name ?? '',
                    phone: phone ?? '', password: '', role: 'customer',
                },
            });
        }
        else {
            await db_1.prisma.user.update({
                where: { id: user.id },
                data: {
                    ...(first_name ? { firstName: first_name } : {}),
                    ...(last_name ? { lastName: last_name } : {}),
                    ...(phone ? { phone: phone } : {}),
                },
            });
        }
        customerId = user.id;
    }
    const appt = await db_1.prisma.appointment.create({
        data: {
            customerId, serviceId: parseInt(service),
            date: date, time: time,
            vehicleMake: vehicle_make ?? '', vehicleModel: vehicle_model ?? '',
            vehicleYear: vehicle_year ? vehicle_year : null,
            notes: notes ?? '', status: 'pending',
        },
        include: { customer: true, service: true },
    });
    res.status(201).json(fmtAppointment(appt));
});
// GET /api/appointments/appointments/:id/
router.get('/appointments/:id/', auth_1.authenticate, async (req, res) => {
    const appt = await db_1.prisma.appointment.findUnique({ where: { id: parseInt(req.params.id) }, include: { customer: true, service: true } });
    if (!appt) {
        res.status(404).json({ detail: 'Not found.' });
        return;
    }
    const u = req.user;
    if (u.role !== 'admin' && u.role !== 'staff' && appt.customerId !== u.userId) {
        res.status(403).json({ detail: 'Forbidden.' });
        return;
    }
    res.json(fmtAppointment(appt));
});
// PATCH /api/appointments/appointments/:id/update_status/ — must come BEFORE /:id/
router.patch('/appointments/:id/update_status/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (req, res) => {
    const valid = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
    const { status, staff_notes } = req.body;
    if (!valid.includes(status)) {
        res.status(400).json({ status: 'Estado inválido.' });
        return;
    }
    try {
        const appt = await db_1.prisma.appointment.update({
            where: { id: parseInt(req.params.id) },
            data: { status, ...(staff_notes !== undefined ? { staffNotes: staff_notes } : {}) },
            include: { customer: true, service: true },
        });
        res.json(fmtAppointment(appt));
    }
    catch {
        res.status(404).json({ detail: 'Not found.' });
    }
});
// PATCH /api/appointments/appointments/:id/
router.patch('/appointments/:id/', auth_1.authenticate, async (req, res) => {
    const appt = await db_1.prisma.appointment.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!appt) {
        res.status(404).json({ detail: 'Not found.' });
        return;
    }
    const u = req.user;
    if (u.role !== 'admin' && u.role !== 'staff' && appt.customerId !== u.userId) {
        res.status(403).json({ detail: 'Forbidden.' });
        return;
    }
    const { date, time, service, vehicle_make, vehicle_model, vehicle_year, notes, staff_notes, status } = req.body;
    const updated = await db_1.prisma.appointment.update({
        where: { id: appt.id },
        data: {
            ...(date !== undefined ? { date: date } : {}),
            ...(time !== undefined ? { time: time } : {}),
            ...(service !== undefined ? { serviceId: parseInt(service) } : {}),
            ...(vehicle_make !== undefined ? { vehicleMake: vehicle_make } : {}),
            ...(vehicle_model !== undefined ? { vehicleModel: vehicle_model } : {}),
            ...(vehicle_year !== undefined ? { vehicleYear: vehicle_year } : {}),
            ...(notes !== undefined ? { notes: notes } : {}),
            ...(staff_notes !== undefined ? { staffNotes: staff_notes } : {}),
            ...(status !== undefined ? { status: status } : {}),
        },
        include: { customer: true, service: true },
    });
    res.json(fmtAppointment(updated));
});
// DELETE /api/appointments/appointments/:id/
router.delete('/appointments/:id/', auth_1.authenticate, async (req, res) => {
    const appt = await db_1.prisma.appointment.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!appt) {
        res.status(404).json({ detail: 'Not found.' });
        return;
    }
    const u = req.user;
    if (u.role !== 'admin' && u.role !== 'staff' && appt.customerId !== u.userId) {
        res.status(403).json({ detail: 'Forbidden.' });
        return;
    }
    await db_1.prisma.appointment.delete({ where: { id: appt.id } });
    res.status(204).send();
});
exports.default = router;
//# sourceMappingURL=appointments.js.map