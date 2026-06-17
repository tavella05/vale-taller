import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { config } from '../config';
import { authenticate, requireAdminOrStaff } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

function formatUser(u: {
  id: number; username: string; email: string; firstName: string;
  lastName: string; role: string; phone: string; dni: string;
}) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    first_name: u.firstName,
    last_name: u.lastName,
    role: u.role,
    phone: u.phone,
    dni: u.dni,
  };
}

function formatUserAdmin(u: {
  id: number; username: string; email: string; firstName: string;
  lastName: string; role: string; phone: string; dni: string;
  isActive: boolean; dateJoined: Date;
}) {
  return { ...formatUser(u), is_active: u.isActive, date_joined: u.dateJoined };
}

function generateTokens(user: { id: number; username: string; role: string; firstName: string; lastName: string }) {
  const fullName = `${user.firstName} ${user.lastName}`.trim();
  const payload = { userId: user.id, username: user.username, role: user.role, full_name: fullName };
  const access = jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtAccessExpiry });
  const refresh = jwt.sign({ userId: user.id }, config.jwtRefreshSecret, { expiresIn: config.jwtRefreshExpiry });
  return { access, refresh };
}

// POST /api/auth/login/
router.post('/login/', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ detail: 'Username and password required.' });
    return;
  }
  const user = await prisma.user.findFirst({
    where: { OR: [{ username }, { email: username }], isActive: true },
  });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    res.status(401).json({ detail: 'No active account found with the given credentials.' });
    return;
  }
  const { access, refresh } = generateTokens(user);
  res.json({ access, refresh, user: formatUser(user) });
});

// POST /api/auth/login/refresh/
router.post('/login/refresh/', async (req: Request, res: Response): Promise<void> => {
  const { refresh } = req.body as { refresh?: string };
  if (!refresh) {
    res.status(400).json({ detail: 'Refresh token required.' });
    return;
  }
  try {
    const payload = jwt.verify(refresh, config.jwtRefreshSecret) as { userId: number };
    const user = await prisma.user.findUnique({ where: { id: payload.userId, isActive: true } });
    if (!user) {
      res.status(401).json({ detail: 'Invalid token.' });
      return;
    }
    const access = jwt.sign(
      { userId: user.id, username: user.username, role: user.role, full_name: `${user.firstName} ${user.lastName}`.trim() },
      config.jwtSecret,
      { expiresIn: config.jwtAccessExpiry }
    );
    res.json({ access });
  } catch {
    res.status(401).json({ detail: 'Invalid or expired refresh token.' });
  }
});

// POST /api/auth/register/
router.post('/register/', async (req: Request, res: Response): Promise<void> => {
  const { username, email, first_name, last_name, phone, password, password2 } = req.body as Record<string, string>;
  if (!username || !email || !password || !password2) {
    res.status(400).json({ detail: 'username, email, password y password2 son requeridos.' });
    return;
  }
  if (password !== password2) {
    res.status(400).json({ password: 'Las contraseñas no coinciden.' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ password: 'La contraseña debe tener al menos 8 caracteres.' });
    return;
  }
  const existing = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] } });
  if (existing) {
    res.status(400).json({ detail: 'Username o email ya existe.' });
    return;
  }
  const user = await prisma.user.create({
    data: {
      username, email,
      firstName: first_name ?? '',
      lastName: last_name ?? '',
      phone: phone ?? '',
      password: await bcrypt.hash(password, 12),
      role: 'customer',
    },
  });
  res.status(201).json(formatUser(user));
});

// GET /api/auth/me/
router.get('/me/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) { res.status(404).json({ detail: 'Not found.' }); return; }
  res.json(formatUser(user));
});

// PATCH /api/auth/me/
router.patch('/me/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { first_name, last_name, email, phone, dni } = req.body as Record<string, string | undefined>;
  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: {
      ...(first_name !== undefined ? { firstName: first_name } : {}),
      ...(last_name !== undefined ? { lastName: last_name } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(dni !== undefined ? { dni } : {}),
    },
  });
  res.json(formatUser(user));
});

// POST /api/auth/change-password/
router.post('/change-password/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { old_password, new_password } = req.body as { old_password?: string; new_password?: string };
  if (!old_password || !new_password) {
    res.status(400).json({ detail: 'old_password y new_password son requeridos.' });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user || !(await bcrypt.compare(old_password, user.password))) {
    res.status(400).json({ old_password: 'Contraseña incorrecta.' });
    return;
  }
  if (new_password.length < 8) {
    res.status(400).json({ new_password: 'La contraseña debe tener al menos 8 caracteres.' });
    return;
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { password: await bcrypt.hash(new_password, 12) },
  });
  res.json({ detail: 'Contraseña actualizada correctamente.' });
});

// GET /api/auth/users/
router.get('/users/', authenticate, requireAdminOrStaff, async (_req: AuthRequest, res: Response): Promise<void> => {
  const users = await prisma.user.findMany({ orderBy: { dateJoined: 'desc' } });
  res.json(users.map(formatUserAdmin));
});

// GET /api/auth/users/:id/
router.get('/users/:id/', authenticate, requireAdminOrStaff, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!user) { res.status(404).json({ detail: 'Not found.' }); return; }
  res.json(formatUserAdmin(user));
});

// PATCH /api/auth/users/:id/
router.patch('/users/:id/', authenticate, requireAdminOrStaff, async (req: AuthRequest, res: Response): Promise<void> => {
  const { first_name, last_name, email, phone, dni, role, is_active } = req.body as Record<string, unknown>;
  try {
    const user = await prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(first_name !== undefined ? { firstName: first_name as string } : {}),
        ...(last_name !== undefined ? { lastName: last_name as string } : {}),
        ...(email !== undefined ? { email: email as string } : {}),
        ...(phone !== undefined ? { phone: phone as string } : {}),
        ...(dni !== undefined ? { dni: dni as string } : {}),
        ...(role !== undefined ? { role: role as string } : {}),
        ...(is_active !== undefined ? { isActive: is_active as boolean } : {}),
      },
    });
    res.json(formatUserAdmin(user));
  } catch {
    res.status(404).json({ detail: 'Not found.' });
  }
});

export default router;
