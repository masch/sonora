export const en = {
  common: {
    learnMore: 'Learn more',
  },
  tabs: {
    index: 'Home',
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
    hintRow: {
      title: 'Try editing',
      hint: 'app/index.tsx',
    },
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
        desc: 'This template has light and dark mode support. The <0>useColorScheme()</0> hook lets you inspect what the user\'s current color scheme is, and so you can adjust UI colors accordingly.',
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
