const display = document.getElementById("display");
const expressionDisplay = document.getElementById("expression");
const statusDisplay = document.getElementById("status");
const buttonsContainer = document.getElementById("botones-calculadora");
const historyList = document.getElementById("lista-historial");
const emptyHistory = document.getElementById("historial-vacio");
const clearHistoryButton = document.getElementById("clear-history");

const STORAGE_KEY = "miHistorialCalculadora";
const OPERATORS = new Set(["+", "-", "*", "/"]);
const OPERATOR_LABELS = {
    "+": "+",
    "-": "-",
    "*": "x",
    "/": "÷"
};
const PRECEDENCE = {
    "+": 1,
    "-": 1,
    "*": 2,
    "/": 2
};

const state = {
    currentInput: "0",
    tokens: [],
    history: loadHistory(),
    lastOperator: "",
    lastOperand: "",
    justCalculated: false,
    inputDirty: false
};

function loadHistory() {
    try {
        const rawHistory = localStorage.getItem(STORAGE_KEY);
        if (!rawHistory) {
            return [];
        }

        const parsedHistory = JSON.parse(rawHistory);
        return Array.isArray(parsedHistory) ? parsedHistory : [];
    } catch (error) {
        console.error("No se pudo recuperar el historial:", error);
        return [];
    }
}

function saveHistory() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
}

function isOperator(token) {
    return OPERATORS.has(token);
}

function isNumberToken(token) {
    return typeof token === "string" && token !== "" && !isOperator(token) && token !== "(" && token !== ")";
}

function formatNumber(value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        throw new Error("Resultado no valido");
    }

    const normalized = numericValue.toFixed(10).replace(/\.?0+$/, "");
    return normalized === "-0" ? "0" : normalized;
}

function formatToken(token) {
    return OPERATOR_LABELS[token] || token;
}

function getVisibleExpression() {
    const preview = [...state.tokens];

    if (state.inputDirty) {
        preview.push(state.currentInput);
    }

    return preview.map(formatToken).join(" ");
}

function updateDisplay() {
    display.value = state.currentInput;
    expressionDisplay.textContent = getVisibleExpression();
}

function updateStatus(message, isError = false) {
    statusDisplay.textContent = message;
    statusDisplay.dataset.state = isError ? "error" : "default";
}

function renderHistory() {
    historyList.innerHTML = "";

    state.history.forEach((entry) => {
        const item = document.createElement("li");
        item.className = "historial-item";
        item.tabIndex = 0;
        item.dataset.result = entry.result;

        const expression = document.createElement("span");
        expression.className = "historial-expresion";
        expression.textContent = entry.expression;

        const result = document.createElement("strong");
        result.className = "historial-resultado";
        result.textContent = entry.result;

        item.append(expression, result);
        historyList.appendChild(item);
    });

    emptyHistory.hidden = state.history.length > 0;
}

function resetState() {
    state.currentInput = "0";
    state.tokens = [];
    state.lastOperator = "";
    state.lastOperand = "";
    state.justCalculated = false;
    state.inputDirty = false;
    updateDisplay();
    updateStatus("Lista para calcular");
}

function clearAll() {
    resetState();
}

function startFreshIfNeeded() {
    if (!state.justCalculated) {
        return;
    }

    state.currentInput = "0";
    state.tokens = [];
    state.lastOperator = "";
    state.lastOperand = "";
    state.justCalculated = false;
    state.inputDirty = false;
}

function getLastToken() {
    return state.tokens[state.tokens.length - 1];
}

function countOpenParentheses(tokens = state.tokens) {
    return tokens.reduce((count, token) => {
        if (token === "(") {
            return count + 1;
        }

        if (token === ")") {
            return count - 1;
        }

        return count;
    }, 0);
}

function commitCurrentInput() {
    if (!state.inputDirty) {
        return false;
    }

    state.tokens.push(state.currentInput);
    state.currentInput = "0";
    state.inputDirty = false;
    return true;
}

function clearEntry() {
    if (state.justCalculated) {
        resetState();
        return;
    }

    if (state.inputDirty) {
        if (
            state.currentInput.length <= 1 ||
            (state.currentInput.length === 2 && state.currentInput.startsWith("-"))
        ) {
            state.currentInput = "0";
            state.inputDirty = false;
        } else {
            state.currentInput = state.currentInput.slice(0, -1);
        }

        updateDisplay();
        return;
    }

    const lastToken = state.tokens.pop();

    if (!lastToken) {
        updateDisplay();
        return;
    }

    if (isNumberToken(lastToken)) {
        state.currentInput = lastToken;
        state.inputDirty = true;
    }

    updateDisplay();
}

