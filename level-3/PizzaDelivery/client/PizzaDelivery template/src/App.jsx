import { useEffect, useState } from "react";
import AdminDashboard from "./AdminDashboard";
import AdminLogin from "./AdminLogin";
import OrderTracking from "./OrderTracking";
import "./App.css";

const API_URL = "http://localhost:5000/api/pizzas";
const ORDER_URL = "http://localhost:5000/api/orders";
const PAYMENT_CREATE_URL =
  "http://localhost:5000/api/payments/create-order";
const PAYMENT_VERIFY_URL =
  "http://localhost:5000/api/payments/verify";

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existingScript = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true), {
        once: true,
      });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Razorpay Checkout load झाले नाही.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () =>
      reject(new Error("Razorpay Checkout load झाले नाही."));
    document.body.appendChild(script);
  });
}

async function readJson(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      "Backend कडून JSON response मिळाला नाही. server.js तपास."
    );
  }
}

function App() {
  const [pizzas, setPizzas] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCheckout, setShowCheckout] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [orderResult, setOrderResult] = useState(null);

  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("Pending");

  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    address: "",
  });

  const [showAdmin, setShowAdmin] = useState(false);
  const [adminToken, setAdminToken] = useState("");

  useEffect(() => {
    async function fetchPizzas() {
      try {
        const response = await fetch(API_URL);
        const data = await readJson(response);

        if (!response.ok) {
          throw new Error(data.message || "Failed to load pizzas.");
        }

        if (!Array.isArray(data)) {
          throw new Error("Pizza API response योग्य नाही.");
        }

        setPizzas(data);
      } catch (err) {
        setError(
          err.message || "Pizzas load झाले नाहीत. Backend तपासा."
        );
      } finally {
        setLoading(false);
      }
    }

    fetchPizzas();
  }, []);

  function addToCart(pizza) {
    if (orderPlaced) {
      setError("नवीन order करण्यासाठी आधी Back to Menu दाब.");
      return;
    }

    setError("");

    setCart((currentCart) => {
      const existing = currentCart.find(
        (item) => item._id === pizza._id
      );

      if (existing) {
        return currentCart.map((item) =>
          item._id === pizza._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...currentCart, { ...pizza, quantity: 1 }];
    });
  }

  function changeQuantity(id, amount) {
    if (orderPlaced) return;

    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item._id === id
            ? { ...item, quantity: item.quantity + amount }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  const totalItems = cart.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const totalPrice = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  async function handlePlaceOrder(event) {
    event.preventDefault();

    if (cart.length === 0) {
      setOrderError("तुझा cart रिकामा आहे.");
      return;
    }

    setOrderLoading(true);
    setOrderError("");
    setPaymentMessage("");
    setOrderResult(null);
    setPaymentStatus("Pending");

    try {
      const response = await fetch(ORDER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer,
          items: cart.map((item) => ({
            pizzaId: item._id,
            quantity: item.quantity,
          })),
        }),
      });

      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(data.message || "Order creation failed.");
      }

      setOrderResult(data);
      setPaymentStatus(data.paymentStatus || "Pending");
      setOrderPlaced(true);
    } catch (err) {
      setOrderError(
        err.message || "Order create करता आली नाही."
      );
    } finally {
      setOrderLoading(false);
    }
  }

  async function handlePayNow() {
    if (!orderResult?.orderId) {
      setPaymentMessage("आधी order place कर.");
      return;
    }

    if (paymentStatus === "Paid") {
      setPaymentMessage("या order चे payment आधीच झाले आहे.");
      return;
    }

    if (paymentLoading) return;

    setPaymentLoading(true);
    setPaymentMessage("");

    let checkoutOpened = false;

    try {
      await loadRazorpayScript();

      const createResponse = await fetch(PAYMENT_CREATE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: orderResult.orderId,
        }),
      });

      const paymentOrder = await readJson(createResponse);

      if (!createResponse.ok) {
        throw new Error(
          paymentOrder.message || "Payment order तयार झाले नाही."
        );
      }

      if (!paymentOrder.keyId || !paymentOrder.razorpayOrderId) {
        throw new Error("Razorpay configuration अपूर्ण आहे.");
      }

      const options = {
        key: paymentOrder.keyId,
        amount: paymentOrder.amount,
        currency: paymentOrder.currency,
        name: "Pizza Paradise",
        description: `Pizza Order ${String(orderResult.orderId)}`,
        order_id: paymentOrder.razorpayOrderId,

        prefill: {
          name: paymentOrder.customerName || customer.name,
          contact: paymentOrder.customerPhone || customer.phone,
        },

        theme: {
          color: "#c51f1a",
        },

        handler: async function (razorpayResponse) {
          setPaymentLoading(true);
          setPaymentMessage("Payment verify करत आहोत...");

          try {
            const verifyResponse = await fetch(PAYMENT_VERIFY_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                orderId: orderResult.orderId,
                razorpay_order_id:
                  razorpayResponse.razorpay_order_id,
                razorpay_payment_id:
                  razorpayResponse.razorpay_payment_id,
                razorpay_signature:
                  razorpayResponse.razorpay_signature,
              }),
            });

            const result = await readJson(verifyResponse);

            if (!verifyResponse.ok) {
              throw new Error(
                result.message || "Payment verification failed."
              );
            }

            if (result.paymentStatus !== "Paid") {
              throw new Error(
                result.message || "Payment अजून confirm झाले नाही."
              );
            }

            setPaymentStatus("Paid");
            setPaymentMessage(
              "Payment Successful! ✅ तुझे payment verify झाले."
            );

            setOrderResult((previous) => ({
              ...previous,
              paymentStatus: "Paid",
            }));
          } catch (err) {
            setPaymentMessage(
              `${err.message || "Payment verification failed."} Payment पुन्हा करण्यापूर्वी Razorpay Dashboard तपास.`
            );
          } finally {
            setPaymentLoading(false);
          }
        },

        modal: {
          ondismiss: function () {
            setPaymentLoading(false);
            setPaymentMessage(
              "Checkout बंद झाले. Payment झाले आहे का ते तपासून मग पुन्हा प्रयत्न कर."
            );
          },
        },
      };

      const checkout = new window.Razorpay(options);

      checkout.on("payment.failed", function (response) {
        setPaymentMessage(
          response.error?.description ||
            "Payment failed. पुन्हा प्रयत्न कर."
        );
        setPaymentLoading(false);
      });

      checkoutOpened = true;
      checkout.open();
    } catch (err) {
      setPaymentMessage(
        err.message || "Payment सुरू करता आले नाही."
      );
      setPaymentLoading(false);
    } finally {
      if (!checkoutOpened) {
        setPaymentLoading(false);
      }
    }
  }

  function resetCheckout() {
    setShowCheckout(false);
    setOrderPlaced(false);
    setOrderResult(null);
    setOrderError("");
    setPaymentMessage("");
    setPaymentStatus("Pending");
    setCart([]);
  }

  if (showAdmin && !adminToken) {
    return (
      <AdminLogin
        onLogin={(token) => setAdminToken(token)}
        onBack={() => setShowAdmin(false)}
      />
    );
  }

  if (showAdmin && adminToken) {
    return (
      <AdminDashboard
        token={adminToken}
        onBack={() => {
          setShowAdmin(false);
          setAdminToken("");
        }}
      />
    );
  }

  return (
    <main className="app">
      <div
        style={{
          textAlign: "right",
          padding: "12px 24px",
        }}
      >
        <button
          type="button"
          onClick={() => setShowAdmin(true)}
        >
          Admin Login
        </button>
      </div>

      <header className="hero">
        <p className="eyebrow">FRESH • HOT • DELICIOUS</p>
        <h1>Pizza Paradise 🍕</h1>
        <p>Your favourite pizza, made just the way you love it.</p>
      </header>

      <section className="menu">
        <h2>Our Pizza Menu</h2>

        {loading && <p>Loading delicious pizzas...</p>}
        {error && <p className="error">{error}</p>}

        <div className="pizza-grid">
          {pizzas.map((pizza) => (
            <article className="pizza-card" key={pizza._id}>
              <img
                src={pizza.image}
                alt={pizza.name}
                className="pizza-image"
              />

              <div className="pizza-info">
                <span className="category">{pizza.category}</span>
                <h3>{pizza.name}</h3>
                <p>{pizza.description}</p>

                <div className="pizza-footer">
                  <strong>₹{pizza.price}</strong>
                  <button
                    type="button"
                    onClick={() => addToCart(pizza)}
                    disabled={orderPlaced}
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="cart-section">
        <h2>🛒 Your Cart ({totalItems})</h2>

        {cart.length === 0 ? (
          <p>Your cart is empty. Add your favourite pizza!</p>
        ) : (
          <>
            {cart.map((item) => (
              <div className="cart-item" key={item._id}>
                <div>
                  <strong>{item.name}</strong>
                  <p>
                    ₹{item.price} × {item.quantity} = ₹
                    {item.price * item.quantity}
                  </p>
                </div>

                <div className="quantity-controls">
                  <button
                    type="button"
                    disabled={orderPlaced}
                    onClick={() => changeQuantity(item._id, -1)}
                  >
                    -
                  </button>

                  <span>{item.quantity}</span>

                  <button
                    type="button"
                    disabled={orderPlaced}
                    onClick={() => changeQuantity(item._id, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}

            <h3 className="cart-total">Total: ₹{totalPrice}</h3>

            {!orderPlaced && (
              <button
                type="button"
                className="checkout-button"
                onClick={() => {
                  setShowCheckout(true);
                  setOrderError("");
                  setPaymentMessage("");
                }}
              >
                Proceed to Checkout
              </button>
            )}
          </>
        )}
      </section>

      {showCheckout && (
        <section className="checkout-section">
          <h2>Delivery Details</h2>

          {!orderPlaced ? (
            <form onSubmit={handlePlaceOrder}>
              <label>
                Full Name
                <input
                  type="text"
                  required
                  value={customer.name}
                  onChange={(event) =>
                    setCustomer({
                      ...customer,
                      name: event.target.value,
                    })
                  }
                  placeholder="Enter your full name"
                />
              </label>

              <label>
                Mobile Number
                <input
                  type="tel"
                  required
                  pattern="[0-9]{10}"
                  title="Enter a 10-digit mobile number"
                  value={customer.phone}
                  onChange={(event) =>
                    setCustomer({
                      ...customer,
                      phone: event.target.value,
                    })
                  }
                  placeholder="10-digit mobile number"
                />
              </label>

              <label>
                Delivery Address
                <textarea
                  required
                  value={customer.address}
                  onChange={(event) =>
                    setCustomer({
                      ...customer,
                      address: event.target.value,
                    })
                  }
                  placeholder="Enter your complete address"
                />
              </label>

              <h3>Order Total: ₹{totalPrice}</h3>

              {orderError && (
                <p className="error">{orderError}</p>
              )}

              <button
                className="checkout-button"
                type="submit"
                disabled={orderLoading || cart.length === 0}
              >
                {orderLoading ? "Placing Order..." : "Place Order"}
              </button>
            </form>
          ) : (
            <div className="order-summary">
              <h3>Order Confirmed! 🍕</h3>

              <p>
                <strong>Order ID:</strong> {orderResult?.orderId}
              </p>

              <p>
                <strong>Delivery Status:</strong>{" "}
                {orderResult?.status}
              </p>

              <p>
                <strong>Name:</strong> {customer.name}
              </p>

              <p>
                <strong>Mobile:</strong> {customer.phone}
              </p>

              <p>
                <strong>Address:</strong> {customer.address}
              </p>

              {cart.map((item) => (
                <p key={item._id}>
                  {item.name} × {item.quantity} — ₹
                  {item.price * item.quantity}
                </p>
              ))}

              <h3>Total: ₹{orderResult?.totalPrice}</h3>

              <div className="payment-section">
                <h3>💳 Payment</h3>

                <p>
                  <strong>Payment Status:</strong> {paymentStatus}
                </p>

                {paymentMessage && (
                  <p className="payment-message" role="status">
                    {paymentMessage}
                  </p>
                )}

                <button
                  type="button"
                  className="checkout-button"
                  onClick={handlePayNow}
                  disabled={paymentLoading || paymentStatus === "Paid"}
                >
                  {paymentStatus === "Paid"
                    ? "Payment Completed ✓"
                    : paymentLoading
                      ? "Processing Payment..."
                      : "Pay Now"}
                </button>
              </div>

              <p>
                Payment Test Mode मध्ये चालू आहे. Test payment
                यशस्वी झाल्यावर status verify होईल.
              </p>

              <button
                type="button"
                className="checkout-button"
                onClick={resetCheckout}
              >
                Back to Menu
              </button>
            </div>
          )}
        </section>
      )}

      <OrderTracking />
    </main>
  );
}

export default App;
