// ui/uiController.js
window.updateUIController = function () {
  if (window.multiplayerMode) {
    window.updateMultiUI();
  } else {
    window.updateSingleUI();
  }
};
