
/* ==========================================
   STEREOVISION STUDIO 3D
   ESTADO CENTRAL Y PREFERENCIAS
   ========================================== */

// ==========================================
// CONFIGURACION INICIAL
// ==========================================

// Ajustes independientes para cada archivo.
export const DEFAULT_CALIBRATION = Object.freeze({
  scale: 100,
  horizontal: 0,
  vertical: 0,
  panX: 0,
  panY: 0,
  brightness: 100,
  contrast: 100,
  swapEyes: false
});

// Configuración física de referencia del visor.
// Se conserva entre archivos y sesiones.
export const DEFAULT_DEVICE_SETTINGS = Object.freeze({
  lensSpacingMm: 64
});

export const DEVICE_LIMITS = Object.freeze({
  minLensSpacingMm: 55,
  maxLensSpacingMm: 75
});

const STORAGE_KEY =
  "stereovision-studio-3d-device-v1";


// ==========================================
// VALIDAR CONFIGURACION DE GAFAS
// ==========================================

function normalizeDeviceSettings(settings = {}) {
  const numericValue = Number(settings.lensSpacingMm);

  const validValue = Number.isFinite(numericValue)
    ? numericValue
    : DEFAULT_DEVICE_SETTINGS.lensSpacingMm;

  const limitedValue = Math.max(
    DEVICE_LIMITS.minLensSpacingMm,
    Math.min(
      DEVICE_LIMITS.maxLensSpacingMm,
      validValue
    )
  );

  return {
    lensSpacingMm: Math.round(limitedValue)
  };
}


// ==========================================
// CARGAR PREFERENCIAS GUARDADAS
// ==========================================

function loadDeviceSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return { ...DEFAULT_DEVICE_SETTINGS };
    }

    const parsed = JSON.parse(saved);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return { ...DEFAULT_DEVICE_SETTINGS };
    }

    return normalizeDeviceSettings(parsed);

  } catch (error) {
    console.warn(
      "[StereoVision] No se pudieron leer las preferencias:",
      error
    );

    return { ...DEFAULT_DEVICE_SETTINGS };
  }
}


// ==========================================
// GUARDAR PREFERENCIAS
// ==========================================

function saveDeviceSettings(settings) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(settings)
    );

    return true;

  } catch (error) {
    console.warn(
      "[StereoVision] No se pudieron guardar las preferencias:",
      error
    );

    return false;
  }
}


// ==========================================
// ESTADO CENTRAL
// ==========================================

function initialState(deviceSettings) {
  return {
    module: null,

    file: null,
    fileName: null,
    fileType: null,
    fileSize: 0,

    status: "empty",
    loading: false,
    vrActive: false,

    calibration: {
      ...DEFAULT_CALIBRATION
    },

    deviceSettings: {
      ...deviceSettings
    }
  };
}

let state = initialState(loadDeviceSettings());

const listeners = new Set();


// ==========================================
// CONSULTAR ESTADO
// ==========================================

export function getState() {
  return {
    ...state,

    calibration: {
      ...state.calibration
    },

    deviceSettings: {
      ...state.deviceSettings
    }
  };
}


// ==========================================
// NOTIFICAR CAMBIOS
// ==========================================

function notify() {
  const snapshot = getState();

  for (const listener of listeners) {
    try {
      listener(snapshot);

    } catch (error) {
      console.error(
        "[StereoVision] Error en suscripción:",
        error
      );
    }
  }
}


// ==========================================
// SUSCRIBIRSE A CAMBIOS
// ==========================================

export function subscribe(listener) {
  if (typeof listener !== "function") {
    throw new TypeError(
      "La suscripción requiere una función."
    );
  }

  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}


// ==========================================
// ACTUALIZAR ESTADO
// ==========================================

export function setState(updates = {}) {
  const {
    deviceSettings,
    calibration,
    ...otherUpdates
  } = updates;

  state = {
    ...state,
    ...otherUpdates,

    calibration: calibration
      ? {
          ...state.calibration,
          ...calibration
        }
      : state.calibration,

    deviceSettings: deviceSettings
      ? normalizeDeviceSettings({
          ...state.deviceSettings,
          ...deviceSettings
        })
      : state.deviceSettings
  };

  if (deviceSettings) {
    saveDeviceSettings(state.deviceSettings);
  }

  notify();
}


// ==========================================
// CAMBIAR MODULO
// ==========================================

export function setModule(moduleId) {
  // Se limpia el archivo y la calibración,
  // pero se conservan las preferencias
  // físicas del visor.

  state = initialState(state.deviceSettings);

  state.module = moduleId;

  notify();
}


// ==========================================
// REGISTRAR ARCHIVO ACTIVO
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

    calibration: {
      ...DEFAULT_CALIBRATION
    }
  });
}


// ==========================================
// ESTADOS DE CARGA
// ==========================================

export function setLoading(loading) {
  const isLoading = Boolean(loading);

  setState({
    loading: isLoading,

    status: isLoading
      ? "loading"
      : state.status
  });
}


export function setError() {
  setState({
    loading: false,
    status: "error"
  });
}


// ==========================================
// ACTUALIZAR CALIBRACION DEL CONTENIDO
// ==========================================

export function updateCalibration(updates = {}) {
  setState({
    calibration: updates
  });
}


// ==========================================
// RESTABLECER CALIBRACION DEL CONTENIDO
// ==========================================

export function resetCalibration() {
  state = {
    ...state,
    calibration: {
      ...DEFAULT_CALIBRATION
    }
  };

  notify();
}


// ==========================================
// PREFERENCIAS GENERALES DEL VISOR
// ==========================================

export function updateDeviceSettings(updates = {}) {
  setState({
    deviceSettings: updates
  });
}


// ==========================================
// RESTABLECER PREFERENCIAS DEL VISOR
// ==========================================

export function resetDeviceSettings() {
  setState({
    deviceSettings: {
      ...DEFAULT_DEVICE_SETTINGS
    }
  });
}


// ==========================================
// ESTADO DEL MODO VR
// ==========================================

export function setVRActive(active) {
  setState({
    vrActive: Boolean(active)
  });
}


// ==========================================
// LIMPIAR ARCHIVO ACTIVO
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

    calibration: {
      ...DEFAULT_CALIBRATION
    }
  });
}


// ==========================================
// REINICIAR APLICACION
// ==========================================

export function resetState() {
  // Las preferencias generales se conservan.
  state = initialState(state.deviceSettings);

  notify();
}


// ==========================================
// OBTENER PREFERENCIA FISICA
// ==========================================

export function getLensSpacingMm() {
  return state.deviceSettings.lensSpacingMm;
}
