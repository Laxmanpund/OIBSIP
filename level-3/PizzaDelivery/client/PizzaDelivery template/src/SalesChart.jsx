import "./SalesChart.css";

export default function SalesChart({ dailySales = [] }) {
  const salesMap = new Map(
    dailySales.map((day) => [day._id, Number(day.revenue || 0)])
  );

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));

    const key = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");

    return {
      key,
      label: date.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
      }),
      revenue: salesMap.get(key) || 0,
    };
  });

  const maxRevenue = Math.max(...days.map((day) => day.revenue), 1);

  return (
    <section className="sales-chart-card">
      <div className="sales-chart-heading">
        <div>
          <h3>📈 Daily Sales</h3>
          <p>Paid revenue over the last 7 days</p>
        </div>
        <span className="sales-chart-unit">INR (₹)</span>
      </div>

      <div
        className="sales-chart"
        role="img"
        aria-label="Bar chart showing paid sales for the last seven days"
      >
        {days.map((day) => {
          const height =
            day.revenue > 0
              ? Math.max((day.revenue / maxRevenue) * 100, 4)
              : 0;

          return (
            <div className="sales-chart-column" key={day.key}>
              <span className="sales-chart-value">
                {day.revenue > 0
                  ? `₹${day.revenue.toLocaleString("en-IN")}`
                  : "—"}
              </span>

              <div className="sales-chart-bar-area">
                <div
                  className={`sales-chart-bar ${
                    day.revenue > 0 ? "has-sales" : ""
                  }`}
                  style={{ height: `${height}%` }}
                  title={`${day.label}: ₹${day.revenue}`}
                />
              </div>

              <span className="sales-chart-label">{day.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
