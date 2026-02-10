// ui/multiUI.js
window.updateMultiUI = function () {

  document
  .querySelectorAll(".multi-player")
  .forEach(el => el.classList.remove("active"));

const active = document.querySelector(
  `.multi-player[data-player="${multiplayerTurnPlayer}"]`
);

players.forEach(p => {
  const el = document.querySelector(
    `.multi-player[data-player="${p.id}"] .player-cards`
  );
  if (el) el.textContent = `🃏 ${p.handCount}`;
});


if (active) active.classList.add("active");


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

function updatePlayerHUD(player, nameEl, cardsEl) {
  if (!player) return;

  nameEl.innerHTML = `
    ${player.name}
    <div class="card-count">🃏 ${player.handCount}</div>
  `;

  // protihráč nemá viditeľné karty
  cardsEl.innerHTML = "";
}

