// ui/singleUI.js
window.updateSingleUI = function () {

  // ===== PC HAND (AI) =====
  const pc = document.getElementById("pcHand");
  if (pc) {
    pc.innerHTML = "";
    pcHand.forEach(() => {
      const back = document.createElement("div");
      back.className = "pc-card";
      pc.appendChild(back);
    });
  }

  // ===== TURN INDICATOR (SINGLE) =====
  const turn = document.getElementById("turnIndicator");
  if (turn) {
    if (gameOver) {
      turn.textContent = "Koniec hry";
    } else if (waitingForAceDecision) {
      turn.textContent = "⏸ Rozhodni sa (ESO)";
    } else if (playerTurn) {
      turn.textContent = "🟢 Tvoj ťah";
    } else {
      turn.textContent = "🤖 Ťah PC";
    }
  }

  // ===== SHARED RENDERS =====
  renderPlayerHand();
  renderTableCard();
  renderAceDecision();
  renderForcedSuit();
  renderControls();

};