function appendValue(value) {
    startFreshIfNeeded();

    if (value === "." && state.currentInput.includes(".")) {
        updateStatus("Ese numero ya tiene decimal");
        return;
    }

    if (!state.inputDirty) {
        if (value === ".") {
            state.currentInput = "0.";
        } else if (state.currentInput === "-0") {
            state.currentInput = `-${value}`;
        } else {
            state.currentInput = value;
        }
    } else if (value === ".") {
        state.currentInput = `${state.currentInput}.`;
    } else if (state.currentInput === "0") {
        state.currentInput = value;
    } else if (state.currentInput === "-0") {
        state.currentInput = `-${value}`;
    } else {
        state.currentInput = `${state.currentInput}${value}`;
    }

    state.inputDirty = true;
    updateDisplay();
    updateStatus("Escribiendo operacion");
}

function appendOperator(operator) {
    if (state.currentInput === "Error") {
        return;
    }

    if (state.justCalculated) {
        state.tokens = [state.currentInput];
        state.justCalculated = false;
        state.inputDirty = false;
    } else {
        commitCurrentInput();
    }

    const lastToken = getLastToken();

    if (lastToken === "(") {
        updateStatus("Antes necesitas un numero", true);
        return;
    }

    if (!lastToken && state.currentInput === "0") {
        state.tokens.push("0");
    }

    if (isOperator(lastToken)) {
        state.tokens[state.tokens.length - 1] = operator;
    } else {
        state.tokens.push(operator);
    }

    state.currentInput = "0";
    state.inputDirty = false;
    updateDisplay();
    updateStatus(`Operador ${formatToken(operator)} seleccionado`);
}

function openParenthesis() {
    startFreshIfNeeded();

    const lastToken = getLastToken();

    if (state.inputDirty) {
        commitCurrentInput();
        state.tokens.push("*");
    } else if (isNumberToken(lastToken) || lastToken === ")") {
        state.tokens.push("*");
    }

    state.tokens.push("(");
    state.currentInput = "0";
    state.inputDirty = false;
    updateDisplay();
    updateStatus("Parentesis abierto");
}

function closeParenthesis() {
    if (countOpenParentheses() <= 0) {
        updateStatus("No hay parentesis por cerrar", true);
        return;
    }

    const lastToken = getLastToken();

    if (state.inputDirty) {
        commitCurrentInput();
    } else if (!lastToken || isOperator(lastToken) || lastToken === "(") {
        updateStatus("Falta un numero antes de cerrar", true);
        return;
    }

    state.tokens.push(")");
    state.currentInput = "0";
    state.inputDirty = false;
    state.justCalculated = false;
    updateDisplay();
    updateStatus("Parentesis cerrado");
}

function toggleSign() {
    if (state.justCalculated) {
        state.justCalculated = false;
        state.tokens = [];
        state.lastOperator = "";
        state.lastOperand = "";
    }

    if (!state.inputDirty && state.currentInput === "0") {
        state.currentInput = "-0";
        state.inputDirty = true;
    } else {
        state.currentInput = formatNumber(-Number(state.currentInput));
        state.inputDirty = state.currentInput !== "0";
    }

    updateDisplay();
    updateStatus("Signo cambiado");
}

function applyPercentage() {
    if (state.currentInput === "Error") {
        return;
    }

    state.currentInput = formatNumber(Number(state.currentInput) / 100);
    state.inputDirty = state.currentInput !== "0";
    state.justCalculated = false;
    updateDisplay();
    updateStatus("Porcentaje aplicado");
}

function evaluateTokens(tokens) {
    const output = [];
    const operators = [];

    tokens.forEach((token) => {
        if (isOperator(token)) {
            while (
                operators.length > 0 &&
                isOperator(operators[operators.length - 1]) &&
                PRECEDENCE[operators[operators.length - 1]] >= PRECEDENCE[token]
            ) {
                output.push(operators.pop());
            }

            operators.push(token);
            return;
        }

        if (token === "(") {
            operators.push(token);
            return;
        }

        if (token === ")") {
            while (operators.length > 0 && operators[operators.length - 1] !== "(") {
                output.push(operators.pop());
            }

            if (operators.length === 0) {
                throw new Error("Parentesis desbalanceados");
            }

            operators.pop();
            return;
        }

        output.push(Number(token));
    });

    while (operators.length > 0) {
        const operator = operators.pop();

        if (operator === "(" || operator === ")") {
            throw new Error("Parentesis desbalanceados");
        }

        output.push(operator);
    }

    const stack = [];

    output.forEach((token) => {
        if (typeof token === "number") {
            stack.push(token);
            return;
        }

        const b = stack.pop();
        const a = stack.pop();

        if (!Number.isFinite(a) || !Number.isFinite(b)) {
            throw new Error("Operacion incompleta");
        }

        if (token === "/" && b === 0) {
            throw new Error("No se puede dividir entre cero");
        }

        const operations = {
            "+": a + b,
            "-": a - b,
            "*": a * b,
            "/": a / b
        };

        stack.push(operations[token]);
    });

    if (stack.length !== 1) {
        throw new Error("Operacion invalida");
    }

    return formatNumber(stack[0]);
}

