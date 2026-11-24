/* =========================================================
   PIG DICE — ARCADE EDITION

   Architecture:
   1. State
   2. DOM elements
   3. SoundFX
   4. Utilities
   5. Rendering
   6. Game logic
   7. CPU AI
   8. Victory + Confetti
   9. Reset
   10. Event listeners
========================================================= */

"use strict";


/* =========================================================
   1. CONFIGURATION AND GAME STATE
========================================================= */

const CONFIG = {

  defaultTarget: 100,

  cpuThinkMin: 650,
  cpuThinkMax: 1150,

  historyLimit: 5,

  diceFaces: {
    1: "⚀",
    2: "⚁",
    3: "⚂",
    4: "⚃",
    5: "⚄",
    6: "⚅"
  }

};


const state = {

  scores: [0, 0],

  currentScore: 0,

  activePlayer: 0,

  dice: 0,

  playing: true,

  rolling: false,

  mode: "human",

  target: CONFIG.defaultTarget,

  names: ["Player 1", "Player 2"],

  totalRolls: 0,

  biggestTurn: 0,

  soundEnabled: true,

  history: [],

  cpuTimer: null

};


/* =========================================================
   2. DOM ELEMENTS
========================================================= */

const $ = (selector) =>
  document.querySelector(selector);


const dom = {

  score: [
    $("#score-0"),
    $("#score-1")
  ],

  current: [
    $("#current-0"),
    $("#current-1")
  ],

  cards: [
    $("#player-0"),
    $("#player-1")
  ],

  names: [
    $("#name-0"),
    $("#name-1")
  ],

  progress: [
    $("#progress-0"),
    $("#progress-1")
  ],

  dice: $("#dice"),

  turn: $("#turn-message"),

  message: $("#message"),

  roll: $("#roll-btn"),

  hold: $("#hold-btn"),

  newGame: $("#new-game-btn"),

  mode: $("#mode-select"),

  target: $("#target-select"),

  modePill: $("#mode-pill"),

  player2Kind: $("#player-2-kind"),

  sound: $("#sound-btn"),

  history: $("#history-list"),

  historyCount: $("#history-count"),

  modal: $("#winner-modal"),

  winnerTitle: $("#winner-title"),

  winnerSubtitle: $("#winner-subtitle"),

  statRolls: $("#stat-rolls"),

  statBiggest: $("#stat-biggest"),

  statScore: $("#stat-score"),

  playAgain: $("#play-again-btn"),

  canvas: $("#confetti-canvas")

};


/* =========================================================
   3. SOUND FX MODULE — WEB AUDIO API

   Generates sounds using JavaScript.
   No external audio files are required.
========================================================= */

const SoundFX = (() => {

  let context = null;


  function getContext() {

    const AudioContextClass =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContextClass) {
      return null;
    }

    if (!context) {
      context = new AudioContextClass();
    }

    if (context.state === "suspended") {
      context.resume();
    }

    return context;

  }


  function tone(
    frequency,
    duration,
    type = "sine",
    volume = 0.08,
    endFrequency = null,
    delay = 0
  ) {

    if (!state.soundEnabled) {
      return;
    }

    const ctx = getContext();

    if (!ctx) {
      return;
    }

    const start = ctx.currentTime + delay;

    const oscillator = ctx.createOscillator();

    const gain = ctx.createGain();


    oscillator.type = type;

    oscillator.frequency.setValueAtTime(
      frequency,
      start
    );


    if (endFrequency) {

      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(1, endFrequency),
        start + duration
      );

    }


    gain.gain.setValueAtTime(
      0.0001,
      start
    );

    gain.gain.exponentialRampToValueAtTime(
      volume,
      start + 0.015
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      start + duration
    );


    oscillator.connect(gain);

    gain.connect(ctx.destination);


    oscillator.start(start);

    oscillator.stop(start + duration + 0.02);

  }


  return {

    // Dice rolling sound
    roll() {

      [0, .09, .18, .29].forEach(
        (delay, i) => {

          tone(
            380 + i * 115,
            .075,
            "triangle",
            .035,
            170,
            delay
          );

        }
      );

    },


    // Hold sound
    hold() {

      tone(
        520,
        .13,
        "sine",
        .07,
        760
      );

      tone(
        780,
        .2,
        "sine",
        .055,
        1040,
        .12
      );

    },


    // Rolling a 1
    pigOut() {

      tone(
        190,
        .38,
        "sawtooth",
        .065,
        65
      );

    },


    // Victory sound
    victory() {

      [523, 659, 784, 1047].forEach(
        (frequency, i) => {

          tone(
            frequency,
            .42,
            "triangle",
            .07,
            null,
            i * .14
          );

        }
      );

    }

  };

})();


