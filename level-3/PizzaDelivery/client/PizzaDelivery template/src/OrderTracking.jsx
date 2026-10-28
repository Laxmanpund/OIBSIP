import { useCallback, useEffect, useState } from "react";
import "./OrderTracking.css";

const API_URL = "http://localhost:5000/api/orders";

const STATUSES = [
  "Order Received",
  "In Kitchen",
  "Sent to Delivery",
  "Delivered",
];

const STATUS_LABELS = {
  "Order Received": "Order Received",
  "In Kitchen": "Preparing Your Pizza",
  "Sent to Delivery": "Out for Delivery",
  Delivered: "Delivered",
  Cancelled: "Order Cancelled",
};

export default function OrderTracking() {
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadOrder = useCallback(async (id, silent = false) => {
    const fullId = id.trim();

    if (!fullId) {
      setError("Please enter your full Order ID.");
      return;
    }

    if (!silent) setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/${encodeURIComponent(fullId)}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Order could not be found.");
      }

      setOrder(data);
      setOrderId(fullId);
      setLastUpdated(new Date());
    } catch (err) {
      if (!silent) {
        setOrder(null);
        setError(
          err.message ||
            "Could not connect to the server. Please try again."
        );
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    loadOrder(orderId);
  }

  useEffect(() => {
    if (!order?.orderId) return undefined;

    if (
      order.status === "Delivered" ||
      order.status === "Cancelled"
    ) {
      return undefined;
    }

    const timer = setInterval(() => {
      loadOrder(order.orderId, true);
    }, 10000);

    return () => clearInterval(timer);
  }, [order?.orderId, order?.status, loadOrder]);

  const currentIndex = STATUSES.indexOf(order?.status);
  const isCancelled = order?.status === "Cancelled";

  return (
    <section className="tracking-section" id="order-tracking">
      <div className="tracking-heading">
        <span className="tracking-eyebrow">PIZZA PARADISE</span>
        <h2>Track Your Order</h2>
        <p>Follow your pizza from our kitchen to your doorstep.</p>
      </div>

      <form onSubmit={handleSubmit} className="tracking-form">
        <input
          type="text"
          value={orderId}
          onChange={(event) => setOrderId(event.target.value)}
          placeholder="Enter your full Order ID"
          aria-label="Order ID"
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Checking..." : "Track Order"}
        </button>
      </form>

      {error && <p className="tracking-error">{error}</p>}

      {order && (
        <div className="tracking-card">
          <div className="tracking-card-header">
            <div>
              <span className="tracking-muted">ORDER NUMBER</span>
              <h3>#{String(order.orderId).slice(-6).toUpperCase()}</h3>
            </div>
            <span
              className={`tracking-status ${
                isCancelled ? "status-cancelled" : ""
              }`}
            >
              {STATUS_LABELS[order.status] || order.status}
            </span>
          </div>

          <div className="tracking-summary">
            <div>
              <span className="tracking-muted">TOTAL AMOUNT</span>
              <strong>
                ₹{Number(order.totalPrice).toLocaleString("en-IN")}
              </strong>
            </div>
            <div>
              <span className="tracking-muted">PAYMENT STATUS</span>
              <strong
                className={
                  order.paymentStatus === "Paid"
                    ? "payment-paid"
                    : "payment-pending"
                }
              >
                {order.paymentStatus || "Pending"}
              </strong>
            </div>
          </div>

          {!isCancelled && (
            <div className="tracking-timeline">
              {STATUSES.map((status, index) => {
                const completed =
                  currentIndex >= 0 && index <= currentIndex;
                const active = index === currentIndex;

                return (
                  <div
                    key={status}
                    className={`timeline-step ${
                      completed ? "completed" : ""
                    } ${active ? "active" : ""}`}
                  >
                    <div className="timeline-marker">
                      {completed ? "✓" : index + 1}
                    </div>
                    <div className="timeline-copy">
                      <strong>{STATUS_LABELS[status]}</strong>
                      <span>
                        {index === 0 && "We received your order"}
                        {index === 1 && "Fresh pizza is being prepared"}
                        {index === 2 && "Your order is on its way"}
                        {index === 3 && "Enjoy your pizza!"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isCancelled && (
            <p className="tracking-error">
              This order has been cancelled. Please contact the restaurant
              if you need assistance.
            </p>
          )}

          <div className="tracking-items">
            <h4>Order Items</h4>
            {Array.isArray(order.items) && order.items.length > 0 ? (
              order.items.map((item, index) => (
                <div
                  className="tracking-item"
                  key={`${item.name}-${index}`}
                >
                  <span>
                    {item.name} × {item.quantity}
                  </span>
                  <span>
                    ₹
                    {(
                      Number(item.price || 0) *
                      Number(item.quantity || 0)
                    ).toLocaleString("en-IN")}
                  </span>
                </div>
              ))
            ) : (
              <p>No item details available.</p>
            )}
          </div>

          {lastUpdated && (
            <p className="tracking-updated">
              Last checked: {lastUpdated.toLocaleTimeString()}
              {order.status !== "Delivered" &&
                order.status !== "Cancelled" &&
                " · Refreshes every 10 seconds"}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
