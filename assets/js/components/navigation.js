
/* ==========================================
   STEREOVISION STUDIO 3D
   NAVEGACIÓN ENTRE MÓDULOS
   ========================================== */

// Configuración de los tres módulos.

const MODULES = {
  anaglyph: {
    name: "Anaglifo 3D",
    mode: "ANAGLIFO ROJO-CIAN",
    accept: ".jpg,.jpeg,.png,.webp",
    vr: false,
    description:
      "Importa una imagen anaglifo rojo-cian para comenzar."
  },

  "sbs-image": {
    name: "Imagen SBS",
    mode: "IMAGEN SIDE-BY-SIDE",
    accept: ".jpg,.jpeg,.png,.webp",
    vr: true,
    description:
      "Importa una imagen SBS para visualizar sus dos perspectivas."
  },

  "sbs-video": {
    name: "Video SBS",
    mode: "VIDEO SIDE-BY-SIDE",
    accept: ".mp4",
    vr: true,
    description:
      "Importa un video MP4 SBS para comenzar la reproducción."
  }
};


// ==========================================
// REFERENCIAS DEL DOCUMENTO
// ==========================================

const elements = {
  homeScreen: document.getElementById("home-screen"),

  studioScreen: document.getElementById("studio-screen"),

  vrScreen: document.getElementById("vr-screen"),

  homeButton: document.getElementById("btn-home"),

  moduleButtons:
    document.querySelectorAll("[data-module]"),

  currentModuleName:
    document.getElementById("current-module-name"),

  viewportMode:
    document.getElementById("viewport-mode"),

  viewportEmpty:
    document.getElementById("viewport-empty"),

  fileInput:
    document.getElementById("media-input"),

  fileInformation:
    document.getElementById("file-information"),

  fileStatus:
    document.getElementById("file-status"),

  activeFileName:
    document.getElementById("active-file-name"),

  studioMessage:
    document.getElementById("studio-message"),

  moduleTools:
    document.getElementById("module-tools"),

  mediaRenderer:
    document.getElementById("media-renderer"),

  mediaControls:
    document.getElementById("media-controls"),

  resetButton:
    document.getElementById("btn-reset"),

  vrButton:
    document.getElementById("btn-vr")
};


// ==========================================
// ESTADO BÁSICO DE NAVEGACIÓN
// ==========================================

let activeModule = null;


// ==========================================
// PREPARAR EDITOR VACÍO
// ==========================================

function prepareEditor(config) {

  elements.currentModuleName.textContent =
    config.name;

  elements.viewportMode.textContent =
    config.mode;

  elements.fileInput.accept =
    config.accept;

  elements.fileInput.value = "";

  elements.fileInformation.textContent =
    "Ningún archivo seleccionado";

  elements.fileStatus.textContent =
    "Sin archivo";

  elements.activeFileName.textContent =
    "Sin archivo activo";

  elements.studioMessage.textContent =
    "Studio preparado";

  elements.studioMessage.className = "";

  elements.resetButton.disabled = true;

  // VR disponible solo en los módulos SBS.
  // Permanecerá deshabilitado hasta importar contenido.

  elements.vrButton.hidden = !config.vr;
  elements.vrButton.disabled = true;

  elements.viewportEmpty.hidden = false;

  elements.viewportEmpty.querySelector("p")
    .textContent = config.description;

  elements.mediaRenderer.replaceChildren();
  elements.mediaControls.replaceChildren();

  // Panel de herramientas provisional.
  // Se sustituirá con los controles reales.

  elements.moduleTools.innerHTML = `
    <div class="tool-placeholder">
      <span aria-hidden="true">◈</span>
      <p>
        Las herramientas de
        ${config.name} aparecerán aquí
        cuando implementemos el módulo.
      </p>
    </div>
  `;

}


// ==========================================
// ABRIR UN MÓDULO
// ==========================================

export function openModule(moduleId) {

  const config = MODULES[moduleId];

  if (!config) {
    console.error(
      "Módulo no reconocido:",
      moduleId
    );
    return;
  }

  // Eventos para futuras rutinas de limpieza.
  // Permitirá a los módulos liberar sus recursos.

  document.dispatchEvent(
    new CustomEvent("studio:before-module-change", {
      detail: {
        previousModule: activeModule,
        nextModule: moduleId
      }
    })
  );

  activeModule = moduleId;

  prepareEditor(config);

  elements.homeScreen.hidden = true;
  elements.studioScreen.hidden = false;
  elements.vrScreen.hidden = true;

  elements.homeButton.hidden = false;

  document.body.classList.add("studio-active");

  window.scrollTo({
    top: 0,
    behavior: "instant"
  });

  document.dispatchEvent(
    new CustomEvent("studio:module-change", {
      detail: {
        module: moduleId
      }
    })
  );

}


// ==========================================
// REGRESAR AL MENÚ PRINCIPAL
// ==========================================

export function goHome() {

  document.dispatchEvent(
    new CustomEvent("studio:before-module-change", {
      detail: {
        previousModule: activeModule,
        nextModule: null
      }
    })
  );

  activeModule = null;

  elements.studioScreen.hidden = true;
  elements.vrScreen.hidden = true;
  elements.homeScreen.hidden = false;

  elements.homeButton.hidden = true;

  elements.fileInput.value = "";

  elements.mediaRenderer.replaceChildren();
  elements.mediaControls.replaceChildren();

  elements.resetButton.disabled = true;
  elements.vrButton.disabled = true;

  document.body.classList.remove("studio-active");

  window.scrollTo({
    top: 0,
    behavior: "instant"
  });

  document.dispatchEvent(
    new CustomEvent("studio:module-change", {
      detail: {
        module: null
      }
    })
  );

}


// ==========================================
// OBTENER MÓDULO ACTUAL
// ==========================================

export function getActiveModule() {
  return activeModule;
}


// ==========================================
// INICIALIZAR NAVEGACIÓN
// ==========================================

export function initNavigation() {

  elements.moduleButtons.forEach((button) => {

    button.addEventListener("click", () => {

      const moduleId = button.dataset.module;

      openModule(moduleId);

    });

  });

  elements.homeButton.addEventListener(
    "click",
    goHome
  );

  // Mostrar el menú principal al iniciar.

  elements.homeScreen.hidden = false;
  elements.studioScreen.hidden = true;
  elements.vrScreen.hidden = true;
  elements.homeButton.hidden = true;

  console.log(
    "[StereoVision] Navegación inicializada."
  );

}
