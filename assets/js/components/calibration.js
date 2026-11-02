
/* ==========================================
   STEREOVISION STUDIO 3D
   CONFIGURACION DE GAFAS Y GESTOS TACTILES
   ========================================== */

import {
  getState,
  subscribe,
  updateDeviceSettings,
  resetDeviceSettings,
  DEFAULT_DEVICE_SETTINGS,
  DEVICE_LIMITS
} from "../core/state.js";


// ==========================================
// CONFIGURACION GENERAL DE GAFAS
// ==========================================

const elements = {
  sidebar: document.querySelector(
    ".studio-sidebar"
  ),

  tools: document.getElementById(
    "module-tools"
  ),

  message: document.getElementById(
    "studio-message"
  )
};

let initialized = false;
let unsubscribe = null;


// ==========================================
// FORMATO DE DISTANCIA
// ==========================================

function formatCentimeters(mm) {
  return (mm / 10).toFixed(1);
}


// ==========================================
// MENSAJES
// ==========================================

function showMessage(message) {
  if (!elements.message) return;

  elements.message.textContent = message;

  elements.message.className =
    "studio-message-success";
}


// ==========================================
// CREAR PANEL DE GAFAS
// ==========================================

function createSettingsPanel() {
  const existing = document.getElementById(
    "device-settings-panel"
  );

  if (existing) return existing;

  if (!elements.sidebar || !elements.tools) {
    throw new Error(
      "No se encontro el panel de herramientas."
    );
  }

  const panel = document.createElement("section");

  panel.id = "device-settings-panel";
  panel.className = "tool-section";

  panel.setAttribute(
    "aria-label",
    "Configuracion de gafas VR"
  );

  panel.innerHTML = `
    <h3>Configuración de gafas VR</h3>

    <p class="tool-description">
      Configura la distancia de referencia
      entre las lentes de tus gafas.
      La preferencia permanece guardada
      al cambiar de archivo.
    </p>

    <div class="tool-control">

      <div class="control-heading">

        <label for="lens-spacing">
          Distancia entre lentes
        </label>

        <output
          id="lens-spacing-value"
          class="control-value"
          for="lens-spacing"
        >
          6.4 cm
        </output>

      </div>

      <input
        id="lens-spacing"
        class="studio-range"
        type="range"
        min="${DEVICE_LIMITS.minLensSpacingMm}"
        max="${DEVICE_LIMITS.maxLensSpacingMm}"
        step="1"
        value="${DEFAULT_DEVICE_SETTINGS.lensSpacingMm}"
      >

      <div style="
        display:flex;
        justify-content:space-between;
        margin-top:10px;
        color:var(--subtle);
        font-size:10px;
      ">
        <span>5.5 cm</span>
        <span>7.5 cm</span>
      </div>

    </div>

    <button
      id="reset-device-settings"
      class="tool-button"
      type="button"
    >
      ↺ Restablecer referencia
    </button>

    <div
      class="file-information"
      style="margin-top:16px;"
    >
      <strong>Referencia del dispositivo</strong>

      <p style="margin:8px 0 0;">
        Esta distancia corresponde a las
        lentes de las gafas y no equivale
        al desplazamiento horizontal
        de las perspectivas.
      </p>
    </div>
  `;

  // Mantener la configuracion general
  // fuera del panel dinamico de cada modulo.
  elements.sidebar.insertBefore(
    panel,
    elements.tools
  );

  return panel;
}


// ==========================================
// ACTUALIZAR PANEL DE GAFAS
// ==========================================

function updatePanel() {
  const slider = document.getElementById(
    "lens-spacing"
  );

  const output = document.getElementById(
    "lens-spacing-value"
  );

  if (!slider || !output) return;

  const value =
    getState().deviceSettings.lensSpacingMm;

  slider.value = String(value);

  output.textContent =
    `${formatCentimeters(value)} cm`;
}


