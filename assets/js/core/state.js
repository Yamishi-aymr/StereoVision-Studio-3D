
/* ==========================================
   STEREOVISION STUDIO 3D
   ESTADO CENTRAL DE LA APLICACIÓN
   ========================================== */

export const DEFAULT_CALIBRATION = Object.freeze({
  scale: 100,
  horizontal: 0,
  vertical: 0,
  brightness: 100,
  contrast: 100,
  swapEyes: false
});

const initialState = () => ({
  module: null,
  file: null,
  fileName: null,
  fileType: null,
  fileSize: 0,
  status: "empty",
  loading: false,
  vrActive: false,
  calibration: { ...DEFAULT_CALIBRATION }
});

let state = initialState();

const listeners = new Set();


// ==========================================
// CONSULTAR ESTADO
// ==========================================

export function getState() {
  return {
    ...state,
    calibration: { ...state.calibration }
  };
}


// ==========================================
// NOTIFICAR CAMBIOS
// ==========================================

function notify() {
  const snapshot = getState();

  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      console.error(
        "[StereoVision] Error en listener:",
        error
      );
    }
  });
}


// ==========================================
// SUSCRIPCIONES
// ==========================================

export function subscribe(listener) {
  if (typeof listener !== "function") {
    throw new TypeError(
      "El listener debe ser una función."
    );
  }

  listeners.add(listener);

  return () => listeners.delete(listener);
}


// ==========================================
// ACTUALIZAR ESTADO
// ==========================================

export function setState(updates) {
  state = {
    ...state,
    ...updates,
    calibration: updates.calibration
      ? {
          ...state.calibration,
          ...updates.calibration
        }
      : state.calibration
  };

  notify();
}


// ==========================================
// CAMBIAR MÓDULO
// ==========================================

export function setModule(moduleId) {
  state = {
    ...initialState(),
    module: moduleId
  };

  notify();
}


// ==========================================
// REGISTRAR ARCHIVO
// ==========================================

export function setActiveFile(file) {
  if (!(file instanceof File)) {
    throw new TypeError(
      "Se requiere un archivo válido."
    );
  }

  setState({
    file,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    status: "ready",
    loading: false,
    vrActive: false,
    calibration: { ...DEFAULT_CALIBRATION }
  });
}


// ==========================================
// ESTADOS DE CARGA
// ==========================================

export function setLoading(loading) {
  setState({
    loading: Boolean(loading),
    status: loading ? "loading" : state.status
  });
}

export function setError() {
  setState({
    loading: false,
    status: "error"
  });
}


// ==========================================
// CALIBRACIÓN
// ==========================================

export function updateCalibration(updates) {
  setState({
    calibration: updates
  });
}

export function resetCalibration() {
  setState({
    calibration: { ...DEFAULT_CALIBRATION }
  });
}


// ==========================================
// MODO VR
// ==========================================

export function setVRActive(active) {
  setState({
    vrActive: Boolean(active)
  });
}


// ==========================================
// LIMPIAR CONTENIDO
// ==========================================

export function clearActiveFile() {
  setState({
    file: null,
    fileName: null,
    fileType: null,
    fileSize: 0,
    status: "empty",
    loading: false,
    vrActive: false,
    calibration: { ...DEFAULT_CALIBRATION }
  });
}


// ==========================================
// REINICIAR APLICACIÓN
// ==========================================

export function resetState() {
  state = initialState();
  notify();
}
