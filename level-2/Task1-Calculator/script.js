const display = document.getElementById("display");
const buttons = document.querySelector(".buttons");

let currentInput = "0";
let previousInput = null;
let operator = null;
let shouldResetDisplay = false;

function updateDisplay() {
    display.value = currentInput;
}

function clearCalculator() {
    currentInput = "0";
    previousInput = null;
    operator = null;
    shouldResetDisplay = false;
    updateDisplay();
}

function inputNumber(number) {
    if (currentInput === "Error") {
        currentInput = number;
        shouldResetDisplay = false;
    } else if (shouldResetDisplay) {
        currentInput = number;
        shouldResetDisplay = false;
    } else if (currentInput === "0") {
        currentInput = number;
    } else if (currentInput.length < 15) {
        currentInput += number;
    }

    updateDisplay();
}

function inputDecimal() {
    if (currentInput === "Error" || shouldResetDisplay) {
        currentInput = "0.";
        shouldResetDisplay = false;
    } else if (!currentInput.includes(".")) {
        currentInput += ".";
    }

    updateDisplay();
}

function chooseOperator(nextOperator) {
    if (currentInput === "Error") return;

    const inputValue = Number.parseFloat(currentInput);

    if (operator && !shouldResetDisplay) {
        const result = calculate(previousInput, inputValue, operator);

        if (!Number.isFinite(result)) {
            showError();
            return;
        }

        currentInput = formatResult(result);
        updateDisplay();
        previousInput = result;
    } else {
        previousInput = inputValue;
    }

    operator = nextOperator;
    shouldResetDisplay = true;
}

function calculate(first, second, selectedOperator) {
    switch (selectedOperator) {
        case "+":
            return first + second;
        case "-":
            return first - second;
        case "*":
            return first * second;
        case "/":
            return second === 0 ? NaN : first / second;
        default:
            return second;
    }
}

function formatResult(number) {
    return String(Number(number.toPrecision(10)));
}

function showError() {
    currentInput = "Error";
    previousInput = null;
    operator = null;
    shouldResetDisplay = true;
    updateDisplay();
}

function calculateResult() {
    if (operator === null || previousInput === null) return;

    const secondInput = Number.parseFloat(currentInput);
    const result = calculate(previousInput, secondInput, operator);

    if (!Number.isFinite(result)) {
        showError();
        return;
    }

    currentInput = formatResult(result);
    previousInput = null;
    operator = null;
    shouldResetDisplay = true;
    updateDisplay();
}

function deleteLastCharacter() {
    if (currentInput === "Error" || shouldResetDisplay) {
        currentInput = "0";
        shouldResetDisplay = false;
    } else if (currentInput.length > 1) {
        currentInput = currentInput.slice(0, -1);

        if (currentInput === "-") {
            currentInput = "0";
        }
    } else {
        currentInput = "0";
    }

    updateDisplay();
}

buttons.addEventListener("click", function (event) {
    const button = event.target.closest("button");

    if (!button) return;

    if (button.dataset.number !== undefined) {
        inputNumber(button.dataset.number);
    } else if (button.dataset.operator) {
        chooseOperator(button.dataset.operator);
    } else {
        switch (button.dataset.action) {
            case "clear":
                clearCalculator();
                break;
            case "delete":
                deleteLastCharacter();
                break;
            case "decimal":
                inputDecimal();
                break;
            case "equals":
                calculateResult();
                break;
        }
    }
});

updateDisplay();