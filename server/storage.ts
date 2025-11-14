// Storage interface for database operations
import type { User, InsertUser, SafeUser } from "@shared/schema";

export interface IStorage {
  // User management
  createUser(data: InsertUser): Promise<SafeUser>;
  getUserByUsername(username: string): Promise<User | null>;
  getUserById(id: number): Promise<SafeUser | null>;
  getAllUsers(): Promise<SafeUser[]>;
  deleteUser(id: number): Promise<void>;
}

export class MemStorage implements IStorage {
  async createUser(data: InsertUser): Promise<SafeUser> {
    throw new Error("Not implemented - use database");
  }
  async getUserByUsername(username: string): Promise<User | null> {
    throw new Error("Not implemented - use database");
  }
  async getUserById(id: number): Promise<SafeUser | null> {
    throw new Error("Not implemented - use database");
  }
  async getAllUsers(): Promise<SafeUser[]> {
    throw new Error("Not implemented - use database");
  }
  async deleteUser(id: number): Promise<void> {
    throw new Error("Not implemented - use database");
  }
}

export const storage = new MemStorage();
