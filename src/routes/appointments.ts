import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticate, requireAdminOrStaff, optionalAuth } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

const STATUS_DISPLAY: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  in_progress: 'En Proceso',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// ── SERVICES ─────────────────────────────────────────────────────────────────

function fmtService(s: { id: number; name: string; description: string; serviceType: string; durationMinutes: number; price: unknown; isActive: boolean }) {
  return {
    id: s.id, name: s.name, description: s.description,
    service_type: s.serviceType, duration_minutes: s.durationMinutes,
    price: s.price, is_active: s.isActive,
  };
}

// GET /api/appointments/services/
router.get('/services/', async (_req: Request, res: Response): Promise<void> => {
  const services = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: [{ serviceType: 'asc' }, { name: 'asc' }],
  });
  res.json(services.map(fmtService));
});

// POST /api/appointments/services/
router.post('/services/', authenticate, requireAdminOrStaff, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, description, service_type, duration_minutes, price, is_active } = req.body as Record<string, unknown>;
  if (!name || !service_type) { res.status(400).json({ detail: 'name y service_type son requeridos.' }); return; }
  const s = await prisma.service.create({
    data: {
      name: name as string,
      description: (description as string) ?? '',
      serviceType: service_type as string,
      durationMinutes: (duration_minutes as number) ?? 30,
      price: (price as number) ?? 0,
      isActive: is_active !== undefined ? (is_active as boolean) : true,
    },
  });
  res.status(201).json(fmtService(s));
});

// GET /api/appointments/services/:id/
router.get('/services/:id/', async (req: Request, res: Response): Promise<void> => {
  const s = await prisma.service.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!s) { res.status(404).json({ detail: 'Not found.' }); return; }
  res.json(fmtService(s));
});

// PUT /api/appointments/services/:id/
router.put('/services/:id/', authenticate, requireAdminOrStaff, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, description, service_type, duration_minutes, price, is_active } = req.body as Record<string, unknown>;
  try {
    const s = await prisma.service.update({
      where: { id: parseInt(req.params.id) },
      data: { name: name as string, description: (description as string) ?? '', serviceType: service_type as string, durationMinutes: (duration_minutes as number) ?? 30, price: (price as number) ?? 0, isActive: is_active !== undefined ? (is_active as boolean) : true },
    });
    res.json(fmtService(s));
  } catch { res.status(404).json({ detail: 'Not found.' }); }
});

// PATCH /api/appointments/services/:id/
router.patch('/services/:id/', authenticate, requireAdminOrStaff, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, description, service_type, duration_minutes, price, is_active } = req.body as Record<string, unknown>;
  try {
    const s = await prisma.service.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(name !== undefined ? { name: name as string } : {}),
        ...(description !== undefined ? { description: description as string } : {}),
        ...(service_type !== undefined ? { serviceType: service_type as string } : {}),
        ...(duration_minutes !== undefined ? { durationMinutes: duration_minutes as number } : {}),
        ...(price !== undefined ? { price: price as number } : {}),
        ...(is_active !== undefined ? { isActive: is_active as boolean } : {}),
      },
    });
    res.json(fmtService(s));
  } catch { res.status(404).json({ detail: 'Not found.' }); }
});

// DELETE /api/appointments/services/:id/
router.delete('/services/:id/', authenticate, requireAdminOrStaff, async (req: AuthRequest, res: Response): Promise<void> => {
  try { await prisma.service.delete({ where: { id: parseInt(req.params.id) } }); res.status(204).send(); }
  catch { res.status(404).json({ detail: 'Not found.' }); }
});

// ── WORKING HOURS ─────────────────────────────────────────────────────────────

function fmtWH(w: { id: number; dayOfWeek: number; isOpen: boolean; openTime: string; closeTime: string; slotDuration: number }) {
  return {
    id: w.id, day_of_week: w.dayOfWeek, day_name: DAY_NAMES[w.dayOfWeek],
    is_open: w.isOpen, open_time: w.openTime, close_time: w.closeTime,
    slot_duration: w.slotDuration,
  };
}

