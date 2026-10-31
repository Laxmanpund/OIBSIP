const dns = require("node:dns");
dns.setServers(["8.8.8.8"]);

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const Razorpay = require("razorpay");
const crypto = require("node:crypto");

const Pizza = require("./models/Pizza");
const Order = require("./models/Order");
const verifyAdmin = require("./middleware/auth");
const Inventory = require("./models/Inventory");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ],
  })
);
app.use(express.json());

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});


// Reserve inventory stock for an order
async function reserveInventoryStock(orderItems) {
  const requiredStock = new Map();

  // Calculate total ingredients required for all pizzas
  for (const orderItem of orderItems) {
    const pizza = await Pizza.findById(orderItem.pizza).populate(
      "ingredients.item"
    );

    if (!pizza || !pizza.isAvailable) {
      throw new Error(`Pizza "${orderItem.name}" is unavailable.`);
    }

    if (!pizza.ingredients || pizza.ingredients.length === 0) {
      throw new Error(
        `Ingredients are not configured for "${pizza.name}".`
      );
    }

    for (const ingredient of pizza.ingredients) {
      if (!ingredient.item) {
        throw new Error(
          `An inventory item is missing for "${pizza.name}".`
        );
      }

      const inventoryId = ingredient.item._id.toString();

      const requiredQuantity =
        ingredient.quantity * orderItem.quantity;

      requiredStock.set(
        inventoryId,
        (requiredStock.get(inventoryId) || 0) + requiredQuantity
      );
    }
  }

  const reservedMovements = [];

  try {
    // Reserve each inventory item atomically
    for (const [inventoryId, requiredQuantity] of requiredStock) {
      const inventoryItem = await Inventory.findOneAndUpdate(
        {
          _id: inventoryId,
          $expr: {
            $gte: [
              {
                $subtract: [
                  "$quantity",
                  { $ifNull: ["$reservedQuantity", 0] },
                ],
              },
              requiredQuantity,
            ],
          },
        },
        {
          $inc: {
            reservedQuantity: requiredQuantity,
          },
        },
        { new: true }
      );

      if (!inventoryItem) {
        throw new Error(
          `Insufficient stock for inventory item ${inventoryId}.`
        );
      }

      reservedMovements.push({
        item: inventoryItem._id,
        quantity: requiredQuantity,
      });
    }

    return reservedMovements;
  } catch (error) {
    // Roll back reservations if any item could not be reserved
    for (const movement of reservedMovements.reverse()) {
      await Inventory.updateOne(
        {
          _id: movement.item,
          reservedQuantity: { $gte: movement.quantity },
        },
        {
          $inc: {
            reservedQuantity: -movement.quantity,
          },
        }
      );
    }

    throw error;
  }
}


app.get("/", (req, res) => {
  res.json({ message: "Pizza Delivery API is running." });
});

// Health
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    database:
      mongoose.connection.readyState === 1
        ? "Connected"
        : "Disconnected",
  });
});

// Get pizzas
app.get("/api/pizzas", async (req, res) => {
  try {
    const pizzas = await Pizza.find({ isAvailable: true });
    res.json(pizzas);
  } catch (error) {
    console.error("Fetch pizzas:", error.message);
    res.status(500).json({ message: "Could not load pizzas." });
  }
});


/* Admin: Update ingredients for a pizza */
app.patch(
  "/api/admin/pizzas/:id/ingredients",
  verifyAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { ingredients } = req.body;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          message: "Invalid Pizza ID.",
        });
      }

      if (!Array.isArray(ingredients)) {
        return res.status(400).json({
          message: "Ingredients must be an array.",
        });
      }

      const normalizedIngredients = [];

      for (const ingredient of ingredients) {
        if (
          !mongoose.isValidObjectId(ingredient.item) ||
          !Number.isFinite(ingredient.quantity) ||
          ingredient.quantity <= 0
        ) {
          return res.status(400).json({
            message: "Invalid ingredient item or quantity.",
          });
        }

        const inventoryItem = await Inventory.findById(
          ingredient.item
        );

        if (!inventoryItem) {
          return res.status(400).json({
            message: "An inventory item was not found.",
          });
        }

        normalizedIngredients.push({
          item: inventoryItem._id,
          quantity: ingredient.quantity,
        });
      }

      const pizza = await Pizza.findByIdAndUpdate(
        id,
        { ingredients: normalizedIngredients },
        { new: true, runValidators: true }
      ).populate("ingredients.item", "itemName unit category");

      if (!pizza) {
        return res.status(404).json({
          message: "Pizza not found.",
        });
      }

      res.json({
        message: "Pizza ingredients updated successfully.",
        pizza,
      });
    } catch (error) {
      console.error("Update pizza ingredients:", error.message);

      res.status(500).json({
        message: "Could not update pizza ingredients.",
      });
    }
  }
);


