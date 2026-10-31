import { useCallback, useEffect, useMemo, useState } from "react";
import "./AdminDashboard.css";
import SalesChart from "./SalesChart";

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
  const [analytics, setAnalytics] = useState(null);

  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  const [error, setError] = useState("");
  const [analyticsError, setAnalyticsError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [updatingId, setUpdatingId] = useState("");
  
  const [inventory, setInventory] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState("");
  const [inventoryNotice, setInventoryNotice] = useState("");
  const [inventorySaving, setInventorySaving] = useState(false);

  const [newItem, setNewItem] = useState({
    itemName: "",
    category: "Base",
    quantity: "0",
    unit: "pieces",
    lowStockThreshold: "20",
  });

  const [stockEdits, setStockEdits] = useState({});


  // Date range filter
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [appliedDates, setAppliedDates] = useState({
    startDate: "",
    endDate: "",
  });
  const [dateError, setDateError] = useState("");

  // Fetch all orders
  const fetchOrders = useCallback(
    async (showLoader = true) => {
      if (showLoader) setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_URL}/orders`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Unable to load orders.");
        }

        const orderList = Array.isArray(data)
          ? data
          : Array.isArray(data.orders)
            ? data.orders
            : [];

        setOrders(orderList);
      } catch (err) {
        setError(err.message || "Unable to connect to the backend.");
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    [token]
  );

  // Fetch analytics with the selected date range
  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError("");

    try {
      const params = new URLSearchParams();

      if (appliedDates.startDate && appliedDates.endDate) {
        params.set("startDate", appliedDates.startDate);
        params.set("endDate", appliedDates.endDate);
      }

      const query = params.toString();
      const url = query
        ? `${API_URL}/admin/analytics?${query}`
        : `${API_URL}/admin/analytics`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Could not load sales analytics."
        );
      }

      setAnalytics(data);
    } catch (err) {
      setAnalyticsError(
        err.message || "Unable to load sales analytics."
      );
    } finally {
      setAnalyticsLoading(false);
    }
  }, [token, appliedDates]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  
const fetchInventory = useCallback(async () => {
  setInventoryLoading(true);
  setInventoryError("");

  try {
    const response = await fetch(`${API_URL}/admin/inventory`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Could not load inventory.");
    }

    setInventory(Array.isArray(data) ? data : []);
  } catch (err) {
    setInventoryError(err.message || "Could not load inventory.");
  } finally {
    setInventoryLoading(false);
  }
}, [token]);

useEffect(() => {
  fetchInventory();
}, [fetchInventory]);

async function addInventoryItem(event) {
  event.preventDefault();
  setInventoryError("");
  setInventoryNotice("");

  const quantity = Number(newItem.quantity);
  const threshold = Number(newItem.lowStockThreshold);

  if (
    !newItem.itemName.trim() ||
    !Number.isInteger(quantity) ||
    quantity < 0 ||
    !Number.isInteger(threshold) ||
    threshold < 0
  ) {
    setInventoryError("Enter a valid name, quantity and stock threshold.");
    return;
  }

  setInventorySaving(true);

  try {
    const response = await fetch(`${API_URL}/admin/inventory`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...newItem,
        itemName: newItem.itemName.trim(),
        quantity,
        lowStockThreshold: threshold,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Could not add inventory item.");
    }

    setNewItem({
      itemName: "",
      category: "Base",
      quantity: "0",
      unit: "pieces",
      lowStockThreshold: "20",
    });

    setInventoryNotice("Inventory item added successfully.");
    await fetchInventory();
  } catch (err) {
    setInventoryError(err.message || "Could not add inventory item.");
  } finally {
    setInventorySaving(false);
  }
}

async function updateStock(item) {
  const edit = stockEdits[item._id] || {};
  const quantity = Number(edit.quantity ?? item.quantity);
  const threshold = Number(
    edit.lowStockThreshold ?? item.lowStockThreshold
  );

  if (
    !Number.isInteger(quantity) ||
    quantity < 0 ||
    !Number.isInteger(threshold) ||
    threshold < 0
  ) {
    setInventoryError("Quantity and threshold must be non-negative integers.");
    return;
  }

  setInventoryError("");
  setInventoryNotice("");
  setInventorySaving(true);

  try {
    const response = await fetch(
      `${API_URL}/admin/inventory/${item._id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          quantity,
          lowStockThreshold: threshold,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Could not update stock.");
    }

    setInventoryNotice(`${item.itemName} stock updated successfully.`);
    await fetchInventory();
    } catch (err) {
      setInventoryError(err.message || "Could not update stock.");
    } finally {
      setInventorySaving(false);
    }
  }


  // Apply date range
  function applyDateFilter() {
    if (!startDate || !endDate) {
      setDateError("Please select both start and end dates.");
      return;
    }

    if (startDate > endDate) {
      setDateError("Start date cannot be after end date.");
      return;
    }

    setDateError("");
    setAppliedDates({ startDate, endDate });
  }

  // Reset date range
  function resetDateFilter() {
    setStartDate("");
    setEndDate("");
    setDateError("");
    setAppliedDates({
      startDate: "",
      endDate: "",
    });
  }

  // Dashboard summary - all orders
  const stats = useMemo(() => {
    const paidOrders = orders.filter(
      (order) => order.paymentStatus === "Paid"
    );

    return {
      total: orders.length,

      active: orders.filter(
        (order) =>
          !["Delivered", "Cancelled"].includes(order.status)
      ).length,

      delivered: orders.filter(
        (order) => order.status === "Delivered"
      ).length,

      revenue: paidOrders.reduce(
        (sum, order) => sum + Number(order.totalPrice || 0),
        0
      ),

      paid: paidOrders.length,

      unpaid: orders.filter(
        (order) => order.paymentStatus !== "Paid"
      ).length,
    };
  }, [orders]);

  // Low Stock Alert
  const lowStockItems = useMemo(() => {
    return inventory.filter((item) => {
      const availableStock =Number(item.quantity || 0) - Number(item.reservedQuantity || 0);
      return availableStock <= Number(item.lowStockThreshold || 0);
    });
  }, [inventory]);

  // Search and filter orders
  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders.filter((order) => {
      const customer = order.customer || {};

      const searchableValues = [
        order._id,
        customer.name,
        customer.phone,
        customer.address,
      ];

      const matchesSearch = searchableValues.some((value) =>
        String(value || "").toLowerCase().includes(query)
      );

      const matchesStatus =
        filter === "All" || order.status === filter;

      const matchesPayment =
        paymentFilter === "All" ||
        (paymentFilter === "Paid" &&
          order.paymentStatus === "Paid") ||
        (paymentFilter === "Unpaid" &&
          order.paymentStatus !== "Paid");

      return matchesSearch && matchesStatus && matchesPayment;
    });
  }, [orders, search, filter, paymentFilter]);

  // Update delivery status
  async function updateStatus(orderId, newStatus) {
    setUpdatingId(orderId);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `${API_URL}/orders/${encodeURIComponent(orderId)}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to update order status."
        );
      }

      const updatedOrder = data.order;

      if (updatedOrder) {
        setOrders((previous) =>
          previous.map((order) =>
            order._id === orderId ? updatedOrder : order
          )
        );
      } else {
        await fetchOrders(false);
      }

      setNotice(`Order status updated to "${newStatus}".`);
    } catch (err) {
      setError(err.message || "Order status update failed.");
    } finally {
      setUpdatingId("");
    }
  }

  async function refreshDashboard() {
    await Promise.all([fetchOrders(), fetchAnalytics()]);
  }

  function clearFilters() {
    setSearch("");
    setFilter("All");
    setPaymentFilter("All");
  }

  // Download CSV report
  function downloadSalesReport() {
    const headers = [
      "Order ID",
      "Customer Name",
      "Phone",
      "Order Date",
      "Order Status",
      "Payment Status",
      "Total Amount (INR)",
      "Items",
    ];

    const rows = orders.map((order) => {
      const customer = order.customer || {};

      const items = (order.items || [])
        .map((item) => `${item.name} x ${item.quantity}`)
        .join("; ");

      return [
        order._id,
        customer.name || "",
        customer.phone || "",
        order.createdAt
          ? new Date(order.createdAt).toLocaleString("en-IN")
          : "",
        order.status || "",
        order.paymentStatus || "Pending",
        Number(order.totalPrice || 0).toFixed(2),
        items,
      ];
    });

    const escapeCsv = (value) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const csvContent = [
      headers.map(escapeCsv).join(","),
      ...rows.map((row) => row.map(escapeCsv).join(",")),
    ].join("\r\n");

    const blob = new Blob(["\uFEFF", csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `pizza-sales-report-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function formatCurrency(amount) {
    return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
  }

  return (
    <main className="admin-dashboard">
      {/* Header */}
      <header className="admin-header">
        <div className="admin-brand">
          <span className="admin-logo">🍕</span>

          <div>
            <span className="admin-eyebrow">PIZZA PARADISE</span>
            <h1>Admin Dashboard</h1>
            <p>Manage orders, payments and deliveries.</p>
          </div>
        </div>

        <button className="admin-back-btn" onClick={onBack}>
          Logout
        </button>
      </header>

      {/* Notifications */}
      {error && (
        <div className="admin-error" role="alert">
          <span>{error}</span>

          {error.toLowerCase().includes("token") && (
            <button onClick={onBack}>Login Again</button>
          )}
        </div>
      )}

      {notice && (
        <div className="admin-notice" role="status">
          {notice}
        </div>
      )}

      {/* Main statistics - all-time totals */}
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
            <p>Active Orders</p>
            <h2>{stats.active}</h2>
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
          <span className="stat-icon">💰</span>
          <div>
            <p>Paid Revenue</p>
            <h2>{formatCurrency(stats.revenue)}</h2>
          </div>
        </article>

        <article className="admin-stat-card">
          <span className="stat-icon">💳</span>
          <div>
            <p>Paid Orders</p>
            <h2>{stats.paid}</h2>
          </div>
        </article>

        <article className="admin-stat-card">
          <span className="stat-icon">🕒</span>
          <div>
            <p>Unpaid Orders</p>
            <h2>{stats.unpaid}</h2>
          </div>
        </article>
      </section>

      
      {/* Inventory Management */}
      <section className="admin-orders admin-inventory">
        <div className="admin-orders-heading">
          <div>
            <h2>📦 Inventory Management</h2>
            <p>Manage pizza bases, sauces, cheese and vegetables.</p>
          </div>

          <button
            className="admin-refresh-btn"
            onClick={fetchInventory}
            disabled={inventoryLoading}
          >
            {inventoryLoading ? "Loading..." : "↻ Refresh Inventory"}
          </button>
        </div>

        {inventoryError && (
          <div className="admin-error" role="alert">
            {inventoryError}
          </div>
        )}

        {inventoryNotice && (
          <div className="admin-notice" role="status">
            {inventoryNotice}
          </div>
        )}

        {/* Low Stock Alert */}
        {!inventoryLoading && lowStockItems.length > 0 && (
          <div className="low-stock-alert">
            <div className="low-stock-alert-heading">
              <span>⚠️</span>
              <h3>Low Stock Alert ({lowStockItems.length})</h3>
            </div>

            <p>
              The following inventory items are running low.
              Please restock them soon.
            </p>

            <div className="low-stock-list">
              {lowStockItems.map((item) => {
                const availableStock =
                  Number(item.quantity || 0) -
                  Number(item.reservedQuantity || 0);

                return (
                  <div className="low-stock-item" key={item._id}>
                    <strong>{item.itemName}</strong>
                    <span>{availableStock} {item.unit} left</span>
                    <small>Minimum required: {item.lowStockThreshold} {item.unit}</small>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <form className="inventory-form" onSubmit={addInventoryItem}>
          <h3>Add Inventory Item</h3>

          <input
            type="text"
            placeholder="Item name"
            value={newItem.itemName}
            onChange={(e) =>
            setNewItem({ ...newItem, itemName: e.target.value })
            }
            required
          />

          <select
            value={newItem.category}
            onChange={(e) =>
            setNewItem({ ...newItem, category: e.target.value })
            }
          >
            <option value="Base">Pizza Base</option>
            <option value="Sauce">Sauce</option>
            <option value="Cheese">Cheese</option>
            <option value="Vegetable">Vegetable</option>
          </select>

          <input
            type="number"
            min="0"
            step="1"
            placeholder="Quantity"
            value={newItem.quantity}
            onChange={(e) =>
            setNewItem({ ...newItem, quantity: e.target.value })
            }
            required
          />

          <input
            type="text"
            placeholder="Unit (pieces, grams, kg)"
            value={newItem.unit}
            onChange={(e) =>
            setNewItem({ ...newItem, unit: e.target.value })
            }
            required
          />

          <input
            type="number"
            min="0"
            step="1"
            placeholder="Low stock threshold"
            value={newItem.lowStockThreshold}
            onChange={(e) =>
            setNewItem({
              ...newItem,
              lowStockThreshold: e.target.value,
            })
            }
            required
          />

          <button type="submit" disabled={inventorySaving}>
            {inventorySaving ? "Saving..." : "Add Item"}
          </button>
        </form>

        <h3 className="analytics-title">Current Stock</h3>

        {inventoryLoading && inventory.length === 0 ? (
          <p className="admin-empty">Loading inventory...</p>
        ) : inventory.length === 0 ? (
          <p className="admin-empty">
            No inventory items yet. Add your first item above.
          </p>
        ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Available Stock</th>
                <th>Low Stock Threshold</th>
                <th>Stock Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {inventory.map((item) => {
                const edit = stockEdits[item._id] || {};
                const quantity = Number(edit.quantity ?? item.quantity);
                const threshold = Number(
                  edit.lowStockThreshold ?? item.lowStockThreshold
                );
                const isLow = item.quantity <= item.lowStockThreshold;

                return (
                  <tr key={item._id}>
                    <td>
                      <strong>{item.itemName}</strong>
                    </td>
                    <td>{item.category}</td>

                    <td>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={edit.quantity ?? item.quantity}
                        onChange={(e) =>
                        setStockEdits((previous) => ({
                          ...previous,
                          [item._id]: {
                            ...previous[item._id],
                            quantity: e.target.value,
                          },
                        }))
                        }
                        aria-label={`${item.itemName} quantity`}
                      />
                      <small> {item.unit}</small>
                   </td>

                    <td>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={
                          edit.lowStockThreshold ?? item.lowStockThreshold
                        }
                        onChange={(e) =>
                          setStockEdits((previous) => ({
                            ...previous,
                            [item._id]: {
                            ...previous[item._id],
                            lowStockThreshold: e.target.value,
                            },
                          }))
                        }
                        aria-label={`${item.itemName} low stock threshold`}
                      />
                   </td>

                    <td>
                      <span
                        className={`admin-status ${
                          isLow ? "status-cancelled" : "status-delivered"
                        }`}
                      >
                        {isLow ? "Low Stock" : "In Stock"}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        disabled={inventorySaving}
                        onClick={() => updateStock(item)}
                      >
                        Update
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </section>


      {/* Sales Analytics */}
      <section className="admin-orders admin-analytics">
        <div className="admin-orders-heading">
          <div>
            <h2>📊 Sales Analytics</h2>
            <p>Sales performance and best-selling pizzas.</p>
          </div>

          <button
            className="admin-refresh-btn"
            onClick={fetchAnalytics}
            disabled={analyticsLoading}
          >
            {analyticsLoading ? "Loading..." : "↻ Refresh Analytics"}
          </button>
        </div>

        {/* Date Range Filter */}
        <div className="date-filter">
          <div className="date-filter-field">
            <label htmlFor="startDate">Start Date</label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>

          <div className="date-filter-field">
            <label htmlFor="endDate">End Date</label>
            <input
              id="endDate"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>

          <button
            type="button"
            onClick={applyDateFilter}
            disabled={analyticsLoading}
          >
            Apply Filter
          </button>

          <button
            type="button"
            onClick={resetDateFilter}
            disabled={analyticsLoading}
          >
            Reset Filter
          </button>

          {dateError && (
            <p className="date-filter-error" role="alert">
              {dateError}
            </p>
          )}
        </div>

        {appliedDates.startDate && appliedDates.endDate && (
          <p className="admin-results">
            Showing analytics from {appliedDates.startDate} to{" "}
            {appliedDates.endDate}
          </p>
        )}

        {analyticsError && (
          <div className="admin-error" role="alert">
            <span>{analyticsError}</span>
            <button onClick={fetchAnalytics}>Retry</button>
          </div>
        )}

        {analyticsLoading && !analytics ? (
          <p className="admin-empty">Loading sales analytics...</p>
        ) : analytics ? (
          <>
            <div className="analytics-summary">
              <article>
                <span>Today's Sales</span>
                <strong>{formatCurrency(analytics.todaySales)}</strong>
                <small>
                  {analytics.todayPaidOrders || 0} paid orders
                </small>
              </article>

              <article>
                <span>Last 7 Days</span>
                <strong>
                  {formatCurrency(analytics.last7DaysSales)}
                </strong>
                <small>
                  {analytics.last7DaysPaidOrders || 0} paid orders
                </small>
              </article>

              <article>
                <span>
                  {appliedDates.startDate
                    ? "Selected Range Revenue"
                    : "All-Time Paid Revenue"}
                </span>
                <strong>
                  {formatCurrency(
                    appliedDates.startDate
                      ? analytics.paidRevenue
                      : stats.revenue
                  )}
                </strong>
                <small>
                  {appliedDates.startDate
                    ? `${analytics.paidOrders || 0} paid orders`
                    : `${stats.paid} paid orders`}
                </small>
              </article>
            </div>

            <SalesChart dailySales={analytics.dailySales || []} />

            <h3 className="analytics-title">
              🍕 Top 5 Best-Selling Pizzas
            </h3>

            {Array.isArray(analytics.topPizzas) &&
            analytics.topPizzas.length > 0 ? (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Pizza Name</th>
                      <th>Quantity Sold</th>
                      <th>Sales Revenue</th>
                    </tr>
                  </thead>

                  <tbody>
                    {analytics.topPizzas.map((pizza, index) => (
                      <tr key={`${pizza.name}-${index}`}>
                        <td>
                          <strong>{pizza.name}</strong>
                        </td>
                        <td>{pizza.quantitySold}</td>
                        <td>{formatCurrency(pizza.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="admin-empty">
                No paid pizza sales available for this period.
              </p>
            )}
          </>
        ) : (
          !analyticsError && (
            <p className="admin-empty">
              Sales analytics are not available.
            </p>
          )
        )}
      </section>

      {/* Customer Orders */}
      <section className="admin-orders">
        <div className="admin-orders-heading">
          <div>
            <h2>Customer Orders</h2>
            <p>Search orders, check payments and update delivery status.</p>
          </div>

          <div className="admin-action-buttons">
            <button
              className="admin-refresh-btn"
              onClick={refreshDashboard}
              disabled={loading || analyticsLoading}
            >
              {loading || analyticsLoading
                ? "Loading..."
                : "↻ Refresh All"}
            </button>

            <button
              className="admin-download-btn"
              onClick={downloadSalesReport}
              disabled={orders.length === 0}
            >
              ⬇ Download CSV
            </button>
          </div>
        </div>

        {/* Search and filters */}
        <div className="admin-filters">
          <input
            type="search"
            placeholder="Search name, phone or order ID..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search orders"
          />

          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            aria-label="Filter by order status"
          >
            <option value="All">All Order Statuses</option>

            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <select
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value)}
            aria-label="Filter by payment status"
          >
            <option value="All">All Payments</option>
            <option value="Paid">Paid</option>
            <option value="Unpaid">Pending / Failed</option>
          </select>

          <button className="admin-clear-btn" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>

        <p className="admin-results">
          Showing {filteredOrders.length} of {orders.length} orders
        </p>

        {loading ? (
          <div className="admin-empty">Loading orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="admin-empty">
            {orders.length === 0
              ? "No orders found."
              : "No orders match your search or filters."}
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Delivery Address</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Order Status</th>
                  <th>Update Status</th>
                </tr>
              </thead>

              <tbody>
                {filteredOrders.map((order) => {
                  const customer = order.customer || {};
                  const status = order.status || "Order Received";
                  const paymentStatus =
                    order.paymentStatus || "Pending";

                  return (
                    <tr key={order._id}>
                      <td className="admin-order-id">
                        #{String(order._id).slice(-6).toUpperCase()}
                      </td>

                      <td>
                        <strong>
                          {customer.name ||
                            order.customerName ||
                            "Customer"}
                        </strong>

                        <span className="admin-subtext">
                          {customer.phone ||
                            order.phone ||
                            "Phone unavailable"}
                        </span>
                      </td>

                      <td className="admin-address">
                        {customer.address ||
                          order.address ||
                          "Address unavailable"}
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
                        {formatCurrency(
                          order.totalPrice ?? order.totalAmount
                        )}
                      </td>

                      <td>
                        <span
                          className={`admin-payment payment-${String(
                            paymentStatus
                          ).toLowerCase()}`}
                        >
                          {paymentStatus}
                        </span>
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
