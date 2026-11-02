
/* ==========================================
   STEREOVISION STUDIO 3D
   MODULO IMAGEN SBS CON GESTOS TACTILES
   ========================================== */

import {
  getState,
  updateCalibration,
  resetCalibration,
  subscribe
} from "../core/state.js";

import {
  getActiveModule
} from "../components/navigation.js";

import {
  initTouchGestures
} from "../components/calibration.js";


// ==========================================
// CONFIGURACION
// ==========================================

const MODULE_ID = "sbs-image";

const DEFAULT_POSITION = {
  panX: 0,
  panY: 0
};

const CONTROLS = [
  {
    id: "scale",
    label: "Zoom / Escala",
    min: 50,
    max: 200,
    unit: "%"
  },
  {
    id: "horizontal",
    label: "Desplazamiento estereoscópico",
    min: -60,
    max: 60,
    unit: " px"
  },
  {
    id: "vertical",
    label: "Alineación vertical",
    min: -40,
    max: 40,
    unit: " px"
  },
  {
    id: "panX",
    label: "Mover imagen horizontalmente",
    min: -250,
    max: 250,
    unit: " px"
  },
  {
    id: "panY",
    label: "Mover imagen verticalmente",
    min: -250,
    max: 250,
    unit: " px"
  }
];


// ==========================================
// REFERENCIAS
// ==========================================

const elements = {
  tools: document.getElementById("module-tools"),
  renderer: document.getElementById("media-renderer"),
  reset: document.getElementById("btn-reset"),
  vr: document.getElementById("btn-vr"),
  message: document.getElementById("studio-message")
};


// ==========================================
// ESTADO DEL RENDERIZADOR
// ==========================================

let sourceImage = null;
let canvas = null;
let context = null;

let resizeObserver = null;
let destroyGestures = null;

let initialized = false;
let loadVersion = 0;


// ==========================================
// UTILIDADES
// ==========================================

function isActive() {
  return getActiveModule() === MODULE_ID;
}


function showMessage(message, error = false) {
  elements.message.textContent = message;

  elements.message.className = error
    ? "studio-message-error"
    : "studio-message-success";
}


function getCalibration() {
  const calibration = getState().calibration;

  return {
    ...calibration,
    panX: Number(calibration.panX) || 0,
    panY: Number(calibration.panY) || 0
  };
}


// ==========================================
// CREAR CONTROL
// ==========================================

function createSlider(config) {
  const calibration = getCalibration();

  const value = calibration[config.id];

  return `
    <div class="tool-control">

      <div class="control-heading">

        <label for="sbs-${config.id}">
          ${config.label}
        </label>

        <output
          id="sbs-${config.id}-value"
          class="control-value"
          for="sbs-${config.id}"
        >
          ${value}${config.unit}
        </output>

      </div>

      <input
        id="sbs-${config.id}"
        class="studio-range"
        type="range"
        min="${config.min}"
        max="${config.max}"
        step="1"
        value="${value}"
      >

    </div>
  `;
}


// ==========================================
// CREAR HERRAMIENTAS
// ==========================================