// Admin login
app.post("/api/admin/login", (req, res) => {
  try {
    const { username, password } = req.body;

    if (
      !username ||
      !password ||
      username !== process.env.ADMIN_USERNAME ||
      password !== process.env.ADMIN_PASSWORD
    ) {
      return res.status(401).json({
        message: "Invalid username or password.",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: "JWT_SECRET is missing.",
      });
    }

    const token = jwt.sign(
      { username, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.json({ message: "Login successful.", token });
  } catch (error) {
    console.error("Admin login:", error.message);
    res.status(500).json({ message: "Login failed." });
  }
});


app.post("/api/orders", async (req, res) => {
  let reservedMovements = [];

  try {
    const { customer, items } = req.body;

    if (
      !customer ||
      !customer.name?.trim() ||
      !/^[0-9]{10}$/.test(customer.phone || "") ||
      !customer.address?.trim()
    ) {
      return res.status(400).json({
        message: "Enter valid name, 10-digit phone and address.",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "Cart is empty.",
      });
    }

    const savedItems = [];

    for (const item of items) {
      if (
        !mongoose.isValidObjectId(item.pizzaId) ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 50
      ) {
        return res.status(400).json({
          message: "Invalid pizza or quantity.",
        });
      }

      const pizza = await Pizza.findById(item.pizzaId);

      if (!pizza || pizza.isAvailable === false) {
        return res.status(400).json({
          message: "A selected pizza is unavailable.",
        });
      }

      savedItems.push({
        pizza: pizza._id,
        name: pizza.name,
        price: pizza.price,
        quantity: item.quantity,
      });
    }

    const totalPrice = savedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
      return res.status(400).json({
        message: "Invalid order total.",
      });
    }

    // Reserve stock before creating the order
    reservedMovements = await reserveInventoryStock(savedItems);

    let order;

    try {
      order = await Order.create({
        customer: {
          name: customer.name.trim(),
          phone: customer.phone,
          address: customer.address.trim(),
        },
        items: savedItems,
        totalPrice,
        status: "Order Received",
        paymentStatus: "Pending",
        inventoryStatus: "Reserved",
        inventoryMovements: reservedMovements,
      });
    } catch (error) {
      // Release reserved stock if order creation fails
      for (const movement of reservedMovements) {
        await Inventory.updateOne(
          {
            _id: movement.item,
            reservedQuantity: { $gte: movement.quantity },
          },
          {
            $inc: {
              reservedQuantity: -movement.quantity,
            },
          }
        );
      }

      reservedMovements = [];
      throw error;
    }

    res.status(201).json({
      message: "Order placed and stock reserved successfully.",
      orderId: order._id,
      status: order.status,
      paymentStatus: order.paymentStatus,
      inventoryStatus: order.inventoryStatus,
      totalPrice: order.totalPrice,
    });
  } catch (error) {
    console.error("Create order:", error.message);

    // Roll back any reservation if an error occurred
    if (reservedMovements.length > 0) {
      for (const movement of reservedMovements) {
        await Inventory.updateOne(
          {
            _id: movement.item,
            reservedQuantity: { $gte: movement.quantity },
          },
          {
            $inc: {
              reservedQuantity: -movement.quantity,
            },
          }
        );
      }
    }

    res.status(400).json({
      message: error.message || "Could not place order.",
    });
  }
});


// Create Razorpay payment order
app.post("/api/payments/create-order", async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({ message: "Invalid Order ID." });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (order.paymentStatus === "Paid") {
      return res.status(400).json({
        message: "This order has already been paid.",
      });
    }

    if (order.status === "Cancelled") {
      return res.status(400).json({
        message: "Cancelled orders cannot be paid.",
      });
    }

    // Reuse the Razorpay order for retries.
    let rpOrder;

    if (order.razorpayOrderId) {
      rpOrder = await razorpay.orders.fetch(order.razorpayOrderId);

      if (rpOrder.status === "paid") {
        return res.status(409).json({
          message:
            "Payment has been made. Refresh or contact support for verification.",
        });
      }
    } else {
      rpOrder = await razorpay.orders.create({
        amount: Math.round(order.totalPrice * 100),
        currency: "INR",
        receipt: String(order._id),
      });

      order.razorpayOrderId = rpOrder.id;
      await order.save();
    }

    res.json({
      keyId: process.env.RAZORPAY_KEY_ID,
      razorpayOrderId: rpOrder.id,
      amount: rpOrder.amount,
      currency: rpOrder.currency,
      customerName: order.customer.name,
      customerPhone: order.customer.phone,
    });
  } catch (error) {
    console.error("Create payment order:", error.message);
    res.status(500).json({
      message: "Could not create payment order.",
    });
  }
});


