import { Request, Response, NextFunction } from 'express';
import { ProblemDetails } from '../types';

/**
 * Middleware to validate Content-Type is application/json
 * Returns RFC 7807 Problem Details on validation failure
 */
export function requireJsonContentType(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const contentType = req.get('Content-Type');

  if (!contentType || !contentType.includes('application/json')) {
    const problem: ProblemDetails = {
      type: 'about:blank',
      title: 'Unsupported Media Type',
      status: 415,
      detail: 'Content-Type must be application/json',
      instance: req.path,
    };
    res.status(415).json(problem);
    return;
  }

  next();
}
