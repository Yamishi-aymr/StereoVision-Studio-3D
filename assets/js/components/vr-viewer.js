
/* ==========================================
   STEREOVISION STUDIO 3D
   VISOR VR MEJORADO PARA GOOGLE CARDBOARD
   ========================================== */

import {
  getState,
  setVRActive,
  subscribe
} from "../core/state.js";

import {
  getActiveModule
} from "./navigation.js";


// ==========================================
// CONFIGURACION
// ==========================================

const VR_MODULES = ["sbs-image", "sbs-video"];

const CONTROLS_HIDE_DELAY = 2000;

const VR_CSS_PATH = "./assets/css/vr-controls.css";


// ==========================================
// REFERENCIAS HTML
// ==========================================

const elements = {
  studio: document.getElementById("studio-screen"),
  vr: document.getElementById("vr-screen"),
  container: document.getElementById("vr-container"),

  enter: document.getElementById("btn-vr"),
  exit: document.getElementById("btn-exit-vr"),

  orientation: document.getElementById(
    "vr-orientation-message"
  ),

  renderer: document.getElementById("media-renderer"),
  message: document.getElementById("studio-message")
};


// ==========================================
// ESTADO DEL VISOR
// ==========================================

let initialized = false;
let active = false;
let sessionId = 0;

let canvas = null;
let context = null;

let sourceImage = null;
let sourceVideo = null;
let sourceObjectURL = null;

let previousVideoParent = null;
let previousVideoSibling = null;
let previousVideoLoop = false;

let resizeObserver = null;

let frameRequest = null;
let frameRequestType = null;

let hideControlsTimer = null;
let controlsOverlay = null;

let playbackError = false;


// ==========================================
// UTILIDADES
// ==========================================

function supportsVR() {
  return VR_MODULES.includes(getActiveModule());
}


function isVideoModule() {
  return getActiveModule() === "sbs-video";
}


function showMessage(message, error = false) {
  elements.message.textContent = message;

  elements.message.className = error
    ? "studio-message-error"
    : "studio-message-success";
}


// ==========================================
// CARGAR CSS DEL VISOR
// ==========================================

function loadVRStyles() {
  if (document.getElementById("vr-controls-css")) {
    return;
  }

  const link = document.createElement("link");

  link.id = "vr-controls-css";
  link.rel = "stylesheet";
  link.href = VR_CSS_PATH;

  document.head.appendChild(link);
}


// ==========================================
// ORIENTACION DEL TELEFONO
// ==========================================

function updateOrientation() {
  if (!active) return;

  const portrait = window.matchMedia(
    "(orientation: portrait)"
  ).matches;

  elements.orientation.hidden = !portrait;
}


// ==========================================
// LIBERAR TEMPORIZADOR
// ==========================================

function clearControlsTimer() {
  if (hideControlsTimer !== null) {
    clearTimeout(hideControlsTimer);
    hideControlsTimer = null;
  }
}


// ==========================================
// MOSTRAR CONTROLES FLOTANTES
// ==========================================

function showControls() {
  if (!active || !controlsOverlay) return;

  clearControlsTimer();

  controlsOverlay.classList.remove(
    "vr-controls-hidden"
  );

  controlsOverlay.classList.add(
    "vr-controls-visible"
  );

  updatePlaybackButtons();

  hideControlsTimer = setTimeout(() => {
    if (!active || !controlsOverlay) return;

    controlsOverlay.classList.remove(
      "vr-controls-visible"
    );

    controlsOverlay.classList.add(
      "vr-controls-hidden"
    );

    hideControlsTimer = null;

  }, CONTROLS_HIDE_DELAY);
}


// ==========================================
// FORMATO DE TIEMPO
// ==========================================

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00";
  }

  const total = Math.floor(seconds);

  const minutes = Math.floor(total / 60);
  const secs = total % 60;

  return (
    String(minutes).padStart(2, "0") +
    ":" +
    String(secs).padStart(2, "0")
  );
}


// ==========================================
// CREAR CONTROLES POR OJO
// ==========================================

