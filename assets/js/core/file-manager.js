
/* ==========================================
   STEREOVISION STUDIO 3D
   GESTOR DE ARCHIVOS MULTIMEDIA
   ========================================== */

import {
  getState,
  setActiveFile,
  setLoading,
  setError,
  clearActiveFile
} from "./state.js";

import {
  getActiveModule
} from "../components/navigation.js";


// ==========================================
// CONFIGURACIÓN DE FORMATOS
// ==========================================

const IMAGE_EXTENSIONS = [
  "jpg", "jpeg", "png", "webp"
];

const MODULE_FORMATS = {
  anaglyph: IMAGE_EXTENSIONS,
  "sbs-image": IMAGE_EXTENSIONS,
  "sbs-video": ["mp4"]
};

const MAX_SIZE = 500 * 1024 * 1024;


// ==========================================
// ELEMENTOS DEL DOCUMENTO
// ==========================================

const elements = {
  input: document.getElementById("media-input"),
  importButton: document.getElementById("btn-import"),
  fileInformation:
    document.getElementById("file-information"),
  fileStatus: document.getElementById("file-status"),
  fileName: document.getElementById("active-file-name"),
  message: document.getElementById("studio-message"),
  renderer: document.getElementById("media-renderer"),
  empty: document.getElementById("viewport-empty"),
  resetButton: document.getElementById("btn-reset"),
  vrButton: document.getElementById("btn-vr")
};

let activeObjectURL = null;
let requestVersion = 0;


// ==========================================
// MENSAJES
// ==========================================

function showMessage(message, type = "info") {
  elements.message.textContent = message;
  elements.message.className = "";

  if (type === "error") {
    elements.message.classList.add(
      "studio-message-error"
    );
  }

  if (type === "success") {
    elements.message.classList.add(
      "studio-message-success"
    );
  }

  if (type === "warning") {
    elements.message.classList.add(
      "studio-message-warning"
    );
  }
}


// ==========================================
// FORMATO DE TAMAÑO
// ==========================================

function formatSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}


// ==========================================
// OBTENER EXTENSIÓN
// ==========================================

function getExtension(fileName) {
  return fileName
    .split(".")
    .pop()
    .toLowerCase();
}


// ==========================================
// COMPROBAR FORMATO
// ==========================================

function validateFile(file, moduleId) {
  if (!file) {
    throw new Error(
      "No se seleccionó ningún archivo."
    );
  }

  const allowed = MODULE_FORMATS[moduleId];

  if (!allowed) {
    throw new Error(
      "Selecciona primero un módulo válido."
    );
  }

  const extension = getExtension(file.name);

  if (!allowed.includes(extension)) {
    throw new Error(
      `Formato no permitido. Este módulo acepta: ${allowed.join(", ").toUpperCase()}.`
    );
  }

  if (file.size === 0) {
    throw new Error(
      "El archivo está vacío."
    );
  }

  if (file.size > MAX_SIZE) {
    throw new Error(
      "El archivo supera el límite de 500 MB establecido para esta aplicación."
    );
  }

  const imageTypes = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp"
  };

  if (moduleId === "sbs-video") {
    if (
      file.type &&
      !["video/mp4", "application/mp4"].includes(file.type)
    ) {
      throw new Error(
        "El archivo seleccionado no corresponde a un MP4 válido."
      );
    }
  } else {
    if (
      file.type &&
      file.type !== imageTypes[extension]
    ) {
      throw new Error(
        "El tipo de imagen no coincide con su extensión."
      );
    }
  }

  return extension;
}


// ==========================================
// COMPROBAR DECODIFICACIÓN DE IMAGEN
// ==========================================

async function validateImage(url) {
  const image = new Image();
  image.src = url;

  try {
    await image.decode();
  } catch {
    throw new Error(
      "No se pudo decodificar la imagen. Comprueba que el archivo no esté dañado."
    );
  }

  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error(
      "La imagen no contiene dimensiones válidas."
    );
  }

  return {
    width: image.naturalWidth,
    height: image.naturalHeight
  };
}


// ==========================================
// COMPROBAR VIDEO MP4
// ==========================================

function validateVideo(url) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    let finished = false;

    function cleanup() {
      video.removeEventListener(
        "loadedmetadata", onLoaded
      );

      video.removeEventListener(
        "error", onError
      );

      video.removeAttribute("src");
      video.load();
    }

    function finish(error, data = null) {
      if (finished) return;

      finished = true;
      cleanup();

      if (error) {
        reject(error);
      } else {
        resolve(data);
      }
    }

    function onLoaded() {
      if (
        video.videoWidth <= 0 ||
        video.videoHeight <= 0
      ) {
        finish(
          new Error(
            "El archivo no contiene dimensiones de video válidas."
          )
        );
        return;
      }

      finish(null, {
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration
      });
    }

    function onError() {
      finish(
        new Error(
          "El navegador no puede cargar este MP4. Comprueba el códec del video."
        )
      );
    }

    video.addEventListener(
      "loadedmetadata", onLoaded
    );

    video.addEventListener(
      "error", onError
    );

    video.src = url;
    video.load();
  });
}


