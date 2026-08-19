export type UserStatus = "active" | "disabled";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  status: UserStatus;
  roleId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Excludes passwordHash — never return the hash to a caller outside this module's infrastructure layer. */
export type PublicUser = Omit<User, "passwordHash">;

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

export class EmailAlreadyRegisteredError extends Error {
  constructor(email: string) {
    super(`Email already registered: ${email}`);
    this.name = "EmailAlreadyRegisteredError";
  }
}

/**
 * Deliberately generic — used for both "no user with this email" and
 * "wrong password" so a caller cannot distinguish account existence from a
 * bad password (CLAUDE.md §57: "can this endpoint be abused?").
 */
export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password");
    this.name = "InvalidCredentialsError";
  }
}

export class UserNotActiveError extends Error {
  constructor() {
    super("User account is not active");
    this.name = "UserNotActiveError";
  }
}

export class UserNotFoundError extends Error {
  constructor(id: string) {
    super(`User not found: ${id}`);
    this.name = "UserNotFoundError";
  }
}
