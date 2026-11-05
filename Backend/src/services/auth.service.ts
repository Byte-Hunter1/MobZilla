import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../lib/errors";
import { prisma } from "../lib/prisma";

function tokenFor(user: { id: string; email: string }) {
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"] };
  return jwt.sign({ email: user.email }, env.JWT_SECRET, { subject: user.id, ...options });
}

function publicUser(user: { id: string; email: string; name: string | null }) {
  return { id: user.id, email: user.email, name: user.name };
}

export async function register(input: { email: string; password: string; name?: string }) {
  const email = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(409, "An account with that email already exists", "CONFLICT");
  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, name: input.name?.trim() || null }
  });
  return { token: tokenFor(user), user: publicUser(user) };
}

export async function login(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new AppError(401, "Email or password is incorrect", "UNAUTHORIZED");
  }
  return { token: tokenFor(user), user: publicUser(user) };
}

export async function me(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(401, "Sign in required", "UNAUTHORIZED");
  return publicUser(user);
}
