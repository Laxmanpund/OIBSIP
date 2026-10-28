
import { useCallback, useEffect, useMemo, useState } from "react";
import "./AdminDashboard.css";

const API_URL = "http://localhost:5000/api";

const STATUSES = [
  "Order Received",
  "In Kitchen",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
];

export default function AdminDashboard({ token, onBack }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [updatingId, setUpdatingId] = useState("");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/orders`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Orders load झाले नाहीत.");
      }

      setOrders(Array.isArray(data) ? data : data.orders || []);
    } catch (err) {
      setError(err.message || "Server connection failed.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  async function updateStatus(orderId, status) {
    setError("");
    setUpdatingId(orderId);

    try {
      const response = await fetch(
        `${API_URL}/orders/${orderId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Status update झाला नाही.");
      }

      setOrders((previous) =>
        previous.map((order) =>
          order._id === orderId
            ? { ...order, status: data.order?.status || status }
            : order
        )
      );
    } catch (err) {
      setError(err.message || "Status update failed.");
      await fetchOrders();
    } finally {
      setUpdatingId("");
    }
  }

  const stats = useMemo(() => {
    const pending = orders.filter((order) =>
      ["Order Received", "In Kitchen", "Out for Delivery"].includes(
        order.status || "Order Received"
      )
    ).length;

    const delivered = orders.filter(
      (order) => order.status === "Delivered"
    ).length;

    const revenue = orders.reduce((sum, order) => {
      if (order.status === "Cancelled") return sum;
      return sum + (Number(order.totalPrice ?? order.totalAmount ?? 0) || 0);
    }, 0);

    return {
      total: orders.length,
      pending,
      delivered,
      revenue,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders.filter((order) => {
      const name = order.customer?.name || order.customerName || order.name || "";
      const phone = order.customer?.phone || order.phone || "";
      const address = order.customer?.address || order.address || "";
      const id = order._id || "";

      const matchesSearch =
        name.toLowerCase().includes(query) ||
        String(phone).includes(query) ||
        address.toLowerCase().includes(query) ||
        id.toLowerCase().includes(query) ||
        id.slice(-6).toLowerCase().includes(query);

      const matchesStatus =
        filter === "All" ||
        (order.status || "Order Received") === filter;

      return matchesSearch && matchesStatus;
    });
  }, [orders, search, filter]);

  return (
    <main className="admin-dashboard">
      <header className="admin-header">
        <div className="admin-brand">
          <span className="admin-logo">🍕</span>
          <div>
            <span className="admin-eyebrow">PIZZA PARADISE</span>
            <h1>Admin Dashboard</h1>
            <p>Manage orders and track deliveries.</p>
          </div>
        </div>

        <button className="admin-back-btn" onClick={onBack}>
          Logout
        </button>
      </header>

      {error && (
        <div className="admin-error" role="alert">
          <span>{error}</span>
          {error.toLowerCase().includes("token") && (
            <button onClick={onBack}>Login Again</button>
          )}
        </div>
      )}

      <section className="admin-stats">
        <article className="admin-stat-card">
          <span className="stat-icon">📦</span>
          <div>
            <p>Total Orders</p>
            <h2>{stats.total}</h2>
          </div>
        </article>

        <article className="admin-stat-card">
          <span className="stat-icon">⏳</span>
          <div>
            <p>Pending Orders</p>
            <h2>{stats.pending}</h2>
          </div>
        </article>

        <article className="admin-stat-card">
          <span className="stat-icon">✅</span>
          <div>
            <p>Delivered Orders</p>
            <h2>{stats.delivered}</h2>
          </div>
        </article>

        <article className="admin-stat-card">
          <span className="stat-icon">₹</span>
          <div>
            <p>Order Revenue</p>
            <h2>₹{stats.revenue.toLocaleString("en-IN")}</h2>
          </div>
        </article>
      </section>

      <section className="admin-orders">
        <div className="admin-orders-heading">
          <div>
            <h2>Customer Orders</h2>
            <p>View customers and manage their orders.</p>
          </div>

          <button
            className="admin-refresh-btn"
            onClick={fetchOrders}
            disabled={loading}
          >
            {loading ? "Loading..." : "↻ Refresh"}
          </button>
        </div>

        <div className="admin-filters">
          <input
            type="search"
            placeholder="Search name, phone or order ID..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            aria-label="Filter orders by status"
          >
            <option value="All">All Orders</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <button
            className="admin-clear-btn"
            onClick={() => {
              setSearch("");
              setFilter("All");
            }}
          >
            Clear
          </button>
        </div>

        <p className="admin-results">
          Showing {filteredOrders.length} of {orders.length} orders
        </p>

        {loading ? (
          <div className="admin-empty">Orders load होत आहेत...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="admin-empty">
            {orders.length === 0
              ? "No orders found."
              : "Search किंवा filter शी जुळणारी order सापडली नाही."}
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer Details</th>
                  <th>Delivery Address</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Update Status</th>
                </tr>
              </thead>

              <tbody>
                {filteredOrders.map((order) => {
                  const customer = order.customer || {};
                  const status = order.status || "Order Received";

                  return (
                    <tr key={order._id}>
                      <td className="admin-order-id">
                        #{order._id?.slice(-6).toUpperCase()}
                      </td>

                      <td>
                        <strong>
                          {customer.name || order.customerName || "Customer"}
                        </strong>
                        <span className="admin-subtext">
                          {customer.phone || order.phone || "Phone unavailable"}
                        </span>
                      </td>

                      <td className="admin-address">
                        {customer.address || order.address || "Address unavailable"}
                      </td>

                      <td className="admin-items">
                        {Array.isArray(order.items)
                          ? order.items.map((item, index) => (
                              <div key={`${order._id}-${index}`}>
                                {item.name || item.pizza?.name || "Pizza"} ×{" "}
                                {item.quantity || 1}
                              </div>
                            ))
                          : "—"}
                      </td>

                      <td className="admin-total">
                        ₹
                        {Number(
                          order.totalPrice ?? order.totalAmount ?? 0
                        ).toLocaleString("en-IN")}
                      </td>

                      <td>
                        <span
                          className={`admin-status status-${status
                            .toLowerCase()
                            .replace(/\s+/g, "-")}`}
                        >
                          {status}
                        </span>
                      </td>

                      <td>
                        <select
                          className="admin-status-select"
                          value={status}
                          disabled={updatingId === order._id}
                          onChange={(event) =>
                            updateStatus(order._id, event.target.value)
                          }
                          aria-label={`Update order ${order._id}`}
                        >
                          {STATUSES.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>

                        {updatingId === order._id && (
                          <small className="admin-updating">
                            Updating...
                          </small>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="admin-footer">
        Pizza Paradise · Admin Management
      </footer>
    </main>
  );
}
