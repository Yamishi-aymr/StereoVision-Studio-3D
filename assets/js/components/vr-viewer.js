
/* ==========================================
   STEREOVISION STUDIO 3D
   VISOR VR PARA GOOGLE CARDBOARD
   ========================================== */

import {
  getState,
  setVRActive,
  subscribe
} from "../core/state.js";

import {
  getActiveModule
} from "./navigation.js";

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

let initialized = false;
let active = false;
let operationId = 0;

let canvas = null;
let context = null;

let sourceImage = null;
let sourceVideo = null;
let sourceObjectURL = null;

let frameId = null;
let frameType = null;
let resizeObserver = null;

let previousVideoParent = null;


// ==========================================
// COMPROBAR MÓDULOS
// ==========================================

function supportsVR() {
  return [
    "sbs-image",
    "sbs-video"
  ].includes(getActiveModule());
}


// ==========================================
// MENSAJES
// ==========================================

function showMessage(message, error = false) {
  elements.message.textContent = message;
  elements.message.className = error
    ? "studio-message-error"
    : "studio-message-success";
}


// ==========================================
// ORIENTACIÓN
// ==========================================

function updateOrientation() {
  if (!active) return;

  const portrait =
    window.matchMedia("(orientation: portrait)").matches;

  elements.orientation.hidden = !portrait;
}


// ==========================================
// CANCELAR FOTOGRAMA PROGRAMADO
// ==========================================

function cancelFrame() {
  if (frameId === null) return;

  if (
    frameType === "video" &&
    sourceVideo &&
    typeof sourceVideo.cancelVideoFrameCallback === "function"
  ) {
    sourceVideo.cancelVideoFrameCallback(frameId);
  } else if (frameType === "animation") {
    cancelAnimationFrame(frameId);
  }

  frameId = null;
  frameType = null;
}


// ==========================================
// TAMAÑO DE PANTALLA
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
    offsetX;

  const y =
    (height - drawHeight) / 2 +
    offsetY;

  context.save();

  // Cada perspectiva permanece dentro
  // de la región de su ojo.
  context.beginPath();
  context.rect(targetX, 0, eyeWidth, height);
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
// RENDERIZAR VISTAS VR
// ==========================================

function drawVR() {
  if (!active || !canvas || !context) return;

  const source = sourceImage?.source || sourceVideo;

  if (!source) return;

  if (
    sourceVideo &&
    (
      sourceVideo.readyState <
        HTMLMediaElement.HAVE_CURRENT_DATA ||
      !sourceVideo.videoWidth
    )
  ) {
    return;
  }

  const dimensions = resizeCanvas();

  if (!dimensions) return;

  const { width, height } = dimensions;

  const sourceWidth = sourceVideo
    ? sourceVideo.videoWidth
    : sourceImage.width;

  const sourceHeight = sourceVideo
    ? sourceVideo.videoHeight
    : sourceImage.height;

  if (sourceWidth < 2 || sourceHeight < 1) {
    return;
  }

  const halfSource = sourceWidth / 2;
  const eyeWidth = width / 2;

  const { calibration } = getState();

  const scale = calibration.scale / 100;
  const horizontal = calibration.horizontal / 2;
  const vertical = calibration.vertical / 2;

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
    scale
  });
}


// ==========================================
// PROGRAMAR FOTOGRAMAS DE VIDEO
// ==========================================

function scheduleFrame() {
  if (
    !active ||
    !sourceVideo ||
    sourceVideo.paused ||
    sourceVideo.ended ||
    frameId !== null
  ) {
    return;
  }

  const currentVideo = sourceVideo;

  const callback = () => {
    frameId = null;
    frameType = null;

    if (
      !active ||
      sourceVideo !== currentVideo
    ) {
      return;
    }

    drawVR();
    scheduleFrame();
  };

  if (
    typeof currentVideo.requestVideoFrameCallback ===
    "function"
  ) {
    frameType = "video";
    frameId = currentVideo.requestVideoFrameCallback(
      callback
    );
  } else {
    frameType = "animation";
    frameId = requestAnimationFrame(callback);
  }
}


// ==========================================
// CARGAR IMAGEN ORIGINAL
// ==========================================

async function loadVRImage(file) {
  sourceObjectURL = URL.createObjectURL(file);

  const image = new Image();

  image.src = sourceObjectURL;

  try {
    await image.decode();
  } catch {
    throw new Error(
      "No fue posible preparar la imagen para VR."
    );
  }

  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error(
      "La imagen no tiene dimensiones válidas."
    );
  }

  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight
  };
}


// ==========================================
// PREPARAR FUENTE DE VIDEO
// ==========================================

function attachVideo() {
  const video = elements.renderer.querySelector("video");

  if (!video) {
    throw new Error(
      "No se encontró el video SBS activo."
    );
  }

  previousVideoParent = video.parentElement;
  sourceVideo = video;

  // Reutilizar el mismo reproductor:
  // no se reinicia el tiempo ni el audio.
  elements.container.appendChild(video);

  video.playsInline = true;
  video.style.position = "absolute";
  video.style.width = "1px";
  video.style.height = "1px";
  video.style.opacity = "0";
  video.style.pointerEvents = "none";
}


// ==========================================
// PREPARAR CANVAS VR
// ==========================================