/* =========================================================
   4. UTILITY FUNCTIONS
========================================================= */

const wait = (milliseconds) => {

  return new Promise(resolve => {

    setTimeout(resolve, milliseconds);

  });

};


const randomInteger = (min, max) => {

  return Math.floor(
    Math.random() * (max - min + 1)
  ) + min;

};


const playerName = (index) => {

  return state.names[index] ||
    `Player ${index + 1}`;

};


const isCPU = (index) => {

  return state.mode === "cpu" && index === 1;

};


function setMessage(text) {

  dom.message.textContent = text;

}


/* =========================================================
   5. RENDERING AND UI UPDATES

   render() synchronizes the game state with the DOM.
========================================================= */

function updateControls() {

  const cpuThinking =
    isCPU(state.activePlayer) &&
    state.playing;

  const disabled =
    !state.playing ||
    state.rolling ||
    cpuThinking;

  dom.roll.disabled = disabled;

  dom.hold.disabled =
    disabled ||
    state.currentScore === 0;

  dom.newGame.disabled = false;

}


function render() {

  state.names.forEach((name, index) => {

    // Do not interrupt a name currently being edited.
    if (
      document.activeElement !==
      dom.names[index]
    ) {

      dom.names[index].value = name;

    }


    // Update permanent score.
    dom.score[index].textContent =
      state.scores[index];


    // Only the active player has turn points.
    dom.current[index].textContent =
      index === state.activePlayer
        ? state.currentScore
        : 0;


    // Update progress bar.
    dom.progress[index].style.width =
      `${Math.min(
        100,
        (state.scores[index] / state.target) * 100
      )}%`;


    // Active player styling.
    dom.cards[index].classList.toggle(
      "active",
      index === state.activePlayer
    );


    dom.cards[index].classList.toggle(
      "inactive",
      index !== state.activePlayer
    );

  });


  dom.turn.textContent =
    `${playerName(state.activePlayer).toUpperCase()}'S TURN`;


  dom.modePill.textContent =
    state.mode === "cpu"
      ? "VS CPU"
      : "2 PLAYERS";


  dom.player2Kind.textContent =
    isCPU(1)
      ? "CPU"
      : "PLAYER";


  updateControls();

}


/* =========================================================
   6. LIVE MOVE HISTORY
========================================================= */

function addHistory(message) {

  state.history.unshift(message);

  state.history =
    state.history.slice(0, CONFIG.historyLimit);


  dom.historyCount.textContent =
    `${state.totalRolls + state.history.length -
      state.history.filter(item =>
        item.startsWith("Game")
      ).length} MOVES`;


  dom.history.replaceChildren();


  if (state.history.length === 0) {

    const empty = document.createElement("li");

    empty.className = "empty-history";

    empty.textContent =
      "Your game activity will appear here.";

    dom.history.append(empty);

    return;

  }


  state.history.forEach(item => {

    const li = document.createElement("li");

    li.textContent = item;

    dom.history.append(li);

  });

}


/* =========================================================
   7. FLOATING SCORE ANIMATION
========================================================= */

