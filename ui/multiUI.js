// ui/multiUI.js
window.updateMultiUI = function () {

  const turn = document.getElementById("turnIndicator");

  if (turn) {
    if (gameOver) {
      turn.textContent = "Koniec hry";
    } else {
      const name =
        playerNames[multiplayerTurnPlayer] || "Hráč";
      turn.textContent = "🔵 Ťah: " + name;
    }
  }


  window.updateMultiUI = function () {
  renderTurnIndicatorMulti();
  renderPlayerHand();
  renderTableCard();
  renderAceDecision();
  renderForcedSuit();
  renderControls();


};


};
