import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5000/api/pizzas";
const ORDER_URL = "http://localhost:5000/api/orders";

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

  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    address: "",
  });

  useEffect(() => {
    async function fetchPizzas() {
      try {
        const response = await fetch(API_URL);

        if (!response.ok) {
          throw new Error("Failed to load pizzas");
        }

        setPizzas(await response.json());
      } catch {
        setError("Pizzas load झाले नाहीत. Backend तपासा.");
      } finally {
        setLoading(false);
      }
    }

    fetchPizzas();
  }, []);

  function addToCart(pizza) {
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
    setOrderLoading(true);
    setOrderError("");
    setOrderResult(null);

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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Order creation failed.");
      }

      setOrderResult(data);
      setOrderPlaced(true);
    } catch (err) {
      setOrderError(err.message || "Order create करता आला नाही.");
    } finally {
      setOrderLoading(false);
    }
  }

  return (
    <main className="app">
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
                    onClick={() => changeQuantity(item._id, -1)}
                  >
                    -
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => changeQuantity(item._id, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}

            <h3 className="cart-total">Total: ₹{totalPrice}</h3>

            <button
              type="button"
              className="checkout-button"
              onClick={() => {
                setShowCheckout(true);
                setOrderPlaced(false);
                setOrderError("");
                setOrderResult(null);
              }}
            >
              Proceed to Checkout
            </button>
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
                <strong>Status:</strong> {orderResult?.status}
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
              <p>Payment अजून केलेले नाही. हा Cash on Delivery शिवाय demo order आहे.</p>

              <button
                type="button"
                className="checkout-button"
                onClick={() => {
                  setShowCheckout(false);
                  setCart([]);
                  setOrderPlaced(false);
                  setOrderResult(null);
                }}
              >
                Back to Menu
              </button>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export default App;
