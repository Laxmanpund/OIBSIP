const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    customer: {
      name: { type: String, required: true, trim: true },
      phone: {
        type: String,
        required: true,
        match: /^[0-9]{10}$/,
      },
      address: { type: String, required: true, trim: true },
    },
    items: [
      {
        pizza: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Pizza",
          required: true,
        },
        name: { type: String, required: true },
        price: { type: Number, required: true, min: 1 },
        quantity: { type: Number, required: true, min: 1 },
      },
    ],
    totalPrice: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: [
        "Order Received",
        "In Kitchen",
        "Sent to Delivery",
        "Delivered",
        "Cancelled",
      ],
      default: "Order Received",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
