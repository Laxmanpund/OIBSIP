const form = document.getElementById("converter-form");
const temperatureInput = document.getElementById("temperature");
const fromUnit = document.getElementById("from-unit");
const toUnit = document.getElementById("to-unit");
const swapButton = document.getElementById("swap-btn");
const clearButton = document.getElementById("clear-btn");
const resultValue = document.getElementById("result-value");
const resultDescription = document.getElementById("result-description");
const errorMessage = document.getElementById("error-message");

const unitNames = {C: "Celsius",F: "Fahrenheit", K: "Kelvin"};

function toCelsius(value, unit) {
  if (unit === "C") return value;
  if (unit === "F") return (value - 32) * 5 / 9;
  return value - 273.15;
}

function fromCelsius(celsius, unit) {
  if (unit === "C") return celsius;
  if (unit === "F") return (celsius * 9 / 5) + 32;
  return celsius + 273.15;
}

function formatNumber(value) {
  return Number(value.toFixed(4)).toLocaleString("en-US", {
    maximumFractionDigits: 4
  });
}

form.addEventListener("submit", function (event) {
  event.preventDefault();
  errorMessage.textContent = "";

  const value = Number(temperatureInput.value);
  const source = fromUnit.value;
  const target = toUnit.value;

  if (temperatureInput.value.trim() === "" || !Number.isFinite(value)) {
    errorMessage.textContent = "Please enter a valid temperature.";
    return;
  }

  const celsius = toCelsius(value, source);

  if (celsius < -273.15) {
    errorMessage.textContent =
      "Temperature cannot be below absolute zero (-273.15°C).";
    return;
  }

  const converted = fromCelsius(celsius, target);

  resultValue.textContent =
    `${formatNumber(converted)} ${target === "K" ? "K" : "°" + target}`;

  resultDescription.textContent =
    `${formatNumber(value)} ${source === "K" ? "K" : "°" + source} = ` +
    `${formatNumber(converted)} ${target === "K" ? "K" : "°" + target} ` +
    `(${unitNames[source]} to ${unitNames[target]})`;
});

swapButton.addEventListener("click", function () {
  const previousFrom = fromUnit.value;
  fromUnit.value = toUnit.value;
  toUnit.value = previousFrom;

  if (temperatureInput.value.trim() !== "") {
    form.requestSubmit();
  }
});

clearButton.addEventListener("click", function () {
  form.reset();
  temperatureInput.value = "";
  fromUnit.value = "C";
  toUnit.value = "F";
  resultValue.textContent = "—";
  resultDescription.textContent =
    "Your converted temperature will appear here.";
  errorMessage.textContent = "";
  temperatureInput.focus();
});