// Verify Razorpay payment and deduct inventory stock
app.post("/api/payments/verify", async (req, res) => {
  let session;

  try {
    const {
      orderId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    // Validate request data
    if (
      !mongoose.isValidObjectId(orderId) ||
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !/^[a-f0-9]{64}$/i.test(razorpay_signature || "")
    ) {
      return res.status(400).json({
        message: "Incomplete or invalid payment details.",
      });
    }

    // Find order
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        message: "Order not found.",
      });
    }

    // Idempotency: prevent duplicate payment processing
    if (order.paymentStatus === "Paid") {
      if (order.razorpayPaymentId === razorpay_payment_id) {
        return res.json({
          message: "Payment already verified.",
          paymentStatus: "Paid",
          inventoryStatus: order.inventoryStatus,
        });
      }

      return res.status(409).json({
        message: "A different payment is already recorded.",
      });
    }

    // Verify Razorpay order ID
    if (order.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({
        message: "Razorpay order ID does not match.",
      });
    }

    // Verify payment signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const expected = Buffer.from(expectedSignature, "hex");
    const received = Buffer.from(razorpay_signature, "hex");

    if (
      expected.length !== received.length ||
      !crypto.timingSafeEqual(expected, received)
    ) {
      return res.status(400).json({
        message: "Payment signature verification failed.",
      });
    }

    // Fetch payment directly from Razorpay
    const payment = await razorpay.payments.fetch(
      razorpay_payment_id
    );

    // Verify payment details
    if (
      payment.order_id !== razorpay_order_id ||
      payment.amount !== Math.round(order.totalPrice * 100) ||
      payment.currency !== "INR"
    ) {
      return res.status(400).json({
        message: "Payment details do not match the order.",
      });
    }

    // Only captured payments can deduct stock
    if (payment.status !== "captured") {
      return res.status(409).json({
        message: "Payment is not captured yet.",
        paymentStatus: payment.status,
      });
    }

    // Prevent payment for cancelled orders
    if (order.status === "Cancelled") {
      return res.status(409).json({
        message: "Cancelled orders cannot be paid.",
      });
    }

    // Stock must already be reserved
    if (order.inventoryStatus !== "Reserved") {
      return res.status(409).json({
        message: "Inventory stock is not reserved for this order.",
        inventoryStatus: order.inventoryStatus,
      });
    }

    if (
      !Array.isArray(order.inventoryMovements) ||
      order.inventoryMovements.length === 0
    ) {
      return res.status(409).json({
        message: "No inventory movements found for this order.",
      });
    }

    // Start MongoDB transaction
    session = await mongoose.startSession();

    let alreadyProcessed = false;

    await session.withTransaction(async () => {
      // Fetch latest order inside transaction
      const currentOrder = await Order.findById(orderId).session(
        session
      );

      if (!currentOrder) {
        throw new Error("Order not found.");
      }

      // Protect against duplicate verification requests
      if (currentOrder.paymentStatus === "Paid") {
        if (
          currentOrder.razorpayPaymentId === razorpay_payment_id
        ) {
          alreadyProcessed = true;
          return;
        }

        throw new Error("A different payment is already recorded.");
      }

      if (currentOrder.status === "Cancelled") {
        throw new Error("Cancelled orders cannot be paid.");
      }

      if (currentOrder.inventoryStatus !== "Reserved") {
        throw new Error("Inventory is not in reserved status.");
      }

      // Deduct each reserved inventory item
      for (const movement of currentOrder.inventoryMovements) {
        const quantity = movement.quantity;

        const updatedInventory = await Inventory.findOneAndUpdate(
          {
            _id: movement.item,
            quantity: { $gte: quantity },
            reservedQuantity: { $gte: quantity },
          },
          {
            $inc: {
              quantity: -quantity,
              reservedQuantity: -quantity,
            },
          },
          {
            new: true,
            session,
          }
        );

        if (!updatedInventory) {
          throw new Error(
            "Inventory deduction failed. Stock or reservation is insufficient."
          );
        }
      }

      // Mark order as paid and inventory as deducted
      const updatedOrder = await Order.updateOne(
        {
          _id: orderId,
          paymentStatus: { $ne: "Paid" },
          inventoryStatus: "Reserved",
          razorpayOrderId: razorpay_order_id,
        },
        {
          $set: {
            paymentStatus: "Paid",
            razorpayPaymentId: razorpay_payment_id,
            inventoryStatus: "Deducted",
          },
        },
        { session }
      );

      if (updatedOrder.modifiedCount !== 1) {
        throw new Error(
          "Order could not be updated. Please verify its status."
        );
      }
    });

    if (alreadyProcessed) {
      return res.json({
        message: "Payment already verified.",
        paymentStatus: "Paid",
        inventoryStatus: "Deducted",
      });
    }

    return res.json({
      message: "Payment verified and inventory stock deducted successfully.",
      paymentStatus: "Paid",
      inventoryStatus: "Deducted",
      orderId: order._id,
    });

  } catch (error) {
    console.error("Verify payment:", error.message);

    const conflictMessages = [
      "A different payment is already recorded.",
      "Cancelled orders cannot be paid.",
      "Inventory is not in reserved status.",
      "Inventory deduction failed. Stock or reservation is insufficient.",
      "Order could not be updated. Please verify its status.",
    ];

    const statusCode = conflictMessages.includes(error.message)
      ? 409
      : 500;

    return res.status(statusCode).json({
      message: error.message || "Could not verify payment.",
    });

  } finally {
    if (session) {
      await session.endSession();
    }
  }
});

