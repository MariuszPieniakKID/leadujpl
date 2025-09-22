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
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

export function requireManagerOrAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}


