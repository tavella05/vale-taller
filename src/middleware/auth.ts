import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthRequest, TokenPayload } from '../types';

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ detail: 'Authentication credentials were not provided.' });
    return;
  }
  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, config.jwtSecret) as TokenPayload;
    next();
  } catch {
    res.status(401).json({ detail: 'Token is invalid or expired.' });
  }
}

export function requireAdminOrStaff(req: AuthRequest, res: Response, next: NextFunction): void {
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

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), config.jwtSecret) as TokenPayload;
    } catch {
      // invalid token — proceed as unauthenticated
    }
  }
  next();
}