function showFloatingScore(points, playerIndex) {

  const card = dom.cards[playerIndex];

  const badge = document.createElement("span");

  badge.className = "floating-score";

  badge.textContent = `+${points}`;

  badge.style.left = "50%";

  badge.style.top = "48%";

  card.append(badge);


  badge.addEventListener(
    "animationend",
    () => badge.remove(),
    { once: true }
  );

}


/* =========================================================
   8. ANIMATED SCORE COUNTER
========================================================= */

async function animateTotalScore(
  index,
  from,
  to
) {

  const duration = 520;

  const start = performance.now();


  return new Promise(resolve => {

    function frame(now) {

      const progress = Math.min(
        1,
        (now - start) / duration
      );

      const eased =
        1 - Math.pow(1 - progress, 3);


      dom.score[index].textContent =
        Math.round(
          from + (to - from) * eased
        );


      if (progress < 1) {

        requestAnimationFrame(frame);

      } else {

        resolve();

      }

    }


    requestAnimationFrame(frame);

  });

}


/* =========================================================
   9. ROLL DICE — HUMAN PLAYER
========================================================= */

async function rollDice() {

  if (
    !state.playing ||
    state.rolling ||
    isCPU(state.activePlayer)
  ) {

    return;

  }


  state.rolling = true;

  updateControls();


  // Play dice sound.
  SoundFX.roll();


  // Restart dice animation.
  dom.dice.classList.remove("rolling");

  void dom.dice.offsetWidth;

  dom.dice.classList.add("rolling");


  // Wait until the dice animation lands.
  await wait(820);


  // Generate random dice value.
  state.dice = randomInteger(1, 6);

  state.totalRolls++;


  // Display result.
  dom.dice.textContent =
    CONFIG.diceFaces[state.dice];

  dom.dice.setAttribute(
    "aria-label",
    `Dice shows ${state.dice}`
  );

  dom.dice.classList.remove("rolling");


  /* -------------------------
     CHECK FOR PIG OUT
  ------------------------- */

  if (state.dice === 1) {

    const player = state.activePlayer;

    const lostPoints = state.currentScore;


    // Lose unbanked points.
    state.currentScore = 0;


    SoundFX.pigOut();


    // Screen shake.
    document.body.classList.remove(
      "screen-shake"
    );

    void document.body.offsetWidth;

    document.body.classList.add(
      "screen-shake"
    );


    // Red flash on player card.
    dom.cards[player].classList.remove(
      "pig-out"
    );

    void dom.cards[player].offsetWidth;

    dom.cards[player].classList.add(
      "pig-out"
    );


    setMessage(
      `${playerName(player)} rolled a 1 — ${lostPoints} turn points lost!`
    );


    addHistory(
      `${playerName(player)} rolled a 1 and lost ${lostPoints} unbanked points.`
    );


    state.rolling = false;

    render();


    await wait(420);


    switchPlayer();

    return;

  }


  /* -------------------------
     NORMAL DICE RESULT
  ------------------------- */

  state.currentScore += state.dice;


  setMessage(
    `${playerName(state.activePlayer)} rolled ${state.dice}. Roll again or hold your points.`
  );


  addHistory(
    `${playerName(state.activePlayer)} rolled ${state.dice} · turn total ${state.currentScore}.`
  );


  state.rolling = false;

  render();

  maybeRunCPU();

}


/* =========================================================
   10. HOLD SCORE — HUMAN PLAYER
========================================================= */

async function holdScore() {

  if (
    !state.playing ||
    state.rolling ||
    isCPU(state.activePlayer) ||
    state.currentScore === 0
  ) {

    return;

  }


  const player = state.activePlayer;

  const banked = state.currentScore;

  const previousTotal = state.scores[player];


  // Save current points permanently.
  state.scores[player] += banked;

  state.biggestTurn = Math.max(
    state.biggestTurn,
    banked
  );

  state.currentScore = 0;

  // Prevent input while the score counter animates.
  state.rolling = true;


  SoundFX.hold();


  // Floating +points animation.
  showFloatingScore(banked, player);


  setMessage(
    `${playerName(player)} banked ${banked} points!`
  );


  addHistory(
    `${playerName(player)} banked +${banked} points.`
  );


  render();


  // Animate permanent score.
  await animateTotalScore(
    player,
    previousTotal,
    state.scores[player]
  );

  state.rolling = false;


  // Check victory.
  if (state.scores[player] >= state.target) {

    finishGame(player);

    return;

  }


  switchPlayer();

}


