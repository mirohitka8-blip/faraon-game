console.log("Game.js loaded");

/* ==================================================
   AUDIO SYSTEM
================================================== */

//multiplayer
const socket = io("https://faraon-server.onrender.com");

socket.on("connect", () => {
  console.log("CONNECTED TO FARAON MULTIPLAYER SERVER");
});



const sounds = {};

function loadSound(name, volume = 1) {
  const audio = new Audio(`/sounds/${name}`);
  audio.volume = volume;
  audio.preload = "auto";
  sounds[name] = audio;
}

function playSound(name) {

  const s = sounds[name];
  if (!s) return;

  s.currentTime = 0;
  s.play().catch(()=>{});
}



/* ==================================================
   GLOBAL STATE
================================================== */

const suits = ["♥","♦","♣","♠"];
const values = ["7","8","9","10","J","Q","K","A"];

let discardPile = [];
let deck = [];
let playerHand = [];
let pcHand = [];
let tableCard = null;
let freePlay = false;
let cinematicFinish = false;
let cinematicLose = false;
let currentRoomCode = null;
let isHost = false;


let playerTurn = true;
let gameOver = false;

let forcedSuit = null;



let pendingDraw = 0;
let skipCount = 0;
let waitingForAceDecision = false;

let selected = [];

/* ==================================================
   DECK
================================================== */

function createDeck() {
  deck = [];
  suits.forEach(s => values.forEach(v => deck.push(v + s)));
  deck.sort(() => Math.random() - 0.5);
}

/* ==================================================
   START GAME
================================================== */

function startGame() {

  // RESET CARD TRANSFORMS
  document.querySelectorAll(".card, .pc-card").forEach(el => {
    el.style.transform = "";
    el.style.opacity = "";
    el.style.transition = "";
  });

  // RESET END SCREEN (WIN + LOSE)
  const end = document.getElementById("endScreen");
  if (end) {
    end.style.display = "none";
    end.classList.remove("active");
  }

  // RESET DARK OVERLAY (LOSE)
  const dark = document.getElementById("darkOverlay");
  if (dark) dark.classList.remove("active");

  // RESET WIN GLOW
  const box = document.querySelector("#endScreen .endBox");
  if (box) box.classList.remove("win-gold-glow");

  // CLEAN OLD FX STATES
  hideWinOutline();
  const title = document.getElementById("endTitle");
if (title) {
  title.classList.remove("win-pulse");
  title.classList.remove("lose-pulse");
}
  hideLoseEdge();
  clearLoseButtonGlow();

  // RESET GAME STATE
  discardPile = [];
  freePlay = false;

  createDeck();

  playerHand = deck.splice(0, 5);
  pcHand = deck.splice(0, 5);
  tableCard = deck.pop();

  pendingDraw = 0;
  skipCount = 0;
  forcedSuit = null;

  waitingForSuit = false;
  waitingForAceDecision = false;

  selected = [];

  gameOver = false;
  playerTurn = true;

  // UPDATE UI
  updateUI();
}


/* ==================================================
   CARD MAP
================================================== */

function cardToFile(card) {
  const v = card.slice(0,-1);
  const s = card.slice(-1);
  const sm = {"♠":"acorn","♥":"heart","♦":"bell","♣":"leaf"};
  const vm = {"7":"seven","8":"eight","9":"nine","10":"ten","J":"unter","Q":"ober","K":"king","A":"ace"};
  return sm[s] + "-" + vm[v] + ".png";
}

/* ==================================================
   RULES
================================================== */

function canPlay(card) {

  if (freePlay) return true;
  const v = card.slice(0, -1);
  const s = card.slice(-1);

  const tv = tableCard.slice(0, -1);
  const ts = tableCard.slice(-1);

  // ===== ESO STOP REŽIM =====
  if (skipCount > 0 && waitingForAceDecision) {
    return v === "A";
  }

  // ===== SEDMIČKOVÝ TREST =====
  if (pendingDraw > 0) {
    if (v === "7") return true;
    if (v === "J" && s === "♣") return true;
    return false;
  }

  // ===== AK JE NA STOLE ZELENÝ DOLNÍK → VŠETKO IDE =====
  if (tv === "J" && ts === "♣") return true;

  // ===== ZELENÝ DOLNÍK JE VŽDY HRATEĽNÝ =====
  if (v === "J" && s === "♣") return true;

  // ===== HORNÍK =====
  if (v === "Q") return true;

  // ===== VYNÚTENÁ FARBA =====
  if (forcedSuit) return s === forcedSuit;

  // ===== ŠTANDARD =====
  return v === tv || s === ts;
}

/* ==================================================
   PLAYER INPUT
================================================== */

function toggleSelect(i) {
  if (!playerTurn || gameOver || waitingForSuit || waitingForAceDecision) return;

  selected.includes(i)
    ? selected = selected.filter(x=>x!==i)
    : selected.push(i);

  updateUI();
}

function playAce() {

  if (!waitingForAceDecision || gameOver) return;

  const aceIndex = playerHand.findIndex(c => c.startsWith("A"));
  if (aceIndex === -1) return;

  if (multiplayerMode) {

    socket.emit("playCard", {
      room: currentRoomCode,
      cards: [ playerHand[aceIndex] ]
    });

    waitingForAceDecision = false;
    selected = [];
    return;
  }

  selected = [aceIndex];
  waitingForAceDecision = false;
  playSelected();
}




/* ==================================================
   PLAY SELECTED
================================================== */

function playSelected() {

  if (!playerTurn || waitingForAceDecision || waitingForSuit || gameOver) return;
  if (!selected.length) return;

  // =========================
  // MULTIPLAYER
  // =========================

  if (multiplayerMode) {

    socket.emit("playCard", {
      room: currentRoomCode,
      cards: selected.map(i => playerHand[i])
    });

    // okamžite zruš výber (server pošle nový stav)
    selected = [];
    updateUI();

    return;
  }

  // =========================
  // SINGLEPLAYER
  // =========================

  const cards = selected.map(i => playerHand[i]);

  const sameValue = cards.every(
    c => c.slice(0,-1) === cards[0].slice(0,-1)
  );

  const sameSuit = cards.every(
    c => c.slice(-1) === cards[0].slice(-1)
  );

  if (!sameValue && !sameSuit) {
    alert("Zlá kombinácia kariet");
    return;
  }

  const isBurned = sameValue && cards.length === 4;

  if (!isBurned && !canPlay(cards[0])) {
    alert("Spodná karta nemôže ísť na stôl");
    return;
  }

  cards.forEach((card, i) => {
    animatePlay(card, true, i * 120);
  });

  selected.sort((a,b)=>b-a).forEach(i => {
    playerHand.splice(i,1);
  });

  selected = [];

  for (const card of cards) {
    applyPlayedCard(card, true);
  }

  if (isBurned) {

    freePlay = true;
    pendingDraw = 0;
    skipCount = 0;
    forcedSuit = null;

    clearPenaltyUI();
    showBurnAnimation();

    if (playerHand.length === 0) {
      cinematicFinish = true;
      showEndScreenDelayed(true, 1300);
      return;
    }

    playerTurn = true;
    updateUI();
    return;
  }

  if (playerHand.length === 0) {

    cinematicFinish = true;
    playerTurn = false;
    updateUI();

    showEndScreenDelayed(true, 1300);
    return;
  }

  const lastCard = cards[cards.length - 1];

  if (lastCard.slice(0,-1) === "Q") {

    waitingForSuit = true;
    const chooser = document.getElementById("suitChooser");
    if (chooser) chooser.style.display = "flex";

    updateUI();
    return;
  }

  playerTurn = false;
  updateUI();
  setTimeout(pcTurn, 700);

  validateDeckIntegrity();
}


