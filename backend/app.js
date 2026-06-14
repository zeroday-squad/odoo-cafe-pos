const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("./config/db");
const { auth, allowRoles } = require("./middleware/authmiddleware");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

let ioRef = null;
function setSocket(io) {
  ioRef = io;
}

const siteConfig = {
  appName: process.env.APP_NAME || "Odoo Cafe POS",
  brandName: process.env.BRAND_NAME || "Cafe POS",
  tagline:
    process.env.APP_TAGLINE ||
    "Run every table, ticket, and payment from one fast cafe console.",
  loginHeadline:
    process.env.LOGIN_HEADLINE ||
    "One screen for cafe orders, kitchen flow, and payments.",
};

function signUser(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: "7d" }
  );
}

function publicUser(user) {
  const { password, ...safe } = user;
  return safe;
}

function emitKitchen(ticket) {
  if (ioRef) {
    ioRef.emit("kitchen:ticket-updated", ticket);
  }
}

function makeOrderNumber() {
  return `ORD-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 90 + 10)}`;
}

function applyDiscount(amount, type, value) {
  if (!value) return 0;
  return type === "percentage" ? amount * (value / 100) : value;
}

async function calculateOrder(items, couponCode) {
  const productIds = items.map((item) => Number(item.productId));
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, active: true },
    include: { category: true },
  });
  const productMap = new Map(products.map((product) => [product.id, product]));
  const promotions = await prisma.promotion.findMany({ where: { active: true } });

  let subtotal = 0;
  let tax = 0;
  let discount = 0;

  const orderItems = items.map((item) => {
    const product = productMap.get(Number(item.productId));
    if (!product) {
      throw new Error("Product not found");
    }
    const quantity = Math.max(1, Number(item.quantity || 1));
    const gross = product.price * quantity;
    let lineDiscount = 0;
    const promo = promotions.find(
      (promotion) =>
        promotion.scope === "product" &&
        promotion.productId === product.id &&
        quantity >= (promotion.minQuantity || 1)
    );
    if (promo) {
      lineDiscount = applyDiscount(gross, promo.discountType, promo.discountValue);
    }
    const taxable = Math.max(0, gross - lineDiscount);
    const lineTax = taxable * ((product.tax || 0) / 100);
    subtotal += gross;
    tax += lineTax;
    discount += lineDiscount;

    return {
      productId: product.id,
      name: product.name,
      quantity,
      unitPrice: product.price,
      tax: Number(lineTax.toFixed(2)),
      discount: Number(lineDiscount.toFixed(2)),
      lineTotal: Number((taxable + lineTax).toFixed(2)),
    };
  });

  const beforeOrderDiscount = subtotal + tax - discount;
  const orderPromotion = promotions.find(
    (promotion) =>
      promotion.scope === "order" &&
      beforeOrderDiscount >= (promotion.minOrderAmount || 0)
  );
  if (orderPromotion) {
    discount += applyDiscount(beforeOrderDiscount, orderPromotion.discountType, orderPromotion.discountValue);
  }

  if (couponCode) {
    const coupon = await prisma.coupon.findFirst({
      where: { code: couponCode.trim().toUpperCase(), active: true },
    });
    if (!coupon) {
      throw new Error("Invalid coupon code");
    }
    discount += applyDiscount(beforeOrderDiscount, coupon.discountType, coupon.discountValue);
  }

  const total = Math.max(0, subtotal + tax - discount);
  return {
    items: orderItems,
    subtotal: Number(subtotal.toFixed(2)),
    tax: Number(tax.toFixed(2)),
    discount: Number(discount.toFixed(2)),
    total: Number(total.toFixed(2)),
  };
}

const orderInclude = {
  table: { include: { floor: true } },
  customer: true,
  createdBy: { select: { id: true, name: true, email: true, role: true } },
  items: { include: { product: { include: { category: true } } } },
  payments: { include: { paymentMethod: true } },
  kitchenTicket: {
    include: {
      items: { include: { orderItem: true } },
    },
  },
};

async function kitchenTicketPayload(ticketId) {
  return prisma.kitchenTicket.findUnique({
    where: { id: ticketId },
    include: {
      order: {
        include: {
          table: { include: { floor: true } },
          customer: true,
        },
      },
      items: { include: { orderItem: true } },
    },
  });
}

app.get("/", (req, res) => {
  res.json({
    name: `${siteConfig.appName} API`,
    tagline: siteConfig.tagline,
    status: "running",
  });
});