// ==========================================
// EVENTOS DEL PANEL
// ==========================================

function connectControls() {
  const slider = document.getElementById(
    "lens-spacing"
  );

  const resetButton = document.getElementById(
    "reset-device-settings"
  );

  if (!slider || !resetButton) return;

  slider.addEventListener("input", event => {
    updateDeviceSettings({
      lensSpacingMm: Number(event.target.value)
    });

    updatePanel();
  });

  slider.addEventListener("change", () => {
    const value =
      getState().deviceSettings.lensSpacingMm;

    showMessage(
      `Referencia guardada: ${formatCentimeters(value)} cm.`
    );
  });

  resetButton.addEventListener("click", () => {
    resetDeviceSettings();

    updatePanel();

    showMessage(
      "Referencia restablecida a 6.4 cm."
    );
  });
}


// ==========================================
// INICIALIZAR CONFIGURACION
// ==========================================

export function initCalibrationSettings() {
  if (initialized) return;

  createSettingsPanel();
  connectControls();
  updatePanel();

  unsubscribe = subscribe(updatePanel);

  initialized = true;

  console.log(
    "[StereoVision] Preferencias de gafas activas."
  );
}


// ==========================================
// CONSULTAR CONFIGURACION
// ==========================================

export function getDeviceCalibration() {
  const { deviceSettings } = getState();

  return {
    lensSpacingMm: deviceSettings.lensSpacingMm,
    lensSpacingCm:
      deviceSettings.lensSpacingMm / 10
  };
}


// ==========================================
// LIBERAR PANEL GENERAL
// ==========================================

export function destroyCalibrationSettings() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  document.getElementById(
    "device-settings-panel"
  )?.remove();

  initialized = false;
}


// ==========================================
// CONTROLADOR DE GESTOS TACTILES
// ==========================================

// Este controlador es reutilizable.
// No modifica directamente las imagenes.
//
// Recibe:
// element: superficie que recibe los gestos
// getTransform: devuelve panX, panY y scale
// onChange: guarda y aplica los nuevos valores
//
// Devuelve una funcion para liberar eventos.

