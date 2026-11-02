
/* ==========================================
   STEREOVISION STUDIO 3D
   VIDEO SBS CON GESTOS TACTILES
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

const MODULE_ID = "sbs-video";

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
    id: "panX",
    label: "Mover video horizontalmente",
    min: -250,
    max: 250,
    unit: " px"
  },
  {
    id: "panY",
    label: "Mover video verticalmente",
    min: -250,
    max: 250,
    unit: " px"
  }
];


// ==========================================
// REFERENCIAS HTML
// ==========================================

const elements = {
  tools: document.getElementById(
    "module-tools"
  ),

  renderer: document.getElementById(
    "media-renderer"
  ),

  controls: document.getElementById(
    "media-controls"
  ),

  reset: document.getElementById(
    "btn-reset"
  ),

  vr: document.getElementById(
    "btn-vr"
  ),

  message: document.getElementById(
    "studio-message"
  )
};


// ==========================================
// ESTADO DEL REPRODUCTOR
// ==========================================

let video = null;
let canvas = null;
let context = null;

let resizeObserver = null;
let destroyGestures = null;

let frameRequest = null;
let frameRequestType = null;

let initialized = false;
let currentVolume = 1;


// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

function isActive() {
  return getActiveModule() === MODULE_ID;
}


function isVRActive() {
  return getState().vrActive;
}


function getCalibration() {
  const calibration = getState().calibration;

  return {
    ...calibration,

    panX: Number(calibration.panX) || 0,
    panY: Number(calibration.panY) || 0
  };
}


function showMessage(message, type = "success") {
  elements.message.textContent = message;

  elements.message.className =
    type === "error"
      ? "studio-message-error"
      : type === "warning"
        ? "studio-message-warning"
        : "studio-message-success";
}


// ==========================================
// FORMATEAR TIEMPO
// ==========================================

function formatTime(seconds) {
  if (
    !Number.isFinite(seconds) ||
    seconds < 0
  ) {
    return "00:00";
  }

  const total = Math.floor(seconds);

  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(
    (total % 3600) / 60
  );

  const secs = total % 60;

  const pad = value =>
    String(value).padStart(2, "0");

  if (hours > 0) {
    return (
      `${pad(hours)}:` +
      `${pad(minutes)}:` +
      `${pad(secs)}`
    );
  }

  return `${pad(minutes)}:${pad(secs)}`;
}


// ==========================================
// CREAR DESLIZADORES
// ==========================================

function createSlider(config) {
  const calibration = getCalibration();

  const value = calibration[config.id];

  return `
    <div class="tool-control">

      <div class="control-heading">

        <label for="video-${config.id}">
          ${config.label}
        </label>

        <output
          id="video-${config.id}-value"
          class="control-value"
          for="video-${config.id}"
        >
          ${value}${config.unit}
        </output>

      </div>

      <input
        id="video-${config.id}"
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
// PANEL DE HERRAMIENTAS
// ==========================================

function renderTools() {
  const calibration = getCalibration();

  elements.tools.innerHTML = `
    <div class="tool-group">

      <div class="tool-group-title">
        <span>CALIBRACIÓN ESTEREOSCÓPICA</span>
      </div>

      <p class="tool-description">
        Ajusta ambas perspectivas sin
        modificar el archivo original.
      </p>

      ${CONTROLS.slice(0, 2)
        .map(createSlider)
        .join("")}

    </div>

    <div class="tool-group">

      <div class="tool-group-title">
        <span>POSICIÓN Y GESTOS</span>
      </div>

      <p class="tool-description">
        Arrastra con un dedo para mover
        ambas vistas al mismo tiempo.
        Pellizca con dos dedos para
        acercar o alejar el video.
      </p>

      ${CONTROLS.slice(2)
        .map(createSlider)
        .join("")}

    </div>

    <div class="tool-group">

      <div class="tool-group-title">
        <span>CONFIGURACIÓN DE OJOS</span>
      </div>

      <label class="studio-checkbox">

        <input
          id="video-swap-eyes"
          type="checkbox"
          ${calibration.swapEyes ? "checked" : ""}
        >

        Intercambiar ojos
      </label>

    </div>

    <div class="tool-group">

      <button
        id="video-reset"
        class="tool-button"
        type="button"
      >
        ↺ Restablecer calibración
      </button>

    </div>

    <div class="tool-group">

      <div class="file-information">

        <strong>Gestos táctiles activados</strong>

        <p>
          Un dedo: desplazar ambas vistas.
        </p>

        <p>
          Dos dedos: aumentar o reducir
          la escala.
        </p>

        <p>
          Los gestos no modifican la
          sincronización del video.
        </p>

      </div>

    </div>
  `;

  // ========================================
  // EVENTOS DE DESLIZADORES
  // ========================================

  CONTROLS.forEach(config => {
    const input = document.getElementById(
      `video-${config.id}`
    );

    input.addEventListener("input", () => {
      if (!video || !isActive()) return;

      updateCalibration({
        [config.id]: Number(input.value)
      });

      updateCalibrationControls();
      drawFrame();
    });
  });

  // ========================================
  // INTERCAMBIAR OJOS
  // ========================================

  document.getElementById("video-swap-eyes")
    .addEventListener("change", event => {
      if (!video || !isActive()) return;

      updateCalibration({
        swapEyes: event.target.checked
      });

      drawFrame();
    });

  // ========================================
  // RESTABLECER
  // ========================================

  document.getElementById("video-reset")
    .addEventListener(
      "click",
      restoreDefaults
    );
}


// ==========================================
// SINCRONIZAR DESLIZADORES
// ==========================================

function updateCalibrationControls() {
  if (!isActive()) return;

  const calibration = getCalibration();

  CONTROLS.forEach(config => {
    const input = document.getElementById(
      `video-${config.id}`
    );

    const output = document.getElementById(
      `video-${config.id}-value`
    );

    if (!input || !output) return;

    const value = calibration[config.id];

    input.value = value;

    output.textContent =
      `${value}${config.unit}`;
  });

  const swap = document.getElementById(
    "video-swap-eyes"
  );

  if (swap) {
    swap.checked = calibration.swapEyes;
  }
}


// ==========================================
// CONTROLES DE REPRODUCCION
// ==========================================

function renderVideoControls() {
  elements.controls.innerHTML = `
    <button
      id="video-back"
      class="video-control-button"
      type="button"
      aria-label="Retroceder 10 segundos"
      title="Retroceder 10 segundos"
    >
      -10
    </button>

    <button
      id="video-play"
      class="video-control-button video-play-button"
      type="button"
      aria-label="Reproducir"
      title="Reproducir"
    >
      ▶
    </button>

    <button
      id="video-forward"
      class="video-control-button"
      type="button"
      aria-label="Adelantar 10 segundos"
      title="Adelantar 10 segundos"
    >
      +10
    </button>

    <span
      id="video-time"
      class="video-time"
    >
      00:00 / 00:00
    </span>

    <input
      id="video-progress"
      class="video-progress"
      type="range"
      min="0"
      max="1000"
      step="1"
      value="0"
      aria-label="Progreso del video"
    >

    <button
      id="video-mute"
      class="video-control-button"
      type="button"
      aria-label="Silenciar"
      title="Silenciar"
    >
      🔊
    </button>

    <input
      id="video-volume"
      class="video-volume"
      type="range"
      min="0"
      max="1"
      step="0.01"
      value="1"
      aria-label="Volumen"
    >
  `;

  document.getElementById("video-play")
    .addEventListener(
      "click",
      togglePlayback
    );

  document.getElementById("video-back")
    .addEventListener(
      "click",
      () => seekRelative(-10)
    );

  document.getElementById("video-forward")
    .addEventListener(
      "click",
      () => seekRelative(10)
    );

  document.getElementById("video-progress")
    .addEventListener("input", event => {
      if (
        !video ||
        !Number.isFinite(video.duration) ||
        video.duration <= 0
      ) {
        return;
      }

      video.currentTime =
        Number(event.target.value) /
        1000 *
        video.duration;

      updatePlaybackUI();
      drawFrame();
    });

  document.getElementById("video-volume")
    .addEventListener("input", event => {
      if (!video) return;

      video.volume = Number(
        event.target.value
      );

      video.muted = video.volume === 0;

      if (video.volume > 0) {
        currentVolume = video.volume;
      }

      updatePlaybackUI();
    });

  document.getElementById("video-mute")
    .addEventListener("click", () => {
      if (!video) return;

      if (video.muted || video.volume === 0) {
        video.volume = currentVolume || 1;
        video.muted = false;
      } else {
        currentVolume = video.volume;
        video.muted = true;
      }

      updatePlaybackUI();
    });

  updatePlaybackUI();
}


// ==========================================
// ACTUALIZAR REPRODUCTOR
// ==========================================

function updatePlaybackUI() {
  if (!video) return;

  const playButton = document.getElementById(
    "video-play"
  );

  const time = document.getElementById(
    "video-time"
  );

  const progress = document.getElementById(
    "video-progress"
  );

  const volume = document.getElementById(
    "video-volume"
  );

  const mute = document.getElementById(
    "video-mute"
  );

  const playing =
    !video.paused && !video.ended;

  if (playButton) {
    playButton.textContent =
      playing ? "❚❚" : "▶";

    playButton.setAttribute(
      "aria-label",
      playing ? "Pausar" : "Reproducir"
    );

    playButton.title =
      playing ? "Pausar" : "Reproducir";
  }

  const duration =
    Number.isFinite(video.duration)
      ? video.duration
      : 0;

  if (time) {
    time.textContent =
      `${formatTime(video.currentTime)} / ` +
      `${formatTime(duration)}`;
  }

  if (progress) {
    progress.value = duration > 0
      ? Math.round(
          video.currentTime /
          duration *
          1000
        )
      : 0;
  }

  if (volume) {
    volume.value =
      video.muted ? 0 : video.volume;
  }

  if (mute) {
    const muted =
      video.muted || video.volume === 0;

    mute.textContent =
      muted ? "🔇" : "🔊";

    mute.setAttribute(
      "aria-label",
      muted
        ? "Activar sonido"
        : "Silenciar"
    );
  }
}


// ==========================================
// REPRODUCIR Y PAUSAR
// ==========================================

async function togglePlayback() {
  if (!video) return;

  const currentVideo = video;

  if (
    !currentVideo.paused &&
    !currentVideo.ended
  ) {
    currentVideo.pause();
    return;
  }

  try {
    await currentVideo.play();

  } catch (error) {
    if (video !== currentVideo) {
      return;
    }

    showMessage(
      "No se pudo iniciar el video. " +
      "Pulsa Reproducir nuevamente.",
      "error"
    );

    console.error(
      "[Video SBS] Error de reproducción:",
      error
    );
  }
}


// ==========================================
// ADELANTAR Y RETROCEDER
// ==========================================

function seekRelative(seconds) {
  if (
    !video ||
    !Number.isFinite(video.duration)
  ) {
    return;
  }

  video.currentTime = Math.max(
    0,
    Math.min(
      video.duration,
      video.currentTime + seconds
    )
  );

  updatePlaybackUI();
}


// ==========================================
// DIMENSIONES DEL CANVAS
// ==========================================

function resizeCanvas() {
  if (!canvas || !context) return null;

  const rect =
    elements.renderer.getBoundingClientRect();

  if (
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    return null;
  }

  const dpr = Math.min(
    window.devicePixelRatio || 1,
    2
  );

  const pixelWidth = Math.max(
    1,
    Math.round(rect.width * dpr)
  );

  const pixelHeight = Math.max(
    1,
    Math.round(rect.height * dpr)
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

  return {
    width: rect.width,
    height: rect.height
  };
}


// ==========================================
// DIBUJAR UNA PERSPECTIVA
// ==========================================

function drawEye({
  sourceX,
  destinationX,
  eyeWidth,
  height,
  horizontalOffset,
  panX,
  panY,
  scale
}) {
  const sourceWidth =
    video.videoWidth / 2;

  const sourceHeight =
    video.videoHeight;

  const fit = Math.min(
    eyeWidth / sourceWidth,
    height / sourceHeight
  );

  const factor = fit * scale;

  const drawWidth =
    sourceWidth * factor;

  const drawHeight =
    sourceHeight * factor;

  const x =
    destinationX +
    (eyeWidth - drawWidth) / 2 +
    horizontalOffset +
    panX;

  const y =
    (height - drawHeight) / 2 +
    panY;

  context.save();

  context.beginPath();

  context.rect(
    destinationX,
    0,
    eyeWidth,
    height
  );

  context.clip();

  context.drawImage(
    video,
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
// DIBUJAR FOTOGRAMA SBS
// ==========================================

function drawFrame() {
  if (
    !isActive() ||
    isVRActive() ||
    !video ||
    !canvas ||
    !context ||
    video.readyState <
      HTMLMediaElement.HAVE_CURRENT_DATA ||
    !video.videoWidth ||
    !video.videoHeight
  ) {
    return;
  }

  const dimensions = resizeCanvas();

  if (!dimensions) return;

  const { width, height } = dimensions;

  const eyeWidth = width / 2;

  const calibration = getCalibration();

  const sourceHalf =
    video.videoWidth / 2;

  const leftSource = calibration.swapEyes
    ? sourceHalf
    : 0;

  const rightSource = calibration.swapEyes
    ? 0
    : sourceHalf;

  const horizontal =
    calibration.horizontal / 2;

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
  // PERSPECTIVA IZQUIERDA
  // ========================================

  drawEye({
    sourceX: leftSource,
    destinationX: 0,
    eyeWidth,
    height,
    horizontalOffset: -horizontal,
    panX,
    panY,
    scale
  });

  // ========================================
  // PERSPECTIVA DERECHA
  // ========================================

  drawEye({
    sourceX: rightSource,
    destinationX: eyeWidth,
    eyeWidth,
    height,
    horizontalOffset: horizontal,
    panX,
    panY,
    scale
  });

  // ========================================
  // SEPARADOR
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

  context.fillRect(12, 12, 32, 27);

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
// CANCELAR FOTOGRAMAS
// ==========================================

function stopFrameLoop() {
  if (frameRequest === null) return;

  if (
    frameRequestType === "video" &&
    video &&
    typeof video.cancelVideoFrameCallback ===
      "function"
  ) {
    video.cancelVideoFrameCallback(
      frameRequest
    );

  } else if (
    frameRequestType === "animation"
  ) {
    cancelAnimationFrame(frameRequest);
  }

  frameRequest = null;
  frameRequestType = null;
}


// ==========================================
// CICLO DE RENDERIZADO
// ==========================================

function scheduleFrame() {
  if (
    !video ||
    !isActive() ||
    isVRActive() ||
    video.paused ||
    video.ended ||
    frameRequest !== null
  ) {
    return;
  }

  const currentVideo = video;

  const callback = () => {
    frameRequest = null;
    frameRequestType = null;

    if (
      video !== currentVideo ||
      !isActive() ||
      isVRActive()
    ) {
      return;
    }

    drawFrame();
    updatePlaybackUI();
    scheduleFrame();
  };

  if (
    typeof currentVideo.requestVideoFrameCallback ===
    "function"
  ) {
    frameRequestType = "video";

    frameRequest =
      currentVideo.requestVideoFrameCallback(
        callback
      );

  } else {
    frameRequestType = "animation";

    frameRequest =
      requestAnimationFrame(callback);
  }
}


// ==========================================
// ACTIVAR GESTOS TACTILES
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
      if (
        !isActive() ||
        isVRActive() ||
        !video
      ) {
        return;
      }

      updateCalibration(values);

      updateCalibrationControls();

      // Redibujar inmediatamente.
      // La reproducción sigue su curso.
      drawFrame();
    }
  });
}


// ==========================================
// RESTABLECER CALIBRACION
// ==========================================

function restoreDefaults() {
  if (!isActive() || !video) return;

  // Esta función ahora reemplaza
  // totalmente los ajustes anteriores,
  // incluyendo panX y panY.
  resetCalibration();

  updateCalibrationControls();

  drawFrame();

  showMessage(
    "Video restablecido a su posición y escala originales."
  );
}


// ==========================================
// LIMPIAR RECURSOS
// ==========================================

function clearVideo() {
  stopFrameLoop();

  if (destroyGestures) {
    destroyGestures();
    destroyGestures = null;
  }

  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  if (video) {
    video.pause();
  }

  video = null;
  canvas = null;
  context = null;

  elements.renderer.classList.remove(
    "interactive"
  );

  elements.controls.replaceChildren();

  if (isActive()) {
    elements.reset.disabled = true;
    elements.vr.disabled = true;
  }
}


// ==========================================
// PREPARAR VIDEO SBS
// ==========================================

function prepareVideo() {
  if (!isActive()) return;

  // Limpiar reproducción anterior
  // y controles táctiles antiguos.
  clearVideo();

  const state = getState();

  if (
    !state.file ||
    state.status !== "ready"
  ) {
    return;
  }

  const preview =
    elements.renderer.querySelector("video");

  if (!preview) {
    showMessage(
      "No se encontró el video importado.",
      "error"
    );
    return;
  }

  video = preview;

  video.controls = false;
  video.playsInline = true;
  video.preload = "auto";

  // Una única fuente de video
  // sincroniza ambas perspectivas.
  video.style.position = "absolute";
  video.style.width = "1px";
  video.style.height = "1px";
  video.style.opacity = "0";
  video.style.pointerEvents = "none";

  canvas =
    document.createElement("canvas");

  canvas.id = "sbs-video-canvas";

  canvas.setAttribute(
    "aria-label",
    "Visualizador de video SBS táctil"
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
    clearVideo();

    showMessage(
      "No se pudo crear el visualizador de video.",
      "error"
    );

    return;
  }

  elements.renderer.appendChild(canvas);

  // Habilitar eventos táctiles en el canvas.
  elements.renderer.classList.add(
    "interactive"
  );

  renderTools();
  renderVideoControls();

  elements.reset.disabled = false;
  elements.vr.disabled = false;

  // ========================================
  // EVENTOS DEL VIDEO
  // ========================================

  video.addEventListener("play", () => {
    updatePlaybackUI();
    scheduleFrame();
  });

  video.addEventListener("pause", () => {
    stopFrameLoop();

    updatePlaybackUI();
    drawFrame();
  });

  video.addEventListener(
    "timeupdate",
    updatePlaybackUI
  );

  video.addEventListener(
    "durationchange",
    updatePlaybackUI
  );

  video.addEventListener(
    "volumechange",
    updatePlaybackUI
  );

  video.addEventListener("seeked", () => {
    drawFrame();
    updatePlaybackUI();
  });

  video.addEventListener(
    "loadeddata",
    drawFrame
  );

  video.addEventListener("ended", () => {
    stopFrameLoop();
    updatePlaybackUI();
    drawFrame();
  });

  video.addEventListener("error", () => {
    stopFrameLoop();

    showMessage(
      "Ocurrió un error durante la reproducción del MP4.",
      "error"
    );
  });

  // ========================================
  // REDIMENSIONAMIENTO
  // ========================================

  resizeObserver = new ResizeObserver(
    () => {
      drawFrame();
    }
  );

  resizeObserver.observe(
    elements.renderer
  );

  // ========================================
  // HERRAMIENTAS TACTILES
  // ========================================

  enableTouchGestures();

  updateCalibrationControls();

  drawFrame();

  showMessage(
    "Video SBS listo. Puedes arrastrar y pellizcar durante la reproducción."
  );

  console.log(
    "[Video SBS] Gestos activados:",
    state.fileName
  );
}


// ==========================================
// INICIALIZACION
// ==========================================

export function initSBSVideo() {
  if (initialized) return;

  initialized = true;

  // ========================================
  // ARCHIVO IMPORTADO
  // ========================================

  document.addEventListener(
    "studio:file-loaded",
    event => {
      if (event.detail.module === MODULE_ID) {
        prepareVideo();
      }
    }
  );

  // ========================================
  // RESTABLECER DESDE ENCABEZADO
  // ========================================

  elements.reset.addEventListener(
    "click",
    () => {
      if (isActive()) {
        restoreDefaults();
      }
    }
  );

  // ========================================
  // CAMBIO DE MODULO
  // ========================================

  document.addEventListener(
    "studio:before-module-change",
    clearVideo
  );

  // ========================================
  // OBSERVAR ESTADO
  // ========================================

  subscribe(state => {
    if (!video) return;

    // Al entrar a VR, el visor VR
    // tomará el control del renderizado.
    // No se pausa el video.
    if (state.vrActive) {
      stopFrameLoop();
      return;
    }

    if (
      state.status === "empty" ||
      state.status === "loading" ||
      state.status === "error"
    ) {
      clearVideo();

      if (isActive()) {
        elements.tools.innerHTML = `
          <div class="tool-placeholder">
            <p>
              Importa un MP4 SBS para
              activar reproducción,
              calibración y gestos táctiles.
            </p>
          </div>
        `;
      }

      return;
    }

    // Al regresar de VR, continuar
    // actualizando la vista del editor.
    if (
      isActive() &&
      state.status === "ready"
    ) {
      drawFrame();

      if (
        !video.paused &&
        !video.ended
      ) {
        scheduleFrame();
      }
    }
  });

  console.log(
    "[StereoVision] Video SBS táctil inicializado."
  );
}
