
/* ==========================================
   STEREOVISION STUDIO 3D
   ARCHIVO PRINCIPAL
   ========================================== */

import {
  initNavigation
} from "./components/navigation.js";

import {
  initFileManager
} from "./core/file-manager.js";

import {
  getState,
  setModule,
  subscribe
} from "./core/state.js";

import {
  initAnaglyph
} from "./modules/anaglyph.js";

import {
  initSBSImage
} from "./modules/sbs-image.js";

import {
  initSBSVideo
} from "./modules/sbs-video.js";

import {
  initVRViewer
} from "./components/vr-viewer.js";


// ==========================================
// EVENTOS GENERALES
// ==========================================

function initStudioEvents() {

  document.addEventListener(
    "studio:module-change",
    event => {
      const moduleId = event.detail.module;

      setModule(moduleId);

      console.log(
        "[StereoVision] Módulo activo:",
        moduleId || "Inicio"
      );
    }
  );

  document.addEventListener(
    "studio:file-loaded",
    event => {
      const { file, module, metadata } =
        event.detail;

      console.log(
        "[StereoVision] Archivo importado:",
        {
          name: file.name,
          module,
          width: metadata.width,
          height: metadata.height
        }
      );
    }
  );
}


// ==========================================
// OBSERVAR ESTADO
// ==========================================

function initStateObserver() {
  subscribe(state => {
    console.debug(
      "[StereoVision] Estado:",
      {
        module: state.module,
        status: state.status,
        file: state.fileName,
        vrActive: state.vrActive,
        calibration: state.calibration
      }
    );
  });
}


// ==========================================
// INICIAR APLICACIÓN
// ==========================================

function initApp() {

  // Estado general y eventos.
  initStudioEvents();
  initStateObserver();

  // Navegación e importación.
  initNavigation();
  initFileManager();

  // Módulos multimedia.
  initAnaglyph();
  initSBSImage();
  initSBSVideo();

  // Visor móvil.
  initVRViewer();

  console.log(
    "=================================="
  );

  console.log(
    " StereoVision Studio 3D"
  );

  console.log(
    " Navegación: activa"
  );

  console.log(
    " Importación: activa"
  );

  console.log(
    " Anaglifo: activo"
  );

  console.log(
    " Imagen SBS: activa"
  );

  console.log(
    " Video SBS: activo"
  );

  console.log(
    " Modo VR: integrado"
  );

  console.log(
    "=================================="
  );

  console.debug(
    "[StereoVision] Estado inicial:",
    getState()
  );
}


// ==========================================
// EJECUCIÓN
// ==========================================

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initApp,
    { once: true }
  );
} else {
  initApp();
}
