const React = require('react');
const { View } = require('react-native');

const zeroInsets = Object.freeze({
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
});

const initialWindowMetrics = Object.freeze({
  frame: {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  },
  insets: zeroInsets,
});

function SafeAreaProvider({ children }) {
  return React.createElement(React.Fragment, null, children);
}

function SafeAreaView({ children, edges, mode, ...props }) {
  return React.createElement(View, props, children);
}

function SafeAreaInsetsContextProvider({ children }) {
  return React.createElement(React.Fragment, null, children);
}

function useSafeAreaInsets() {
  return zeroInsets;
}

function useSafeAreaFrame() {
  return initialWindowMetrics.frame;
}

module.exports = {
  SafeAreaConsumer: ({ children }) => children(zeroInsets),
  SafeAreaInsetsContext: {
    Consumer: ({ children }) => children(zeroInsets),
    Provider: SafeAreaInsetsContextProvider,
  },
  SafeAreaProvider,
  SafeAreaView,
  initialWindowMetrics,
  useSafeAreaFrame,
  useSafeAreaInsets,
};