// GET /api/appointments/working-hours/
router.get('/working-hours/', async (_req: Request, res: Response): Promise<void> => {
  const hours = await prisma.workingHours.findMany({ orderBy: { dayOfWeek: 'asc' } });
  res.json(hours.map(fmtWH));
});

// POST /api/appointments/working-hours/
router.post('/working-hours/', authenticate, requireAdminOrStaff, async (req: AuthRequest, res: Response): Promise<void> => {
  const { day_of_week, is_open, open_time, close_time, slot_duration } = req.body as Record<string, unknown>;
  const w = await prisma.workingHours.create({
    data: {
      dayOfWeek: day_of_week as number,
      isOpen: is_open !== undefined ? (is_open as boolean) : true,
      openTime: (open_time as string) ?? '09:00',
      closeTime: (close_time as string) ?? '18:00',
      slotDuration: (slot_duration as number) ?? 30,
    },
  });
  res.status(201).json(fmtWH(w));
});

// GET /api/appointments/working-hours/:id/
router.get('/working-hours/:id/', async (req: Request, res: Response): Promise<void> => {
  const w = await prisma.workingHours.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!w) { res.status(404).json({ detail: 'Not found.' }); return; }
  res.json(fmtWH(w));
});

// PUT /api/appointments/working-hours/:id/
router.put('/working-hours/:id/', authenticate, requireAdminOrStaff, async (req: AuthRequest, res: Response): Promise<void> => {
  const { day_of_week, is_open, open_time, close_time, slot_duration } = req.body as Record<string, unknown>;
  try {
    const w = await prisma.workingHours.update({
      where: { id: parseInt(req.params.id) },
      data: { dayOfWeek: day_of_week as number, isOpen: is_open !== undefined ? (is_open as boolean) : true, openTime: (open_time as string) ?? '09:00', closeTime: (close_time as string) ?? '18:00', slotDuration: (slot_duration as number) ?? 30 },
    });
    res.json(fmtWH(w));
  } catch { res.status(404).json({ detail: 'Not found.' }); }
});

// PATCH /api/appointments/working-hours/:id/
router.patch('/working-hours/:id/', authenticate, requireAdminOrStaff, async (req: AuthRequest, res: Response): Promise<void> => {
  const { is_open, open_time, close_time, slot_duration } = req.body as Record<string, unknown>;
  try {
    const w = await prisma.workingHours.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(is_open !== undefined ? { isOpen: is_open as boolean } : {}),
        ...(open_time !== undefined ? { openTime: open_time as string } : {}),
        ...(close_time !== undefined ? { closeTime: close_time as string } : {}),
        ...(slot_duration !== undefined ? { slotDuration: slot_duration as number } : {}),
      },
    });
    res.json(fmtWH(w));
  } catch { res.status(404).json({ detail: 'Not found.' }); }
});

// DELETE /api/appointments/working-hours/:id/
router.delete('/working-hours/:id/', authenticate, requireAdminOrStaff, async (req: AuthRequest, res: Response): Promise<void> => {
  try { await prisma.workingHours.delete({ where: { id: parseInt(req.params.id) } }); res.status(204).send(); }
  catch { res.status(404).json({ detail: 'Not found.' }); }
});

// ── APPOINTMENTS ──────────────────────────────────────────────────────────────

type AppointmentWithRelations = {
  id: number; customerId: number; serviceId: number; date: string; time: string;
  status: string; vehicleMake: string; vehicleModel: string; vehicleYear: number | null;
  notes: string; staffNotes: string; createdAt: Date; updatedAt: Date;
  customer?: { firstName: string; lastName: string; email: string; phone: string } | null;
  service?: { name: string; serviceType: string } | null;
};