socket.on("gameOver", data => {

  multiplayerMode = false;

  const won = data.winner === socket.id;

  showEndScreen(won);
});



function showBurnAnimation() {


  playSound("fire.wav");

  console.log("🔥 BURN EFFECT TRIGGERED");
  spawnFireParticles(120);
  spawnSmokeParticles(100);

  const text = document.createElement("div");
  text.textContent = "SPÁLENÁ";

  text.style.position = "fixed";
  text.style.left = "50%";
  text.style.top = "50%";
  text.style.transform = "translate(-50%,-50%) scale(0.6)";
  text.style.fontSize = "64px";
  text.style.fontWeight = "900";
  text.style.letterSpacing = "4px";
  text.style.color = "#ffae00";
  text.style.pointerEvents = "none";
  text.style.zIndex = "99999999";
  text.style.opacity = "0";

  text.style.textShadow =
    "0 0 20px rgba(255,140,0,.9), 0 0 60px rgba(255,60,0,.8)";

  text.style.transition =
    "transform .35s cubic-bezier(.2,1.4,.4,1), opacity .35s ease";

  document.body.appendChild(text);

  // FORCE REFLOW
  text.getBoundingClientRect();

  requestAnimationFrame(() => {
    text.style.opacity = "1";
    text.style.transform = "translate(-50%,-50%) scale(1)";
  });

  setTimeout(() => {
    text.style.opacity = "0";
    text.style.transform = "translate(-50%,-50%) scale(1.2)";
  }, 700);

  setTimeout(() => text.remove(), 1100);

  // SCREEN SHAKE
  const game = document.getElementById("game");

  if (game) {

    game.classList.remove("shake-strong");
    void game.offsetWidth;
    game.classList.add("shake-strong");

    setTimeout(() => {
      game.classList.remove("shake-strong");
    }, 500);
  }
}

function spawnFireParticles(count = 30) {

  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;

  for (let i = 0; i < count; i++) {

    const p = document.createElement("div");

    const size = 10 + Math.random() * 16;

    p.style.position = "fixed";
    p.style.left = cx + "px";
    p.style.top = cy + "px";
    p.style.width = size + "px";
    p.style.height = size + "px";
    p.style.borderRadius = "50%";
    p.style.pointerEvents = "none";
    p.style.zIndex = "99999998";

    p.style.background =
      "radial-gradient(circle, #fff7c2, #ff9a00, #ff2a00)";

    const angle = Math.random() * Math.PI * 2;
    const dist = 120 + Math.random() * 200;

    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;

    p.style.transform = "translate(-50%,-50%) scale(1)";
    p.style.transition =
      "transform .9s ease-out, opacity .9s ease-out";

    document.body.appendChild(p);

    p.getBoundingClientRect();

    requestAnimationFrame(() => {

      p.style.transform =
        `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0.2)`;

      p.style.opacity = "0";
    });

    setTimeout(() => p.remove(), 1000);
  }
}

function spawnSmokeParticles(count = 18) {

  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;

  for (let i = 0; i < count; i++) {

    const p = document.createElement("div");

    const size = 40 + Math.random() * 60;

    p.style.position = "fixed";
    p.style.left = cx + "px";
    p.style.top = cy + "px";
    p.style.width = size + "px";
    p.style.height = size + "px";
    p.style.borderRadius = "50%";
    p.style.pointerEvents = "none";
    p.style.zIndex = "99999997";

    p.style.background =
      "radial-gradient(circle, rgba(200,200,200,.5), rgba(80,80,80,.25), transparent)";

    const angle = Math.random() * Math.PI * 2;
    const dist = 80 + Math.random() * 120;

    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist - 120; // ide hore

    p.style.transform = "translate(-50%,-50%) scale(0.7)";
    p.style.opacity = "0.7";

    p.style.transition =
      "transform 1.4s ease-out, opacity 1.4s ease-out";

    document.body.appendChild(p);

    p.getBoundingClientRect();

    requestAnimationFrame(() => {

      p.style.transform =
        `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(1.4)`;

      p.style.opacity = "0";
    });

    setTimeout(() => p.remove(), 1500);
  }
}


function launchWinConfetti() {

  const overlay = document.getElementById("tableOverlay");
  if (!overlay) return;

  const colors = [
    "#ffd700",
    "#ffae00",
    "#22c55e",
    "#16a34a",
    "#facc15",
    "#ffffff"
  ];

  

  const spawnWave = (amount, delay) => {

    setTimeout(() => {

      for (let i = 0; i < amount; i++) {

        const conf = document.createElement("div");

        const size = 6 + Math.random() * 12;

        let x = Math.random() * window.innerWidth;
        let y = -30;

        let speedY = 2 + Math.random() * 3;
        let speedX = -2 + Math.random() * 4;

        let rot = Math.random() * 360;
        let rotSpeed = -8 + Math.random() * 16;

        const wobble = Math.random() * 0.06 + 0.02;

        conf.style.position = "absolute";
        conf.style.left = x + "px";
        conf.style.top = y + "px";
        conf.style.width = size + "px";
        conf.style.height = size + "px";

        conf.style.background =
          colors[Math.floor(Math.random() * colors.length)];

        conf.style.borderRadius = "2px";
        conf.style.pointerEvents = "none";
        conf.style.opacity = "0.95";
        conf.style.zIndex = "999999";

        overlay.appendChild(conf);

        let t = 0;

        function fall() {

          t += wobble;

          speedY += 0.035; // gravity

          y += speedY;
          x += speedX + Math.sin(t) * 2.2;

          rot += rotSpeed;

          conf.style.top = y + "px";
          conf.style.left = x + "px";
          conf.style.transform = `rotate(${rot}deg)`;

          if (y < window.innerHeight + 50) {
            requestAnimationFrame(fall);
          } else {
            conf.remove();
          }
        }

        requestAnimationFrame(fall);
      }

    }, delay);
  };

  // ===== MULTI WAVE CONFETTI =====
  spawnWave(120, 0);      // instant burst
  spawnWave(100, 350);   // follow up
  spawnWave(80, 800);    // rain tail
}







