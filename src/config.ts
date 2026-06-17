import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT ?? '8000', 10),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-in-prod',
  jwtRefreshSecret: (process.env.JWT_SECRET ?? 'dev-secret-change-in-prod') + '-refresh',
  jwtAccessExpiry: '8h' as const,
  jwtRefreshExpiry: '7d' as const,
  corsOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(',').map(s => s.trim()),
  nodeEnv: process.env.NODE_ENV ?? 'development',
};
