import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import app from '../src/index';
import { seedDefaultUser, userStore } from '../src/models/userStore';
import { JWTPayload, User } from '../src/types';

const JWT_SECRET = process.env.JWT_SECRET ?? 'default-secret-key-change-in-production';

beforeAll(async () => {
  // Seed the default user before running tests
  await seedDefaultUser();
});

afterAll(() => {
  // Clean up user store after tests
  userStore.clear();
});

/**
 * Helper function to register a user with a specific email case
 */
async function registerUser(email: string, password: string): Promise<User> {
  const passwordHash = await bcrypt.hash(password, 10);
  const user: User = {
    id: uuidv4(),
    email,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  userStore.set(email.toLowerCase(), user);
  return user;
}

describe('POST /auth/login', () => {
  describe('Successful authentication', () => {
    it('returns 200 with token and expiresIn for valid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .send({
          email: 'user@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('expiresIn', 3600);
      expect(typeof response.body.token).toBe('string');
    });

    it('returns a valid JWT with correct payload', async () => {
      const response = await request(app)
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .send({
          email: 'user@example.com',
          password: 'password123',
        });

      const { token } = response.body;
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

      expect(decoded).toHaveProperty('sub');
      expect(decoded).toHaveProperty('email', 'user@example.com');
      expect(decoded).toHaveProperty('iat');
      expect(decoded).toHaveProperty('exp');
      expect(decoded.exp - decoded.iat).toBe(3600);
    });

    it('is case-insensitive for email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .send({
          email: 'USER@EXAMPLE.COM',
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
    });

    it('authenticates user registered with uppercase email using lowercase login', async () => {
      // Register a new user with uppercase email
      await registerUser('ADMIN@EXAMPLE.COM', 'SecurePass123');

      const response = await request(app)
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .send({
          email: 'admin@example.com',
          password: 'SecurePass123',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('expiresIn', 3600);

      // Verify token contains the original email from registration
      const { token } = response.body;
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      expect(decoded.email).toBe('ADMIN@EXAMPLE.COM');
    });
  });

  describe('Invalid credentials', () => {
    it('returns 401 for wrong password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .send({
          email: 'user@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid email or password',
        instance: '/auth/login',
      });
    });

    it('returns 401 for non-existent email with same message', async () => {
      const response = await request(app)
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .send({
          email: 'notfound@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid email or password',
        instance: '/auth/login',
      });
    });
  });

  describe('Validation errors', () => {
    it('returns 400 when email is missing', async () => {
      const response = await request(app)
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .send({
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        detail: 'Missing required fields: email',
        instance: '/auth/login',
      });
    });

    it('returns 400 when password is missing', async () => {
      const response = await request(app)
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .send({
          email: 'user@example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        detail: 'Missing required fields: password',
        instance: '/auth/login',
      });
    });

    it('returns 400 when both email and password are missing', async () => {
      const response = await request(app)
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        detail: 'Missing required fields: email, password',
        instance: '/auth/login',
      });
    });

    it('returns 415 for non-JSON Content-Type', async () => {
      const response = await request(app)
        .post('/auth/login')
        .set('Content-Type', 'text/plain')
        .send('email=user@example.com&password=password123');

      expect(response.status).toBe(415);
      expect(response.body).toMatchObject({
        type: 'about:blank',
        title: 'Unsupported Media Type',
        status: 415,
        detail: 'Content-Type must be application/json',
        instance: '/auth/login',
      });
    });

    it('returns 415 when Content-Type header is missing', async () => {
      const response = await request(app)
        .post('/auth/login')
        .set('Content-Type', '')
        .send(JSON.stringify({
          email: 'user@example.com',
          password: 'password123',
        }));

      expect(response.status).toBe(415);
      expect(response.body).toMatchObject({
        type: 'about:blank',
        title: 'Unsupported Media Type',
        status: 415,
        detail: 'Content-Type must be application/json',
        instance: '/auth/login',
      });
    });
  });
});