function clearPenaltyUI() {

  const el = document.querySelector(".penalty-text");
  if (el) el.remove();

}


function backToMenu() {

  const end = document.getElementById("endScreen");
  const game = document.getElementById("game");
  const menu = document.getElementById("menuScreen");

  // zavri end screen
  if (end) end.classList.remove("active");
document.getElementById("darkOverlay").classList.remove("active");


  // skry hru
  if (game) game.style.display = "none";

  // zobraz menu
  if (menu) menu.style.display = "flex";

  // reset hry
  gameOver = false;

  // cleanup efekty
  document.querySelectorAll(
    ".confetti, .damage-flash, .rage-flash, #loseDarkOverlay"
  ).forEach(e => e.remove());
}

function impactShake() {

  if (cinematicLose) {
  playSound("boom.wav");
}

  const board = document.getElementById("gameInner");
  if (!board) return;

  board.classList.remove("shake-strong");
  void board.offsetWidth;
  board.classList.add("shake-strong");

  setTimeout(() => {
    board.classList.remove("shake-strong");
  }, 500);
}


/* ==================================================
   CARD EFFECTS
================================================== */

function applyPlayedCard(card, isPlayer) {


    freePlay = false;

  // ===== PRESUNIEME STARÚ STOLNÚ KARTU DO DISCARD =====
  if (tableCard !== null) {
    discardPile.push(tableCard);
  }

  // ===== NOVÁ KARTA IDE NA STÔL =====
  tableCard = card;

  const v = card.slice(0, -1);
  const s = card.slice(-1);

  // ===== RESET FORCED SUIT AK NIE JE HORNÍK =====
  if (v !== "Q") {
    forcedSuit = null;
  }

  // ===== ZELENÝ DOLNÍK (J♣) — ZRUŠÍ TREST =====
  if (v === "J" && s === "♣") {

    pendingDraw = 0;
    skipCount = 0;

    clearPenaltyUI();

    showGreenFlash();
    greenWave();

    return;
  }

  // ===== SEDMIČKA (+3 STACK) =====
  if (v === "7") {
    pendingDraw += 3;
    showPenalty(pendingDraw);
  }

  // ===== ESO (STOPKA) =====
  if (v === "A") {
    skipCount++;
  }

  // ===== HORNÍK (Q) — PC SI VYBERIE FARBU =====
  if (v === "Q" && !isPlayer) {
    forcedSuit = choosePcSuit();
  }
}


function adjustHandSpacing() {

  const hand = document.getElementById("playerCards");
  if (!hand) return;

  const count = playerHand.length;

  let gap = 18;

  if (count >= 10) gap = 4;
  if (count >= 14) gap = -8;
  if (count >= 18) gap = -18;
  if (count >= 22) gap = -28;

  hand.style.setProperty("--card-gap", gap + "px");
}




/* ==================================================
   DRAW
================================================== */

function debugCardCount() {

  const total =
    deck.length +
    playerHand.length +
    pcHand.length +
    discardPile.length +
    (tableCard ? 1 : 0);

  console.log("TOTAL CARDS:", total);
}

function drawCard() {

  if (!playerTurn || gameOver || waitingForSuit || waitingForAceDecision) return;

  // ===== MULTIPLAYER =====
  if (multiplayerMode) {

    socket.emit("drawCard", currentRoomCode);
    return;
  }

  // ===== SINGLEPLAYER =====

  // REFILL
  if (deck.length === 0) {
    refillDeck();
  }

  if (deck.length === 0) {
    triggerLoseSequence();
    return;
  }

  // ESO STOP FIX
  if (skipCount > 0) {
    skipCount = 0;
  }

  // +3 PENALTY
  if (pendingDraw > 0) {

    for (let i = 0; i < pendingDraw && deck.length; i++) {
      animateDraw(true, i * 120);
      playerHand.push(deck.pop());
    }

    pendingDraw = 0;

    playerTurn = false;
    updateUI();
    setTimeout(pcTurn, 700);

    validateDeckIntegrity();
    return;
  }

  // NORMAL DRAW
  animateDraw(true);
  playerHand.push(deck.pop());

  playerTurn = false;
  updateUI();
  setTimeout(pcTurn, 600);

  validateDeckIntegrity();
}



window.testConfetti = function() {

  const c = document.createElement("div");

  c.style.position = "fixed";
  c.style.top = "50%";
  c.style.left = "50%";
  c.style.width = "30px";
  c.style.height = "30px";
  c.style.background = "gold";
  c.style.zIndex = "999999999";
  c.style.transform = "translate(-50%,-50%)";

  document.body.appendChild(c);

  setTimeout(() => c.remove(), 3000);
}


/* ==================================================
   PC TURN
================================================== */