// Customer tracking: full Order ID required
app.get("/api/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid Order ID. Enter the full Order ID.",
      });
    }

    const order = await Order.findById(id).select(
      "items.name items.quantity totalPrice status paymentStatus createdAt"
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    res.json({
      orderId: order._id,
      items: order.items,
      totalPrice: order.totalPrice,
      status: order.status,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
    });
  } catch (error) {
    console.error("Track order:", error.message);
    res.status(500).json({ message: "Could not track order." });
  }
});


/* Admin: Sales Analytics with Date Range Filter */
app.get("/api/admin/analytics", verifyAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const now = new Date();

    // Validate date inputs
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (
      (startDate && !dateRegex.test(startDate)) ||
      (endDate && !dateRegex.test(endDate))
    ) {
      return res.status(400).json({
        message: "Dates must use YYYY-MM-DD format.",
      });
    }

    if ((startDate && !endDate) || (!startDate && endDate)) {
      return res.status(400).json({
        message: "Please provide both startDate and endDate.",
      });
    }

    let rangeStart = null;
    let rangeEnd = null;

    if (startDate && endDate) {
      // India local time boundaries
      rangeStart = new Date(`${startDate}T00:00:00+05:30`);

      const endDay = new Date(`${endDate}T00:00:00+05:30`);

      if (
        Number.isNaN(rangeStart.getTime()) ||
        Number.isNaN(endDay.getTime()) ||
        rangeStart.toISOString().slice(0, 10) !== startDate ||
        endDay.toISOString().slice(0, 10) !== endDate
      ) {
        return res.status(400).json({
          message: "Please enter valid calendar dates.",
        });
      }

      if (rangeStart > endDay) {
        return res.status(400).json({
          message: "Start date cannot be after end date.",
        });
      }

      // Include the complete end date
      rangeEnd = new Date(endDay.getTime() + 24 * 60 * 60 * 1000);
    }

    // Date filter for orders and analytics
    const dateMatch =
      rangeStart && rangeEnd
        ? {
            createdAt: {
              $gte: rangeStart,
              $lt: rangeEnd,
            },
          }
        : {};

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [
      totalOrders,
      deliveredOrders,
      paidOrders,
      unpaidOrders,
      paidRevenueResult,
      todaySalesResult,
      weeklySalesResult,
      topPizzas,
      dailySales,
    ] = await Promise.all([
      Order.countDocuments(dateMatch),

      Order.countDocuments({
        ...dateMatch,
        status: "Delivered",
      }),

      Order.countDocuments({
        ...dateMatch,
        paymentStatus: "Paid",
      }),

      Order.countDocuments({
        ...dateMatch,
        paymentStatus: { $ne: "Paid" },
      }),

      Order.aggregate([
        {
          $match: {
            ...dateMatch,
            paymentStatus: "Paid",
          },
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$totalPrice" },
          },
        },
      ]),

      // Today's paid sales (independent of selected range)
      Order.aggregate([
        {
          $match: {
            paymentStatus: "Paid",
            createdAt: { $gte: todayStart, $lte: now },
          },
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$totalPrice" },
            orders: { $sum: 1 },
          },
        },
      ]),

      // Last 7 days paid sales (independent of selected range)
      Order.aggregate([
        {
          $match: {
            paymentStatus: "Paid",
            createdAt: { $gte: sevenDaysAgo, $lte: now },
          },
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$totalPrice" },
            orders: { $sum: 1 },
          },
        },
      ]),

      // Top 5 pizzas in selected date range
      Order.aggregate([
        {
          $match: {
            ...dateMatch,
            paymentStatus: "Paid",
          },
        },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.name",
            quantitySold: { $sum: "$items.quantity" },
            revenue: {
              $sum: {
                $multiply: ["$items.price", "$items.quantity"],
              },
            },
          },
        },
        { $sort: { quantitySold: -1 } },
        { $limit: 5 },
        {
          $project: {
            _id: 0,
            name: "$_id",
            quantitySold: 1,
            revenue: 1,
          },
        },
      ]),

      // Daily paid sales for chart
      Order.aggregate([
        {
          $match: {
            ...dateMatch,
            paymentStatus: "Paid",
            ...(!startDate
              ? {
                  createdAt: {
                    $gte: sevenDaysAgo,
                    $lte: now,
                  },
                }
              : {}),
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
                timezone: "+05:30",
              },
            },
            revenue: { $sum: "$totalPrice" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const today = todaySalesResult[0] || {
      revenue: 0,
      orders: 0,
    };

    const last7Days = weeklySalesResult[0] || {
      revenue: 0,
      orders: 0,
    };

    res.json({
      totalOrders,
      deliveredOrders,
      paidOrders,
      unpaidOrders,

      // Revenue and order metrics follow the selected date range
      paidRevenue: paidRevenueResult[0]?.revenue || 0,

      todaySales: today.revenue,
      todayPaidOrders: today.orders,

      last7DaysSales: last7Days.revenue,
      last7DaysPaidOrders: last7Days.orders,

      topPizzas,
      dailySales,

      selectedRange: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
    });
  } catch (error) {
    console.error("Admin analytics:", error.message);

    res.status(500).json({
      message: "Could not load sales analytics.",
    });
  }
});

