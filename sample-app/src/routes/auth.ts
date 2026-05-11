import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { LoginRequest, LoginResponse, ProblemDetails, JWTPayload } from '../types';
import { findUserByEmail } from '../models/userStore';
import { requireJsonContentType } from '../middleware/contentType';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET ?? 'default-secret-key-change-in-production';
const JWT_EXPIRY = parseInt(process.env.JWT_EXPIRY ?? '3600', 10);

/**
 * @route POST /auth/login
 * @param {LoginRequest} req.body - Email and password
 * @returns {LoginResponse} JWT token with expiry time
 *
 * Authenticates user credentials and returns a signed JWT token.
 * Spec: specs/user-auth-spec.md
 */
router.post(
  '/auth/login',
  requireJsonContentType,
  async (req: Request, res: Response): Promise<void> => {
    const body = req.body as Partial<LoginRequest>;

    // Validate required fields
    const missingFields: string[] = [];
    if (!body.email) missingFields.push('email');
    if (!body.password) missingFields.push('password');

    if (missingFields.length > 0) {
      const problem: ProblemDetails = {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        detail: `Missing required fields: ${missingFields.join(', ')}`,
        instance: req.path,
      };
      res.status(400).json(problem);
      return;
    }

    const { email, password } = body as LoginRequest;

    // Find user (case-insensitive)
    const user = findUserByEmail(email);

    // Use constant-time comparison for password
    // If user not found, still perform bcrypt comparison to prevent timing attacks
    const passwordHash = user?.passwordHash ?? '$2b$10$invalidhashtopreventtimingattacks';
    const isValid = await bcrypt.compare(password, passwordHash);

    if (!user || !isValid) {
      console.log(`[Auth] Failed login attempt for email: ${email}`);
      const problem: ProblemDetails = {
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid email or password',
        instance: req.path,
      };
      res.status(401).json(problem);
      return;
    }

    // Generate JWT token
    const now = Math.floor(Date.now() / 1000);
    const payload: JWTPayload = {
      sub: user.id,
      email: user.email,
      iat: now,
      exp: now + JWT_EXPIRY,
    };

    const token = jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });

    console.log(`[Auth] Successful login for user: ${email}`);

    const response: LoginResponse = {
      token,
      expiresIn: JWT_EXPIRY,
    };

    res.status(200).json(response);
  }
);

export default router;