function pcTurn() {

  if (multiplayerMode) return;
  if (gameOver) return;

  // ===== PC NEMÁ KARTY (PREHRA HRÁČA) =====
  if (!pcHand.length) {

    cinematicFinish = true;

    setTimeout(() => {
      finishGame(false);
    }, 1200);

    return;
  }

  // ===== STOP (ESO) CHAIN =====
  if (skipCount > 0) {

    const aceIdx = pcHand.findIndex(c => c.startsWith("A"));

    // PC ODBIJE ESOM
    if (aceIdx !== -1) {

      const card = pcHand.splice(aceIdx, 1)[0];

      animatePlay(card, false);
      applyPlayedCard(card, false);

      waitingForAceDecision = true;
      playerTurn = true;

      const box = document.getElementById("aceDecision");
      const playBtn = document.getElementById("playAceBtn");

      if (box) box.style.display = "flex";

      if (playBtn) {
        playBtn.style.display =
          playerHand.some(c => c.startsWith("A"))
            ? "inline-block"
            : "none";
      }

      updateUI();
      return;
    }

    // PC NEMÁ ESO → STOJÍ
    skipCount = Math.max(0, skipCount - 1);

    waitingForAceDecision = false;

    playerTurn = true;
    updateUI();

    return;
  }

  // ===== +3 TREST =====
  if (pendingDraw > 0) {

    // GREEN JACK RUŠÍ
    const greenIdx = pcHand.indexOf("J♣");

    if (greenIdx !== -1) {

      const card = pcHand.splice(greenIdx, 1)[0];

      animatePlay(card, false);

      pendingDraw = 0;
      skipCount = 0;
      forcedSuit = null;

      clearPenaltyUI();

      applyPlayedCard(card, false);

      playerTurn = true;
      updateUI();

      return;
    }

    // REŤAZ SEDMOU
    const sevenIdx = pcHand.findIndex(c => c.startsWith("7"));

    if (sevenIdx !== -1) {

      const card = pcHand.splice(sevenIdx, 1)[0];

      animatePlay(card, false);
      applyPlayedCard(card, false);

      playerTurn = true;
      updateUI();
      return;
    }

    // PC MUSÍ ŤAHAŤ
    const amount = pendingDraw;

    for (let i = 0; i < amount && deck.length; i++) {
      animateDraw(false, i * 120);
      pcHand.push(deck.pop());
    }

    pendingDraw = 0;

    playerTurn = true;
    updateUI();
    return;
  }

  // ===== NORMÁLNY ŤAH =====
  for (let i = 0; i < pcHand.length; i++) {

    if (canPlay(pcHand[i])) {

      const card = pcHand.splice(i, 1)[0];

      animatePlay(card, false);
      applyPlayedCard(card, false);

      // ===== ESO → DECISION =====
      if (card.startsWith("A")) {

        waitingForAceDecision = true;
        playerTurn = true;

        const box = document.getElementById("aceDecision");
        const playBtn = document.getElementById("playAceBtn");

        if (box) box.style.display = "flex";

        if (playBtn) {
          playBtn.style.display =
            playerHand.some(c => c.startsWith("A"))
              ? "inline-block"
              : "none";
        }

        updateUI();
        return;
      }

      // ===== PC VYHRAL POSLEDNOU KARTOU =====
      if (!pcHand.length) {

        cinematicFinish = true;

        setTimeout(() => {
          finishGame(false);
        }, 1200);

        return;
      }

      playerTurn = true;
      updateUI();
      return;
    }
  }

  // ===== PC NEMÁ ŤAH → ŤAHÁ =====
  if (deck.length) {
    animateDraw(false);
    pcHand.push(deck.pop());
  }

  playerTurn = true;
  updateUI();
  validateDeckIntegrity();
}



/* ==================================================
   FINISH GAME (SAFE DELAY)
================================================== */

function finishGame(won){

  if (gameOver) return;

  if (won) {

    gameOver = true;

    setTimeout(()=>{
      showEndScreen(true);
    },1000);

  } else {

    triggerLoseSequence("");

  }
}




function refillDeck() {

  // nechávame poslednú kartu na stole
  if (discardPile.length === 0) {
    console.warn("NO CARDS TO REFILL");
    return;
  }

  console.log("♻ REFILLING DECK:", discardPile.length);

  deck = discardPile.slice();
  discardPile = [];

  // zamiešaj
  deck.sort(() => Math.random() - 0.5);
}


/* ==================================================
   UI + EFFECTS
================================================== */

function showPenalty(amount) {

  playSound("hit.wav");

  console.log("SHOW PENALTY", amount);

  // ===== TEXT POP =====
  const old = document.getElementById("penaltyPop");
  if (old) old.remove();

  const el = document.createElement("div");
  el.id = "penaltyPop";
  el.textContent = "+" + amount;

  // STYLE
  el.style.position = "fixed";
  el.style.left = "50%";
  el.style.top = "45%";
  el.style.transform = "translate(-50%, -50%) scale(0.4)";
  el.style.fontSize = "72px";
  el.style.fontWeight = "900";
  el.style.color = "#ff3333";
  el.style.pointerEvents = "none";
  el.style.zIndex = "99999999";
  el.style.opacity = "0";

  el.style.textShadow =
    "0 0 15px rgba(255,0,0,.9), 0 0 40px rgba(255,0,0,.6)";

  el.style.transition =
    "transform .35s cubic-bezier(.2,1.4,.4,1), opacity .35s ease";

  document.body.appendChild(el);

  // FORCE RENDER
  el.getBoundingClientRect();

  // POP IN
  requestAnimationFrame(() => {
    el.style.opacity = "1";
    el.style.transform = "translate(-50%, -50%) scale(1.3)";
  });

  // SETTLE
  setTimeout(() => {
    el.style.transform = "translate(-50%, -50%) scale(1)";
  }, 160);

  // FADE OUT
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translate(-50%, -50%) scale(0.9)";
  }, 520);

  // CLEANUP
  setTimeout(() => {
    el.remove();
  }, 900);


  // ===== SCREEN SHAKE =====
  const game = document.getElementById("game");

  if (game) {

    // RESET
    game.classList.remove("shake-light","shake-medium","shake-strong");
    void game.offsetWidth;

   if (amount >= 12) {
  game.classList.add("shake-ultra");     // TOTAL WAR
}
else if (amount >= 9) {
  game.classList.add("shake-strong");    // HARD HIT
}
else if (amount >= 6) {
  game.classList.add("shake-medium");    // MEDIUM HIT
}
else {
  game.classList.add("shake-light");     // LIGHT TAP
}

    // CLEANUP
    setTimeout(() => {
      game.classList.remove("shake-light","shake-medium","shake-strong");
    }, 600);
  }
}