function captureLastOperation(tokens) {
    if (tokens.length < 3) {
        state.lastOperator = "";
        state.lastOperand = "";
        return;
    }

    const last = tokens[tokens.length - 1];
    const operator = tokens[tokens.length - 2];
    const previous = tokens[tokens.length - 3];

    if (isNumberToken(last) && isOperator(operator) && isNumberToken(previous)) {
        state.lastOperator = operator;
        state.lastOperand = last;
        return;
    }

    state.lastOperator = "";
    state.lastOperand = "";
}

function formatHistoryExpression(tokens) {
    return tokens.map(formatToken).join(" ");
}

function addToHistory(expression, result) {
    state.history.unshift({ expression, result });
    state.history = state.history.slice(0, 20);
    saveHistory();
    renderHistory();
}

function buildCalculationTokens() {
    const tokens = [...state.tokens];

    if (state.inputDirty) {
        tokens.push(state.currentInput);
    }

    if (tokens.length === 0) {
        return [];
    }

    const lastToken = tokens[tokens.length - 1];

    if (isOperator(lastToken) || lastToken === "(") {
        throw new Error("Operacion incompleta");
    }

    if (countOpenParentheses(tokens) !== 0) {
        throw new Error("Faltan parentesis por cerrar");
    }

    return tokens;
}

function calculate() {
    try {
        let tokensToEvaluate;
        let expressionForHistory;

        if (state.justCalculated && state.lastOperator && state.lastOperand) {
            tokensToEvaluate = [state.currentInput, state.lastOperator, state.lastOperand];
            expressionForHistory = formatHistoryExpression(tokensToEvaluate);
        } else {
            tokensToEvaluate = buildCalculationTokens();

            if (tokensToEvaluate.length === 0) {
                updateStatus("No hay nada que calcular");
                return;
            }

            expressionForHistory = formatHistoryExpression(tokensToEvaluate);
            captureLastOperation(tokensToEvaluate);
        }

        const result = evaluateTokens(tokensToEvaluate);

        state.currentInput = result;
        state.tokens = [];
        state.inputDirty = false;
        state.justCalculated = true;
        updateDisplay();
        updateStatus("Resultado calculado");
        addToHistory(expressionForHistory, result);
    } catch (error) {
        state.currentInput = "Error";
        state.tokens = [];
        state.inputDirty = false;
        state.justCalculated = false;
        updateDisplay();
        updateStatus(error.message, true);
        window.setTimeout(resetState, 1600);
    }
}

function useHistoryResult(result) {
    state.currentInput = result;
    state.tokens = [];
    state.justCalculated = true;
    state.inputDirty = false;
    updateDisplay();
    updateStatus("Resultado recuperado del historial");
}

function clearHistory() {
    state.history = [];
    saveHistory();
    renderHistory();
    updateStatus("Historial borrado");
}

buttonsContainer.addEventListener("click", (event) => {
    const button = event.target.closest("button");

    if (!button) {
        return;
    }

    const { value, operator, action } = button.dataset;

    if (value) {
        appendValue(value);
    }

    if (operator) {
        appendOperator(operator);
    }

    if (action === "clear") {
        clearAll();
    }

    if (action === "delete") {
        clearEntry();
        updateStatus("Ultimo elemento eliminado");
    }

    if (action === "calculate") {
        calculate();
    }

    if (action === "toggle-sign") {
        toggleSign();
    }

    if (action === "percentage") {
        applyPercentage();
    }

    if (action === "open-parenthesis") {
        openParenthesis();
    }

    if (action === "close-parenthesis") {
        closeParenthesis();
    }
});

document.addEventListener("keydown", (event) => {
    const key = event.key;

    if (/^[0-9]$/.test(key)) {
        appendValue(key);
        return;
    }

    if (key === ".") {
        appendValue(key);
        return;
    }

    if (isOperator(key)) {
        appendOperator(key);
        return;
    }

    if (key === "(") {
        openParenthesis();
        return;
    }

    if (key === ")") {
        closeParenthesis();
        return;
    }

    if (key === "%") {
        event.preventDefault();
        applyPercentage();
        return;
    }

    if (key === "Enter" || key === "=") {
        event.preventDefault();
        calculate();
        return;
    }

    if (key === "Backspace") {
        event.preventDefault();
        clearEntry();
        updateStatus("Ultimo elemento eliminado");
        return;
    }

    if (key === "Escape" || key.toLowerCase() === "c") {
        clearAll();
        return;
    }

    if (key === "F9") {
        event.preventDefault();
        toggleSign();
    }
});

historyList.addEventListener("click", (event) => {
    const item = event.target.closest(".historial-item");

    if (!item) {
        return;
    }

    useHistoryResult(item.dataset.result);
});

historyList.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
        return;
    }

    const item = event.target.closest(".historial-item");

    if (!item) {
        return;
    }

    event.preventDefault();
    useHistoryResult(item.dataset.result);
});

clearHistoryButton.addEventListener("click", clearHistory);

renderHistory();
updateDisplay();
updateStatus("Lista para calcular");