app.get("/api/public/site", async (req, res) => {
  const demoUsers = await prisma.user.findMany({
    where: {
      email: { in: ["admin@cafepos.com", "cashier@cafepos.com"] },
      status: true,
    },
    select: { name: true, email: true, role: true },
    orderBy: { role: "asc" },
  });

  res.json({
    ...siteConfig,
    demoAccounts: demoUsers,
  });
});

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password, role = "employee" } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email: email.toLowerCase(), password: hashed, role },
    });
    res.status(201).json({ user: publicUser(user), token: signUser(user) });
  } catch (error) {
    res.status(400).json({ message: "Could not create account", error: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email: String(email || "").toLowerCase() } });
  if (!user || !(await bcrypt.compare(password || "", user.password))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }
  if (!user.status) {
    return res.status(403).json({ message: "Account archived" });
  }
  res.json({ user: publicUser(user), token: signUser(user) });
});

app.get("/api/auth/me", auth, (req, res) => res.json({ user: req.user }));

app.get("/api/bootstrap", auth, async (req, res) => {
  const [categories, products, floors, paymentMethods, customers, coupons, promotions, openSession] =
    await Promise.all([
      prisma.category.findMany({ orderBy: { name: "asc" } }),
      prisma.product.findMany({ include: { category: true }, orderBy: { name: "asc" } }),
      prisma.floor.findMany({
        include: {
          tables: {
            include: {
              orders: {
                where: { status: { in: ["draft", "sent"] } },
                select: {
                  id: true,
                  orderNumber: true,
                  status: true,
                  total: true,
                  kitchenTicket: { select: { stage: true } },
                },
                orderBy: { createdAt: "desc" },
              },
            },
            orderBy: { number: "asc" },
          },
        },
      }),
      prisma.paymentMethod.findMany({ orderBy: { id: "asc" } }),
      prisma.customer.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.coupon.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.promotion.findMany({ include: { product: true }, orderBy: { id: "desc" } }),
      prisma.session.findFirst({
        where: { openedById: req.user.id, status: "open" },
        orderBy: { openedAt: "desc" },
      }),
    ]);
  res.json({ categories, products, floors, paymentMethods, customers, coupons, promotions, openSession });
});

app.get("/api/users", auth, allowRoles("admin"), async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(users);
});

app.post("/api/users", auth, allowRoles("admin"), async (req, res) => {
  const { name, email, password = "welcome123", role = "employee" } = req.body;
  const user = await prisma.user.create({
    data: { name, email: email.toLowerCase(), password: await bcrypt.hash(password, 10), role },
  });
  res.status(201).json(publicUser(user));
});

app.patch("/api/users/:id", auth, allowRoles("admin"), async (req, res) => {
  const data = { ...req.body };
  if (data.password) data.password = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.update({ where: { id: Number(req.params.id) }, data });
  res.json(publicUser(user));
});

app.delete("/api/users/:id", auth, allowRoles("admin"), async (req, res) => {
  await prisma.user.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});

function crudRoutes(path, model, include) {
  app.get(`/api/${path}`, auth, async (req, res) => {
    const rows = await prisma[model].findMany({ include, orderBy: { id: "desc" } });
    res.json(rows);
  });
  app.post(`/api/${path}`, auth, async (req, res) => {
    const row = await prisma[model].create({ data: req.body, include });
    res.status(201).json(row);
  });
  app.patch(`/api/${path}/:id`, auth, async (req, res) => {
    const row = await prisma[model].update({ where: { id: Number(req.params.id) }, data: req.body, include });
    res.json(row);
  });
  app.delete(`/api/${path}/:id`, auth, async (req, res) => {
    await prisma[model].delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  });
}

crudRoutes("categories", "category");
crudRoutes("customers", "customer");
crudRoutes("coupons", "coupon");
crudRoutes("payment-methods", "paymentMethod");
crudRoutes("promotions", "promotion", { product: true });

app.get("/api/products", auth, async (req, res) => {
  res.json(await prisma.product.findMany({ include: { category: true }, orderBy: { id: "desc" } }));
});

app.post("/api/products", auth, async (req, res) => {
  const data = { ...req.body, categoryId: Number(req.body.categoryId), price: Number(req.body.price), tax: Number(req.body.tax || 0) };
  res.status(201).json(await prisma.product.create({ data, include: { category: true } }));
});

