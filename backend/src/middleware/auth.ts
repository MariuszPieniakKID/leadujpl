import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export type JwtUser = { id: string; role: 'ADMIN' | 'MANAGER' | 'SALES_REP' };

declare global {
  namespace Express {
    interface Request {
      user?: JwtUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  let token: string | undefined;
  if (auth && auth.startsWith('Bearer ')) {
    token = auth.slice(7);
  } else if (typeof req.query.token === 'string' && req.query.token.length > 0) {
    token = req.query.token;
  }
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret') as JwtUser;
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    console.error('[requireAdmin] No user found in request');
    return res.status(403).json({ error: 'Forbidden: No user authenticated' });
  }
  if (req.user.role !== 'ADMIN') {
    console.error('[requireAdmin] User role is not ADMIN:', req.user.role);
    return res.status(403).json({ error: 'Forbidden: Admin role required' });
  }
  next();
}

export function requireManagerOrAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}


