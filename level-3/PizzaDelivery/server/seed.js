const dns = require("node:dns");
dns.setServers(["8.8.8.8"]);

const mongoose = require("mongoose");
require("dotenv").config();

const Pizza = require("./models/Pizza");

const pizzas = [
  {
    name: "Margherita",
    description: "Classic cheese pizza with rich tomato sauce.",
    price: 199,
    image: "https://images.unsplash.com/photo-1579751626657-72bc17010498?w=600",
    category: "Veg",
  },
  {
    name: "Farmhouse",
    description: "Loaded with capsicum, onion, and fresh vegetables.",
    price: 299,
    image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600",
    category: "Veg",
  },
  {
    name: "Paneer Tikka",
    description: "Spicy paneer, onions, capsicum, and creamy cheese.",
    price: 329,
    image: "https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=600",
    category: "Veg",
  },
  {
    name: "Chicken Supreme",
    description: "Chicken toppings with mozzarella and signature sauce.",
    price: 379,
    image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600",
    category: "Non-Veg",
  },
];

async function seedPizzas() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    await Pizza.deleteMany({});
    await Pizza.insertMany(pizzas);

    console.log("Pizza data added successfully!");
  } catch (error) {
    console.error("Seed failed:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

seedPizzas();
