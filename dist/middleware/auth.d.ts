import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
export declare function authenticate(req: AuthRequest, res: Response, next: NextFunction): void;
export declare function requireAdminOrStaff(req: AuthRequest, res: Response, next: NextFunction): void;
export declare function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void;
