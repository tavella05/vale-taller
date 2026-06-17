"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    port: parseInt(process.env.PORT ?? '8000', 10),
    jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-in-prod',
    jwtRefreshSecret: (process.env.JWT_SECRET ?? 'dev-secret-change-in-prod') + '-refresh',
    jwtAccessExpiry: '8h',
    jwtRefreshExpiry: '7d',
    corsOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(',').map(s => s.trim()),
    nodeEnv: process.env.NODE_ENV ?? 'development',
};
//# sourceMappingURL=config.js.map