function renderTools() {
  elements.tools.innerHTML = `
    <div class="tool-group">

      <div class="tool-group-title">
        <span>CALIBRACIÓN ESTEREOSCÓPICA</span>
      </div>

      <p class="tool-description">
        Ajusta la escala y la alineación
        entre ambas perspectivas.
      </p>

      ${CONTROLS.slice(0, 3)
        .map(createSlider)
        .join("")}

    </div>

    <div class="tool-group">

      <div class="tool-group-title">
        <span>POSICIÓN Y GESTOS</span>
      </div>

      <p class="tool-description">
        Arrastra con un dedo para mover
        las dos vistas al mismo tiempo.
        Pellizca con dos dedos para hacer zoom.
      </p>

      ${CONTROLS.slice(3)
        .map(createSlider)
        .join("")}

    </div>

    <div class="tool-group">

      <div class="tool-group-title">
        <span>CONFIGURACIÓN DE OJOS</span>
      </div>

      <label class="studio-checkbox">

        <input
          id="sbs-swap-eyes"
          type="checkbox"
        >

        Intercambiar ojos
      </label>

    </div>

    <div class="tool-group">

      <button
        id="sbs-reset"
        class="tool-button"
        type="button"
      >
        ↺ Restablecer calibración
      </button>

    </div>

    <div class="tool-group">

      <div class="file-information">
        <strong>Control táctil activado</strong>

        <p>
          Un dedo: mover las dos imágenes.
        </p>

        <p>
          Dos dedos: acercar o alejar.
        </p>

        <p>
          Los desplazamientos de posición
          no modifican la disparidad relativa
          entre las perspectivas.
        </p>
      </div>

    </div>
  `;

  // ========================================
  // SLIDERS
  // ========================================

  CONTROLS.forEach(config => {
    const input = document.getElementById(
      `sbs-${config.id}`
    );

    input.addEventListener("input", () => {
      updateCalibration({
        [config.id]: Number(input.value)
      });

      updateControls();
      drawSBS();
    });
  });

  // ========================================
  // INTERCAMBIAR OJOS
  // ========================================

  document.getElementById("sbs-swap-eyes")
    .addEventListener("change", event => {
      updateCalibration({
        swapEyes: event.target.checked
      });

      drawSBS();
    });

  // ========================================
  // RESTABLECER
  // ========================================

  document.getElementById("sbs-reset")
    .addEventListener("click", restoreDefaults);
}


// ==========================================
// ACTUALIZAR CONTROLES
// ==========================================

function updateControls() {
  if (!isActive()) return;

  const calibration = getCalibration();

  CONTROLS.forEach(config => {
    const input = document.getElementById(
      `sbs-${config.id}`
    );

    const output = document.getElementById(
      `sbs-${config.id}-value`
    );

    if (!input || !output) return;

    const value = calibration[config.id];

    input.value = value;
    output.textContent =
      `${value}${config.unit}`;
  });

  const swap = document.getElementById(
    "sbs-swap-eyes"
  );

  if (swap) {
    swap.checked = calibration.swapEyes;
  }
}


// ==========================================
// TAMAÑO DEL CANVAS
// ==========================================

function resizeCanvas() {
  if (!canvas || !context) return null;

  const bounds =
    elements.renderer.getBoundingClientRect();

  const width = bounds.width;
  const height = bounds.height;

  if (width <= 0 || height <= 0) {
    return null;
  }

  const dpr = Math.min(
    window.devicePixelRatio || 1,
    2
  );

  const pixelWidth = Math.max(
    1,
    Math.round(width * dpr)
  );

  const pixelHeight = Math.max(
    1,
    Math.round(height * dpr)
  );

  if (
    canvas.width !== pixelWidth ||
    canvas.height !== pixelHeight
  ) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  context.setTransform(
    dpr, 0, 0, dpr, 0, 0
  );

  return { width, height };
}


// ==========================================
// DIBUJAR UNA PERSPECTIVA
// ==========================================

function drawEye({
  sourceX,
  destinationX,
  frameWidth,
  frameHeight,
  horizontalOffset,
  verticalOffset,
  panX,
  panY,
  scale
}) {
  const sourceWidth =
    sourceImage.naturalWidth / 2;

  const sourceHeight =
    sourceImage.naturalHeight;

  const fit = Math.min(
    frameWidth / sourceWidth,
    frameHeight / sourceHeight
  );

  const factor = fit * scale;

  const drawWidth =
    sourceWidth * factor;

  const drawHeight =
    sourceHeight * factor;

  const x =
    destinationX +
    (frameWidth - drawWidth) / 2 +
    horizontalOffset +
    panX;

  const y =
    (frameHeight - drawHeight) / 2 +
    verticalOffset +
    panY;

  context.save();

  // Recortar cada perspectiva para
  // que no invada el otro ojo.
  context.beginPath();

  context.rect(
    destinationX,
    0,
    frameWidth,
    frameHeight
  );

  context.clip();

  context.drawImage(
    sourceImage,
    sourceX,
    0,
    sourceWidth,
    sourceHeight,
    x,
    y,
    drawWidth,
    drawHeight
  );

  context.restore();
}


