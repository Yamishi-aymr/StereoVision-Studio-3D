
/* ==========================================
   STEREOVISION STUDIO 3D
   MODULO VIDEO SBS
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

const MODULE_ID = "sbs-video";

const elements = {
  tools: document.getElementById("module-tools"),
  renderer: document.getElementById("media-renderer"),
  controls: document.getElementById("media-controls"),
  reset: document.getElementById("btn-reset"),
  vr: document.getElementById("btn-vr"),
  message: document.getElementById("studio-message")
};

let video = null;
let canvas = null;
let context = null;
let resizeObserver = null;

let frameRequest = null;
let frameRequestType = null;

let initialized = false;
let currentVolume = 1;


// ==========================================
// COMPROBAR MODULO
// ==========================================

function isActive() {
  return getActiveModule() === MODULE_ID;
}


// ==========================================
// MENSAJES
// ==========================================

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
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00";
  }

  const total = Math.floor(seconds);

  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const pad = value => String(value).padStart(2, "0");

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
  }

  return `${pad(minutes)}:${pad(secs)}`;
}


// ==========================================
// CONTROLES DE CALIBRACION
// ==========================================

function sliderHTML(id, label, min, max, value, unit) {
  return `
    <div class="tool-control">
      <div class="control-heading">

        <label for="video-${id}">
          ${label}
        </label>

        <output
          id="video-${id}-value"
          class="control-value"
          for="video-${id}"
        >
          ${value}${unit}
        </output>

      </div>

      <input
        type="range"
        class="studio-range"
        id="video-${id}"
        min="${min}"
        max="${max}"
        step="1"
        value="${value}"
      >
    </div>
  `;
}


function renderTools() {
  const calibration = getState().calibration;

  elements.tools.innerHTML = `
    <div class="tool-group">

      <div class="tool-group-title">
        <span>CALIBRACION DE VIDEO</span>
        <span aria-hidden="true">◈</span>
      </div>

      <p class="tool-description">
        Modifica ambas perspectivas durante
        la reproduccion sin alterar el MP4.
      </p>

      ${sliderHTML(
        "scale",
        "Zoom / Escala",
        50,
        200,
        calibration.scale,
        "%"
      )}

      ${sliderHTML(
        "horizontal",
        "Desplazamiento horizontal",
        -60,
        60,
        calibration.horizontal,
        " px"
      )}

    </div>

    <div class="tool-group">

      <div class="tool-group-title">
        <span>CONFIGURACION</span>
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
        ↺ Restablecer calibracion
      </button>

    </div>

    <div class="tool-group">
      <div class="file-information">
        <strong>Video SBS 3D</strong>
        <p>
          Ambas perspectivas provienen
          del mismo fotograma, por lo que
          permanecen sincronizadas.
        </p>
      </div>
    </div>
  `;

  ["scale", "horizontal"].forEach(id => {
    document.getElementById(`video-${id}`)
      .addEventListener("input", event => {

        updateCalibration({
          [id]: Number(event.target.value)
        });

        updateCalibrationControls();
        drawFrame();
      });
  });

  document.getElementById("video-swap-eyes")
    .addEventListener("change", event => {

      updateCalibration({
        swapEyes: event.target.checked
      });

      drawFrame();
    });

  document.getElementById("video-reset")
    .addEventListener("click", restoreDefaults);
}


// ==========================================
// SINCRONIZAR VALORES
// ==========================================

function updateCalibrationControls() {
  const { calibration } = getState();

  for (const id of ["scale", "horizontal"]) {
    const input = document.getElementById(`video-${id}`);
    const output = document.getElementById(
      `video-${id}-value`
    );

    if (!input || !output) continue;

    input.value = calibration[id];

    output.textContent =
      `${calibration[id]}${id === "scale" ? "%" : " px"}`;
  }

  const swap = document.getElementById(
    "video-swap-eyes"
  );

  if (swap) {
    swap.checked = calibration.swapEyes;
  }
}


// ==========================================
// CONSTRUIR REPRODUCTOR
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

    <span id="video-time" class="video-time">
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
    .addEventListener("click", togglePlayback);

  document.getElementById("video-back")
    .addEventListener("click", () => seekRelative(-10));

  document.getElementById("video-forward")
    .addEventListener("click", () => seekRelative(10));

  document.getElementById("video-progress")
    .addEventListener("input", event => {
      if (!video || !Number.isFinite(video.duration)) {
        return;
      }

      video.currentTime =
        (Number(event.target.value) / 1000) *
        video.duration;

      updatePlaybackUI();
    });

  document.getElementById("video-volume")
    .addEventListener("input", event => {
      if (!video) return;

      video.volume = Number(event.target.value);
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
// ACTUALIZAR CONTROLES MULTIMEDIA
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

  if (playButton) {
    const playing = !video.paused && !video.ended;

    playButton.textContent = playing ? "❚❚" : "▶";

    playButton.setAttribute(
      "aria-label",
      playing ? "Pausar" : "Reproducir"
    );

    playButton.title = playing ? "Pausar" : "Reproducir";
  }

  const duration = Number.isFinite(video.duration)
    ? video.duration
    : 0;

  if (time) {
    time.textContent =
      `${formatTime(video.currentTime)} / ${formatTime(duration)}`;
  }

  if (progress) {
    progress.value = duration > 0
      ? Math.round(video.currentTime / duration * 1000)
      : 0;
  }

  if (volume) {
    volume.value = video.muted ? 0 : video.volume;
  }

  if (mute) {
    mute.textContent =
      video.muted || video.volume === 0 ? "🔇" : "🔊";

    mute.setAttribute(
      "aria-label",
      video.muted ? "Activar sonido" : "Silenciar"
    );
  }
}


// ==========================================
// REPRODUCCION
// ==========================================

async function togglePlayback() {
  if (!video) return;

  if (!video.paused && !video.ended) {
    video.pause();
    return;
  }

  try {
    await video.play();
  } catch (error) {
    showMessage(
      "El navegador no permitió reproducir el video. Pulsa Reproducir nuevamente.",
      "error"
    );

    console.error("[Video SBS] Reproducción:", error);
  }
}


// ==========================================
// BUSQUEDA EN EL VIDEO
// ==========================================

function seekRelative(seconds) {
  if (!video || !Number.isFinite(video.duration)) {
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
// AJUSTAR CANVAS
// ==========================================

function resizeCanvas() {
  if (!canvas || !context) return null;

  const rect =
    elements.renderer.getBoundingClientRect();

  if (!rect.width || !rect.height) {
    return null;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const width = Math.max(
    1,
    Math.round(rect.width * dpr)
  );

  const height = Math.max(
    1,
    Math.round(rect.height * dpr)
  );

  if (
    canvas.width !== width ||
    canvas.height !== height
  ) {
    canvas.width = width;
    canvas.height = height;
  }

  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  return {
    width: rect.width,
    height: rect.height
  };
}


// ==========================================
// DIBUJAR UNA VISTA
// ==========================================

function drawEye(
  sourceX,
  targetX,
  eyeWidth,
  height,
  horizontalOffset,
  scale
) {
  const sourceWidth = video.videoWidth / 2;
  const sourceHeight = video.videoHeight;

  const fit = Math.min(
    eyeWidth / sourceWidth,
    height / sourceHeight
  );

  const factor = fit * scale;

  const drawWidth = sourceWidth * factor;
  const drawHeight = sourceHeight * factor;

  const x =
    targetX +
    (eyeWidth - drawWidth) / 2 +
    horizontalOffset;

  const y = (height - drawHeight) / 2;

  context.save();

  context.beginPath();
  context.rect(targetX, 0, eyeWidth, height);
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
// RENDERIZAR FOTOGRAMA SBS
// ==========================================

function drawFrame() {
  if (
    !isActive() ||
    !video ||
    !canvas ||
    !context ||
    video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
    !video.videoWidth ||
    !video.videoHeight
  ) {
    return;
  }

  const dimensions = resizeCanvas();

  if (!dimensions) return;

  const { width, height } = dimensions;
  const eyeWidth = width / 2;

  const { calibration } = getState();

  const leftSource = calibration.swapEyes
    ? video.videoWidth / 2
    : 0;

  const rightSource = calibration.swapEyes
    ? 0
    : video.videoWidth / 2;

  const horizontal = calibration.horizontal / 2;
  const scale = calibration.scale / 100;

  context.clearRect(0, 0, width, height);

  context.fillStyle = "#05060c";
  context.fillRect(0, 0, width, height);

  drawEye(
    leftSource,
    0,
    eyeWidth,
    height,
    -horizontal,
    scale
  );

  drawEye(
    rightSource,
    eyeWidth,
    eyeWidth,
    height,
    horizontal,
    scale
  );

  context.fillStyle = "#292d42";
  context.fillRect(eyeWidth - 0.5, 0, 1, height);

  context.font = "600 12px Inter, sans-serif";
  context.textBaseline = "top";

  context.fillStyle = "rgba(0,0,0,.65)";
  context.fillRect(12, 12, 32, 27);
  context.fillRect(eyeWidth + 12, 12, 32, 27);

  context.fillStyle = "#fff";
  context.fillText("L", 23, 19);
  context.fillText("R", eyeWidth + 23, 19);
}


// ==========================================
// CANCELAR RENDERIZADO PROGRAMADO
// ==========================================

function stopFrameLoop() {
  if (frameRequest === null) return;

  if (
    frameRequestType === "video" &&
    video?.cancelVideoFrameCallback
  ) {
    video.cancelVideoFrameCallback(frameRequest);
  } else if (frameRequestType === "animation") {
    cancelAnimationFrame(frameRequest);
  }

  frameRequest = null;
  frameRequestType = null;
}


// ==========================================
// PROGRAMAR SIGUIENTE FOTOGRAMA
// ==========================================

function scheduleFrame() {
  if (
    !video ||
    !isActive() ||
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
      !isActive()
    ) {
      return;
    }

    drawFrame();
    updatePlaybackUI();
    scheduleFrame();
  };

  if (typeof video.requestVideoFrameCallback === "function") {
    frameRequestType = "video";

    frameRequest = video.requestVideoFrameCallback(
      callback
    );
  } else {
    frameRequestType = "animation";

    frameRequest = requestAnimationFrame(
      callback
    );
  }
}


// ==========================================
// RESTABLECER AJUSTES
// ==========================================

function restoreDefaults() {
  if (!isActive() || !video) return;

  resetCalibration();
  updateCalibrationControls();
  drawFrame();

  showMessage(
    "Calibración restablecida sin reiniciar el video."
  );
}


// ==========================================
// LIMPIAR RECURSOS
// ==========================================

function clearVideo() {
  stopFrameLoop();

  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  if (video) {
    video.pause();

    // El gestor de archivos libera la URL.
    // Aquí eliminamos solamente las referencias.
  }

  video = null;
  canvas = null;
  context = null;

  if (isActive()) {
    elements.reset.disabled = true;
    elements.vr.disabled = true;
  }

  elements.controls.replaceChildren();
}


// ==========================================
// PREPARAR VIDEO SBS
// ==========================================

function prepareVideo() {
  if (!isActive()) return;

  clearVideo();

  const state = getState();

  if (!state.file || state.status !== "ready") {
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

  // Un solo video para ambas perspectivas.
  video.controls = false;
  video.playsInline = true;
  video.preload = "auto";

  // El video permanece en el DOM como
  // fuente de los fotogramas del canvas.
  video.style.position = "absolute";
  video.style.width = "1px";
  video.style.height = "1px";
  video.style.opacity = "0";
  video.style.pointerEvents = "none";

  canvas = document.createElement("canvas");
  canvas.id = "sbs-video-canvas";

  canvas.setAttribute(
    "aria-label",
    "Visualizador de video estereoscópico"
  );

  context = canvas.getContext("2d");

  if (!context) {
    clearVideo();

    showMessage(
      "No se pudo crear el visualizador de video.",
      "error"
    );
    return;
  }

  elements.renderer.appendChild(canvas);

  renderTools();
  renderVideoControls();

  elements.reset.disabled = false;

  // Se conectará en la siguiente etapa:
  // el visor móvil Google Cardboard.
  elements.vr.disabled = false;

  video.addEventListener("play", () => {
    updatePlaybackUI();
    scheduleFrame();
  });

  video.addEventListener("pause", () => {
    stopFrameLoop();
    updatePlaybackUI();
    drawFrame();
  });

  video.addEventListener("timeupdate", updatePlaybackUI);

  video.addEventListener("durationchange", updatePlaybackUI);

  video.addEventListener("volumechange", updatePlaybackUI);

  video.addEventListener("seeked", () => {
    drawFrame();
    updatePlaybackUI();
  });

  video.addEventListener("loadeddata", drawFrame);

  video.addEventListener("ended", () => {
    stopFrameLoop();
    updatePlaybackUI();
    drawFrame();
  });

  video.addEventListener("error", () => {
    stopFrameLoop();

    showMessage(
      "Ocurrió un error al decodificar o reproducir el MP4.",
      "error"
    );
  });

  resizeObserver = new ResizeObserver(() => {
    drawFrame();
  });

  resizeObserver.observe(elements.renderer);

  drawFrame();

  showMessage(
    "Video SBS preparado. Pulsa Reproducir para comenzar."
  );

  console.log(
    "[Video SBS] Archivo preparado:",
    state.fileName
  );
}


// ==========================================
// INICIALIZAR
// ==========================================

export function initSBSVideo() {
  if (initialized) return;

  initialized = true;

  document.addEventListener(
    "studio:file-loaded",
    event => {
      if (event.detail.module === MODULE_ID) {
        prepareVideo();
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
    clearVideo
  );

  // Al sustituir un archivo, detener
  // el renderizado y la reproducción.
  subscribe(state => {
    if (!video) return;

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
              activar la reproducción y
              la calibración.
            </p>
          </div>
        `;
      }
    }
  });

  console.log(
    "[StereoVision] Módulo Video SBS inicializado."
  );
}
