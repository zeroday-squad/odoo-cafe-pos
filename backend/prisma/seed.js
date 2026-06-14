const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function upsertUser({ name, email, password, role }) {
  return prisma.user.upsert({
    where: { email },
    update: { name, role, status: true },
    create: {
      name,
      email,
      role,
      status: true,
      password: await bcrypt.hash(password, 10),
    },
  });
}

async function main() {
  const admin = await upsertUser({
    name: "Cafe Admin",
    email: "admin@cafepos.com",
    password: "admin123",
    role: "admin",
  });

  await upsertUser({
    name: "Cashier One",
    email: "cashier@cafepos.com",
    password: "cashier123",
    role: "employee",
  });

  const categoryData = [
    ["Coffee", "#7c3f24"],
    ["Tea", "#0f766e"],
    ["Snacks", "#d97706"],
    ["Desserts", "#be185d"],
    ["Cold Drinks", "#2563eb"],
  ];

  const categories = {};
  for (const [name, color] of categoryData) {
    categories[name] = await prisma.category.upsert({
      where: { name },
      update: { color },
      create: { name, color },
    });
  }

  const products = [
    ["Espresso", "Coffee", 90, "cup", 5, "Short and bold coffee shot"],
    ["Cappuccino", "Coffee", 140, "cup", 5, "Espresso with steamed milk foam"],
    ["Masala Tea", "Tea", 60, "cup", 5, "Indian spiced milk tea"],
    ["Lemon Iced Tea", "Cold Drinks", 120, "glass", 5, "Chilled tea with lemon"],
    ["Veg Sandwich", "Snacks", 160, "plate", 5, "Grilled cafe sandwich"],
    ["Cheese Garlic Bread", "Snacks", 180, "plate", 5, "Toasted bread with cheese"],
    ["Chocolate Brownie", "Desserts", 150, "piece", 5, "Warm brownie dessert"],
    ["Blueberry Muffin", "Desserts", 130, "piece", 5, "Soft baked muffin"],
  ];

  for (const [name, categoryName, price, unit, tax, description] of products) {
    const existing = await prisma.product.findFirst({ where: { name } });
    const data = {
      name,
      categoryId: categories[categoryName].id,
      price,
      unit,
      tax,
      description,
      active: true,
      kitchen: true,
    };
    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data });
    } else {
      await prisma.product.create({ data });
    }
  }

  const ground = await prisma.floor.upsert({
    where: { id: 1 },
    update: { name: "Ground Floor" },
    create: { name: "Ground Floor" },
  });
  const rooftop = await prisma.floor.upsert({
    where: { id: 2 },
    update: { name: "Rooftop" },
    create: { name: "Rooftop" },
  });

  const tableData = [
    [ground.id, "T1", 2],
    [ground.id, "T2", 4],
    [ground.id, "T3", 4],
    [ground.id, "T4", 6],
    [rooftop.id, "R1", 2],
    [rooftop.id, "R2", 4],
    [rooftop.id, "R3", 6],
  ];

  for (const [floorId, number, seats] of tableData) {
    const existing = await prisma.cafeTable.findFirst({ where: { floorId, number } });
    if (existing) {
      await prisma.cafeTable.update({ where: { id: existing.id }, data: { seats, active: true } });
    } else {
      await prisma.cafeTable.create({ data: { floorId, number, seats, active: true } });
    }
  }

  const methods = [
    ["Cash", "cash", true, null],
    ["Digital/Card", "card", true, null],
    ["UPI QR", "upi", true, "cafe@ybl"],
  ];
  for (const [name, type, enabled, upiId] of methods) {
    await prisma.paymentMethod.upsert({
      where: { type },
      update: { name, enabled, upiId },
      create: { name, type, enabled, upiId },
    });
  }

  await prisma.coupon.upsert({
    where: { code: "CAFE10" },
    update: { discountType: "percentage", discountValue: 10, active: true },
    create: { code: "CAFE10", discountType: "percentage", discountValue: 10, active: true },
  });
  await prisma.coupon.upsert({
    where: { code: "FLAT50" },
    update: { discountType: "fixed", discountValue: 50, active: true },
    create: { code: "FLAT50", discountType: "fixed", discountValue: 50, active: true },
  });

  await prisma.promotion.deleteMany({});
  const brownie = await prisma.product.findFirst({ where: { name: "Chocolate Brownie" } });
  await prisma.promotion.create({
    data: {
      name: "Buy 2 Brownies Save 15%",
      scope: "product",
      productId: brownie.id,
      minQuantity: 2,
      discountType: "percentage",
      discountValue: 15,
    },
  });
  await prisma.promotion.create({
    data: {
      name: "Orders above 500 save 40",
      scope: "order",
      minOrderAmount: 500,
      discountType: "fixed",
      discountValue: 40,
    },
  });

  await prisma.customer.upsert({
    where: { id: 1 },
    update: { name: "Walk-in Guest", email: "guest@example.com", phone: "9999999999" },
    create: { name: "Walk-in Guest", email: "guest@example.com", phone: "9999999999" },
  });

  await prisma.session.upsert({
    where: { id: 1 },
    update: { openedById: admin.id, status: "open" },
    create: { openedById: admin.id, status: "open", openingCash: 1000 },
  });

  console.log("Seed completed");
  console.log("Admin: admin@cafepos.com / admin123");
  console.log("Employee: cashier@cafepos.com / cashier123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
