
/* ==========================================
   STEREOVISION STUDIO 3D
   MÓDULO DE IMAGEN SBS
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

const MODULE_ID = "sbs-image";

const CONTROLS = [
  {
    id: "scale",
    label: "Zoom / Escala",
    min: 50,
    max: 200,
    step: 1,
    unit: "%"
  },
  {
    id: "horizontal",
    label: "Desplazamiento horizontal",
    min: -60,
    max: 60,
    step: 1,
    unit: " px"
  },
  {
    id: "vertical",
    label: "Alineación vertical",
    min: -40,
    max: 40,
    step: 1,
    unit: " px"
  }
];

const elements = {
  tools: document.getElementById("module-tools"),
  renderer: document.getElementById("media-renderer"),
  reset: document.getElementById("btn-reset"),
  vr: document.getElementById("btn-vr"),
  message: document.getElementById("studio-message")
};

let sourceImage = null;
let canvas = null;
let context = null;
let resizeObserver = null;
let initialized = false;
let loadVersion = 0;


// ==========================================
// COMPROBAR MÓDULO ACTIVO
// ==========================================

function isActive() {
  return getActiveModule() === MODULE_ID;
}


// ==========================================
// MOSTRAR MENSAJES
// ==========================================

function showMessage(message, type = "success") {
  elements.message.textContent = message;

  elements.message.className =
    type === "error"
      ? "studio-message-error"
      : "studio-message-success";
}


// ==========================================
// CREAR CONTROL DESLIZANTE
// ==========================================

function createSlider(config, value) {
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
        step="${config.step}"
        value="${value}"
      >

    </div>
  `;
}


// ==========================================
// CONSTRUIR PANEL DE HERRAMIENTAS
// ==========================================

function renderTools() {
  const calibration = getState().calibration;

  elements.tools.innerHTML = `
    <div class="tool-group">

      <div class="tool-group-title">
        <span>CALIBRACIÓN ESTEREOSCÓPICA</span>
        <span aria-hidden="true">◈</span>
      </div>

      <p class="tool-description">
        Ajusta la visualización de ambas
        perspectivas sin modificar el archivo.
      </p>

      ${CONTROLS.map(config =>
        createSlider(config, calibration[config.id])
      ).join("")}

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

      <p class="tool-description"
         style="margin-top: 12px;">
        Invierte las perspectivas izquierda
        y derecha cuando sea necesario.
      </p>

    </div>

    <div class="tool-group">

      <div class="tool-group-title">
        <span>CONTROLES</span>
      </div>

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
        <strong>Recomendación visual</strong>
        <p>
          Usa desplazamientos pequeños.
          Si observas visión doble persistente,
          fatiga o mareo, detén la prueba.
        </p>
      </div>

    </div>
  `;

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

  document.getElementById("sbs-swap-eyes")
    .addEventListener("change", event => {
      updateCalibration({
        swapEyes: event.target.checked
      });

      drawSBS();
    });

  document.getElementById("sbs-reset")
    .addEventListener("click", restoreDefaults);
}


// ==========================================
// SINCRONIZAR CONTROLES
// ==========================================

function updateControls() {
  if (!isActive()) return;

  const { calibration } = getState();

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
    output.textContent = `${value}${config.unit}`;
  });

  const swap = document.getElementById(
    "sbs-swap-eyes"
  );

  if (swap) {
    swap.checked = calibration.swapEyes;
  }
}


// ==========================================
// PREPARAR TAMAÑO DEL CANVAS
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

  context.setTransform(dpr, 0, 0, dpr, 0, 0);

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
  scale
}) {
  const sourceWidth = sourceImage.naturalWidth / 2;
  const sourceHeight = sourceImage.naturalHeight;

  // Ajuste proporcional dentro de cada región.
  const fit = Math.min(
    frameWidth / sourceWidth,
    frameHeight / sourceHeight
  );

  const factor = fit * scale;

  const drawWidth = sourceWidth * factor;
  const drawHeight = sourceHeight * factor;

  const x =
    destinationX +
    (frameWidth - drawWidth) / 2 +
    horizontalOffset;

  const y =
    (frameHeight - drawHeight) / 2 +
    verticalOffset;

  context.save();

  // Evitar que una perspectiva invada
  // el espacio asignado al otro ojo.
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
// RENDERIZAR IMAGEN SBS
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
  const { calibration } = getState();

  const eyeWidth = width / 2;

  const originalLeft = 0;
  const originalRight =
    sourceImage.naturalWidth / 2;

  const leftSource = calibration.swapEyes
    ? originalRight
    : originalLeft;

  const rightSource = calibration.swapEyes
    ? originalLeft
    : originalRight;

  // El desplazamiento es relativo:
  // cada perspectiva se mueve en
  // dirección opuesta a la otra.
  const horizontal =
    calibration.horizontal / 2;

  const vertical =
    calibration.vertical / 2;

  const scale = calibration.scale / 100;

  context.clearRect(0, 0, width, height);

  context.fillStyle = "#05060c";
  context.fillRect(0, 0, width, height);

  // VISTA IZQUIERDA
  drawEye({
    sourceX: leftSource,
    destinationX: 0,
    frameWidth: eyeWidth,
    frameHeight: height,
    horizontalOffset: -horizontal,
    verticalOffset: -vertical,
    scale
  });

  // VISTA DERECHA
  drawEye({
    sourceX: rightSource,
    destinationX: eyeWidth,
    frameWidth: eyeWidth,
    frameHeight: height,
    horizontalOffset: horizontal,
    verticalOffset: vertical,
    scale
  });

  // Separador central.
  context.fillStyle = "#292d42";
  context.fillRect(
    eyeWidth - 0.5,
    0,
    1,
    height
  );

  // Etiquetas visuales.
  context.font = "600 12px Inter, sans-serif";
  context.textBaseline = "top";

  context.fillStyle = "rgba(0, 0, 0, 0.65)";
  context.fillRect(12, 12, 32, 27);
  context.fillRect(eyeWidth + 12, 12, 32, 27);

  context.fillStyle = "#ffffff";
  context.fillText("L", 23, 19);
  context.fillText("R", eyeWidth + 23, 19);
}


// ==========================================
// RESTABLECER CALIBRACIÓN
// ==========================================

function restoreDefaults() {
  if (!isActive() || !sourceImage) return;

  resetCalibration();

  updateControls();
  drawSBS();

  showMessage(
    "Calibración restablecida: escala 100 %, desplazamientos 0 e intercambio desactivado."
  );
}


// ==========================================
// LIMPIAR RECURSOS DEL MÓDULO
// ==========================================

function clearSBS() {
  loadVersion++;

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
// CARGAR VISTA SBS
// ==========================================

async function prepareSBS() {
  if (!isActive()) return;

  const version = ++loadVersion;

  const state = getState();

  if (!state.file || state.status !== "ready") {
    return;
  }

  // Obtener la vista previa que ya preparó
  // el gestor de archivos.
  const image = elements.renderer.querySelector("img");

  if (!image) {
    showMessage(
      "No se encontró una imagen válida.",
      "error"
    );
    return;
  }

  try {
    await image.decode();

    if (
      version !== loadVersion ||
      !isActive() ||
      getState().file !== state.file
    ) {
      return;
    }

    if (image.naturalWidth < 2) {
      throw new Error(
        "La imagen es demasiado pequeña para dividirla."
      );
    }

    sourceImage = image;

    canvas = document.createElement("canvas");

    canvas.id = "sbs-canvas";
    canvas.setAttribute(
      "aria-label",
      "Visualizador estereoscópico SBS"
    );

    context = canvas.getContext("2d");

    if (!context) {
      throw new Error(
        "El navegador no pudo crear el visualizador."
      );
    }

    // Sustituir la vista previa original
    // por el visualizador real de dos ojos.
    elements.renderer.replaceChildren(canvas);

    renderTools();

    elements.reset.disabled = false;

    // El modo VR se habilitará cuando
    // implementemos vr-viewer.js.
    elements.vr.disabled = false;

    resizeObserver = new ResizeObserver(() => {
      drawSBS();
    });

    resizeObserver.observe(elements.renderer);

    updateControls();
    drawSBS();

    showMessage(
      "Imagen SBS preparada. Puedes calibrar ambas perspectivas."
    );

    console.log(
      "[SBS] Visualizador listo:",
      state.fileName
    );

  } catch (error) {
    if (version !== loadVersion) return;

    clearSBS();

    showMessage(
      error.message ||
      "No se pudo preparar la imagen SBS.",
      "error"
    );

    console.error("[SBS]", error);
  }
}


// ==========================================
// INICIALIZAR MÓDULO
// ==========================================

export function initSBSImage() {
  if (initialized) return;

  initialized = true;

  document.addEventListener(
    "studio:file-loaded",
    event => {
      if (event.detail.module === MODULE_ID) {
        prepareSBS();
      }
    }
  );

  elements.reset.addEventListener(
    "click",
    () => {
      if (isActive()) {
        restoreDefaults();
      }
    }
  );

  document.addEventListener(
    "studio:before-module-change",
    clearSBS
  );

  // Desactivar el editor mientras se
  // sustituye o invalida un archivo.
  subscribe(state => {
    if (
      !sourceImage &&
      !canvas
    ) {
      return;
    }

    if (
      state.status === "empty" ||
      state.status === "loading" ||
      state.status === "error"
    ) {
      clearSBS();

      if (isActive()) {
        elements.tools.innerHTML = `
          <div class="tool-placeholder">
            <p>
              Importa una imagen SBS para
              activar las herramientas de calibración.
            </p>
          </div>
        `;
      }
    }
  });

  console.log(
    "[StereoVision] Módulo Imagen SBS inicializado."
  );
}
