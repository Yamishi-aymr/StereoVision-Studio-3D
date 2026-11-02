
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

import {
  initCalibrationSettings
} from "./components/calibration.js";


// ==========================================
// EVENTOS GENERALES
// ==========================================

function initStudioEvents() {

  // Cambiar entre menú y módulos.
  document.addEventListener(
    "studio:module-change",
    event => {

      const moduleId = event.detail.module;

      // Restablece el contenido anterior,
      // pero conserva la configuración
      // general de las gafas.
      setModule(moduleId);

      console.log(
        "[StereoVision] Módulo activo:",
        moduleId || "Inicio"
      );
    }
  );

  // Registrar una importación exitosa.
  document.addEventListener(
    "studio:file-loaded",
    event => {

      const {
        file,
        module,
        metadata
      } = event.detail;

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
// OBSERVAR CAMBIOS DE ESTADO
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
        calibration: state.calibration,
        deviceSettings: state.deviceSettings
      }
    );
  });

}


// ==========================================
// INICIAR APLICACION
// ==========================================

function initApp() {

  // Eventos generales.
  initStudioEvents();

  // Estado central.
  initStateObserver();

  // Navegación.
  initNavigation();

  // Importación multimedia.
  initFileManager();

  // Módulo 1: Anaglifo.
  initAnaglyph();

  // Módulo 2: Imagen SBS.
  initSBSImage();

  // Módulo 3: Video SBS.
  initSBSVideo();

  // Modo VR.
  initVRViewer();

  // Preferencias generales de gafas.
  initCalibrationSettings();

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
    " Importación multimedia: activa"
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
    " Configuración persistente: activa"
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
// EJECUCION
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
