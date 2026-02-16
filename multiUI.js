window.updateMultiUI = function () {

  // ===== ACTIVE PLAYER HIGHLIGHT =====
  document
    .querySelectorAll(".multi-player")
    .forEach(el => el.classList.remove("active"));

  const active = document.querySelector(
    `.multi-player.${multiplayerTurnPlayer}`
  );

  if (active) active.classList.add("active");

  // ===== TURN INDICATOR =====
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

};

function renderTurnIndicatorMulti() {

  if (!multiplayerMode) return;

  const ids = Object.keys(multiplayerHands || {});
  const current = multiplayerTurnPlayer;

  ids.forEach(id => {

    const el = document.querySelector(`[data-player-id="${id}"]`);
    if (!el) return;

    if (id === current) {
      el.classList.add("active-turn");
    } else {
      el.classList.remove("active-turn");
    }

  });
}