/* =========================================================
   11. SWITCH PLAYER
========================================================= */

function switchPlayer() {

  state.currentScore = 0;

  state.activePlayer =
    1 - state.activePlayer;

  state.dice = 0;


  // Reset dice display.
  dom.dice.textContent = "🎲";

  dom.dice.setAttribute(
    "aria-label",
    "Dice not rolled yet"
  );


  render();


  if (isCPU(state.activePlayer)) {

    setMessage(
      `${playerName(1)} is thinking...`
    );

    maybeRunCPU();

  } else {

    setMessage(
      `${playerName(state.activePlayer)}, it's your turn. Roll the dice!`
    );

  }

}


/* =========================================================
   12. CPU DECISION ENGINE

   CPU evaluates risk and reward.

   It considers:
   - Current turn points.
   - Score difference.
   - Points needed to win.
   - Whether it is leading or behind.
========================================================= */

function shouldCPUHold() {

  const cpuTotal = state.scores[1];

  const humanTotal = state.scores[0];

  const turn = state.currentScore;

  const pointsNeeded =
    state.target - cpuTotal;

  const gap =
    cpuTotal - humanTotal;


  if (turn === 0) {
    return false;
  }


  // Enough points to win.
  if (turn >= pointsNeeded) {
    return false;
  }


  // Protect a valuable turn.
  if (turn >= 20) {
    return true;
  }


  // Protect the lead.
  if (turn >= 15 && gap >= 0) {
    return true;
  }


  // Close to winning.
  if (turn >= 12 && pointsNeeded <= 25) {
    return true;
  }


  // Behind: accept more risk.
  if (turn >= 10 && gap < -25) {
    return false;
  }


  return turn >= 14;

}


/* =========================================================
   13. CPU THINKING DELAY
========================================================= */

async function maybeRunCPU() {

  if (
    !state.playing ||
    !isCPU(state.activePlayer) ||
    state.rolling
  ) {

    return;

  }


  updateControls();

  clearTimeout(state.cpuTimer);


  state.cpuTimer = setTimeout(
    async () => {

      if (
        !state.playing ||
        !isCPU(state.activePlayer)
      ) {

        return;

      }


      if (
        state.currentScore > 0 &&
        shouldCPUHold()
      ) {

        await cpuHold();

      } else {

        await cpuRoll();

      }

    },

    randomInteger(
      CONFIG.cpuThinkMin,
      CONFIG.cpuThinkMax
    )

  );

}


/* =========================================================
   14. CPU ROLL DICE
========================================================= */

async function cpuRoll() {

  if (
    !state.playing ||
    !isCPU(state.activePlayer) ||
    state.rolling
  ) {

    return;

  }


  state.rolling = true;

  updateControls();

  SoundFX.roll();


  dom.dice.classList.remove("rolling");

  void dom.dice.offsetWidth;

  dom.dice.classList.add("rolling");


  await wait(820);


  state.dice = randomInteger(1, 6);

  state.totalRolls++;


  dom.dice.textContent =
    CONFIG.diceFaces[state.dice];

  dom.dice.setAttribute(
    "aria-label",
    `Dice shows ${state.dice}`
  );

  dom.dice.classList.remove("rolling");


  // CPU rolled a 1.
  if (state.dice === 1) {

    const lost = state.currentScore;

    state.currentScore = 0;

    SoundFX.pigOut();

    dom.cards[1].classList.add("pig-out");

    document.body.classList.add(
      "screen-shake"
    );


    setMessage(
      `${playerName(1)} rolled a 1 and lost ${lost} points.`
    );


    addHistory(
      `${playerName(1)} rolled a 1 and lost ${lost} unbanked points.`
    );


    state.rolling = false;

    render();

    await wait(450);

    switchPlayer();

    return;

  }


  // Normal CPU dice result.
  state.currentScore += state.dice;


  setMessage(
    `${playerName(1)} rolled ${state.dice}. ${
      shouldCPUHold()
        ? "Considering a hold..."
        : "Taking another risk..."
    }`
  );


  addHistory(
    `${playerName(1)} rolled ${state.dice} · turn total ${state.currentScore}.`
  );


  state.rolling = false;

  render();

  maybeRunCPU();

}


