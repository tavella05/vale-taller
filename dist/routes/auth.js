"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../db");
const config_1 = require("../config");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
function formatUser(u) {
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
function formatUserAdmin(u) {
    return { ...formatUser(u), is_active: u.isActive, date_joined: u.dateJoined };
}
function generateTokens(user) {
    const fullName = `${user.firstName} ${user.lastName}`.trim();
    const payload = { userId: user.id, username: user.username, role: user.role, full_name: fullName };
    const access = jsonwebtoken_1.default.sign(payload, config_1.config.jwtSecret, { expiresIn: config_1.config.jwtAccessExpiry });
    const refresh = jsonwebtoken_1.default.sign({ userId: user.id }, config_1.config.jwtRefreshSecret, { expiresIn: config_1.config.jwtRefreshExpiry });
    return { access, refresh };
}
// POST /api/auth/login/
router.post('/login/', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        res.status(400).json({ detail: 'Username and password required.' });
        return;
    }
    const user = await db_1.prisma.user.findFirst({
        where: { OR: [{ username }, { email: username }], isActive: true },
    });
    if (!user || !(await bcryptjs_1.default.compare(password, user.password))) {
        res.status(401).json({ detail: 'No active account found with the given credentials.' });
        return;
    }
    const { access, refresh } = generateTokens(user);
    res.json({ access, refresh, user: formatUser(user) });
});
// POST /api/auth/login/refresh/
router.post('/login/refresh/', async (req, res) => {
    const { refresh } = req.body;
    if (!refresh) {
        res.status(400).json({ detail: 'Refresh token required.' });
        return;
    }
    try {
        const payload = jsonwebtoken_1.default.verify(refresh, config_1.config.jwtRefreshSecret);
        const user = await db_1.prisma.user.findUnique({ where: { id: payload.userId, isActive: true } });
        if (!user) {
            res.status(401).json({ detail: 'Invalid token.' });
            return;
        }
        const access = jsonwebtoken_1.default.sign({ userId: user.id, username: user.username, role: user.role, full_name: `${user.firstName} ${user.lastName}`.trim() }, config_1.config.jwtSecret, { expiresIn: config_1.config.jwtAccessExpiry });
        res.json({ access });
    }
    catch {
        res.status(401).json({ detail: 'Invalid or expired refresh token.' });
    }
});
// POST /api/auth/register/
router.post('/register/', async (req, res) => {
    const { username, email, first_name, last_name, phone, password, password2 } = req.body;
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
    const existing = await db_1.prisma.user.findFirst({ where: { OR: [{ username }, { email }] } });
    if (existing) {
        res.status(400).json({ detail: 'Username o email ya existe.' });
        return;
    }
    const user = await db_1.prisma.user.create({
        data: {
            username, email,
            firstName: first_name ?? '',
            lastName: last_name ?? '',
            phone: phone ?? '',
            password: await bcryptjs_1.default.hash(password, 12),
            role: 'customer',
        },
    });
    res.status(201).json(formatUser(user));
});
// GET /api/auth/me/
router.get('/me/', auth_1.authenticate, async (req, res) => {
    const user = await db_1.prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
        res.status(404).json({ detail: 'Not found.' });
        return;
    }
    res.json(formatUser(user));
});
// PATCH /api/auth/me/
router.patch('/me/', auth_1.authenticate, async (req, res) => {
    const { first_name, last_name, email, phone, dni } = req.body;
    const user = await db_1.prisma.user.update({
        where: { id: req.user.userId },
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
router.post('/change-password/', auth_1.authenticate, async (req, res) => {
    const { old_password, new_password } = req.body;
    if (!old_password || !new_password) {
        res.status(400).json({ detail: 'old_password y new_password son requeridos.' });
        return;
    }
    const user = await db_1.prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user || !(await bcryptjs_1.default.compare(old_password, user.password))) {
        res.status(400).json({ old_password: 'Contraseña incorrecta.' });
        return;
    }
    if (new_password.length < 8) {
        res.status(400).json({ new_password: 'La contraseña debe tener al menos 8 caracteres.' });
        return;
    }
    await db_1.prisma.user.update({
        where: { id: user.id },
        data: { password: await bcryptjs_1.default.hash(new_password, 12) },
    });
    res.json({ detail: 'Contraseña actualizada correctamente.' });
});
// GET /api/auth/users/
router.get('/users/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (_req, res) => {
    const users = await db_1.prisma.user.findMany({ orderBy: { dateJoined: 'desc' } });
    res.json(users.map(formatUserAdmin));
});
// GET /api/auth/users/:id/
router.get('/users/:id/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (req, res) => {
    const user = await db_1.prisma.user.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!user) {
        res.status(404).json({ detail: 'Not found.' });
        return;
    }
    res.json(formatUserAdmin(user));
});
// PATCH /api/auth/users/:id/
router.patch('/users/:id/', auth_1.authenticate, auth_1.requireAdminOrStaff, async (req, res) => {
    const { first_name, last_name, email, phone, dni, role, is_active } = req.body;
    try {
        const user = await db_1.prisma.user.update({
            where: { id: parseInt(req.params.id) },
            data: {
                ...(first_name !== undefined ? { firstName: first_name } : {}),
                ...(last_name !== undefined ? { lastName: last_name } : {}),
                ...(email !== undefined ? { email: email } : {}),
                ...(phone !== undefined ? { phone: phone } : {}),
                ...(dni !== undefined ? { dni: dni } : {}),
                ...(role !== undefined ? { role: role } : {}),
                ...(is_active !== undefined ? { isActive: is_active } : {}),
            },
        });
        res.json(formatUserAdmin(user));
    }
    catch {
        res.status(404).json({ detail: 'Not found.' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map