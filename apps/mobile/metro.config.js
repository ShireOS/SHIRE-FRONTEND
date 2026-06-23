const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const fs = require('fs');
const path = require('path');

const config = getDefaultConfig(__dirname);
const pnpmDir = path.resolve(__dirname, '../../node_modules/.pnpm');
const expoRouterEntryPackageName =
  'expo-router@6.0.24_@expo+metro-runtime@6.1.2_@types+react-dom@18.3.7_@types+react@19.2._660194f29e378df04e2ae752d183f068';
const expoRouterPackageName = fs.existsSync(path.join(pnpmDir, expoRouterEntryPackageName))
  ? expoRouterEntryPackageName
  : fs.readdirSync(pnpmDir)
    .filter((entry) => entry.startsWith('expo-router@6.0.24_@expo+metro-runtime'))
    .sort()
    .at(-1);
const expoRouterPackageDir = path.join(
  pnpmDir,
  expoRouterPackageName,
  'node_modules/expo-router',
);

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-safe-area-context') {
    return context.resolveRequest(
      context,
      path.join(__dirname, 'src/shims/reactNativeSafeAreaContext.js'),
      platform,
    );
  }

  if (moduleName.endsWith('link/preview/LinkPreviewContext')) {
    return context.resolveRequest(
      context,
      path.join(__dirname, 'src/shims/LinkPreviewContext.js'),
      platform,
    );
  }

  if (moduleName === 'expo-router' || moduleName.startsWith('expo-router/')) {
    const subpath = moduleName === 'expo-router' ? '' : moduleName.slice('expo-router/'.length);
    return context.resolveRequest(
      context,
      path.join(expoRouterPackageDir, subpath),
      platform,
    );
  }

  if (moduleName.endsWith('setUpFuseboxReactDevToolsDispatcher')) {
    return context.resolveRequest(
      context,
      path.join(__dirname, 'src/shims/setUpFuseboxReactDevToolsDispatcher.js'),
      platform,
    );
  }

  if (moduleName.startsWith('@/')) {
    return context.resolveRequest(
      context,
      path.join(__dirname, 'src', moduleName.slice(2)),
      platform,
    );
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
