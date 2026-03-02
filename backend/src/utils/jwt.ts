import jwt, { SignOptions } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

export interface JwtPayload {
  userId: string;
  email: string;
}

export function signToken(payload: JwtPayload): string {
  const options: SignOptions = { expiresIn: JWT_EXPIRES_IN as any };
  return jwt.sign(payload as object, JWT_SECRET, options);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