function updateUI() {

  // ===== ESO DECISION =====
  if (waitingForAceDecision && !gameOver) {
    const box = document.getElementById("aceDecision");
    const playBtn = document.getElementById("playAceBtn");

    if (box) box.style.display = "flex";
    if (playBtn) {
      playBtn.style.display =
        playerHand.some(c => c.startsWith("A"))
          ? "inline-block"
          : "none";
    }

  } else {
    const box = document.getElementById("aceDecision");
    if (box) box.style.display = "none";
  }

  // ===== PC HAND =====
  const pc = document.getElementById("pcHand");
  if (pc) {
    pc.innerHTML = "";
    pcHand.forEach(() => {
      const back = document.createElement("div");
      back.className = "pc-card";
      pc.appendChild(back);
    });
  }

  // ===== TABLE CARD =====
  const table = document.getElementById("tableCard");
  if (table) {
    table.innerHTML = "";
    if (tableCard) {
      const img = document.createElement("img");
      img.src = "/cards/" + cardToFile(tableCard);
      table.appendChild(img);
    }
  }

  // ===== PLAYER HAND =====
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

  // ===== PLAY BUTTON =====
  const playBtn = document.getElementById("playSelectedBtn");
  if (playBtn) {
    playBtn.style.display =
      playerTurn &&
      selected.length &&
      !waitingForAceDecision &&
      !waitingForSuit &&
      !gameOver
        ? "inline-block"
        : "none";
  }

  // ===== FORCED SUIT =====
 const indicator = document.getElementById("forcedSuitIndicator");
const suitImg = document.getElementById("forcedSuitImg");

if (indicator && suitImg) {

  if (forcedSuit) {

    indicator.style.display = "flex";

    const map = {
      "♣": "leaf-icon@medium.png",
      "♥": "heart-icon@medium.png",
      "♦": "bell-icon@medium.png",
      "♠": "acorn-icon@medium.png"
    };

    suitImg.src = "cards/" + map[forcedSuit];

  } else {

    indicator.style.display = "none";

  }
}


  // ===== TURN INDICATOR =====
  const turn = document.getElementById("turnIndicator");
  if (turn) {
    turn.textContent =
      gameOver
        ? "Koniec hry"
        : waitingForAceDecision
        ? "⏸ Rozhodni sa (ESO)"
        : playerTurn
        ? "🟢 Tvoj ťah"
        : "🤖 Ťah PC";
  }
  adjustHandLayout();


}

function validateDeckIntegrity() {

  const all = [
    ...deck,
    ...playerHand,
    ...pcHand,
    ...discardPile,
    tableCard
  ].filter(Boolean);

  const unique = new Set(all);

  if (all.length !== unique.size || all.length !== 32) {
  gameOver = true;
  alert("CARD ENGINE ERROR — STOPPING GAME");
}

  if (all.length !== unique.size) {
    console.error("❌ DUPLICATE CARD DETECTED", all);
  }

  if (all.length !== 32) {
    console.error("❌ CARD COUNT ERROR:", all.length);
  }
}


function adjustHandLayout() {

  const hand = document.getElementById("playerCards");
  if (!hand) return;

  const count = playerHand.length;

  let gap = 18;
  let scale = 1;

  if (count >= 10) {
    gap = 14;
    scale = 0.97;
  }

  if (count >= 14) {
    gap = 8;
    scale = 0.94;
  }

  if (count >= 18) {
    gap = 2;
    scale = 0.9;
  }

  if (count >= 22) {
    gap = -6;
    scale = 0.85;
  }

  hand.style.setProperty("--card-gap", gap + "px");
  hand.style.setProperty("--card-scale", scale);
}



function restartGame() {

  const end = document.getElementById("endScreen");

  if (end) {
    end.style.display = "none";
    end.classList.remove("active");
  }

  const dark = document.getElementById("darkOverlay");
  if (dark) dark.classList.remove("active");

  gameOver = false;

  startGame();
}

function setSuit(suit) {

  if (gameOver) return;

  /* =========================
     MULTIPLAYER
  ========================= */

  if (multiplayerMode) {

    socket.emit("setSuit", {
      room: currentRoomCode,
      suit
    });

    // lokálne len zavri UI
    waitingForSuit = false;

    const chooser = document.getElementById("suitChooser");
    if (chooser) chooser.style.display = "none";

    return;
  }

  /* =========================
     SINGLEPLAYER (PC MODE)
  ========================= */

  forcedSuit = suit;
  waitingForSuit = false;

  const chooser = document.getElementById("suitChooser");
  if (chooser) chooser.style.display = "none";

  // ide PC
  playerTurn = false;
  updateUI();

  setTimeout(pcTurn, 600);
}


function standAce() {

  if (!waitingForAceDecision || gameOver) return;

  if (multiplayerMode) {

    socket.emit("standAce", {
      room: currentRoomCode
    });

    waitingForAceDecision = false;
    return;
  }

  // singleplayer fallback
  waitingForAceDecision = false;
  skipCount--;

  playerTurn = false;
  updateUI();
  setTimeout(pcTurn, 600);
}




function showGreenFlash(){
  const f=document.createElement("div");
  f.style.position="fixed";
  f.style.inset="0";
  f.style.background="rgba(0,255,120,.6)";
  f.style.zIndex="999999";
  f.style.opacity="0";
  f.style.transition=".15s";

  document.body.appendChild(f);

  requestAnimationFrame(()=>f.style.opacity="1");

  setTimeout(()=>f.style.opacity="0",120);
  setTimeout(()=>f.remove(),300);
}

function greenWave() {

  const wave = document.createElement("div");

  wave.style.position = "fixed";
  wave.style.left = "50%";
  wave.style.top = "50%";
  wave.style.width = "20px";
  wave.style.height = "20px";
  wave.style.borderRadius = "50%";
  wave.style.border = "4px solid rgba(0,255,120,.9)";
  wave.style.transform = "translate(-50%,-50%) scale(0)";
  wave.style.pointerEvents = "none";
  wave.style.zIndex = "9999999";
  wave.style.opacity = "1";

  wave.style.transition =
    "transform .45s ease-out, opacity .45s ease-out";

  document.body.appendChild(wave);

  requestAnimationFrame(() => {
    wave.style.transform = "translate(-50%,-50%) scale(18)";
    wave.style.opacity = "0";
  });

  setTimeout(() => wave.remove(), 500);
}


function animatePlay(card, fromPlayer = true, delay = 0) {

  const overlay = document.getElementById("tableOverlay");
  const tableImg = document.querySelector("#tableCard img");
  if (!overlay || !tableImg) return;

  const rect = tableImg.getBoundingClientRect();

  setTimeout(() => {

    playSound("card.wav");

    const el = document.createElement("div");

    const rot = (Math.random() * 10 - 5);

    el.style.position = "fixed";
    el.style.width = "90px";
    el.style.height = "130px";
    el.style.background = `url("/cards/${cardToFile(card)}") center/cover`;
    el.style.borderRadius = "10px";
    el.style.pointerEvents = "none";
    el.style.zIndex = "9999";

    // GPU hint
    el.style.willChange = "transform, opacity";

    const startX = window.innerWidth / 2;
    const startY = fromPlayer
      ? window.innerHeight * 0.82
      : window.innerHeight * 0.18;

    const targetX = rect.left + rect.width / 2;
    const targetY = rect.top + rect.height / 2;

    // START STATE (ONLY TRANSFORM)
    el.style.transform =
      `translate3d(${startX}px, ${startY}px, 0) rotate(${rot}deg) scale(1.05)`;

    el.style.opacity = "1";

    const speed = cinematicFinish ? 1.2 : 0.42;

el.style.transition =
  `transform ${speed}s cubic-bezier(.2,.9,.2,1), opacity .2s ease`;


    overlay.appendChild(el);

    requestAnimationFrame(() => {

      el.style.transform =
        `translate3d(${targetX}px, ${targetY}px, 0) rotate(${rot * 0.3}deg) scale(1)`;

    });

    setTimeout(() => {
      el.style.opacity = "0";
    }, 280);

    setTimeout(() => {

  el.remove();

  if (cinematicFinish) {

    impactShake();

    
    cinematicFinish = false;
  }

}, cinematicFinish ? 1300 : 520);



  }, delay);
}

