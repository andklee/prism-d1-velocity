import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { User } from '../types';

/**
 * In-memory user store (keyed by lowercase email)
 * Spec: specs/user-auth-spec.md
 */
export const userStore = new Map<string, User>();

/**
 * Seeds the user store with a default test user
 * Default credentials: user@example.com / password123
 */
export async function seedDefaultUser(): Promise<void> {
  const email = 'user@example.com';
  const password = 'password123';
  const passwordHash = await bcrypt.hash(password, 10);

  const user: User = {
    id: uuidv4(),
    email,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  userStore.set(email.toLowerCase(), user);
  console.log(`[UserStore] Seeded default user: ${email}`);
}

/**
 * Find a user by email (case-insensitive)
 */
export function findUserByEmail(email: string): User | undefined {
  return userStore.get(email.toLowerCase());
}