/* =========================================================
   15. CPU HOLD SCORE
========================================================= */

async function cpuHold() {

  if (
    !state.playing ||
    !isCPU(state.activePlayer) ||
    state.currentScore === 0
  ) {

    return;

  }


  const banked = state.currentScore;

  const previousTotal = state.scores[1];


  state.scores[1] += banked;

  state.biggestTurn = Math.max(
    state.biggestTurn,
    banked
  );

  state.currentScore = 0;

  state.rolling = true;


  SoundFX.hold();

  showFloatingScore(banked, 1);


  setMessage(
    `${playerName(1)} banked ${banked} points.`
  );


  addHistory(
    `${playerName(1)} banked +${banked} points.`
  );


  render();


  await animateTotalScore(
    1,
    previousTotal,
    state.scores[1]
  );

  state.rolling = false;


  if (state.scores[1] >= state.target) {

    finishGame(1);

    return;

  }


  switchPlayer();

}


/* =========================================================
   16. FINISH GAME — VICTORY
========================================================= */

function finishGame(winnerIndex) {

  state.playing = false;

  state.currentScore = 0;

  clearTimeout(state.cpuTimer);


  SoundFX.victory();


  setMessage(
    `${playerName(winnerIndex)} wins the match!`
  );


  dom.turn.textContent =
    `${playerName(winnerIndex).toUpperCase()} WINS!`;


  dom.winnerTitle.textContent =
    `${playerName(winnerIndex)} WINS!`;


  dom.winnerSubtitle.textContent =
    `A brilliant run — ${state.scores[winnerIndex]} points on the board.`;


  dom.statRolls.textContent =
    state.totalRolls;

  dom.statBiggest.textContent =
    state.biggestTurn;

  dom.statScore.textContent =
    state.scores[winnerIndex];


  // Show winner modal.
  dom.modal.hidden = false;


  updateControls();


  // Celebrate victory.
  launchConfetti();

}


/* =========================================================
   17. CONFETTI — CANVAS API
========================================================= */

function launchConfetti() {

  const canvas = dom.canvas;

  const ctx = canvas.getContext("2d");


  const dpr = Math.min(
    window.devicePixelRatio || 1,
    2
  );


  canvas.width =
    window.innerWidth * dpr;

  canvas.height =
    window.innerHeight * dpr;


  ctx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );


  const pieces = Array.from(
    { length: 130 },

    () => ({

      x: Math.random() * window.innerWidth,

      y: -Math.random() * window.innerHeight * .5,

      size: randomInteger(4, 8),

      speed: randomInteger(2, 6),

      drift: Math.random() * 2 - 1,

      rotation: Math.random() * 6,

      spin: Math.random() * .16 - .08,

      color: [
        "#52d6f5",
        "#48e0a4",
        "#ffd477",
        "#ff647c",
        "#8a9cff"
      ][randomInteger(0, 4)]

    })

  );


  let frame = 0;


  function draw() {

    ctx.clearRect(
      0,
      0,
      window.innerWidth,
      window.innerHeight
    );


    pieces.forEach(piece => {

      piece.y += piece.speed;

      piece.x += piece.drift;

      piece.rotation += piece.spin;


      ctx.save();

      ctx.translate(
        piece.x,
        piece.y
      );

      ctx.rotate(piece.rotation);

      ctx.fillStyle = piece.color;

      ctx.fillRect(
        -piece.size / 2,
        -piece.size / 2,
        piece.size,
        piece.size * .65
      );

      ctx.restore();

    });


    frame++;


    if (frame < 190) {

      requestAnimationFrame(draw);

    } else {

      ctx.clearRect(
        0,
        0,
        window.innerWidth,
        window.innerHeight
      );

    }

  }


  requestAnimationFrame(draw);

}


