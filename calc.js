const display = document.getElementById("display");
const expressionDisplay = document.getElementById("expression");
const statusDisplay = document.getElementById("status");
const buttonsContainer = document.getElementById("botones-calculadora");
const historyList = document.getElementById("lista-historial");
const emptyHistory = document.getElementById("historial-vacio");
const clearHistoryButton = document.getElementById("clear-history");
const functionInput = document.getElementById("function-input");
const plotFunctionButton = document.getElementById("plot-function");
const graphShortcuts = document.getElementById("graph-shortcuts");
const graphStatus = document.getElementById("graph-status");
const graphCanvas = document.getElementById("graph-canvas");
const xMinInput = document.getElementById("x-min");
const xMaxInput = document.getElementById("x-max");
const evalXInput = document.getElementById("eval-x");
const graphResult = document.getElementById("graph-result");
const trigModeControls = document.querySelectorAll("[id='trig-mode-controls'], [id='graph-trig-mode-controls']");

const STORAGE_KEY = "miHistorialCalculadora";
const TRIG_MODE_KEY = "miModoTrigonometrico";
const OPERATORS = new Set(["+", "-", "*", "/", "^"]);
const OPERATOR_LABELS = {
    "+": "+",
    "-": "-",
    "*": "x",
    "/": "÷",
    "^": "^"
};
const PRECEDENCE = {
    "+": 1,
    "-": 1,
    "*": 2,
    "/": 2,
    "^": 4,
    neg: 4
};
const ASSOCIATIVITY = {
    "+": "left",
    "-": "left",
    "*": "left",
    "/": "left",
    "^": "right",
    neg: "right"
};
const FUNCTION_NAMES = new Set(["sin", "cos", "tan", "sqrt", "log", "ln", "abs"]);
const CONSTANTS = {
    pi: Math.PI,
    e: Math.E
};