// Get all inventory items
app.get("/api/admin/inventory", verifyAdmin, async (req, res) => {
  try {
    const inventory = await Inventory.find().sort({ category: 1, itemName: 1 });
    res.json(inventory);
  } catch (error) {
    console.error("Fetch inventory:", error.message);
    res.status(500).json({ message: "Could not load inventory." });
  }
});

// Add a new inventory item
app.post("/api/admin/inventory", verifyAdmin, async (req, res) => {
  try {
    const { itemName, category, quantity, unit, lowStockThreshold } = req.body;

    const allowedCategories = ["Base", "Sauce", "Cheese", "Vegetable"];

    if (!itemName || !itemName.trim()) {
      return res.status(400).json({
        message: "Item name is required.",
      });
    }

    if (!allowedCategories.includes(category)) {
      return res.status(400).json({
        message: "Invalid inventory category.",
      });
    }

    if (
      quantity === undefined ||
      !Number.isInteger(quantity) ||
      quantity < 0
    ) {
      return res.status(400).json({
        message: "Quantity must be a non-negative integer.",
      });
    }

    if (
      lowStockThreshold !== undefined &&
      (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0)
    ) {
      return res.status(400).json({
        message: "Low-stock threshold must be a non-negative integer.",
      });
    }

    const inventoryItem = await Inventory.create({
      itemName: itemName.trim(),
      category,
      quantity,
      unit: unit?.trim() || "units",
      lowStockThreshold: lowStockThreshold ?? 20,
    });

    res.status(201).json({
      message: "Inventory item added successfully.",
      inventory: inventoryItem,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "An inventory item with this name already exists.",
      });
    }

    console.error("Add inventory item:", error.message);
    res.status(500).json({ message: "Could not add inventory item." });
  }
});

