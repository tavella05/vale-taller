"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.requireAdminOrStaff = requireAdminOrStaff;
exports.optionalAuth = optionalAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ detail: 'Authentication credentials were not provided.' });
        return;
    }
    const token = header.slice(7);
    try {
        req.user = jsonwebtoken_1.default.verify(token, config_1.config.jwtSecret);
        next();
    }
    catch {
        res.status(401).json({ detail: 'Token is invalid or expired.' });
    }
}
function requireAdminOrStaff(req, res, next) {
    if (!req.user) {
        res.status(401).json({ detail: 'Authentication credentials were not provided.' });
        return;
    }
    if (req.user.role !== 'admin' && req.user.role !== 'staff') {
        res.status(403).json({ detail: 'You do not have permission to perform this action.' });
        return;
    }
    next();
}
function optionalAuth(req, _res, next) {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
        try {
            req.user = jsonwebtoken_1.default.verify(header.slice(7), config_1.config.jwtSecret);
        }
        catch {
            // invalid token — proceed as unauthenticated
        }
    }
    next();
}
//# sourceMappingURL=auth.js.map