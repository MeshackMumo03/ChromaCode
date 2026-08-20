export default {
  "expo": {
    "name": "chromacode",
    "slug": "chromacode",
    "version": "2.71",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "chromacode",
    "userInterfaceStyle": "automatic",
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.metrem.chromacode",
      "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false
      }
    },
    "android": {
      "usesCleartextTraffic": true,
      "softwareKeyboardLayoutMode": "resize",
      "adaptiveIcon": {
        "backgroundColor": "#E6F4FE",
        "foregroundImage": "./assets/images/android-icon-foreground.png",
        "backgroundImage": "./assets/images/android-icon-background.png",
        "monochromeImage": "./assets/images/android-icon-monochrome.png"
      },
      "package": "com.metrem.chromacode",
      "googleServicesFile": process.env.GOOGLE_SERVICES_JSON || "./google-services.json"
    },
    "web": {
      "output": "static",
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": [
      "expo-router",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#ffffff",
          "dark": {
            "backgroundColor": "#000000"
          }
        }
      ],
      "@react-native-google-signin/google-signin",
      "expo-video",
      "expo-font",
      "expo-secure-store",
      "expo-web-browser",
      "expo-updates",
      [
        "expo-audio",
        {
          "microphonePermission": "Allow $(PRODUCT_NAME) to access your microphone.",
          "recordAudioAndroid": true,
          "enableBackgroundPlayback": false
        }
      ]
    ],
    "runtimeVersion": {
      "policy": "appVersion"
    },
    "updates": {
      "url": "https://u.expo.dev/8fb4d373-8dce-4372-b53f-c46c2a075f17"
    },
    "experiments": {
      "typedRoutes": true
    },
    "extra": {
      "router": {},
      "eas": {
        "projectId": "8fb4d373-8dce-4372-b53f-c46c2a075f17"
      }
    },
    "owner": "metrem"
  }
};