function createEyeControls(eye) {
  const panel = document.createElement("div");

  panel.className = "vr-eye-controls";
  panel.dataset.eye = eye;

  panel.innerHTML = `
    <div class="vr-control-panel">

      <div class="vr-control-title">
        VIDEO SBS 3D
      </div>

      <div class="vr-control-buttons">

        <button
          class="vr-control-button vr-play-toggle"
          type="button"
          aria-label="Pausar o reproducir"
        >
          ❚❚
        </button>

        <button
          class="vr-control-button vr-mute-toggle"
          type="button"
          aria-label="Silenciar o activar sonido"
        >
          🔊
        </button>

      </div>

      <div class="vr-control-time">
        00:00 / 00:00
      </div>

    </div>
  `;

  panel.querySelector(".vr-play-toggle")
    .addEventListener("click", event => {
      event.stopPropagation();

      togglePlayback();
      showControls();
    });

  panel.querySelector(".vr-mute-toggle")
    .addEventListener("click", event => {
      event.stopPropagation();

      toggleMute();
      showControls();
    });

  return panel;
}


// ==========================================
// CONSTRUIR CAPA DE CONTROLES
// ==========================================

function createControlsOverlay() {
  if (!sourceVideo) return;

  controlsOverlay = document.createElement("div");

  controlsOverlay.id = "vr-controls-overlay";

  controlsOverlay.className =
    "vr-controls-overlay vr-controls-visible";

  controlsOverlay.setAttribute(
    "aria-label",
    "Controles de reproducción VR"
  );

  controlsOverlay.appendChild(
    createEyeControls("left")
  );

  controlsOverlay.appendChild(
    createEyeControls("right")
  );

  elements.vr.appendChild(controlsOverlay);

  controlsOverlay.addEventListener(
    "pointerdown",
    event => {
      if (!event.target.closest("button")) {
        showControls();
      }
    }
  );

  updatePlaybackButtons();
  showControls();
}


// ==========================================
// ACTUALIZAR CONTROLES FLOTANTES
// ==========================================

function updatePlaybackButtons() {
  if (!sourceVideo || !controlsOverlay) return;

  const playing =
    !sourceVideo.paused && !sourceVideo.ended;

  const muted =
    sourceVideo.muted || sourceVideo.volume === 0;

  const duration = Number.isFinite(
    sourceVideo.duration
  )
    ? sourceVideo.duration
    : 0;

  const timeText =
    `${formatTime(sourceVideo.currentTime)} / ` +
    `${formatTime(duration)}`;

  controlsOverlay.querySelectorAll(
    ".vr-play-toggle"
  ).forEach(button => {
    button.textContent = playing ? "❚❚" : "▶";

    button.setAttribute(
      "aria-label",
      playing ? "Pausar video" : "Reproducir video"
    );
  });

  controlsOverlay.querySelectorAll(
    ".vr-mute-toggle"
  ).forEach(button => {
    button.textContent = muted ? "🔇" : "🔊";

    button.setAttribute(
      "aria-label",
      muted ? "Activar sonido" : "Silenciar"
    );
  });

  controlsOverlay.querySelectorAll(
    ".vr-control-time"
  ).forEach(label => {
    label.textContent = timeText;
  });
}


// ==========================================
// REPRODUCIR O PAUSAR
// ==========================================

async function togglePlayback() {
  if (!sourceVideo) return;

  const currentVideo = sourceVideo;

  if (!currentVideo.paused) {
    currentVideo.pause();
    updatePlaybackButtons();
    return;
  }

  try {
    await currentVideo.play();

  } catch (error) {
    if (active && sourceVideo === currentVideo) {
      playbackError = true;
      showControls();

      console.warn(
        "[VR] No se pudo reproducir:",
        error
      );
    }
  }

  updatePlaybackButtons();
}


// ==========================================
// SILENCIAR O ACTIVAR SONIDO
// ==========================================

function toggleMute() {
  if (!sourceVideo) return;

  sourceVideo.muted = !sourceVideo.muted;

  updatePlaybackButtons();
}


// ==========================================
// DETENER BUCLE DE RENDERIZADO
// ==========================================

function stopFrameLoop() {
  if (frameRequest === null) return;

  if (
    frameRequestType === "video" &&
    sourceVideo &&
    typeof sourceVideo.cancelVideoFrameCallback ===
      "function"
  ) {
    sourceVideo.cancelVideoFrameCallback(
      frameRequest
    );

  } else if (frameRequestType === "animation") {
    cancelAnimationFrame(frameRequest);
  }

  frameRequest = null;
  frameRequestType = null;
}


// ==========================================
// TAMAÑO DEL CANVAS
// ==========================================

