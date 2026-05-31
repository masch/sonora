export const es = {
  common: {
    learnMore: 'Saber más',
  },
  trips: {
    notFound: 'Viaje no encontrado',
    duration: 'Caminata de {{minutes}} min',
  },
  tabs: {
    index: 'Inicio',
    walk: 'Caminata',
    explore: 'Explorar',
    settings: 'Ajustes',
  },
  index: {
    title: 'Bienvenido a Expo',
    getStarted: 'empezar',
    hints: {
      editing: 'Probá editar',
      devtools: 'Herramientas',
      freshStart: 'Empezar de cero',
      devtoolsWeb: 'usá las devtools del navegador',
      devtoolsDevice: 'sacudí el dispositivo o presioná <0>m</0> en la terminal',
      devtoolsAndroid: 'presioná <0>cmd+m (o ctrl+m)</0>',
      devtoolsIos: 'presioná <0>cmd+d</0>',
    },
    geofence: {
      debugTitle: 'Debug de Geofence GPS Offline',
      gpsStatus: 'Estado de GPS',
      gpsAccuracy: 'Precisión de GPS',
      distanceToStart: 'Distancia al inicio',
      requiredProximity: 'Proximidad requerida',
      nearStartLocation: '¿Cerca del inicio?',
      yesWithinRadius: 'SÍ (Dentro de {{radius}}m)',
      no: 'NO',
      errorPrefix: 'Error: {{error}}',
      notAvailable: 'N/A',
    },
    downloadDebug: {
      title: 'Debug de Descarga de Audio',
      status: 'Estado de descarga',
      progress: 'Progreso',
      localUri: 'URI Local',
      btnDownload: 'Descargar',
      btnDelete: 'Borrar',
    },
    playerDebug: {
      title: 'Debug de Audio Player',
      status: 'Estado del Player',
      position: 'Posición',
      duration: 'Duración',
      btnPlay: 'Reproducir',
      btnPause: 'Pausa',
      btnStop: 'Detener',
      loading: 'Cargando...',
      positionValue: '{{value}}s',
      durationValue: '{{value}}s',
    },
    waitingForDownload: 'Descargá el audio primero para reproducirlo',
  },
  components: {
    downloadCard: {
      btnDownload: 'Descargar',
      btnDelete: 'Borrar',
      statusCompleted: '✓',
      progressPercent: '{{value}}%',
    },
    gpsBadge: {
      statusInitializing: 'Inicializando GPS…',
      statusWeak: 'Señal GPS débil. Alejate de árboles/paredes para mejorar la precisión.',
      statusReady: 'GPS listo',
      distance: 'Distancia',
      accuracy: 'Precisión',
      nearStart: 'Cerca del inicio',
    },
    mediaControls: {
      btnPlay: 'Reproducir',
      btnPause: 'Pausa',
      btnStop: 'Detener',
      statusLoading: 'Cargando…',
      position: '{{value}}s',
      duration: '{{value}}s',
    },
  },
  errors: {
    invalidDownloadConfig: 'Configuración de descarga o viaje inválida',
    insufficientSpace:
      'Espacio de almacenamiento insuficiente. Libre: {{free}}MB, Requerido: {{required}}MB',
    downloadWriteFailed: 'La descarga no pudo escribirse en la ruta destino',
  },
  explore: {
    title: 'Explorar',
    subtitle: 'Esta app de ejemplo incluye código\npara ayudarte a empezar.',
    docLink: 'Documentación de Expo',
    sections: {
      fileRouting: {
        title: 'Ruteo por archivos',
        desc: 'Esta app tiene dos pantallas: <0>src/app/index.tsx</0> y <0>src/app/explore.tsx</0>',
        layout:
          'El archivo de layout en <0>src/app/_layout.tsx</0> configura el navegador de tabs.',
      },
      platforms: {
        title: 'Compatibilidad con Android, iOS y web',
        desc: 'Podés abrir este proyecto en Android, iOS y web. Para abrir la versión web, presioná <bold>w</bold> en la terminal.',
      },
      images: {
        title: 'Imágenes',
        desc: 'Para imágenes estáticas, podés usar los sufijos <0>@2x</0> y <0>@3x</0> para distintos niveles de densidad de pantalla.',
      },
      theme: {
        title: 'Componentes con modo claro y oscuro',
        desc: 'Este template soporta modo claro y oscuro. El hook <0>useColorScheme()</0> te permite detectar el esquema de color del usuario y ajustar los colores de la interfaz.',
      },
      animations: {
        title: 'Animaciones',
        desc: 'Este template incluye un ejemplo de componente animado. El componente <0>src/components/ui/collapsible.tsx</0> usa la librería <0>react-native-reanimated</0> para animar la apertura.',
      },
    },
  },
  settings: {
    title: 'Ajustes',
    subtitle: 'Gestioná tus preferencias',
    profile: {
      initials: 'JD',
      name: 'Juan Pérez',
      email: 'juan@ejemplo.com',
    },
    section: {
      preferences: 'Preferencias',
      about: 'Acerca de',
    },
    preferences: {
      notifications: 'Notificaciones',
      darkMode: 'Modo oscuro',
      darkModeValue: {
        on: 'Sí',
        off: 'No',
      },
      language: 'Idioma',
    },
    language: {
      label: 'Español',
    },
    about: {
      version: 'Versión',
      versionValue: '1.0.0',
      terms: 'Términos del servicio',
      privacy: 'Política de privacidad',
    },
    footer: 'Powered by Expo + NativeWind',
  },
} as const;