/* =========================================================
   18. NEW GAME — RESET STATE
========================================================= */

function newGame() {

  clearTimeout(state.cpuTimer);


  // Reset game data.
  state.scores = [0, 0];

  state.currentScore = 0;

  state.activePlayer = 0;

  state.dice = 0;

  state.playing = true;

  state.rolling = false;

  state.totalRolls = 0;

  state.biggestTurn = 0;

  state.history = [];


  // Read settings.
  state.mode = dom.mode.value;

  state.target = Number(dom.target.value);


  // Read player names.
  state.names = [

    dom.names[0].value.trim() || "Player 1",

    state.mode === "cpu"
      ? "CPU"
      : (dom.names[1].value.trim() || "Player 2")

  ];


  if (state.mode === "cpu") {

    dom.names[1].value = "CPU";

  } else if (dom.names[1].value === "CPU") {

    dom.names[1].value = "Player 2";

  }


  // Reset dice.
  dom.dice.textContent = "🎲";

  dom.dice.setAttribute(
    "aria-label",
    "Dice not rolled yet"
  );

  dom.dice.classList.remove("rolling");


  // Hide winner modal.
  dom.modal.hidden = true;


  // Remove temporary effects.
  document.body.classList.remove(
    "screen-shake"
  );


  dom.cards.forEach(card => {

    card.classList.remove("pig-out");

  });


  setMessage(
    "Roll the dice to start your turn."
  );


  addHistory(
    "Game started. Good luck!"
  );


  render();

}


/* =========================================================
   19. SOUND TOGGLE
========================================================= */

function toggleSound() {

  state.soundEnabled =
    !state.soundEnabled;


  dom.sound.textContent =
    state.soundEnabled
      ? "🔊"
      : "🔇";


  dom.sound.setAttribute(
    "aria-label",
    state.soundEnabled
      ? "Mute sound"
      : "Enable sound"
  );

}


/* =========================================================
   20. EVENT LISTENERS
========================================================= */

// Roll button.
dom.roll.addEventListener(
  "click",
  rollDice
);


// Hold button.
dom.hold.addEventListener(
  "click",
  holdScore
);


// New game button.
dom.newGame.addEventListener(
  "click",
  newGame
);


// Play again button.
dom.playAgain.addEventListener(
  "click",
  newGame
);


// Sound button.
dom.sound.addEventListener(
  "click",
  toggleSound
);


// Change game mode.
dom.mode.addEventListener(
  "change",
  () => {

    dom.names[1].disabled =
      dom.mode.value === "cpu";


    if (dom.mode.value === "cpu") {

      dom.names[1].value = "CPU";

    } else if (dom.names[1].value === "CPU") {

      dom.names[1].value = "Player 2";

    }


    newGame();

  }
);


// Change winning score.
dom.target.addEventListener(
  "change",
  newGame
);


// Edit player names.
dom.names.forEach((input, index) => {

  input.addEventListener(
    "change",
    () => {

      if (
        state.mode === "cpu" &&
        index === 1
      ) {

        input.value = "CPU";

        return;

      }


      state.names[index] =
        input.value.trim() ||
        `Player ${index + 1}`;


      input.value = state.names[index];

      render();

    }
  );

});


/* =========================================================
   21. INITIALIZE GAME
========================================================= */

dom.names[1].disabled = false;

newGame();

console.log(
  "Pig Dice Arcade Edition initialized."
);