app.patch("/api/products/:id", auth, async (req, res) => {
  const data = { ...req.body };
  if (data.categoryId) data.categoryId = Number(data.categoryId);
  if (data.price !== undefined) data.price = Number(data.price);
  if (data.tax !== undefined) data.tax = Number(data.tax);
  res.json(await prisma.product.update({ where: { id: Number(req.params.id) }, data, include: { category: true } }));
});

app.delete("/api/products/:id", auth, async (req, res) => {
  await prisma.product.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});

app.get("/api/floors", auth, async (req, res) => {
  res.json(await prisma.floor.findMany({ include: { tables: true }, orderBy: { id: "asc" } }));
});

app.post("/api/floors", auth, async (req, res) => {
  res.status(201).json(await prisma.floor.create({ data: { name: req.body.name }, include: { tables: true } }));
});

app.post("/api/tables", auth, async (req, res) => {
  const table = await prisma.cafeTable.create({
    data: { number: req.body.number, seats: Number(req.body.seats), active: req.body.active ?? true, floorId: Number(req.body.floorId) },
  });
  res.status(201).json(table);
});

app.patch("/api/tables/:id", auth, async (req, res) => {
  const data = { ...req.body };
  if (data.seats !== undefined) data.seats = Number(data.seats);
  if (data.floorId !== undefined) data.floorId = Number(data.floorId);
  res.json(await prisma.cafeTable.update({ where: { id: Number(req.params.id) }, data }));
});

app.get("/api/sessions/open", auth, async (req, res) => {
  let session = await prisma.session.findFirst({
    where: { openedById: req.user.id, status: "open" },
    orderBy: { openedAt: "desc" },
  });
  if (!session) {
    session = await prisma.session.create({
      data: { openedById: req.user.id, openingCash: Number(req.query.openingCash || 0) },
    });
  }
  res.json(session);
});

app.post("/api/sessions/:id/close", auth, async (req, res) => {
  const sessionId = Number(req.params.id);
  const totals = await prisma.order.aggregate({
    where: { sessionId, status: "paid" },
    _sum: { total: true },
    _count: { id: true },
  });
  const session = await prisma.session.update({
    where: { id: sessionId },
    data: {
      status: "closed",
      closingCash: Number(req.body.closingCash || 0),
      closingSales: totals._sum.total || 0,
      closedAt: new Date(),
    },
  });
  res.json({ session, totalOrders: totals._count.id, closingSales: totals._sum.total || 0 });
});

app.get("/api/orders", auth, async (req, res) => {
  const where = {};
  if (req.query.sessionId) where.sessionId = Number(req.query.sessionId);
  res.json(await prisma.order.findMany({ where, include: orderInclude, orderBy: { createdAt: "desc" } }));
});

app.post("/api/orders", auth, async (req, res) => {
  try {
    const totals = await calculateOrder(req.body.items || [], req.body.couponCode);
    const order = await prisma.order.create({
      data: {
        orderNumber: makeOrderNumber(),
        tableId: req.body.tableId ? Number(req.body.tableId) : null,
        customerId: req.body.customerId ? Number(req.body.customerId) : null,
        sessionId: req.body.sessionId ? Number(req.body.sessionId) : null,
        createdById: req.user.id,
        couponCode: req.body.couponCode ? req.body.couponCode.toUpperCase() : null,
        subtotal: totals.subtotal,
        tax: totals.tax,
        discount: totals.discount,
        total: totals.total,
        items: { create: totals.items },
      },
      include: orderInclude,
    });
    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.patch("/api/orders/:id", auth, async (req, res) => {
  const orderId = Number(req.params.id);
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing || existing.status !== "draft") {
    return res.status(400).json({ message: "Only draft orders can be edited" });
  }
  const totals = await calculateOrder(req.body.items || [], req.body.couponCode);
  await prisma.orderItem.deleteMany({ where: { orderId } });
  const order = await prisma.order.update({
    where: { id: orderId },
    data: {
      tableId: req.body.tableId ? Number(req.body.tableId) : null,
      customerId: req.body.customerId ? Number(req.body.customerId) : null,
      couponCode: req.body.couponCode ? req.body.couponCode.toUpperCase() : null,
      subtotal: totals.subtotal,
      tax: totals.tax,
      discount: totals.discount,
      total: totals.total,
      items: { create: totals.items },
    },
    include: orderInclude,
  });
  res.json(order);
});

app.post("/api/orders/:id/send-to-kitchen", auth, async (req, res) => {
  const orderId = Number(req.params.id);
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: { include: { product: true } } } });
  if (!order) return res.status(404).json({ message: "Order not found" });

  const kitchenItems = order.items.filter((item) => item.product.kitchen);
  const ticket = await prisma.kitchenTicket.upsert({
    where: { orderId },
    create: {
      orderId,
      stage: "to_cook",
      items: { create: kitchenItems.map((item) => ({ orderItemId: item.id })) },
    },
    update: { stage: "to_cook" },
  });
  await prisma.order.update({ where: { id: orderId }, data: { status: "sent" } });
  const payload = await kitchenTicketPayload(ticket.id);
  emitKitchen(payload);
  res.json(payload);
});