export function initTouchGestures({
  element,
  getTransform,
  onChange,
  minScale = 50,
  maxScale = 200,
  maxPan = 250
}) {

  if (!element) {
    throw new Error(
      "Se necesita una superficie para los gestos."
    );
  }

  if (
    typeof getTransform !== "function" ||
    typeof onChange !== "function"
  ) {
    throw new Error(
      "El controlador requiere sus funciones de estado."
    );
  }

  const pointers = new Map();

  let gesture = null;

  const originalTouchAction =
    element.style.touchAction;

  element.style.touchAction = "none";

  element.style.userSelect = "none";

  element.style.cursor = "grab";


  // ========================================
  // FUNCIONES AUXILIARES
  // ========================================

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }


  function distance(a, b) {
    return Math.hypot(
      b.x - a.x,
      b.y - a.y
    );
  }


  function midpoint(a, b) {
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2
    };
  }


  function getPoints() {
    return [...pointers.values()];
  }


  // ========================================
  // INICIAR O REINICIAR GESTO
  // ========================================

  function beginGesture() {
    const points = getPoints();

    if (!points.length) {
      gesture = null;
      return;
    }

    const current = getTransform();

    const start = {
      panX: Number(current.panX) || 0,
      panY: Number(current.panY) || 0,
      scale: Number(current.scale) || 100
    };

    if (points.length === 1) {
      gesture = {
        type: "drag",
        start,
        point: { ...points[0] }
      };

      element.style.cursor = "grabbing";
      return;
    }

    const first = points[0];
    const second = points[1];

    gesture = {
      type: "pinch",
      start,
      distance: Math.max(
        1,
        distance(first, second)
      ),
      center: midpoint(first, second)
    };

    element.style.cursor = "grabbing";
  }


  // ========================================
  // APLICAR UN ARRASTRE
  // ========================================

  function applyDrag() {
    if (
      !gesture ||
      gesture.type !== "drag" ||
      pointers.size !== 1
    ) {
      return;
    }

    const point = getPoints()[0];

    const deltaX =
      point.x - gesture.point.x;

    const deltaY =
      point.y - gesture.point.y;

    onChange({
      panX: Math.round(
        clamp(
          gesture.start.panX + deltaX,
          -maxPan,
          maxPan
        )
      ),

      panY: Math.round(
        clamp(
          gesture.start.panY + deltaY,
          -maxPan,
          maxPan
        )
      )
    });
  }


  // ========================================
  // APLICAR PELLIZCO
  // ========================================

  function applyPinch() {
    if (
      !gesture ||
      gesture.type !== "pinch" ||
      pointers.size < 2
    ) {
      return;
    }

    const points = getPoints();

    const first = points[0];
    const second = points[1];

    const currentDistance = Math.max(
      1,
      distance(first, second)
    );

    const ratio =
      currentDistance / gesture.distance;

    const currentCenter =
      midpoint(first, second);

    const deltaX =
      currentCenter.x - gesture.center.x;

    const deltaY =
      currentCenter.y - gesture.center.y;

    onChange({
      scale: Math.round(
        clamp(
          gesture.start.scale * ratio,
          minScale,
          maxScale
        )
      ),

      panX: Math.round(
        clamp(
          gesture.start.panX + deltaX,
          -maxPan,
          maxPan
        )
      ),

      panY: Math.round(
        clamp(
          gesture.start.panY + deltaY,
          -maxPan,
          maxPan
        )
      )
    });
  }


  // ========================================
  // EVENTOS POINTER
  // ========================================

  function onPointerDown(event) {
    if (
      event.pointerType === "mouse" &&
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();

    pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY
    });

    try {
      element.setPointerCapture(event.pointerId);
    } catch {
      // Algunos navegadores no admiten captura.
    }

    beginGesture();
  }


  function onPointerMove(event) {
    if (!pointers.has(event.pointerId)) {
      return;
    }

    event.preventDefault();

    pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY
    });

    if (pointers.size === 1) {
      applyDrag();
    } else {
      applyPinch();
    }
  }


  function onPointerEnd(event) {
    if (!pointers.has(event.pointerId)) {
      return;
    }

    pointers.delete(event.pointerId);

    if (element.hasPointerCapture?.(event.pointerId)) {
      try {
        element.releasePointerCapture(event.pointerId);
      } catch {
        // La captura puede haberse liberado.
      }
    }

    // Si queda un dedo, comenzar otro gesto
    // desde la posicion actual para evitar saltos.
    beginGesture();

    if (!pointers.size) {
      element.style.cursor = "grab";
    }
  }


  // ========================================
  // REGISTRAR EVENTOS
  // ========================================

  element.addEventListener(
    "pointerdown",
    onPointerDown
  );

  element.addEventListener(
    "pointermove",
    onPointerMove
  );

  element.addEventListener(
    "pointerup",
    onPointerEnd
  );

  element.addEventListener(
    "pointercancel",
    onPointerEnd
  );

  element.addEventListener(
    "lostpointercapture",
    onPointerEnd
  );


  // ========================================
  // LIMPIEZA
  // ========================================

  return function destroyTouchGestures() {
    element.removeEventListener(
      "pointerdown",
      onPointerDown
    );

    element.removeEventListener(
      "pointermove",
      onPointerMove
    );

    element.removeEventListener(
      "pointerup",
      onPointerEnd
    );

    element.removeEventListener(
      "pointercancel",
      onPointerEnd
    );

    element.removeEventListener(
      "lostpointercapture",
      onPointerEnd
    );

    pointers.clear();
    gesture = null;

    element.style.touchAction =
      originalTouchAction;

    element.style.cursor = "";
    element.style.userSelect = "";
  };
}
