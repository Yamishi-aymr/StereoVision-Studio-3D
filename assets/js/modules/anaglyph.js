
/* ==========================================
   STEREOVISION STUDIO 3D
   MÓDULO ANAGLIFO ROJO-CIAN
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


// ==========================================
// CONFIGURACIÓN
// ==========================================

const MODULE_ID = "anaglyph";

const DEFAULTS = {
  scale: 100,
  brightness: 100,
  contrast: 100
};

const CONTROLS = [
  {
    id: "scale",
    label: "Zoom / Escala",
    min: 25,
    max: 200,
    step: 1,
    unit: "%"
  },
  {
    id: "brightness",
    label: "Brillo",
    min: 0,
    max: 200,
    step: 1,
    unit: "%"
  },
  {
    id: "contrast",
    label: "Contraste",
    min: 0,
    max: 200,
    step: 1,
    unit: "%"
  }
];


// ==========================================
// ELEMENTOS
// ==========================================

const elements = {
  tools: document.getElementById("module-tools"),
  renderer: document.getElementById("media-renderer"),
  reset: document.getElementById("btn-reset"),
  message: document.getElementById("studio-message"),
  fileStatus: document.getElementById("file-status")
};


// ==========================================
// ESTADO DEL MÓDULO
// ==========================================

let activeImage = null;
let initialized = false;


// ==========================================
// COMPROBAR MÓDULO
// ==========================================

function isAnaglyph() {
  return getActiveModule() === MODULE_ID;
}


// ==========================================
// MENSAJES
// ==========================================

function showMessage(message) {
  elements.message.textContent = message;
  elements.message.className =
    "studio-message-success";
}


// ==========================================
// CREAR UN CONTROL
// ==========================================

function createControl(config) {
  const value = DEFAULTS[config.id];

  return `
    <div class="tool-control">

      <div class="control-heading">

        <label for="anaglyph-${config.id}">
          ${config.label}
        </label>

        <output
          id="anaglyph-${config.id}-value"
          class="control-value"
          for="anaglyph-${config.id}"
        >
          ${value}${config.unit}
        </output>

      </div>

      <input
        type="range"
        id="anaglyph-${config.id}"
        class="studio-range"
        min="${config.min}"
        max="${config.max}"
        step="${config.step}"
        value="${value}"
      >

    </div>
  `;
}


// ==========================================
// CREAR PANEL DE HERRAMIENTAS
// ==========================================

function renderTools() {
  elements.tools.innerHTML = `
    <div class="tool-group">

      <div class="tool-group-title">
        <span>AJUSTES DE IMAGEN</span>
        <span aria-hidden="true">◈</span>
      </div>

      <p class="tool-description">
        Ajusta la representación del anaglifo
        sin modificar el archivo original.
      </p>

      ${CONTROLS.map(createControl).join("")}

    </div>

    <div class="tool-group">

      <div class="tool-group-title">
        <span>VISUALIZACIÓN</span>
      </div>

      <div class="file-information">
        <strong>Modo rojo-cian</strong>

        <p>
          Utiliza lentes anaglifo compatibles
          para apreciar la profundidad de
          una imagen estereoscópica.
        </p>
      </div>

    </div>

    <div class="tool-group">

      <button
        id="anaglyph-reset"
        class="tool-button"
        type="button"
      >
        ↺ Restablecer ajustes
      </button>

    </div>
  `;

  // Registrar eventos de los deslizadores.
  CONTROLS.forEach((config) => {
    const input = document.getElementById(
      `anaglyph-${config.id}`
    );

    input.addEventListener("input", () => {
      updateCalibration({
        [config.id]: Number(input.value)
      });

      applyCalibration();
    });
  });

  document.getElementById("anaglyph-reset")
    .addEventListener("click", restoreDefaults);
}


// ==========================================
// ACTUALIZAR INDICADORES
// ==========================================

function updateIndicators(calibration) {
  CONTROLS.forEach((config) => {
    const input = document.getElementById(
      `anaglyph-${config.id}`
    );

    const output = document.getElementById(
      `anaglyph-${config.id}-value`
    );

    if (!input || !output) return;

    const value = calibration[config.id];

    input.value = value;
    output.textContent = `${value}${config.unit}`;
  });
}


// ==========================================
// APLICAR CALIBRACIÓN
// ==========================================

function applyCalibration() {
  if (!activeImage || !isAnaglyph()) return;

  const { calibration } = getState();

  const scale = calibration.scale / 100;

  activeImage.style.transform =
    `scale(${scale})`;

  activeImage.style.filter = `
    brightness(${calibration.brightness}%)
    contrast(${calibration.contrast}%)
  `;

  activeImage.style.transformOrigin = "center center";

  activeImage.style.objectFit = "contain";

  activeImage.style.maxWidth = "100%";
  activeImage.style.maxHeight = "100%";

  // Actualizar el panel con los valores reales.
  updateIndicators(calibration);
}


// ==========================================
// RESTABLECER AJUSTES
// ==========================================

function restoreDefaults() {
  if (!isAnaglyph() || !activeImage) return;

  resetCalibration();

  applyCalibration();

  showMessage(
    "Los ajustes del anaglifo se restablecieron."
  );
}


// ==========================================
// PREPARAR IMAGEN
// ==========================================

function prepareImage() {
  if (!isAnaglyph()) return;

  const state = getState();

  if (!state.file || state.status !== "ready") {
    return;
  }

  // El gestor de archivos ya validó y creó
  // la vista previa dentro del renderizador.

  activeImage = elements.renderer.querySelector("img");

  if (!activeImage) {
    console.error(
      "[Anaglifo] No se encontró la imagen."
    );
    return;
  }

  activeImage.style.display = "block";
  activeImage.style.width = "100%";
  activeImage.style.height = "100%";

  // No aplicar filtros rojo-cian artificiales:
  // la imagen importada ya debe ser anaglifo.

  renderTools();

  elements.reset.disabled = false;

  applyCalibration();

  showMessage(
    "Anaglifo cargado. Puedes ajustar brillo, contraste y zoom."
  );

  console.log(
    "[Anaglifo] Editor preparado:",
    state.fileName
  );
}


// ==========================================
// LIMPIAR MÓDULO
// ==========================================

function clearAnaglyph() {
  activeImage = null;

  if (isAnaglyph()) {
    elements.reset.disabled = true;
  }
}


// ==========================================
// INICIALIZAR MÓDULO
// ==========================================

export function initAnaglyph() {
  if (initialized) return;

  initialized = true;

  // Cuando se importa una imagen.
  document.addEventListener(
    "studio:file-loaded",
    (event) => {
      if (event.detail.module !== MODULE_ID) {
        return;
      }

      prepareImage();
    }
  );

  // Botón Restablecer del encabezado.
  elements.reset.addEventListener(
    "click",
    () => {
      if (isAnaglyph()) {
        restoreDefaults();
      }
    }
  );

  // Cuando se cambia de módulo.
  document.addEventListener(
    "studio:before-module-change",
    clearAnaglyph
  );

  // Cuando comienza una nueva importación
  // o se invalida el contenido, desactivar
  // referencias al archivo anterior.
  subscribe((state) => {
    if (
      state.status === "loading" ||
      state.status === "error" ||
      state.status === "empty"
    ) {
      clearAnaglyph();

      if (isAnaglyph() && state.status !== "ready") {
        elements.tools.replaceChildren();

        const placeholder = document.createElement("div");
        placeholder.className = "tool-placeholder";

        const message = document.createElement("p");
        message.textContent =
          "Importa una imagen anaglifo para activar los ajustes.";

        placeholder.appendChild(message);
        elements.tools.appendChild(placeholder);
      }
    }
  });

  console.log(
    "[StereoVision] Módulo Anaglifo inicializado."
  );
}
