const React = require('react');

const defaultValue = {
  isStackAnimationDisabled: false,
  openPreviewKey: undefined,
  setOpenPreviewKey: () => {},
};

function LinkPreviewContextProvider({ children }) {
  return React.createElement(React.Fragment, null, children);
}

function useLinkPreviewContext() {
  return defaultValue;
}

module.exports = {
  LinkPreviewContextProvider,
  useLinkPreviewContext,
};
