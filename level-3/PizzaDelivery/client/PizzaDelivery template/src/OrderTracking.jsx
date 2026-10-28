
import { useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5000/api/orders";

const STATUSES = [
  "Order Received",
  "In Kitchen",
  "Sent to Delivery",
  "Delivered",
];

export default function OrderTracking() {
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadOrder(id, keepPrevious = false) {
    const fullId = id.trim();

    if (!fullId) {
      setError("कृपया पूर्ण Order ID टाक.");
      return;
    }

    setLoading(true);
    setError("");

    if (!keepPrevious) setOrder(null);

    try {
      const response = await fetch(
        `${API_URL}/${encodeURIComponent(fullId)}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Order सापडली नाही.");
      }

      setOrder(data);
    } catch (err) {
      setError(err.message || "Backend शी connection झाले नाही.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    loadOrder(orderId);
  }

  const currentIndex = order
    ? STATUSES.indexOf(order.status)
    : -1;

  return (
    <section className="tracking-section">
      <h2>📦 Track Your Order</h2>
      <p>Confirmation मधील पूर्ण Order ID टाक.</p>

      <form onSubmit={handleSubmit} className="tracking-form">
        <input
          type="text"
          value={orderId}
          onChange={(event) => setOrderId(event.target.value)}
          placeholder="Enter full Order ID"
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Checking..." : "Track Order"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {order && (
        <div className="tracking-result">
          <h3>
            Order #{String(order.orderId).slice(-6).toUpperCase()}
          </h3>

          <p>
            <strong>Status:</strong> {order.status}
          </p>

          <p>
            <strong>Total:</strong>{" "}
            ₹{Number(order.totalPrice).toLocaleString("en-IN")}
          </p>

          {Array.isArray(order.items) &&
            order.items.map((item, index) => (
              <p key={`${item.name}-${index}`}>
                {item.name} × {item.quantity}
              </p>
            ))}

          {order.status === "Cancelled" ? (
            <p className="error">ही order cancel झाली आहे.</p>
          ) : (
            <div className="tracking-steps">
              {STATUSES.map((status, index) => {
                const completed =
                  currentIndex >= 0 && index <= currentIndex;

                return (
                  <div
                    key={status}
                    className={`tracking-step ${
                      completed ? "completed" : ""
                    }`}
                  >
                    <span>{completed ? "✓" : index + 1}</span>
                    <p>{status}</p>
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="button"
            className="tracking-refresh"
            disabled={loading}
            onClick={() => loadOrder(orderId, true)}
          >
            {loading ? "Refreshing..." : "Refresh Status"}
          </button>
        </div>
      )}
    </section>
  );
}