function triggerLoseSequence() {

  cinematicLose = true;
  playSound("lose.wav");

  if (gameOver) return;
  gameOver = true;

  // RED FLASH
const flash = document.createElement("div");

flash.style.position = "fixed";
flash.style.inset = "0";
flash.style.background = "rgba(255,0,0,.35)";
flash.style.zIndex = "9999999";
flash.style.pointerEvents = "none";
flash.style.opacity = "0";
flash.style.transition = "opacity .12s";

document.body.appendChild(flash);

requestAnimationFrame(() => flash.style.opacity = "1");

setTimeout(() => flash.style.opacity = "0", 120);
setTimeout(() => flash.remove(), 260);


  // screen shake
  const board = document.getElementById("gameInner");

if (board) {

  board.classList.remove("shake");
  void board.offsetWidth;
  board.classList.add("shake");

  setTimeout(() => {
    board.classList.remove("shake");
  }, 300);
}


  setTimeout(() => {
    board.classList.remove("shake");
  }, 300);

  // dark overlay
  document.getElementById("darkOverlay").classList.add("active");

  const dark = document.getElementById("darkOverlay");
if (dark) {
  dark.style.pointerEvents = "none";
}

  // text
 const title = document.getElementById("endTitle");

title.innerText = "💀 PREHRAL SI";
title.classList.add("lose-pulse");

  const reasonBox = document.getElementById("loseReason");

if (reasonBox) {
  reasonBox.innerText = "";
  reasonBox.style.display = "none";
}


  // show screen
 const end = document.getElementById("endScreen");

if (end) {
  end.style.display = "flex";
  end.classList.add("active");
  // CARD EXPLOSION
  explodeCards();

  // FORCE ABOVE DARK OVERLAY
  end.style.zIndex = "10000000";
}

}


function launchConfetti() {

  const colors = [
    "#ffd700", // gold
    "#22c55e",
    "#3b82f6",
    "#ef4444",
    "#a855f7",
    "#f97316",
    "#ffffff"
  ];

  const total = 420;          // celkový počet konfiet
  const duration = 6000;     // ako dlho sa budú spawnovať (ms)
  const interval = duration / total;

  let spawned = 0;

  const spawnTimer = setInterval(() => {

    if (spawned >= total) {
      clearInterval(spawnTimer);
      return;
    }

    spawned++;

    const conf = document.createElement("div");
    conf.className = "confetti";

    const size = 6 + Math.random() * 10;

    let x = Math.random() * window.innerWidth;
    let y = -40;

    const fallTime = 6 + Math.random() * 4; // pomalý pád

    const drift = (Math.random() - 0.5) * 220;
    const rotate = Math.random() * 720;

    conf.style.position = "fixed";
    conf.style.width = size + "px";
    conf.style.height = size * 1.4 + "px";
    conf.style.borderRadius = "2px";

    conf.style.left = x + "px";
    conf.style.top = y + "px";

    conf.style.background =
      colors[Math.floor(Math.random() * colors.length)];

    conf.style.pointerEvents = "none";
    conf.style.opacity = "0.95";
    conf.style.zIndex = "9999999";

    conf.style.transition =
      `transform ${fallTime}s cubic-bezier(.18,.8,.22,1), opacity ${fallTime}s ease`;

    document.body.appendChild(conf);

    // force render
    conf.getBoundingClientRect();

    requestAnimationFrame(() => {

      conf.style.transform =
        `translate(${drift}px, ${window.innerHeight + 200}px) rotate(${rotate}deg)`;

      conf.style.opacity = "0.6";
    });

    setTimeout(() => conf.remove(), fallTime * 1000 + 200);

  }, interval);
}



function playLoseAnimation() {

  const game = document.getElementById("game");

  if (!game) return;

  // ===== RAGE FLASH =====
  const flash = document.createElement("div");

  flash.style.position = "fixed";
  flash.style.inset = "0";
  flash.style.background = "rgba(255, 0, 0, 0.35)";
  flash.style.zIndex = "99999999";
  flash.style.pointerEvents = "none";
  flash.style.opacity = "0";
  flash.style.transition = "opacity .12s";

  document.body.appendChild(flash);

  requestAnimationFrame(() => {
    flash.style.opacity = "1";
  });

  setTimeout(() => {
    flash.style.opacity = "0";
  }, 120);

  setTimeout(() => flash.remove(), 260);

  // ===== BRUTAL SHAKE =====
  game.classList.remove("shake-strong");
  void game.offsetWidth;
  game.classList.add("shake-strong");

  setTimeout(() => {
    game.classList.remove("shake-strong");
  }, 500);

  // ===== THROW CARDS =====
  const cards = document.querySelectorAll(
    "#playerCards .card, #pcHand .pc-card"
  );

  cards.forEach(card => {

    const rx = (Math.random() - 0.5) * 600;
    const ry = (Math.random() - 0.5) * 400;
    const rot = (Math.random() - 0.5) * 720;

    card.style.transition =
      "transform .6s cubic-bezier(.2,.8,.2,1), opacity .6s";

    card.style.transform =
      `translate(${rx}px, ${ry}px) rotate(${rot}deg) scale(0.3)`;

    card.style.opacity = "0";
  });

  // ===== DARKEN SCREEN =====
  const dark = document.createElement("div");

  dark.id = "loseDarkOverlay";
  dark.style.position = "fixed";
  dark.style.inset = "0";
  dark.style.background = "rgba(0,0,0,.6)";
  dark.style.zIndex = "5000";
  dark.style.pointerEvents = "none";
  dark.style.opacity = "0";
  dark.style.transition = "opacity .4s";

  document.body.appendChild(dark);

  requestAnimationFrame(() => {
    dark.style.opacity = "1";
  });

}


