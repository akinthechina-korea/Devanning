import { db } from "./db";
import { sql } from "drizzle-orm";
import { inboundList } from "@shared/schema";

async function seed() {
  console.log("🌱 Starting database seed...");

  try {
    console.log("Truncating inbound_list table...");
    await db.execute(sql`TRUNCATE TABLE inbound_list RESTART IDENTITY CASCADE`);

    console.log("Inserting test data...");
    // Admin account (id=1)에 테스트 데이터 할당
    const ADMIN_USER_ID = 1;
    
    const testData = [
      {
        userId: ADMIN_USER_ID,
        반입번호: "A001",
        no: "1",
        도착Time: "09:00",
        출발Time: "08:00",
        도착예정Time: "10:00",
        blNo: "TEST-BL-001",
        itemNo: "ITEM-001",
        dept: "Dept A",
        description: "Test Product 1",
        qty: "100",
        qty_이상유무: "OK",
        containerCntrNo: "CNTR001",
        containerSealNo: "SEAL001",
        containerTemp: "DRY",
        container_파손유무: "NO",
        palletQty: "10",
        mpk: "MPK1",
        box: "500",
        unit: "EA",
        palletType: "Standard",
        제품확인_블록: "Block 1",
        제품확인Coo: "Korea",
        제품확인Remark: "All OK",
        수작업_유형: "Manual",
        차량번호: "TRUCK-001",
        비고: "Test note 1",
        구분: "Category A",
        수입자: "Test Importer",
        costcoBlNo: "COSTCO-BL-001",
        tie: "5",
        높이: "120cm",
        반입일자: "2025-10-31",
      },
      {
        userId: ADMIN_USER_ID,
        반입번호: "A002",
        no: "2",
        도착Time: "10:00",
        출발Time: "09:00",
        도착예정Time: "11:00",
        blNo: "TEST-BL-001",
        itemNo: "ITEM-002",
        dept: "Dept A",
        description: "Test Product 2",
        qty: "200",
        qty_이상유무: "OK",
        containerCntrNo: "CNTR001",
        containerSealNo: "SEAL001",
        containerTemp: "DRY",
        container_파손유무: "NO",
        palletQty: "20",
        mpk: "MPK2",
        box: "1000",
        unit: "EA",
        palletType: "Standard",
        제품확인_블록: "Block 1",
        제품확인Coo: "Korea",
        제품확인Remark: "All OK",
        수작업_유형: "Manual",
        차량번호: "TRUCK-001",
        비고: "Test note 2",
        구분: "Category A",
        수입자: "Test Importer",
        costcoBlNo: "COSTCO-BL-001",
        tie: "5",
        높이: "100cm",
        반입일자: "2025-10-31",
      },
      {
        userId: ADMIN_USER_ID,
        반입번호: "B001",
        no: "3",
        도착Time: "11:00",
        출발Time: "10:00",
        도착예정Time: "12:00",
        blNo: "TEST-BL-002",
        itemNo: "ITEM-003",
        dept: "Dept B",
        description: "Test Product 3",
        qty: "150",
        qty_이상유무: "OK",
        containerCntrNo: "CNTR002",
        containerSealNo: "SEAL002",
        containerTemp: "COLD",
        container_파손유무: "NO",
        palletQty: "15",
        mpk: "MPK3",
        box: "750",
        unit: "BOX",
        palletType: "Special",
        제품확인_블록: "Block 2",
        제품확인Coo: "USA",
        제품확인Remark: "Needs inspection",
        수작업_유형: "Auto",
        차량번호: "TRUCK-002",
        비고: "Refrigerated",
        구분: "Category B",
        수입자: "Test Importer 2",
        costcoBlNo: "COSTCO-BL-002",
        tie: "4",
        높이: "110cm",
        반입일자: "2025-10-31",
      },
    ];

    const result = [];
    for (const data of testData) {
      const [inserted] = await db.insert(inboundList).values(data).returning();
      result.push(inserted);
    }

    console.log(`✅ Successfully seeded ${result.length} test records`);
    console.log("Test records:", result.map((r) => `ID ${r.id}: ${r.description}`).join(", "));
  } catch (error) {
    console.error("❌ Seed failed:", error);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then(() => {
      console.log("✅ Seed completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Seed failed:", error);
      process.exit(1);
    });
}

export { seed };
