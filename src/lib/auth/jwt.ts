// src/lib/auth/jwt.ts
import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "super-secret-change-me";

export function sign<T extends object = any>(payload: T): string {
  return jwt.sign(payload, SECRET);
}

export function verify<T = any>(token: string): T | null {
  try {
    return jwt.verify(token, SECRET) as T;
  } catch {
    return null;
  }
}