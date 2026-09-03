import type { Secret, SignOptions } from "jsonwebtoken";

export const authConfig = {
  jwtSecret: (process.env.JWT_SECRET || "change_this_secret") as Secret,
  accessExpiresIn: (process.env.ACCESS_EXPIRES || "15m") as SignOptions["expiresIn"],
  refreshExpiresIn: (process.env.REFRESH_EXPIRES || "7d") as SignOptions["expiresIn"],
};
