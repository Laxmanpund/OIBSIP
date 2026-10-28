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

// Home
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

// Create customer order
app.post("/api/orders", async (req, res) => {
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
      return res.status(400).json({ message: "Cart is empty." });
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

      // Price and name come from database, not from frontend.
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

    const order = await Order.create({
      customer: {
        name: customer.name.trim(),
        phone: customer.phone,
        address: customer.address.trim(),
      },
      items: savedItems,
      totalPrice,
      status: "Order Received",
      paymentStatus: "Pending",
    });

    res.status(201).json({
      message: "Order placed successfully.",
      orderId: order._id,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalPrice: order.totalPrice,
    });
  } catch (error) {
    console.error("Create order:", error.message);
    res.status(500).json({
      message: "Could not place order.",
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

// Verify Razorpay payment
app.post("/api/payments/verify", async (req, res) => {
  try {
    const {
      orderId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

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

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (order.paymentStatus === "Paid") {
      if (order.razorpayPaymentId === razorpay_payment_id) {
        return res.json({
          message: "Payment already verified.",
          paymentStatus: "Paid",
        });
      }

      return res.status(409).json({
        message: "A different payment is already recorded.",
      });
    }

    if (order.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({
        message: "Razorpay order ID does not match.",
      });
    }

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

    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (
      payment.order_id !== razorpay_order_id ||
      payment.amount !== Math.round(order.totalPrice * 100) ||
      payment.currency !== "INR"
    ) {
      return res.status(400).json({
        message: "Payment details do not match the order.",
      });
    }

    // This demo confirms payment only when Razorpay reports captured.
    if (payment.status !== "captured") {
      return res.status(409).json({
        message:
          "Payment is not captured yet. Configure capture in Razorpay or implement capture/webhook handling.",
        paymentStatus: payment.status,
      });
    }

    order.paymentStatus = "Paid";
    order.razorpayPaymentId = razorpay_payment_id;
    await order.save();

    res.json({
      message: "Payment verified successfully.",
      paymentStatus: "Paid",
      orderId: order._id,
    });
  } catch (error) {
    console.error("Verify payment:", error.message);
    res.status(500).json({
      message: "Could not verify payment.",
    });
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
      "Sent to Delivery",
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