function animateDraw(toPlayer = true, delay = 0) {

  const overlay = document.getElementById("tableOverlay");
  const deckEl = document.getElementById("deck");
  if (!overlay || !deckEl) return;

  const d = deckEl.getBoundingClientRect();

  setTimeout(() => {

    playSound("draw.wav");

    const el = document.createElement("div");

    el.style.position = "fixed";
    el.style.width = "70px";
    el.style.height = "100px";
    el.style.background = 'url("/cards/back.png") center/cover';
    el.style.borderRadius = "8px";
    el.style.pointerEvents = "none";
    el.style.zIndex = "9999";

    el.style.willChange = "transform, opacity";

    const startX = d.left + d.width / 2;
    const startY = d.top + d.height / 2;

    const endY = toPlayer
      ? window.innerHeight * 0.78
      : window.innerHeight * 0.22;

    el.style.transform =
      `translate3d(${startX}px, ${startY}px, 0)`;

    el.style.transition =
      "transform .38s cubic-bezier(.2,.8,.2,1), opacity .18s";

    overlay.appendChild(el);

    requestAnimationFrame(() => {

      el.style.transform =
        `translate3d(${startX}px, ${endY}px, 0)`;

      el.style.opacity = "0";
    });

    setTimeout(() => el.remove(), 420);

  }, delay);
}


/* ==================================================
   END SCREEN
================================================== */

function showEndScreen(won) {

  gameOver = true;
  cinematicLose = false;

  const screen = document.getElementById("endScreen");
  const title = document.getElementById("endTitle");
  const restartBtn = document.getElementById("restartBtn");
  const menuBtn = document.getElementById("menuBtn");
  const game = document.getElementById("game");

  if (!screen || !title || !restartBtn || !menuBtn || !game) {
    console.error("END SCREEN ELEMENT MISSING");
    return;
  }

  // ===== RESET =====
  title.className = "";
  restartBtn.className = "";
  menuBtn.className = "";
  game.classList.remove("lose-rage");

  if (won) {

    playSound("win.wav");

    // ===== TEXT =====
    title.textContent = "🏆 VYHRAL SI!";
title.classList.add("win-pulse");


    // ===== GLOW =====
    title.classList.add("win-glow");

    // ===== BUTTON STYLE =====
    restartBtn.classList.add("win");
    menuBtn.classList.add("win");

    // ===== CONFETTI =====
    launchConfetti();

  } else {

    // ===== TEXT =====
    title.textContent = "💀 PREHRAL SI";

    // ===== RED GLOW =====
    title.classList.add("lose-glow");

    // ===== BUTTON STYLE =====
    restartBtn.classList.add("lose");
    menuBtn.classList.add("lose");

    // ===== RAGE SHAKE =====
    void game.offsetWidth;
    game.classList.add("lose-rage");
    // ===== CARD EXPLOSION =====
    explodeCards();

  }
  // ===== SHOW SCREEN =====
screen.style.display = "flex";
screen.classList.add("active");

}

function explodeCards() {

  const cards = document.querySelectorAll(
    "#playerCards .card, #pcHand .pc-card"
  );

  cards.forEach(card => {

    const rx = (Math.random() - 0.5) * 800;
    const ry = (Math.random() - 0.5) * 600;
    const rot = (Math.random() - 0.5) * 720;

    card.style.transition =
      "transform .8s cubic-bezier(.2,.8,.2,1), opacity .8s ease";

    requestAnimationFrame(() => {

      card.style.transform =
        `translate(${rx}px, ${ry}px) rotate(${rot}deg) scale(0.6)`;

      card.style.opacity = "0";
    });

  });

}


function showEndScreenDelayed(won, delay = 1000) {

  // necháme dobehnúť animácie poslednej karty
  setTimeout(() => {

    if (gameOver) return;

    gameOver = true;
    showEndScreen(won);

  }, delay);

}

let multiplayerMode = false;
let multiplayerHands = {};
let multiplayerTurnPlayer = null;

function initMultiplayerGame(data) {

  multiplayerMode = true;

  multiplayerHands = data.hands;
  tableCard = data.tableCard;
  multiplayerTurnPlayer = data.turnPlayer;

  playerHand = multiplayerHands[socket.id];

  playerTurn = multiplayerTurnPlayer === socket.id;

  playerTurn = multiplayerTurnPlayer === socket.id;
selected = [];


  updateUI();
}

/* ==================================================
   HELPERS
================================================== */

function choosePcSuit(){
  const c={"♥":0,"♦":0,"♣":0,"♠":0};
  pcHand.forEach(k=>c[k.slice(-1)]++);
  return Object.keys(c).sort((a,b)=>c[b]-c[a])[0];
}

function hideWinOutline(){}
function hideLoseEdge(){}
function clearLoseButtonGlow(){}

socket.on("roomJoined", data => {

  console.log("ROOM JOINED RAW:", data);

  // SAFE READ
  const code = data.roomCode;

  currentRoomCode = code;
  isHost = data.isHost;

  // UI SHOW
  const lobby = document.getElementById("multiplayerLobby");
  const roomInfo = document.getElementById("roomInfo");
  const codeLabel = document.getElementById("roomCodeLabel");

  if (lobby) lobby.style.display = "flex";
  if (roomInfo) roomInfo.style.display = "block";

  if (codeLabel) {
    codeLabel.textContent = code;
  }

  updatePlayerList(data.players || []);

  // HOST BUTTON
  const startBtn = document.getElementById("startGameBtn");
  if (startBtn) {
    startBtn.style.display = isHost ? "block" : "none";
  }

});



socket.on("roomUpdate", data => {

  updatePlayerList(data.players, data.host);
  // === HOST CHECK ===
  isHost = data.host === socket.id;

  const startBtn = document.getElementById("startGameBtn");
  if (startBtn) {
    startBtn.style.display = isHost ? "block" : "none";
  }

});


