export interface DemoUser {
  id: string;
  name: string;
  email: string;
  password: string;
  createdAt: string;
}

const globalForUsers = globalThis as typeof globalThis & {
  __documindDemoUsers?: Map<string, DemoUser>;
};
const demoUsers = globalForUsers.__documindDemoUsers ??= new Map<string, DemoUser>();

export function findUserByEmail(email: string): DemoUser | undefined {
  return demoUsers.get(email.trim().toLowerCase());
}

export function createUser(name: string, email: string, password: string): DemoUser {
  const normalizedEmail = email.trim().toLowerCase();
  if (demoUsers.has(normalizedEmail)) {
    throw new Error("An account with this email already exists.");
  }

  const user: DemoUser = {
    id: `user_${Math.random().toString(36).slice(2, 10)}`,
    name: name.trim() || "DocuMind User",
    email: normalizedEmail,
    password,
    createdAt: new Date().toISOString(),
  };

  demoUsers.set(normalizedEmail, user);
  return user;
}

export function verifyCredentials(email: string, password: string): DemoUser | null {
  const user = findUserByEmail(email);
  if (!user || user.password !== password) return null;
  return user;
}