function resizeCanvas() {
  if (!canvas || !context) return null;

  const rect = elements.container.getBoundingClientRect();

  if (rect.width <= 0 || rect.height <= 0) {
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

  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  return {
    width: rect.width,
    height: rect.height
  };
}


// ==========================================
// DIBUJAR UNA PERSPECTIVA
// ==========================================

function drawEye({
  source,
  sourceX,
  sourceWidth,
  sourceHeight,
  targetX,
  eyeWidth,
  height,
  offsetX,
  offsetY,
  panX,
  panY,
  scale
}) {
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
    offsetX +
    panX;

  const y =
    (height - drawHeight) / 2 +
    offsetY +
    panY;

  context.save();

  context.beginPath();

  context.rect(
    targetX,
    0,
    eyeWidth,
    height
  );

  context.clip();

  context.drawImage(
    source,
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
// DIBUJAR CONTENIDO VR
// ==========================================

function drawVR() {
  if (!active || !canvas || !context) return;

  // Para imagen, sourceImage es el
  // HTMLImageElement directamente.
  // Para video, utilizamos el reproductor.
  const source = sourceImage || sourceVideo;

  if (!source) return;

  if (
    sourceVideo &&
    (
      sourceVideo.readyState <
        HTMLMediaElement.HAVE_CURRENT_DATA ||
      !sourceVideo.videoWidth ||
      !sourceVideo.videoHeight
    )
  ) {
    return;
  }

  const dimensions = resizeCanvas();

  if (!dimensions) return;

  const { width, height } = dimensions;

  const sourceWidth = sourceVideo
    ? sourceVideo.videoWidth
    : sourceImage.naturalWidth;

  const sourceHeight = sourceVideo
    ? sourceVideo.videoHeight
    : sourceImage.naturalHeight;

  if (sourceWidth < 2 || sourceHeight < 1) {
    return;
  }

  const halfSource = sourceWidth / 2;
  const eyeWidth = width / 2;

  const calibration = getState().calibration;

  const scale = calibration.scale / 100;

  const horizontal =
    (Number(calibration.horizontal) || 0) / 2;

  const vertical = sourceVideo
    ? 0
    : (Number(calibration.vertical) || 0) / 2;

  const panX = Number(calibration.panX) || 0;
  const panY = Number(calibration.panY) || 0;

  const leftSource = calibration.swapEyes
    ? halfSource
    : 0;

  const rightSource = calibration.swapEyes
    ? 0
    : halfSource;

  context.clearRect(0, 0, width, height);

  context.fillStyle = "#000000";

  context.fillRect(0, 0, width, height);

  // OJO IZQUIERDO
  drawEye({
    source,
    sourceX: leftSource,
    sourceWidth: halfSource,
    sourceHeight,
    targetX: 0,
    eyeWidth,
    height,
    offsetX: -horizontal,
    offsetY: -vertical,
    panX,
    panY,
    scale
  });

  // OJO DERECHO
  drawEye({
    source,
    sourceX: rightSource,
    sourceWidth: halfSource,
    sourceHeight,
    targetX: eyeWidth,
    eyeWidth,
    height,
    offsetX: horizontal,
    offsetY: vertical,
    panX,
    panY,
    scale
  });
}


// ==========================================
// PROGRAMAR FOTOGRAMAS
// ==========================================

function scheduleFrame() {
  if (
    !active ||
    !sourceVideo ||
    sourceVideo.paused ||
    sourceVideo.ended ||
    frameRequest !== null
  ) {
    return;
  }

  const currentVideo = sourceVideo;

  const callback = () => {
    frameRequest = null;
    frameRequestType = null;

    if (
      !active ||
      sourceVideo !== currentVideo
    ) {
      return;
    }

    drawVR();
    updatePlaybackButtons();
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
// CARGAR IMAGEN PARA VR
// ==========================================

async function loadVRImage(file) {
  const url = URL.createObjectURL(file);

  sourceObjectURL = url;

  const image = new Image();
  image.src = url;

  try {
    await image.decode();

  } catch {
    throw new Error(
      "No se pudo decodificar la imagen para VR."
    );
  }

  if (
    !image.naturalWidth ||
    !image.naturalHeight
  ) {
    throw new Error(
      "La imagen no tiene dimensiones válidas."
    );
  }

  return image;
}


// ==========================================
// REUTILIZAR VIDEO DEL EDITOR
// ==========================================

function attachVideo() {
  const video =
    elements.renderer.querySelector("video");

  if (!video) {
    throw new Error(
      "No se encontró el video SBS activo."
    );
  }

  previousVideoParent = video.parentElement;
  previousVideoSibling = video.nextSibling;

  previousVideoLoop = video.loop;

  sourceVideo = video;

  // Bucle activo solamente durante VR.
  video.loop = true;
  video.playsInline = true;

  elements.container.appendChild(video);

  video.style.position = "absolute";
  video.style.width = "1px";
  video.style.height = "1px";
  video.style.opacity = "0";
  video.style.pointerEvents = "none";

  return video;
}


// ==========================================
// CREAR CANVAS VR
// ==========================================

function createCanvas() {
  canvas = document.createElement("canvas");

  canvas.id = "vr-canvas";

  canvas.setAttribute(
    "aria-label",
    "Visualizador estereoscópico VR"
  );

  context = canvas.getContext(
    "2d",
    { alpha: false }
  );

  if (!context) {
    throw new Error(
      "No se pudo crear el Canvas VR."
    );
  }

  elements.container.appendChild(canvas);

  // Tocar la imagen muestra los controles.
  canvas.addEventListener(
    "pointerdown",
    () => {
      if (sourceVideo) {
        showControls();
      }
    }
  );
}


// ==========================================
// EVENTOS DEL VIDEO
// ==========================================

function onVideoPlay() {
  playbackError = false;

  updatePlaybackButtons();
  drawVR();
  scheduleFrame();
}


function onVideoPause() {
  stopFrameLoop();

  updatePlaybackButtons();
  drawVR();
}


function onVideoSeek() {
  drawVR();
  updatePlaybackButtons();
}


function onVideoTimeUpdate() {
  updatePlaybackButtons();
}


function onVideoError() {
  stopFrameLoop();

  showControls();

  console.error(
    "[VR] Error de reproducción o decodificación."
  );
}


function connectVideoEvents() {
  if (!sourceVideo) return;

  sourceVideo.addEventListener(
    "play",
    onVideoPlay
  );

  sourceVideo.addEventListener(
    "pause",
    onVideoPause
  );

  sourceVideo.addEventListener(
    "seeked",
    onVideoSeek
  );

  sourceVideo.addEventListener(
    "loadeddata",
    onVideoSeek
  );

  sourceVideo.addEventListener(
    "timeupdate",
    onVideoTimeUpdate
  );

  sourceVideo.addEventListener(
    "error",
    onVideoError
  );
}


function disconnectVideoEvents() {
  if (!sourceVideo) return;

  sourceVideo.removeEventListener(
    "play",
    onVideoPlay
  );

  sourceVideo.removeEventListener(
    "pause",
    onVideoPause
  );

  sourceVideo.removeEventListener(
    "seeked",
    onVideoSeek
  );

  sourceVideo.removeEventListener(
    "loadeddata",
    onVideoSeek
  );

  sourceVideo.removeEventListener(
    "timeupdate",
    onVideoTimeUpdate
  );

  sourceVideo.removeEventListener(
    "error",
    onVideoError
  );
}


// ==========================================
// INTENTAR REPRODUCCION AUTOMATICA
// ==========================================

function startVideoInVR() {
  if (!sourceVideo) return;

  const currentVideo = sourceVideo;

  // Entrar a VR proviene de un clic real.
  // Intentar reproducir directamente aquí
  // ayuda con las reglas de navegadores móviles.
  try {
    const result = currentVideo.play();

    if (result && typeof result.catch === "function") {
      result.catch(error => {
        if (
          active &&
          sourceVideo === currentVideo
        ) {
          playbackError = true;
          showControls();

          console.warn(
            "[VR] Reproducción automática bloqueada:",
            error
          );
        }
      });
    }

  } catch (error) {
    playbackError = true;
    showControls();

    console.warn(
      "[VR] Reproducción no permitida:",
      error
    );
  }
}


// ==========================================
// LIMPIAR RECURSOS DEL VISOR
// ==========================================

function cleanupVR() {
  sessionId++;

  clearControlsTimer();
  stopFrameLoop();

  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  disconnectVideoEvents();

  if (sourceVideo) {
    // Al salir de VR siempre se pausa.
    sourceVideo.pause();

    // Restaurar la configuración del editor.
    sourceVideo.loop = previousVideoLoop;

    if (previousVideoParent) {
      if (
        previousVideoSibling &&
        previousVideoSibling.parentNode ===
          previousVideoParent
      ) {
        previousVideoParent.insertBefore(
          sourceVideo,
          previousVideoSibling
        );
      } else {
        previousVideoParent.appendChild(
          sourceVideo
        );
      }
    }
  }

  sourceVideo = null;
  previousVideoParent = null;
  previousVideoSibling = null;

  sourceImage = null;

  if (sourceObjectURL) {
    URL.revokeObjectURL(sourceObjectURL);
    sourceObjectURL = null;
  }

  canvas = null;
  context = null;

  controlsOverlay = null;
  playbackError = false;

  elements.container.replaceChildren();
}


// ==========================================
// ENTRAR AL MODO VR
// ==========================================

export async function enterVR() {
  if (active || !supportsVR()) return;

  const state = getState();

  if (
    !state.file ||
    state.status !== "ready"
  ) {
    showMessage(
      "Importa primero una imagen o video SBS.",
      true
    );
    return;
  }

  const moduleId = getActiveModule();

  active = true;

  const currentSession = ++sessionId;

  elements.studio.hidden = true;
  elements.vr.hidden = false;

  setVRActive(true);

  updateOrientation();

  try {
    // El video debe iniciar desde la
    // interacción que activó Modo VR.
    if (moduleId === "sbs-video") {
      attachVideo();
      connectVideoEvents();

      createCanvas();
      createControlsOverlay();

      startVideoInVR();
    }

    // Solicitar fullscreen sin esperar
    // operaciones asíncronas previas.
    if (elements.vr.requestFullscreen) {
      try {
        const result =
          elements.vr.requestFullscreen();

        Promise.resolve(result).catch(() => {
          console.info(
            "[VR] Se utilizará el visor dentro de la página."
          );
        });

      } catch {
        console.info(
          "[VR] Pantalla completa no disponible."
        );
      }
    }

    if (moduleId === "sbs-image") {
      const image = await loadVRImage(state.file);

      if (
        !active ||
        currentSession !== sessionId
      ) {
        return;
      }

      sourceImage = image;
      createCanvas();
    }

    if (
      !active ||
      currentSession !== sessionId
    ) {
      return;
    }

    resizeObserver = new ResizeObserver(() => {
      drawVR();
    });

    resizeObserver.observe(
      elements.container
    );

    drawVR();

    if (sourceVideo && !sourceVideo.paused) {
      scheduleFrame();
    }

    console.log(
      "[VR] Visor mejorado activo:",
      moduleId
    );

  } catch (error) {
    if (currentSession !== sessionId) return;

    console.error("[VR]", error);

    await exitVR();

    showMessage(
      error.message ||
      "No fue posible activar el modo VR.",
      true
    );
  }
}


// ==========================================
// SALIR DEL MODO VR
// ==========================================

export async function exitVR() {
  if (!active) return;

  active = false;

  cleanupVR();

  elements.vr.hidden = true;
  elements.studio.hidden = false;

  elements.orientation.hidden = true;

  setVRActive(false);

  if (document.fullscreenElement === elements.vr) {
    try {
      await document.exitFullscreen();
    } catch {
      console.info(
        "[VR] El navegador cerró pantalla completa."
      );
    }
  }

  showMessage(
    "Has salido de VR. Se conservaron el archivo y la calibración."
  );

  console.log(
    "[VR] Regreso al editor; video pausado."
  );
}


// ==========================================
// ACTUALIZAR AL CAMBIAR ORIENTACION
// ==========================================

function handleOrientationChange() {
  if (!active) return;

  updateOrientation();
  drawVR();
}


// ==========================================
// INICIALIZAR VISOR
// ==========================================

export function initVRViewer() {
  if (initialized) return;

  initialized = true;

  loadVRStyles();

  elements.enter.addEventListener(
    "click",
    enterVR
  );

  elements.exit.addEventListener(
    "click",
    exitVR
  );

  window.addEventListener(
    "resize",
    drawVR
  );

  window.addEventListener(
    "orientationchange",
    handleOrientationChange
  );

  document.addEventListener(
    "fullscreenchange",
    () => {
      if (active) {
        updateOrientation();
        drawVR();
      }
    }
  );

  // Limpieza al abandonar un módulo.
  document.addEventListener(
    "studio:before-module-change",
    () => {
      if (active) {
        exitVR();
      }
    },
    { capture: true }
  );

  // Reflejar cambios de calibración.
  subscribe(state => {
    if (!active) return;

    if (
      state.status === "empty" ||
      state.status === "error"
    ) {
      exitVR();
      return;
    }

    drawVR();
  });

  console.log(
    "[StereoVision] VR con controles flotantes inicializado."
  );
}