socket.on("gameStarted", data => {

  console.log("GAME STARTED", data);

  multiplayerMode = true;

  // skry lobby
  document.getElementById("multiplayerLobby").style.display = "none";

  // zobraz hru
  document.getElementById("game").style.display = "block";

  // init multiplayer state
  multiplayerHands = data.hands;
  tableCard = data.tableCard;

  forcedSuit = data.forcedSuit ?? null;
  pendingDraw = data.pendingDraw ?? 0;
  skipCount = data.skipCount ?? 0;

  multiplayerTurnPlayer = data.order[data.turnIndex];

  playerHand = multiplayerHands[socket.id];

  playerTurn = multiplayerTurnPlayer === socket.id;

  selected = [];
  waitingForSuit = false;
  waitingForAceDecision = false;

  gameOver = false;

  updateUI();

});




  socket.on("gameUpdate", data => {

  console.log("GAME UPDATE:", data);

  multiplayerHands = data.hands;
  tableCard = data.tableCard;

  forcedSuit = data.forcedSuit ?? null;
  pendingDraw = data.pendingDraw ?? 0;
  skipCount = data.skipCount ?? 0;

  multiplayerTurnPlayer = data.turnPlayer;
  playerTurn = multiplayerTurnPlayer === socket.id;

  playerHand = multiplayerHands[socket.id] || [];

  selected = [];

  // =========================
  // QUEEN (HORNÍK)
  // =========================

  if (data.queenDecision === true && playerTurn) {

    waitingForSuit = true;

    const chooser = document.getElementById("suitChooser");

    if (chooser) {
      chooser.style.display = "flex";
      console.log("OPENING SUIT CHOOSER");
    }

  } else {

    waitingForSuit = false;

    const chooser = document.getElementById("suitChooser");
    if (chooser) chooser.style.display = "none";
  }

  // =========================
  // ACE
  // =========================

  waitingForAceDecision =
    data.aceDecision === true && playerTurn;

  // =========================
  // FX
  // =========================

  if (data.effects?.burn) {
    showBurnAnimation();
  }

  updateUI();
});









  socket.on("errorMessage", msg => {
  alert(msg);
  });

  socket.on("kicked", () => {

  alert("Bol si vyhodený z miestnosti");

  currentRoomCode = null;

  document.getElementById("multiplayerLobby").style.display = "none";
  document.getElementById("menuScreen").style.display = "flex";
  });

  function updatePlayerList(players = [], hostId) {

  if (!Array.isArray(players)) return;

  const list = document.getElementById("playerList");
  if (!list) return;

  list.innerHTML = "";

  players.forEach(p => {

    const row = document.createElement("div");
    row.className = "player-row";

    let name = p.name;

    if (p.id === socket.id) {
      name += " (TY)";
    }

    if (p.id === hostId) {
      row.classList.add("player-host");
      name = "👑 " + name;
    }

    row.innerHTML = `
      <span>${name}</span>
      <span>${p.ready ? "✅" : "⏳"}</span>
    `;

    if (isHost && p.id !== socket.id) {

      const kickBtn = document.createElement("button");
      kickBtn.textContent = "❌";
      kickBtn.style.background = "none";
      kickBtn.style.border = "none";
      kickBtn.style.cursor = "pointer";

      kickBtn.onclick = () => {
        socket.emit("kickPlayer", {
          code: currentRoomCode,
          playerId: p.id
        });
      };

      row.appendChild(kickBtn);
    }

    list.appendChild(row);
  });
}




/* ==================================================
   EVENTS
================================================== */

document.addEventListener("DOMContentLoaded", () => {

  // =============================
  // LOAD GAME SOUNDS
  // =============================

  loadSound("boom.wav", 0.9);
  loadSound("card.wav", 0.7);
  loadSound("click.wav", 0.5);
  loadSound("draw.wav", 0.6);
  loadSound("fire.wav", 0.9);
  loadSound("hit.wav", 0.8);
  loadSound("lose.wav", 0.8);
  loadSound("win.wav", 0.8);

  // =============================
  // UI ELEMENTS
  // =============================

  const singleBtn = document.getElementById("singlePlayerBtn");
  const multiplayerBtn = document.getElementById("multiplayerBtn");
  if (multiplayerBtn) {
  multiplayerBtn.onclick = () => {

    document.getElementById("menuScreen").style.display = "none";
    document.getElementById("multiplayerLobby").style.display = "flex";

  };
}

const backLobbyBtn = document.getElementById("backFromLobbyBtn");

if (backLobbyBtn) {
  backLobbyBtn.onclick = () => {

    document.getElementById("multiplayerLobby").style.display = "none";
    document.getElementById("menuScreen").style.display = "flex";

  };
}


  const multiBtn = document.querySelector(".menu-btn.disabled") || document.getElementById("multiBtn");

  const playBtn = document.getElementById("playSelectedBtn");
  const deckBtn = document.getElementById("deck");
  const restartBtn = document.getElementById("restartBtn");
  const menuBtn = document.getElementById("menuBtn");
  const acePlayBtn = document.getElementById("playAceBtn");
  const aceStandBtn = document.getElementById("standAceBtn");

  const createRoomBtn = document.getElementById("createRoomBtn");
  if (createRoomBtn) {
  createRoomBtn.onclick = () => {

    const name = document.getElementById("playerNameInput").value.trim();

    if (!name) {
      alert("Zadaj meno");
      return;
    }

    socket.emit("createRoom", name);

  };
  }

  const joinRoomBtn = document.getElementById("joinRoomBtn");

if (joinRoomBtn) {
  joinRoomBtn.onclick = () => {

    const name = document.getElementById("playerNameInput").value.trim();
    const code = document.getElementById("roomCodeInput").value.trim().toUpperCase();

    if (!name || !code) {
      alert("Zadaj meno a kód miestnosti");
      return;
    }

    socket.emit("joinRoom", { name, code });
  };
}

const readyBtn = document.getElementById("readyBtn");

if (readyBtn) {
  const readyBtn = document.getElementById("readyBtn");

if (readyBtn) {
  readyBtn.onclick = () => {

    if (!currentRoomCode) {
      console.warn("NO ROOM CODE");
      return;
    }

    console.log("READY CLICK:", currentRoomCode);

    socket.emit("playerReady", currentRoomCode);
  };
}

}

const startGameBtn = document.getElementById("startGameBtn");

if (startGameBtn) {
  startGameBtn.onclick = () => {
    console.log("START GAME CLICK", currentRoomCode);
    if (!currentRoomCode) return;

    socket.emit("startGame", currentRoomCode);
  };
}



  // =============================
  // BUTTON EVENTS WITH SOUND
  // =============================

  if (singleBtn) {
    singleBtn.onclick = () => {
      playSound("click.wav");
      document.getElementById("menuScreen").style.display = "none";
      document.getElementById("game").style.display = "block";
      startGame();
    };
  }

  if (playBtn) {
    playBtn.onclick = () => {
      playSelected();
    };
  }

  if (deckBtn) {
    deckBtn.onclick = (e) => {
      e.stopPropagation();
      playSound("draw.wav");
      drawCard();
    };
  }

  if (restartBtn) {
    restartBtn.onclick = () => {
      playSound("click.wav");
      restartGame();
    };
  }

  if (menuBtn) {
    menuBtn.onclick = () => {
      playSound("click.wav");
      backToMenu();
    };
  }

  if (acePlayBtn) {
    acePlayBtn.onclick = () => {
      playSound("click.wav");
      playAce();
    };
  }

  if (aceStandBtn) {
    aceStandBtn.onclick = () => {
      playSound("click.wav");
      standAce();
    };
  }

});



