import { Request } from 'express';

export interface TokenPayload {
  userId: number;
  username: string;
  role: string;
  full_name: string;
}

export interface AuthRequest extends Request {
  user?: TokenPayload;
}
