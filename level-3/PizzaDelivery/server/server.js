const dns = require("node:dns");
dns.setServers(["8.8.8.8"]);

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
const Pizza = require("./models/Pizza");
const Order = require("./models/Order");

app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://127.0.0.1:5173"
  ]
}));

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Pizza Delivery API is running 🍕" });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "OK" });
});

app.get("/api/pizzas", async (req, res) => {
  try {
    const pizzas = await Pizza.find({ isAvailable: true });
    res.json(pizzas);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch pizzas" });
  }
});


app.post("/api/orders", async (req, res) => {
  try {
    const { customer, items } = req.body;

    if (
      !customer?.name?.trim() ||
      !/^[0-9]{10}$/.test(customer.phone || "") ||
      !customer?.address?.trim() ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        message: "Valid customer details and cart items are required.",
      });
    }

    const orderItems = [];
    let totalPrice = 0;

    for (const item of items) {
      const quantity = Number(item.quantity);

      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
        return res.status(400).json({ message: "Invalid quantity." });
      }

      const pizza = await Pizza.findOne({
        _id: item.pizzaId,
        isAvailable: true,
      });

      if (!pizza) {
        return res.status(400).json({
          message: "A selected pizza is unavailable.",
        });
      }

      orderItems.push({
        pizza: pizza._id,
        name: pizza.name,
        price: pizza.price,
        quantity,
      });

      totalPrice += pizza.price * quantity;
    }

    const order = await Order.create({
      customer: {
        name: customer.name.trim(),
        phone: customer.phone,
        address: customer.address.trim(),
      },
      items: orderItems,
      totalPrice,
    });

    res.status(201).json({
      message: "Order created successfully!",
      orderId: order._id,
      status: order.status,
      totalPrice: order.totalPrice,
    });
  } catch (error) {
    console.error("Order creation failed:", error.message);
    res.status(500).json({ message: "Could not create order." });
  }
});



app.post("/api/orders", async (req, res) => {
  try {
    const { customer, items } = req.body;

    if (
      !customer?.name?.trim() ||
      !/^[0-9]{10}$/.test(customer.phone || "") ||
      !customer?.address?.trim() ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        message: "Valid customer details and cart items are required.",
      });
    }

    const orderItems = [];
    let totalPrice = 0;

    for (const item of items) {
      const quantity = Number(item.quantity);

      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
        return res.status(400).json({ message: "Invalid item quantity." });
      }

      const pizza = await Pizza.findOne({
        _id: item.pizzaId,
        isAvailable: true,
      });

      if (!pizza) {
        return res.status(400).json({
          message: "A selected pizza is unavailable.",
        });
      }

      orderItems.push({
        pizza: pizza._id,
        name: pizza.name,
        price: pizza.price,
        quantity,
      });

      totalPrice += pizza.price * quantity;
    }

    const order = await Order.create({
      customer: {
        name: customer.name.trim(),
        phone: customer.phone,
        address: customer.address.trim(),
      },
      items: orderItems,
      totalPrice,
    });

    res.status(201).json({
      message: "Order created successfully!",
      orderId: order._id,
      status: order.status,
      totalPrice: order.totalPrice,
    });
  } catch (error) {
    console.error("Order creation failed:", error.message);
    res.status(500).json({ message: "Could not create order." });
  }
});


async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected successfully");

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
  }
}

startServer();