const state = {
    currentInput: "0",
    tokens: [],
    history: loadHistory(),
    trigMode: loadTrigMode(),
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

function loadTrigMode() {
    const savedMode = localStorage.getItem(TRIG_MODE_KEY);
    return savedMode === "deg" ? "deg" : "rad";
}

function saveTrigMode() {
    localStorage.setItem(TRIG_MODE_KEY, state.trigMode);
}

function isOperator(token) {
    return OPERATORS.has(token);
}

function isNumberToken(token) {
    return typeof token === "string" && /^-?\d+(\.\d+)?$/.test(token);
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
    statusDisplay.textContent = `${message} · ${state.trigMode === "deg" ? "Grados" : "Radianes"}`;
    statusDisplay.dataset.state = isError ? "error" : "default";
}

function updateGraphStatus(message, isError = false) {
    graphStatus.textContent = `${message} · ${state.trigMode === "deg" ? "Grados" : "Radianes"}`;
    graphStatus.dataset.state = isError ? "error" : "default";
}

function renderTrigModeControls() {
    trigModeControls.forEach((container) => {
        const buttons = container.querySelectorAll("[data-trig-mode]");

        buttons.forEach((button) => {
            button.classList.toggle("is-active", button.dataset.trigMode === state.trigMode);
            button.setAttribute("aria-pressed", button.dataset.trigMode === state.trigMode ? "true" : "false");
        });
    });
}

function setTrigMode(mode) {
    state.trigMode = mode === "deg" ? "deg" : "rad";
    saveTrigMode();
    renderTrigModeControls();
    updateStatus("Modo trigonometrico actualizado");
    renderGraph();
}

function convertTrigInput(value) {
    return state.trigMode === "deg" ? (value * Math.PI) / 180 : value;
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

function insertConstant(name) {
    const numericValue = CONSTANTS[name];

    if (!Number.isFinite(numericValue)) {
        updateStatus("Constante no disponible", true);
        return;
    }

    startFreshIfNeeded();

    const value = formatNumber(numericValue);
    const lastToken = getLastToken();

    if (state.inputDirty) {
        commitCurrentInput();
        state.tokens.push("*");
    } else if (isNumberToken(lastToken) || lastToken === ")") {
        state.tokens.push("*");
    }

    state.tokens.push(value);
    state.currentInput = "0";
    state.inputDirty = false;
    updateDisplay();
    updateStatus(`Constante ${name} insertada`);
}

function insertPower() {
    appendOperator("^");
}

function insertFunction(name) {
    startFreshIfNeeded();

    const lastToken = getLastToken();

    if (state.inputDirty) {
        commitCurrentInput();
        state.tokens.push("*");
    } else if (isNumberToken(lastToken) || lastToken === ")") {
        state.tokens.push("*");
    }

    state.tokens.push(name);
    state.tokens.push("(");
    state.currentInput = "0";
    state.inputDirty = false;
    state.justCalculated = false;
    updateDisplay();
    updateStatus(`Funcion ${name} lista`);
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

function tokenizeExpression(expression) {
    const rawTokens = [];
    let index = 0;

    while (index < expression.length) {
        const char = expression[index];

        if (/\s/.test(char)) {
            index += 1;
            continue;
        }

        if (/[0-9.]/.test(char)) {
            let value = "";

            while (index < expression.length && /[0-9.]/.test(expression[index])) {
                value += expression[index];
                index += 1;
            }

            if ((value.match(/\./g) || []).length > 1 || value === ".") {
                throw new Error("Numero invalido");
            }

            rawTokens.push({ type: "number", value: Number(value) });
            continue;
        }

        if (/[a-z]/i.test(char)) {
            let name = "";

            while (index < expression.length && /[a-z]/i.test(expression[index])) {
                name += expression[index].toLowerCase();
                index += 1;
            }

            if (name === "x") {
                rawTokens.push({ type: "variable", value: "x" });
                continue;
            }

            if (Object.prototype.hasOwnProperty.call(CONSTANTS, name)) {
                rawTokens.push({ type: "number", value: CONSTANTS[name] });
                continue;
            }

            if (FUNCTION_NAMES.has(name)) {
                rawTokens.push({ type: "function", value: name });
                continue;
            }

            throw new Error(`Funcion desconocida: ${name}`);
        }

        if ("+-*/^()".includes(char)) {
            rawTokens.push({
                type: char === "(" || char === ")" ? "paren" : "operator",
                value: char
            });
            index += 1;
            continue;
        }

        throw new Error(`Caracter no valido: ${char}`);
    }

    const normalizedTokens = [];

    rawTokens.forEach((token, tokenIndex) => {
        const previous = normalizedTokens[normalizedTokens.length - 1];

        if (
            previous &&
            needsImplicitMultiplication(previous, token)
        ) {
            normalizedTokens.push({ type: "operator", value: "*" });
        }

        if (
            token.type === "operator" &&
            token.value === "-" &&
            (!previous || (previous.type === "operator" && previous.value !== ")") || (previous.type === "paren" && previous.value === "("))
        ) {
            normalizedTokens.push({ type: "operator", value: "neg" });
            return;
        }

        normalizedTokens.push(token);

        if (tokenIndex === rawTokens.length - 1 && token.type === "function") {
            throw new Error("Falta abrir parentesis en la funcion");
        }
    });

    return normalizedTokens;
}

function needsImplicitMultiplication(previous, current) {
    const previousCanMultiply =
        previous.type === "number" ||
        previous.type === "variable" ||
        previous.value === ")";
    const currentCanMultiply =
        current.type === "number" ||
        current.type === "variable" ||
        current.type === "function" ||
        current.value === "(";

    return previousCanMultiply && currentCanMultiply;
}

function toRpn(tokens) {
    const output = [];
    const operators = [];

    tokens.forEach((token, index) => {
        if (token.type === "number" || token.type === "variable") {
            output.push(token);
            return;
        }

        if (token.type === "function") {
            operators.push(token);
            return;
        }

        if (token.type === "operator") {
            while (operators.length > 0) {
                const top = operators[operators.length - 1];

                if (top.type === "function") {
                    output.push(operators.pop());
                    continue;
                }

                if (
                    top.type === "operator" &&
                    (
                        PRECEDENCE[top.value] > PRECEDENCE[token.value] ||
                        (
                            PRECEDENCE[top.value] === PRECEDENCE[token.value] &&
                            ASSOCIATIVITY[token.value] === "left"
                        )
                    )
                ) {
                    output.push(operators.pop());
                    continue;
                }

                break;
            }

            operators.push(token);
            return;
        }

        if (token.value === "(") {
            operators.push(token);
            return;
        }

        if (token.value === ")") {
            while (operators.length > 0 && operators[operators.length - 1].value !== "(") {
                output.push(operators.pop());
            }

            if (operators.length === 0) {
                throw new Error("Parentesis desbalanceados");
            }

            operators.pop();

            if (operators.length > 0 && operators[operators.length - 1].type === "function") {
                output.push(operators.pop());
            }

            if (index > 0 && tokens[index - 1].value === "(") {
                throw new Error("Parentesis vacios");
            }
        }
    });

    while (operators.length > 0) {
        const operator = operators.pop();

        if (operator.value === "(" || operator.value === ")") {
            throw new Error("Parentesis desbalanceados");
        }

        output.push(operator);
    }

    return output;
}

function applyMathFunction(name, value) {
    const operations = {
        sin: Math.sin(convertTrigInput(value)),
        cos: Math.cos(convertTrigInput(value)),
        tan: Math.tan(convertTrigInput(value)),
        sqrt: value < 0 ? NaN : Math.sqrt(value),
        log: value <= 0 ? NaN : Math.log10(value),
        ln: value <= 0 ? NaN : Math.log(value),
        abs: Math.abs(value)
    };

    return operations[name];
}

function evaluateRpn(rpnTokens, xValue = 0) {
    const stack = [];

    rpnTokens.forEach((token) => {
        if (token.type === "number") {
            stack.push(token.value);
            return;
        }

        if (token.type === "variable") {
            stack.push(xValue);
            return;
        }

        if (token.type === "function") {
            const value = stack.pop();

            if (!Number.isFinite(value)) {
                throw new Error("Funcion incompleta");
            }

            const result = applyMathFunction(token.value, value);

            if (!Number.isFinite(result)) {
                throw new Error("La funcion sale del dominio permitido");
            }

            stack.push(result);
            return;
        }

        if (token.value === "neg") {
            const value = stack.pop();

            if (!Number.isFinite(value)) {
                throw new Error("Signo incompleto");
            }

            stack.push(-value);
            return;
        }

        const b = stack.pop();
        const a = stack.pop();

        if (!Number.isFinite(a) || !Number.isFinite(b)) {
            throw new Error("Operacion incompleta");
        }

        if (token.value === "/" && b === 0) {
            throw new Error("No se puede dividir entre cero");
        }

        const result = {
            "+": a + b,
            "-": a - b,
            "*": a * b,
            "/": a / b,
            "^": a ** b
        }[token.value];

        if (!Number.isFinite(result)) {
            throw new Error("Resultado no valido");
        }

        stack.push(result);
    });

    if (stack.length !== 1 || !Number.isFinite(stack[0])) {
        throw new Error("Operacion invalida");
    }

    return stack[0];
}

function evaluateMathExpression(expression, xValue = 0) {
    const tokens = tokenizeExpression(expression);
    const rpn = toRpn(tokens);
    return evaluateRpn(rpn, xValue);
}

function compileMathExpression(expression) {
    const tokens = tokenizeExpression(expression);
    return toRpn(tokens);
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

        const result = formatNumber(evaluateMathExpression(tokensToEvaluate.join("")));

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

function getGraphRange() {
    const xMin = Number(xMinInput.value);
    const xMax = Number(xMaxInput.value);

    if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMin === xMax) {
        throw new Error("Configura un rango X valido");
    }

    if (xMin > xMax) {
        throw new Error("X min debe ser menor que X max");
    }

    return { xMin, xMax };
}

function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    const rect = graphCanvas.getBoundingClientRect();
    const width = rect.width || 720;
    const height = rect.height || 420;

    graphCanvas.width = Math.round(width * ratio);
    graphCanvas.height = Math.round(height * ratio);

    const context = graphCanvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    return { context, width, height };
}

function toCanvasX(x, range, width) {
    return ((x - range.xMin) / (range.xMax - range.xMin)) * width;
}

function toCanvasY(y, bounds, height) {
    return height - ((y - bounds.minY) / (bounds.maxY - bounds.minY)) * height;
}

function sampleFunction(compiledExpression, range, width) {
    const sampleCount = Math.max(280, Math.floor(width));
    const points = [];

    for (let index = 0; index <= sampleCount; index += 1) {
        const x = range.xMin + ((range.xMax - range.xMin) * index) / sampleCount;

        try {
            const y = evaluateRpn(compiledExpression, x);

            if (Number.isFinite(y)) {
                points.push({ x, y });
            } else {
                points.push(null);
            }
        } catch (error) {
            points.push(null);
        }
    }

    return points;
}

function getVerticalBounds(points) {
    const validPoints = points.filter(Boolean);

    if (validPoints.length === 0) {
        throw new Error("La funcion no produce valores validos en ese rango");
    }

    let minY = Math.min(...validPoints.map((point) => point.y));
    let maxY = Math.max(...validPoints.map((point) => point.y));

    if (minY === maxY) {
        minY -= 1;
        maxY += 1;
    }

    const padding = (maxY - minY) * 0.12;

    return {
        minY: minY - padding,
        maxY: maxY + padding
    };
}

function drawGraphAxes(context, width, height, range, bounds) {
    context.clearRect(0, 0, width, height);

    const gridColor = "rgba(154, 176, 206, 0.18)";
    const axisColor = "rgba(238, 244, 255, 0.75)";
    const labelColor = "#9ab0ce";

    context.fillStyle = "rgba(2, 8, 17, 0.96)";
    context.fillRect(0, 0, width, height);

    context.lineWidth = 1;
    context.strokeStyle = gridColor;

    for (let step = 0; step <= 10; step += 1) {
        const x = (width / 10) * step;
        const y = (height / 10) * step;

        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();

        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
    }

    const axisX = range.xMin <= 0 && range.xMax >= 0 ? toCanvasX(0, range, width) : null;
    const axisY = bounds.minY <= 0 && bounds.maxY >= 0 ? toCanvasY(0, bounds, height) : null;

    context.strokeStyle = axisColor;
    context.lineWidth = 1.4;

    if (axisX !== null) {
        context.beginPath();
        context.moveTo(axisX, 0);
        context.lineTo(axisX, height);
        context.stroke();
    }

    if (axisY !== null) {
        context.beginPath();
        context.moveTo(0, axisY);
        context.lineTo(width, axisY);
        context.stroke();
    }

    context.fillStyle = labelColor;
    context.font = '12px "JetBrains Mono", monospace';
    context.fillText(`x: ${formatNumber(range.xMin)} a ${formatNumber(range.xMax)}`, 12, 18);
    context.fillText(`y: ${formatNumber(bounds.minY)} a ${formatNumber(bounds.maxY)}`, 12, 36);
    context.fillText(`modo: ${state.trigMode === "deg" ? "grados" : "radianes"}`, 12, 54);
}

function drawFunctionPath(context, width, height, range, bounds, points) {
    context.strokeStyle = "#6ee7b7";
    context.lineWidth = 2.4;
    context.beginPath();

    let drawing = false;

    points.forEach((point, index) => {
        if (!point) {
            drawing = false;
            return;
        }

        const currentX = toCanvasX(point.x, range, width);
        const currentY = toCanvasY(point.y, bounds, height);
        const previous = points[index - 1];

        if (
            !drawing ||
            !previous ||
            Math.abs(currentY - toCanvasY(previous.y, bounds, height)) > height * 0.45
        ) {
            context.moveTo(currentX, currentY);
            drawing = true;
            return;
        }

        context.lineTo(currentX, currentY);
    });

    context.stroke();
}

function updateFunctionEvaluation(compiledExpression) {
    const xValue = Number(evalXInput.value);

    if (!Number.isFinite(xValue)) {
        graphResult.textContent = "Introduce un valor valido";
        return;
    }

    try {
        const result = formatNumber(evaluateRpn(compiledExpression, xValue));
        graphResult.textContent = `f(${formatNumber(xValue)}) = ${result}`;
    } catch (error) {
        graphResult.textContent = error.message;
    }
}

function renderGraph() {
    try {
        const expression = functionInput.value.trim();

        if (!expression) {
            throw new Error("Escribe una funcion");
        }

        const compiledExpression = compileMathExpression(expression);
        const range = getGraphRange();
        const { context, width, height } = resizeCanvas();
        const points = sampleFunction(compiledExpression, range, width);
        const bounds = getVerticalBounds(points);

        drawGraphAxes(context, width, height, range, bounds);
        drawFunctionPath(context, width, height, range, bounds, points);
        updateFunctionEvaluation(compiledExpression);
        updateGraphStatus("Funcion representada correctamente");
    } catch (error) {
        const { context, width, height } = resizeCanvas();
        context.clearRect(0, 0, width, height);
        context.fillStyle = "rgba(2, 8, 17, 0.96)";
        context.fillRect(0, 0, width, height);
        context.fillStyle = "#ff7676";
        context.font = '16px "Space Grotesk", sans-serif';
        context.fillText("No se pudo dibujar la funcion", 20, 32);
        context.fillStyle = "#9ab0ce";
        context.font = '13px "JetBrains Mono", monospace';
        context.fillText(error.message, 20, 58);
        graphResult.textContent = "Corrige la expresion";
        updateGraphStatus(error.message, true);
    }
}

buttonsContainer.addEventListener("click", (event) => {
    const button = event.target.closest("button");

    if (!button) {
        return;
    }

    const { value, operator, action, function: functionName, constant } = button.dataset;

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

    if (action === "insert-function") {
        insertFunction(functionName);
    }

    if (action === "insert-power") {
        insertPower();
    }

    if (action === "insert-constant") {
        insertConstant(constant);
    }
});

trigModeControls.forEach((container) => {
    container.addEventListener("click", (event) => {
        const button = event.target.closest("[data-trig-mode]");

        if (!button) {
            return;
        }

        setTrigMode(button.dataset.trigMode);
    });
});

document.addEventListener("keydown", (event) => {
    const key = event.key;
    const targetTag = event.target.tagName;
    const isTypingInGraphInput =
        event.target === functionInput ||
        (targetTag === "INPUT" && event.target !== display);

    if (isTypingInGraphInput && key !== "Enter") {
        return;
    }

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

        if (event.target === functionInput || event.target === evalXInput || event.target === xMinInput || event.target === xMaxInput) {
            renderGraph();
            return;
        }

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

graphShortcuts.addEventListener("click", (event) => {
    const button = event.target.closest("[data-snippet]");

    if (!button) {
        return;
    }

    const { snippet } = button.dataset;
    const start = functionInput.selectionStart ?? functionInput.value.length;
    const end = functionInput.selectionEnd ?? functionInput.value.length;
    const before = functionInput.value.slice(0, start);
    const after = functionInput.value.slice(end);

    functionInput.value = `${before}${snippet}${after}`;
    const cursorOffset = snippet.endsWith("(") ? snippet.length : snippet.length;
    const position = start + cursorOffset;

    functionInput.focus();
    functionInput.setSelectionRange(position, position);
    renderGraph();
});

plotFunctionButton.addEventListener("click", renderGraph);
functionInput.addEventListener("input", renderGraph);
evalXInput.addEventListener("input", () => {
    try {
        const expression = functionInput.value.trim();

        if (!expression) {
            graphResult.textContent = "Escribe una funcion";
            return;
        }

        updateFunctionEvaluation(compileMathExpression(expression));
    } catch (error) {
        graphResult.textContent = error.message;
    }
});
xMinInput.addEventListener("input", renderGraph);
xMaxInput.addEventListener("input", renderGraph);
clearHistoryButton.addEventListener("click", clearHistory);
window.addEventListener("resize", renderGraph);

renderHistory();
renderTrigModeControls();
updateDisplay();
updateStatus("Lista para calcular");
renderGraph();
