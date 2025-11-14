import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

async function initAdmin() {
  try {
    // admin 계정이 이미 존재하는지 확인
    const [existingAdmin] = await db
      .select()
      .from(users)
      .where(eq(users.username, "admin"))
      .limit(1);

    if (existingAdmin) {
      console.log("✓ Admin account already exists");
      return;
    }

    // admin 계정 생성
    const passwordHash = await bcrypt.hash("admin123", 12);
    
    const [newAdmin] = await db
      .insert(users)
      .values({
        username: "admin",
        passwordHash,
        role: "admin",
      })
      .returning();

    console.log("✓ Admin account created successfully");
    console.log("  Username: admin");
    console.log("  Password: admin123");
  } catch (error) {
    console.error("✗ Failed to initialize admin account:", error);
  }
}

// 즉시 실행
initAdmin();