// ==========================================
// LIBERAR CONTENIDO ANTERIOR
// ==========================================

function releaseMedia() {
  const videos = elements.renderer.querySelectorAll(
    "video"
  );

  videos.forEach((video) => {
    video.pause();
    video.removeAttribute("src");
    video.load();
  });

  elements.renderer.replaceChildren();

  if (activeObjectURL) {
    URL.revokeObjectURL(activeObjectURL);
    activeObjectURL = null;
  }
}


// ==========================================
// LIMPIAR ARCHIVO ACTIVO
// ==========================================

export function clearMedia() {
  requestVersion++;

  releaseMedia();
  clearActiveFile();

  elements.input.value = "";

  elements.fileInformation.textContent =
    "Ningún archivo seleccionado";

  elements.fileStatus.textContent =
    "Sin archivo";

  elements.fileName.textContent =
    "Sin archivo activo";

  elements.empty.hidden = false;

  elements.resetButton.disabled = true;
  elements.vrButton.disabled = true;
}


// ==========================================
// VISTA PREVIA PROVISIONAL
// ==========================================

function renderPreview(moduleId, url) {
  const preview = moduleId === "sbs-video"
    ? document.createElement("video")
    : document.createElement("img");

  preview.src = url;

  if (moduleId === "sbs-video") {
    preview.controls = true;
    preview.playsInline = true;
    preview.preload = "metadata";
  } else {
    preview.alt = "Vista previa del archivo importado";
    preview.draggable = false;
  }

  preview.style.width = "100%";
  preview.style.height = "100%";
  preview.style.objectFit = "contain";

  // Esta vista todavía no separa las perspectivas SBS.
  // Los renderizadores definitivos llegarán después.

  elements.renderer.replaceChildren(preview);
  elements.empty.hidden = true;
}


// ==========================================
// IMPORTAR ARCHIVO
// ==========================================

export async function importMedia(file) {
  const moduleId = getActiveModule();

  if (!moduleId) {
    showMessage(
      "Selecciona un módulo antes de importar.",
      "warning"
    );
    return;
  }

  // Invalidar cualquier carga anterior.
  const currentRequest = ++requestVersion;

  // Al intentar importar otro archivo, limpiamos
  // el contenido anterior y sus recursos.
  releaseMedia();
  clearActiveFile();

  elements.empty.hidden = false;
  elements.resetButton.disabled = true;
  elements.vrButton.disabled = true;

  elements.fileStatus.textContent = "Cargando...";
  elements.fileInformation.textContent =
    "Validando archivo...";

  setLoading(true);

  let temporaryURL = null;

  try {
    const extension = validateFile(file, moduleId);

    temporaryURL = URL.createObjectURL(file);

    const metadata = extension === "mp4"
      ? await validateVideo(temporaryURL)
      : await validateImage(temporaryURL);

    // Si el usuario cambió de módulo o archivo
    // durante la carga, descartamos este resultado.

    if (
      currentRequest !== requestVersion ||
      moduleId !== getActiveModule()
    ) {
      URL.revokeObjectURL(temporaryURL);
      return;
    }

    activeObjectURL = temporaryURL;
    temporaryURL = null;

    setActiveFile(file);

    elements.fileStatus.textContent =
      "Archivo listo";

    elements.fileName.textContent =
      file.name;

    elements.fileInformation.textContent =
      `${file.name} · ${formatSize(file.size)} · ${metadata.width} × ${metadata.height}`;

    renderPreview(moduleId, activeObjectURL);

    showMessage(
      "Archivo importado correctamente. Vista preliminar disponible.",
      "success"
    );

    document.dispatchEvent(
      new CustomEvent("studio:file-loaded", {
        detail: {
          file,
          module: moduleId,
          metadata
        }
      })
    );

  } catch (error) {
    if (temporaryURL) {
      URL.revokeObjectURL(temporaryURL);
    }

    if (currentRequest !== requestVersion) {
      return;
    }

    setError();

    elements.fileStatus.textContent =
      "Error de archivo";

    elements.fileInformation.textContent =
      "No se pudo importar el archivo.";

    showMessage(
      error.message || "Error al cargar el archivo.",
      "error"
    );

    console.error(
      "[StereoVision] Error de importación:",
      error
    );

  } finally {
    if (currentRequest === requestVersion) {
      elements.input.value = "";

      if (getState().loading) {
        setLoading(false);
      }
    }
  }
}


// ==========================================
// INICIALIZAR GESTOR
// ==========================================

export function initFileManager() {
  elements.input.disabled = false;
  elements.importButton.disabled = false;

  elements.importButton.addEventListener(
    "click",
    () => {
      if (!getActiveModule()) return;

      elements.input.click();
    }
  );

  elements.input.addEventListener(
    "change",
    (event) => {
      const file = event.target.files?.[0];

      if (!file) return;

      importMedia(file);
    }
  );

  // Limpieza al abandonar un módulo.
  document.addEventListener(
    "studio:before-module-change",
    clearMedia
  );

  console.log(
    "[StereoVision] Gestor de archivos inicializado."
  );
}
