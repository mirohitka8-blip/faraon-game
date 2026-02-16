window.renderPlayerHand = function () {
  const playerCards = document.getElementById("playerCards");
  if (!playerCards) return;

  playerCards.innerHTML = "";

  playerHand.forEach((card, i) => {
    const btn = document.createElement("button");
    btn.className = "card";

    if (selected.includes(i)) btn.classList.add("selected");

    const img = document.createElement("img");
    img.src = "cards/" + cardToFile(card);

    btn.appendChild(img);
    btn.onclick = () => toggleSelect(i);

    playerCards.appendChild(btn);
  });


  window.renderTableCard = function () {
  const table = document.getElementById("tableCard");
  if (!table) return;

  table.innerHTML = "";
  if (!tableCard) return;

  const img = document.createElement("img");
  img.src = "cards/" + cardToFile(tableCard);
  table.appendChild(img);
};

// ===== ACE DECISION UI =====
window.renderAceDecision = function () {

  const box = document.getElementById("aceDecision");
  if (!box) return;

  if (!waitingForAceDecision || gameOver) {
    box.style.display = "none";
    return;
  }

  // zobraz
  box.style.display = "flex";

  // PLAY ACE BUTTON
  const playBtn = document.getElementById("playAceBtn");
  if (playBtn) {
    playBtn.style.display =
      playerHand.some(c => c.startsWith("A"))
        ? "inline-block"
        : "none";
  }

  // STAND BUTTON – vždy viditeľný
  const standBtn = document.getElementById("standAceBtn");
  if (standBtn) {
    standBtn.style.display = "inline-block";
  }
};

// ===== FORCED SUIT UI =====
window.renderForcedSuit = function () {

  const box = document.getElementById("forcedSuitIndicator");
  const img = document.getElementById("forcedSuitImg");

  if (!box || !img) return;

  if (!forcedSuit || gameOver) {
    box.style.display = "none";
    return;
  }

  box.style.display = "flex";

  const map = {
    "♣": "leaf",
    "♥": "heart",
    "♦": "bell",
    "♠": "acorn"
  };

  img.src = "cards/" + map[forcedSuit] + "-icon@medium.png";
};

// ===== CONTROLS UI =====
window.renderControls = function () {

  const btn = document.getElementById("playSelectedBtn");
  if (!btn) return;

  // skryť pri game over
  if (gameOver) {
    btn.style.display = "none";
    return;
  }

  btn.style.display = "inline-block";

  // povolenie / zákaz
  const disabled =
    !playerTurn ||
    waitingForAceDecision ||
    waitingForSuit ||
    selected.length === 0;

  btn.disabled = disabled;
  btn.style.opacity = disabled ? "0.4" : "1";
};


};