function createCanvas() {
  canvas = document.createElement("canvas");
  canvas.id = "vr-canvas";

  canvas.setAttribute(
    "aria-label",
    "Visualización estereoscópica VR"
  );

  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.maxWidth = "none";
  canvas.style.maxHeight = "none";
  canvas.style.display = "block";
  canvas.style.gridColumn = "1 / -1";
  canvas.style.gridRow = "1";
  canvas.style.touchAction = "none";

  context = canvas.getContext("2d", {
    alpha: false
  });

  if (!context) {
    throw new Error(
      "No fue posible crear el visualizador VR."
    );
  }

  elements.container.appendChild(canvas);
}


// ==========================================
// SINCRONIZAR EVENTOS DE VIDEO
// ==========================================

function onVideoPlay() {
  drawVR();
  scheduleFrame();
}

function onVideoPause() {
  cancelFrame();
  drawVR();
}

function onVideoSeek() {
  drawVR();
}

function connectVideoEvents() {
  if (!sourceVideo) return;

  sourceVideo.addEventListener("play", onVideoPlay);
  sourceVideo.addEventListener("pause", onVideoPause);
  sourceVideo.addEventListener("seeked", onVideoSeek);
  sourceVideo.addEventListener("loadeddata", onVideoSeek);
}

function disconnectVideoEvents() {
  if (!sourceVideo) return;

  sourceVideo.removeEventListener("play", onVideoPlay);
  sourceVideo.removeEventListener("pause", onVideoPause);
  sourceVideo.removeEventListener("seeked", onVideoSeek);
  sourceVideo.removeEventListener(
    "loadeddata",
    onVideoSeek
  );
}


// ==========================================
// LIBERAR RECURSOS VR
// ==========================================

function cleanupVR() {
  operationId++;

  cancelFrame();

  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  disconnectVideoEvents();

  // Devolver el reproductor al editor original.
  if (sourceVideo && previousVideoParent) {
    previousVideoParent.appendChild(sourceVideo);
  }

  sourceVideo = null;
  previousVideoParent = null;
  sourceImage = null;

  if (sourceObjectURL) {
    URL.revokeObjectURL(sourceObjectURL);
    sourceObjectURL = null;
  }

  canvas = null;
  context = null;

  elements.container.replaceChildren();
}


// ==========================================
// ENTRAR EN MODO VR
// ==========================================

export async function enterVR() {
  if (active || !supportsVR()) return;

  const state = getState();

  if (!state.file || state.status !== "ready") {
    showMessage(
      "Importa primero una imagen o video SBS.",
      true
    );
    return;
  }

  const moduleId = getActiveModule();

  active = true;

  elements.studio.hidden = true;
  elements.vr.hidden = false;

  setVRActive(true);

  updateOrientation();

  const currentOperation = ++operationId;

  // Pedir pantalla completa directamente
  // durante la interacción del usuario.
  // Si no se permite, el visor seguirá
  // funcionando dentro de la página.
  if (elements.vr.requestFullscreen) {
    try {
      const fullscreenPromise =
        elements.vr.requestFullscreen();

      Promise.resolve(fullscreenPromise).catch(() => {
        console.info(
          "[VR] Pantalla completa no disponible."
        );
      });
    } catch {
      console.info(
        "[VR] Se utilizará el visor en página."
      );
    }
  }

  try {
    if (moduleId === "sbs-image") {
      sourceImage = await loadVRImage(state.file);

      if (
        currentOperation !== operationId ||
        !active
      ) {
        return;
      }
    }

    if (moduleId === "sbs-video") {
      attachVideo();
    }

    createCanvas();

    resizeObserver = new ResizeObserver(() => {
      drawVR();
    });

    resizeObserver.observe(elements.container);

    drawVR();

    if (sourceVideo) {
      connectVideoEvents();

      // La reproducción conserva su estado.
      // Si estaba pausada, continuará pausada.
      if (!sourceVideo.paused) {
        scheduleFrame();
      }
    }

    console.log(
      "[VR] Visor activo:",
      moduleId
    );

  } catch (error) {
    console.error("[VR]", error);

    await exitVR();

    showMessage(
      error.message || "No fue posible activar VR.",
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
        "[VR] No se pudo cerrar pantalla completa."
      );
    }
  }

  showMessage(
    "Has regresado al Studio. La calibración se conservó."
  );

  console.log("[VR] Regreso al editor.");
}


// ==========================================
// CAMBIOS DE PANTALLA COMPLETA
// ==========================================

function handleFullscreenChange() {
  // Si el navegador salió de fullscreen,
  // mantenemos la interfaz VR disponible.
  // El usuario puede salir con el botón.
  if (active) {
    updateOrientation();
    drawVR();
  }
}


// ==========================================
// INICIALIZAR
// ==========================================

export function initVRViewer() {
  if (initialized) return;

  initialized = true;

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
    () => {
      updateOrientation();
      drawVR();
    }
  );

  document.addEventListener(
    "fullscreenchange",
    handleFullscreenChange
  );

  // Ejecutar antes de los manejadores normales
  // de cambio de módulo para devolver el video.
  document.addEventListener(
    "studio:before-module-change",
    () => {
      if (active) {
        exitVR();
      }
    },
    { capture: true }
  );

  // Dibujar nuevamente ante cambios
  // de calibración, incluso en pausa.
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
    "[StereoVision] Visor VR inicializado."
  );
}