// ==========================================
// DIBUJAR SBS
// ==========================================

function drawSBS() {
  if (
    !isActive() ||
    !sourceImage ||
    !canvas ||
    !context
  ) {
    return;
  }

  const dimensions = resizeCanvas();

  if (!dimensions) return;

  const { width, height } = dimensions;

  const eyeWidth = width / 2;

  const calibration = getCalibration();

  const originalLeft = 0;

  const originalRight =
    sourceImage.naturalWidth / 2;

  const leftSource = calibration.swapEyes
    ? originalRight
    : originalLeft;

  const rightSource = calibration.swapEyes
    ? originalLeft
    : originalRight;

  const horizontal =
    calibration.horizontal / 2;

  const vertical =
    calibration.vertical / 2;

  const scale =
    calibration.scale / 100;

  const panX = calibration.panX;
  const panY = calibration.panY;

  context.clearRect(
    0, 0, width, height
  );

  context.fillStyle = "#05060c";

  context.fillRect(
    0, 0, width, height
  );

  // ========================================
  // OJO IZQUIERDO
  // ========================================

  drawEye({
    sourceX: leftSource,
    destinationX: 0,
    frameWidth: eyeWidth,
    frameHeight: height,
    horizontalOffset: -horizontal,
    verticalOffset: -vertical,
    panX,
    panY,
    scale
  });

  // ========================================
  // OJO DERECHO
  // ========================================

  drawEye({
    sourceX: rightSource,
    destinationX: eyeWidth,
    frameWidth: eyeWidth,
    frameHeight: height,
    horizontalOffset: horizontal,
    verticalOffset: vertical,
    panX,
    panY,
    scale
  });

  // ========================================
  // SEPARADOR CENTRAL
  // ========================================

  context.fillStyle = "#292d42";

  context.fillRect(
    eyeWidth - 0.5,
    0,
    1,
    height
  );

  // ========================================
  // ETIQUETAS
  // ========================================

  context.font =
    "600 12px Inter, sans-serif";

  context.textBaseline = "top";

  context.fillStyle =
    "rgba(0, 0, 0, 0.65)";

  context.fillRect(
    12, 12, 32, 27
  );

  context.fillRect(
    eyeWidth + 12,
    12,
    32,
    27
  );

  context.fillStyle = "#ffffff";

  context.fillText(
    "L", 23, 19
  );

  context.fillText(
    "R", eyeWidth + 23, 19
  );
}


// ==========================================
// APLICAR GESTOS TACTILES
// ==========================================

function enableTouchGestures() {
  if (!canvas) return;

  if (destroyGestures) {
    destroyGestures();
    destroyGestures = null;
  }

  destroyGestures = initTouchGestures({
    element: canvas,

    minScale: 50,
    maxScale: 200,
    maxPan: 250,

    getTransform: () => {
      const calibration = getCalibration();

      return {
        scale: calibration.scale,
        panX: calibration.panX,
        panY: calibration.panY
      };
    },

    onChange: values => {
      if (!isActive() || !sourceImage) {
        return;
      }

      updateCalibration(values);

      // Reflejar gestos en los sliders.
      updateControls();

      // Dibujar sin recargar archivo.
      drawSBS();
    }
  });
}


// ==========================================
// RESTABLECER
// ==========================================

function restoreDefaults() {
  if (!isActive() || !sourceImage) return;

  resetCalibration();

  // Los nuevos valores de posicion
  // tambien deben regresar a cero.
  // Se establecen explicitamente porque
  // los valores adicionales se fusionan
  // con el estado de calibracion actual.
  updateCalibration({
    ...DEFAULT_POSITION
  });

  updateControls();
  drawSBS();

  showMessage(
    "Calibración y posición restablecidas."
  );
}


// ==========================================
// LIMPIAR RECURSOS
// ==========================================

