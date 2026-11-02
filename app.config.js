// iOS Google Sign-In needs its own OAuth client (Google Cloud Console ->
// Credentials -> iOS client for bundle ID com.metrem.chromacode). The native
// SDK is opened through the reversed client ID as a URL scheme.
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const googleIosUrlScheme = googleIosClientId
  ? `com.googleusercontent.apps.${googleIosClientId.replace('.apps.googleusercontent.com', '')}`
  : undefined;

export default {
  "expo": {
    "name": "chromacode",
    "slug": "chromacode",
    "version": "2.80",
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
      googleIosUrlScheme
        ? ["@react-native-google-signin/google-signin", { "iosUrlScheme": googleIosUrlScheme }]
        : "@react-native-google-signin/google-signin",
      [
        "expo-image-picker",
        {
          "photosPermission": "Allow $(PRODUCT_NAME) to access your photos so you can share them in chats and set profile pictures.",
          "cameraPermission": "Allow $(PRODUCT_NAME) to use your camera to take photos for chats and your profile.",
          "microphonePermission": "Allow $(PRODUCT_NAME) to use your microphone to record voice messages."
        }
      ],
      "expo-video",
      "expo-font",
      "expo-secure-store",
      "expo-web-browser",
      "expo-updates",
      [
        "expo-audio",
        {
          "microphonePermission": "Allow $(PRODUCT_NAME) to use your microphone to record voice messages.",
          "recordAudioAndroid": true,
          "enableBackgroundPlayback": false
        }
      ]
    ],
    "runtimeVersion": "2.71",
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