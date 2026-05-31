export const en = {
  common: {
    learnMore: 'Learn more',
  },
  trips: {
    notFound: 'Trip not found',
    duration: '{{minutes}} min walk',
  },
  tabs: {
    index: 'Home',
    walk: 'Walk',
    explore: 'Explore',
    settings: 'Settings',
  },
  index: {
    title: 'Welcome to Expo',
    getStarted: 'get started',
    hints: {
      editing: 'Try editing',
      devtools: 'Dev tools',
      freshStart: 'Fresh start',
      devtoolsWeb: 'use browser devtools',
      devtoolsDevice: 'shake device or press <0>m</0> in terminal',
      devtoolsAndroid: 'press <0>cmd+m (or ctrl+m)</0>',
      devtoolsIos: 'press <0>cmd+d</0>',
    },
    geofence: {
      debugTitle: 'GPS Offline Geofence Debug',
      gpsStatus: 'GPS Status',
      gpsAccuracy: 'GPS Accuracy',
      distanceToStart: 'Distance to Start',
      requiredProximity: 'Required Proximity',
      nearStartLocation: 'Near Start Location?',
      yesWithinRadius: 'YES (Within {{radius}}m)',
      no: 'NO',
      errorPrefix: 'Error: {{error}}',
      notAvailable: 'N/A',
    },
    downloadDebug: {
      title: 'Audio Download Debug',
      status: 'Download Status',
      progress: 'Progress',
      localUri: 'Local URI',
      btnDownload: 'Download',
      btnDelete: 'Delete',
    },
    playerDebug: {
      title: 'Audio Player Debug',
      status: 'Player Status',
      position: 'Position',
      duration: 'Duration',
      btnPlay: 'Play',
      btnPause: 'Pause',
      btnStop: 'Stop',
      loading: 'Loading...',
      positionValue: '{{value}}s',
      durationValue: '{{value}}s',
    },
    waitingForDownload: 'Download audio first to play it',
  },
  components: {
    downloadCard: {
      btnDownload: 'Download',
      btnDelete: 'Delete',
      statusCompleted: '✓',
      progressPercent: '{{value}}%',
    },
    gpsBadge: {
      statusInitializing: 'Initializing GPS…',
      statusWeak: 'Weak GPS signal. Step away from trees/walls to improve accuracy.',
      statusReady: 'GPS ready',
      distance: 'Distance',
      accuracy: 'Accuracy',
      nearStart: 'Near start',
    },
    mediaControls: {
      btnPlay: 'Play',
      btnPause: 'Pause',
      btnStop: 'Stop',
      statusLoading: 'Loading…',
      position: '{{value}}s',
      duration: '{{value}}s',
    },
  },
  errors: {
    invalidDownloadConfig: 'Invalid trip or download configuration',
    insufficientSpace: 'Insufficient storage space. Free: {{free}}MB, Required: {{required}}MB',
    downloadWriteFailed: 'Download failed to write target path',
  },
  explore: {
    title: 'Explore',
    subtitle: 'This starter app includes example\ncode to help you get started.',
    docLink: 'Expo documentation',
    sections: {
      fileRouting: {
        title: 'File-based routing',
        desc: 'This app has two screens: <0>src/app/index.tsx</0> and <0>src/app/explore.tsx</0>',
        layout: 'The layout file in <0>src/app/_layout.tsx</0> sets up the tab navigator.',
      },
      platforms: {
        title: 'Android, iOS, and web support',
        desc: 'You can open this project on Android, iOS, and the web. To open the web version, press <bold>w</bold> in the terminal running this project.',
      },
      images: {
        title: 'Images',
        desc: 'For static images, you can use the <0>@2x</0> and <0>@3x</0> suffixes to provide files for different screen densities.',
      },
      theme: {
        title: 'Light and dark mode components',
        desc: "This template has light and dark mode support. The <0>useColorScheme()</0> hook lets you inspect what the user's current color scheme is, and so you can adjust UI colors accordingly.",
      },
      animations: {
        title: 'Animations',
        desc: 'This template includes an example of an animated component. The <0>src/components/ui/collapsible.tsx</0> component uses the powerful <0>react-native-reanimated</0> library to animate this hint.',
      },
    },
  },
  settings: {
    title: 'Settings',
    subtitle: 'Manage your preferences',
    profile: {
      initials: 'JD',
      name: 'John Doe',
      email: 'john@example.com',
    },
    section: {
      preferences: 'Preferences',
      about: 'About',
    },
    preferences: {
      notifications: 'Notifications',
      darkMode: 'Dark Mode',
      darkModeValue: {
        on: 'On',
        off: 'Off',
      },
      language: 'Language',
    },
    language: {
      label: 'English',
    },
    about: {
      version: 'Version',
      versionValue: '1.0.0',
      terms: 'Terms of Service',
      privacy: 'Privacy Policy',
    },
    footer: 'Powered by Expo + NativeWind',
  },
} as const;

export type EnDict = typeof en;