function clearSBS() {
  loadVersion++;

  if (destroyGestures) {
    destroyGestures();
    destroyGestures = null;
  }

  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  sourceImage = null;
  canvas = null;
  context = null;

  if (isActive()) {
    elements.reset.disabled = true;
    elements.vr.disabled = true;
  }
}


// ==========================================
// PREPARAR IMAGEN SBS
// ==========================================

async function prepareSBS() {
  if (!isActive()) return;

  // Evitar conservar controles y eventos
  // de una imagen anterior.
  clearSBS();

  const version = ++loadVersion;
  const state = getState();

  if (
    !state.file ||
    state.status !== "ready"
  ) {
    return;
  }

  const image =
    elements.renderer.querySelector("img");

  if (!image) {
    showMessage(
      "No se encontró la imagen importada.",
      true
    );
    return;
  }

  try {
    await image.decode();

    // Descartar cargas antiguas si el
    // usuario cambió el archivo o el módulo.
    if (
      version !== loadVersion ||
      !isActive() ||
      getState().file !== state.file
    ) {
      return;
    }

    if (
      image.naturalWidth < 2 ||
      image.naturalHeight < 1
    ) {
      throw new Error(
        "La imagen no tiene dimensiones válidas para SBS."
      );
    }

    sourceImage = image;

    canvas =
      document.createElement("canvas");

    canvas.id = "sbs-canvas";

    canvas.setAttribute(
      "aria-label",
      "Visualizador SBS táctil"
    );

    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.maxWidth = "none";
    canvas.style.maxHeight = "none";

    context = canvas.getContext(
      "2d",
      { alpha: false }
    );

    if (!context) {
      throw new Error(
        "El navegador no pudo crear el visualizador."
      );
    }

    // Reemplazar la vista previa
    // por el editor SBS real.
    elements.renderer.replaceChildren(
      canvas
    );

    // Habilitar interaccion directa.
    elements.renderer.classList.add(
      "interactive"
    );

    renderTools();

    elements.reset.disabled = false;
    elements.vr.disabled = false;

    resizeObserver = new ResizeObserver(
      () => {
        drawSBS();
      }
    );

    resizeObserver.observe(
      elements.renderer
    );

    updateControls();

    enableTouchGestures();

    drawSBS();

    showMessage(
      "Imagen SBS lista. Arrastra con un dedo o pellizca con dos."
    );

    console.log(
      "[SBS] Gestos táctiles activados:",
      state.fileName
    );

  } catch (error) {
    if (version !== loadVersion) {
      return;
    }

    clearSBS();

    showMessage(
      error.message ||
      "No se pudo preparar la imagen SBS.",
      true
    );

    console.error(
      "[StereoVision SBS]",
      error
    );
  }
}


// ==========================================
// INICIALIZAR MODULO
// ==========================================

export function initSBSImage() {
  if (initialized) return;

  initialized = true;

  // Nueva imagen importada.
  document.addEventListener(
    "studio:file-loaded",
    event => {
      if (event.detail.module === MODULE_ID) {
        prepareSBS();
      }
    }
  );

  // Boton Restablecer superior.
  elements.reset.addEventListener(
    "click",
    () => {
      if (isActive()) {
        restoreDefaults();
      }
    }
  );

  // Cambio de modulo o regreso a Inicio.
  document.addEventListener(
    "studio:before-module-change",
    () => {
      clearSBS();

      elements.renderer.classList.remove(
        "interactive"
      );
    }
  );

  // Al reemplazar o invalidar un archivo.
  subscribe(state => {
    if (!sourceImage && !canvas) {
      return;
    }

    if (
      state.status === "empty" ||
      state.status === "loading" ||
      state.status === "error"
    ) {
      clearSBS();

      elements.renderer.classList.remove(
        "interactive"
      );

      if (isActive()) {
        elements.tools.innerHTML = `
          <div class="tool-placeholder">
            <p>
              Importa una imagen SBS para
              activar la calibración y
              los gestos táctiles.
            </p>
          </div>
        `;
      }
    }
  });

  console.log(
    "[StereoVision] Imagen SBS táctil inicializada."
  );
}