// Update stock quantity
app.patch("/api/admin/inventory/:id", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, lowStockThreshold, unit } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid inventory item ID.",
      });
    }

    const updates = {};

    if (quantity !== undefined) {
      if (!Number.isInteger(quantity) || quantity < 0) {
        return res.status(400).json({
          message: "Quantity must be a non-negative integer.",
        });
      }

      updates.quantity = quantity;
    }

    if (lowStockThreshold !== undefined) {
      if (
        !Number.isInteger(lowStockThreshold) ||
        lowStockThreshold < 0
      ) {
        return res.status(400).json({
          message: "Low-stock threshold must be a non-negative integer.",
        });
      }

      updates.lowStockThreshold = lowStockThreshold;
    }

    if (unit !== undefined) {
      if (typeof unit !== "string" || !unit.trim()) {
        return res.status(400).json({
          message: "Unit must be a non-empty string.",
        });
      }

      updates.unit = unit.trim();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "Provide quantity, lowStockThreshold or unit to update.",
      });
    }

    const inventoryItem = await Inventory.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!inventoryItem) {
      return res.status(404).json({
        message: "Inventory item not found.",
      });
    }

    res.json({
      message: "Inventory updated successfully.",
      inventory: inventoryItem,
    });
  } catch (error) {
    console.error("Update inventory:", error.message);
    res.status(500).json({ message: "Could not update inventory." });
  }
});

// Admin: get all orders
app.get("/api/orders", verifyAdmin, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error("Fetch orders:", error.message);
    res.status(500).json({ message: "Could not load orders." });
  }
});

// Admin: update delivery status
app.patch("/api/orders/:id/status", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = [
      "Order Received",
      "In Kitchen",
      "Out for  Delivery",
      "Delivered",
      "Cancelled",
    ];

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid Order ID." });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid order status.",
      });
    }

    const order = await Order.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    res.json({
      message: "Order status updated successfully.",
      order,
    });
  } catch (error) {
    console.error("Update order status:", error.message);
    res.status(500).json({ message: "Could not update order status." });
  }
});

async function startServer() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from .env");
    }

    if (
      !process.env.RAZORPAY_KEY_ID ||
      !process.env.RAZORPAY_KEY_SECRET
    ) {
      throw new Error("Razorpay API keys are missing from .env");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected successfully.");

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
