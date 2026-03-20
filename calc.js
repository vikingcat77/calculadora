/* === 1. SELECCIÓN DE ELEMENTOS DEL DOM === */
const display = document.getElementById('display');
const listaHistorial = document.getElementById('lista-historial');

// Al cargar la página, recuperamos lo que había en LocalStorage
const historialGuardado = localStorage.getItem('miHistorial');

// Si existe algo guardado, lo ponemos dentro de la lista
if (historialGuardado) {
    listaHistorial.innerHTML = historialGuardado;
}

let ultimoOperador = ""; // Para guardar el "+"
let ultimoNumero = "";    // Para guardar el "2"

let esResultado = false; // Esta variable nos dirá si lo que vemos es un resultado

/* === 2. FUNCIONES DE ENTRADA (NÚMEROS Y OPERADORES) === */

// Agrega números y el punto decimal
function agregar(valor) {
    // Si lo que hay en pantalla es un resultado, y el usuario pulsa un número...
    if (esResultado) {
        display.value = valor; // Reemplazamos el resultado por el nuevo número
        esResultado = false;   // Ya no es un "resultado", es una nueva entrada
    } else if (display.value === "0") {
        display.value = valor;
    } else {
        display.value += valor;
    }
}

// Agrega operadores (+, -, *, /) gestionando duplicados
function operar(operador) {
    esResultado = false; 
    const ultimoCaracter = display.value.trim().slice(-1);
    const operadores = ['+', '-', '*', '/'];

    if (operadores.includes(ultimoCaracter)) {
        // Quitamos el operador anterior y sus espacios, y ponemos el nuevo
        display.value = display.value.trim().slice(0, -1).trim() + " " + operador + " ";
    } else {
        display.value += " " + operador + " ";
    }
}

/* === 3. LÓGICA DE CÁLCULO Y BORRADO === */

function limpiar() {
    display.value = "0";
    esResultado = false;
    ultimoOperador = ""; // Reset memoria
    ultimoNumero = "";   // Reset memoria
}

function calcular() {
    try {
        let expresion = display.value;
        let resultado;

        // CASO A: Es una repetición (el usuario pulsa = varias veces seguidas)
        if (esResultado && ultimoOperador !== "" && ultimoNumero !== "") {
            // Construimos la repetición usando el valor actual + lo que tenemos en memoria
            let nuevaOperacion = `${display.value} ${ultimoOperador} ${ultimoNumero}`;
            resultado = eval(nuevaOperacion);
            
            // Para el historial, queremos que se vea la cuenta completa
            agregarAlHistorial(`${display.value} ${ultimoOperador} ${ultimoNumero}`, resultado);
        } 
        
        // CASO B: Es la primera vez que pulsa = en esta operación
        else {
            // Extraemos el último operador y número antes de calcular
            // Buscamos la última parte de la cadena (ej: "2 + 2" -> sacamos "+ 2")
            const partes = expresion.trim().split(" ");
            
            if (partes.length >= 3) {
                ultimoOperador = partes[partes.length - 2]; // El penúltimo es el operador
                ultimoNumero = partes[partes.length - 1];   // El último es el número
            }

            resultado = eval(expresion);
            agregarAlHistorial(expresion, resultado);
        }

        display.value = resultado;
        esResultado = true; // Marcamos que lo que hay en pantalla es un resultado

    } catch (error) {
        display.value = "Error";
        setTimeout(limpiar, 1500);
    }
}

/* === 4. GESTIÓN DEL HISTORIAL (BLOC DE NOTAS) === */

function agregarAlHistorial(expresion, resultado) {
    const nuevaEntrada = document.createElement('li');
    let expresionFormateada = expresion.replace(/\*/g, ' × ').replace(/\//g, ' ÷ ');
    nuevaEntrada.textContent = `${expresionFormateada} = ${resultado}`;
    
    listaHistorial.prepend(nuevaEntrada);

    // NUEVO: Guardamos el HTML de la lista en el "archivador" llamado 'miHistorial'
    localStorage.setItem('miHistorial', listaHistorial.innerHTML);
}

function limpiarHistorial() {
    listaHistorial.innerHTML = "";
    // NUEVO: Borramos también el dato del archivador
    localStorage.removeItem('miHistorial');
}

/* === 5. SOPORTE PARA TECLADO FÍSICO === */

document.addEventListener('keydown', (event) => {
    const tecla = event.key;

    if (!isNaN(tecla) || tecla === '.') {
        agregar(tecla);
    }
    
    if (['+', '-', '*', '/'].includes(tecla)) {
        operar(tecla);
    }

    if (tecla === 'Enter') {
        event.preventDefault(); 
        calcular();
    }

    if (tecla === 'Escape' || tecla.toLowerCase() === 'c') {
        limpiar();
    }

    if (tecla === 'Backspace') {
        display.value = display.value.slice(0, -1);
        if (display.value === "") display.value = "0";
    }
});


/* === 6. RECUPERAR RESULTADOS DEL HISTORIAL (Actualizado) === */

listaHistorial.addEventListener('click', (event) => {
    if (event.target.tagName === 'LI') {
        const textoCompleto = event.target.textContent;
        
        // Extraemos el resultado (lo que está después del "=")
        const partes = textoCompleto.split('=');
        const resultadoRecuperado = partes[partes.length - 1].trim();
        
        // --- LA MAGIA ESTÁ AQUÍ ---
        // En lugar de: display.value = resultadoRecuperado;
        // Usamos nuestra función agregar() que ya tiene la lógica de 
        // no borrar lo que hay si no es un "0".
        agregar(resultadoRecuperado);
        
        // Feedback visual rápido
        display.style.backgroundColor = "#444";
        setTimeout(() => display.style.backgroundColor = "#333", 200);
    }
});