app.post("/api/orders/:id/pay", auth, async (req, res) => {
  const orderId = Number(req.params.id);
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return res.status(404).json({ message: "Order not found" });
  const method = await prisma.paymentMethod.findUnique({ where: { id: Number(req.body.paymentMethodId) } });
  if (!method || !method.enabled) return res.status(400).json({ message: "Payment method unavailable" });
  await prisma.payment.create({
    data: {
      orderId,
      paymentMethodId: method.id,
      amount: order.total,
      receivedAmount: req.body.receivedAmount ? Number(req.body.receivedAmount) : null,
      changeDue: req.body.receivedAmount ? Math.max(0, Number(req.body.receivedAmount) - order.total) : null,
      reference: req.body.reference || null,
    },
  });
  const paid = await prisma.order.update({
    where: { id: orderId },
    data: { status: "paid", paidAt: new Date() },
    include: orderInclude,
  });
  res.json(paid);
});

app.post("/api/orders/:id/cancel", auth, async (req, res) => {
  res.json(await prisma.order.update({
    where: { id: Number(req.params.id) },
    data: { status: "cancelled" },
    include: orderInclude,
  }));
});

app.get("/api/kitchen/tickets", auth, async (req, res) => {
  res.json(await prisma.kitchenTicket.findMany({
    where: { stage: { not: "completed" } },
    include: {
      order: { include: { table: { include: { floor: true } }, customer: true } },
      items: { include: { orderItem: true } },
    },
    orderBy: { createdAt: "asc" },
  }));
});

app.patch("/api/kitchen/tickets/:id/stage", auth, async (req, res) => {
  const stages = ["to_cook", "preparing", "completed"];
  const ticket = await prisma.kitchenTicket.findUnique({ where: { id: Number(req.params.id) } });
  const nextStage = req.body.stage || stages[Math.min(stages.indexOf(ticket.stage) + 1, stages.length - 1)];
  const updated = await prisma.kitchenTicket.update({
    where: { id: ticket.id },
    data: { stage: nextStage },
  });
  const payload = await kitchenTicketPayload(updated.id);
  emitKitchen(payload);
  res.json(payload);
});

app.patch("/api/kitchen/items/:id", auth, async (req, res) => {
  const item = await prisma.kitchenTicketItem.update({
    where: { id: Number(req.params.id) },
    data: { completed: Boolean(req.body.completed) },
    include: { kitchenTicket: true },
  });
  const payload = await kitchenTicketPayload(item.kitchenTicketId);
  emitKitchen(payload);
  res.json(payload);
});

app.get("/api/reports/summary", auth, async (req, res) => {
  const paidOrders = await prisma.order.findMany({
    where: { status: "paid" },
    include: { items: { include: { product: { include: { category: true } } } }, customer: true },
    orderBy: { paidAt: "desc" },
  });
  const revenue = paidOrders.reduce((sum, order) => sum + order.total, 0);
  const productMap = new Map();
  const categoryMap = new Map();

  paidOrders.forEach((order) => {
    order.items.forEach((item) => {
      const product = productMap.get(item.productId) || { name: item.name, quantity: 0, revenue: 0 };
      product.quantity += item.quantity;
      product.revenue += item.lineTotal;
      productMap.set(item.productId, product);

      const categoryName = item.product.category.name;
      const category = categoryMap.get(categoryName) || { name: categoryName, revenue: 0, color: item.product.category.color };
      category.revenue += item.lineTotal;
      categoryMap.set(categoryName, category);
    });
  });

  res.json({
    totalOrders: paidOrders.length,
    revenue: Number(revenue.toFixed(2)),
    averageOrderValue: paidOrders.length ? Number((revenue / paidOrders.length).toFixed(2)) : 0,
    topOrders: paidOrders.slice(0, 8),
    topProducts: [...productMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8),
    topCategories: [...categoryMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8),
    trend: paidOrders.slice(0, 14).reverse().map((order) => ({
      label: new Date(order.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      revenue: order.total,
    })),
  });
});

module.exports = { app, setSocket };