function fmtAppointment(a: AppointmentWithRelations) {
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
router.get('/appointments/available_slots/', async (req: Request, res: Response): Promise<void> => {
  const { date: dateStr, service: serviceId } = req.query as Record<string, string>;
  if (!dateStr || !serviceId) {
    res.status(400).json({ error: 'Parámetros date y service son requeridos.' }); return;
  }
  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    res.status(400).json({ error: 'Formato de fecha inválido. Use YYYY-MM-DD.' }); return;
  }
  const targetDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (targetDate < today) {
    res.status(400).json({ error: 'No se pueden reservar turnos en fechas pasadas.' }); return;
  }
  const jsDay = targetDate.getDay(); // 0=Sun
  const djangoDay = jsDay === 0 ? 6 : jsDay - 1; // 0=Mon
  const wh = await prisma.workingHours.findUnique({ where: { dayOfWeek: djangoDay } });
  if (!wh || !wh.isOpen) { res.json({ slots: [] }); return; }
  const service = await prisma.service.findUnique({ where: { id: parseInt(serviceId) } });
  if (!service) { res.status(404).json({ error: 'Servicio no encontrado.' }); return; }
  const booked = await prisma.appointment.findMany({
    where: { date: dateStr, status: { in: ['pending', 'confirmed', 'in_progress'] } },
    select: { time: true },
  });
  const bookedSet = new Set(booked.map(a => a.time));
  const [openH, openM] = wh.openTime.split(':').map(Number);
  const [closeH, closeM] = wh.closeTime.split(':').map(Number);
  let cur = openH * 60 + openM;
  const close = closeH * 60 + closeM;
  const slots: { time: string; available: boolean }[] = [];
  while (cur + service.durationMinutes <= close) {
    const t = `${Math.floor(cur / 60).toString().padStart(2, '0')}:${(cur % 60).toString().padStart(2, '0')}`;
    slots.push({ time: t, available: !bookedSet.has(t) });
    cur += wh.slotDuration;
  }
  res.json({ slots });
});

// GET /api/appointments/appointments/stats/ — must come BEFORE /:id/
router.get('/appointments/stats/', authenticate, requireAdminOrStaff, async (_req: AuthRequest, res: Response): Promise<void> => {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const y = today.getFullYear(), m = today.getMonth();
  const firstDay = new Date(y, m, 1).toISOString().slice(0, 10);
  const lastDay = new Date(y, m + 1, 0).toISOString().slice(0, 10);
  const [todayCount, pending, confirmed, completedMonth] = await Promise.all([
    prisma.appointment.count({ where: { date: todayStr } }),
    prisma.appointment.count({ where: { status: 'pending' } }),
    prisma.appointment.count({ where: { status: 'confirmed' } }),
    prisma.appointment.count({ where: { status: 'completed', date: { gte: firstDay, lte: lastDay } } }),
  ]);
  res.json({ today: todayCount, pending, confirmed, completed_this_month: completedMonth });
});

// GET /api/appointments/appointments/
router.get('/appointments/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user!;
  if (user.role === 'admin' || user.role === 'staff') {
    const where: Record<string, unknown> = {};
    if (req.query.date) where.date = req.query.date as string;
    if (req.query.status) where.status = req.query.status as string;
    if (req.query.service_type) where.service = { serviceType: req.query.service_type as string };
    const [count, rows] = await Promise.all([
      prisma.appointment.count({ where }),
      prisma.appointment.findMany({ where, include: { customer: true, service: true }, orderBy: [{ date: 'asc' }, { time: 'asc' }] }),
    ]);
    res.json({ count, results: rows.map(fmtAppointment) });
  } else {
    const rows = await prisma.appointment.findMany({
      where: { customerId: user.userId },
      include: { service: true },
      orderBy: { date: 'desc' },
    });
    res.json(rows.map(fmtAppointment));
  }
});

