const mongoose = require("mongoose");

const ingredientSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.01,
    },
  },
  { _id: false }
);

const pizzaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 1 },
    image: { type: String, default: "" },
    category: {
      type: String,
      enum: ["Veg", "Non-Veg"],
      required: true,
    },
    isAvailable: { type: Boolean, default: true },

    // Ingredients required to prepare one pizza
    ingredients: {
      type: [ingredientSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Pizza", pizzaSchema);