// POST /api/appointments/appointments/
router.post('/appointments/', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  const { service, date, time, vehicle_make, vehicle_model, vehicle_year, notes, email, phone, first_name, last_name } = body;
  let customerId: number;
  if (req.user) {
    customerId = req.user.userId;
  } else {
    if (!email) { res.status(400).json({ email: 'El email es requerido.' }); return; }
    let user = await prisma.user.findFirst({ where: { email: email as string } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          username: email as string, email: email as string,
          firstName: (first_name as string) ?? '', lastName: (last_name as string) ?? '',
          phone: (phone as string) ?? '', password: '', role: 'customer',
        },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(first_name ? { firstName: first_name as string } : {}),
          ...(last_name ? { lastName: last_name as string } : {}),
          ...(phone ? { phone: phone as string } : {}),
        },
      });
    }
    customerId = user.id;
  }
  const appt = await prisma.appointment.create({
    data: {
      customerId, serviceId: parseInt(service as string),
      date: date as string, time: time as string,
      vehicleMake: (vehicle_make as string) ?? '', vehicleModel: (vehicle_model as string) ?? '',
      vehicleYear: vehicle_year ? (vehicle_year as number) : null,
      notes: (notes as string) ?? '', status: 'pending',
    },
    include: { customer: true, service: true },
  });
  res.status(201).json(fmtAppointment(appt));
});

// GET /api/appointments/appointments/:id/
router.get('/appointments/:id/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const appt = await prisma.appointment.findUnique({ where: { id: parseInt(req.params.id) }, include: { customer: true, service: true } });
  if (!appt) { res.status(404).json({ detail: 'Not found.' }); return; }
  const u = req.user!;
  if (u.role !== 'admin' && u.role !== 'staff' && appt.customerId !== u.userId) { res.status(403).json({ detail: 'Forbidden.' }); return; }
  res.json(fmtAppointment(appt));
});

// PATCH /api/appointments/appointments/:id/update_status/ — must come BEFORE /:id/
router.patch('/appointments/:id/update_status/', authenticate, requireAdminOrStaff, async (req: AuthRequest, res: Response): Promise<void> => {
  const valid = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
  const { status, staff_notes } = req.body as Record<string, string>;
  if (!valid.includes(status)) { res.status(400).json({ status: 'Estado inválido.' }); return; }
  try {
    const appt = await prisma.appointment.update({
      where: { id: parseInt(req.params.id) },
      data: { status, ...(staff_notes !== undefined ? { staffNotes: staff_notes } : {}) },
      include: { customer: true, service: true },
    });
    res.json(fmtAppointment(appt));
  } catch { res.status(404).json({ detail: 'Not found.' }); }
});

// PATCH /api/appointments/appointments/:id/
router.patch('/appointments/:id/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const appt = await prisma.appointment.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!appt) { res.status(404).json({ detail: 'Not found.' }); return; }
  const u = req.user!;
  if (u.role !== 'admin' && u.role !== 'staff' && appt.customerId !== u.userId) { res.status(403).json({ detail: 'Forbidden.' }); return; }
  const { date, time, service, vehicle_make, vehicle_model, vehicle_year, notes, staff_notes, status } = req.body as Record<string, unknown>;
  const updated = await prisma.appointment.update({
    where: { id: appt.id },
    data: {
      ...(date !== undefined ? { date: date as string } : {}),
      ...(time !== undefined ? { time: time as string } : {}),
      ...(service !== undefined ? { serviceId: parseInt(service as string) } : {}),
      ...(vehicle_make !== undefined ? { vehicleMake: vehicle_make as string } : {}),
      ...(vehicle_model !== undefined ? { vehicleModel: vehicle_model as string } : {}),
      ...(vehicle_year !== undefined ? { vehicleYear: vehicle_year as number } : {}),
      ...(notes !== undefined ? { notes: notes as string } : {}),
      ...(staff_notes !== undefined ? { staffNotes: staff_notes as string } : {}),
      ...(status !== undefined ? { status: status as string } : {}),
    },
    include: { customer: true, service: true },
  });
  res.json(fmtAppointment(updated));
});

// DELETE /api/appointments/appointments/:id/
router.delete('/appointments/:id/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const appt = await prisma.appointment.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!appt) { res.status(404).json({ detail: 'Not found.' }); return; }
  const u = req.user!;
  if (u.role !== 'admin' && u.role !== 'staff' && appt.customerId !== u.userId) { res.status(403).json({ detail: 'Forbidden.' }); return; }
  await prisma.appointment.delete({ where: { id: appt.id } });
  res.status(204).send();
});

export default router;
