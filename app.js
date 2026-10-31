// Greek Tavli Online — Core Game Engine, Fevga Rules, AI, Spectator Handshake Fix, Tutorial, Global Messaging & WebRTC Multiplayer (app.js — v20)

const PEER_CONFIG = {
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" },
      { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
      { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" }
    ]
  }
};

let myPlayerName = "Player 1";
let playerNames = { W: "Player 1", B: "Player 2" };
let pendingRoomFromUrl = null;
let rollOffTimer = null;
let autoRollTimer = null;
let confettiCleanupTimer = null;
let activeSetSummaryObj = null;

let state = {
  variantSequence: ["PORTES", "PLAKOTO", "FEVGA"],
  variantIdx: 0,
  targetScore: 7,
  scoreW: 0,
  scoreB: 0,
  phase: "ROLL_OFF",
  rollOff: { W: null, B: null },
  turn: "W",
  dice: [],
  displayDice: [],
  rolled: false,
  requireEndTurn: true,
  autoRoll: false,
  colors: { W: "white", B: "black" },
  playerNames: { W: "Player 1", B: "Player 2" },
  spectatorCount: 0,
  points: [],
  bar: { W: 0, B: 0 },
  off: { W: 0, B: 0 },
  fevgaPassed: { W: false, B: false },
  setGamesLog: [],
  setRollCounts: { W: {}, B: {} },
  lastAction: "INIT",
  lastMoveAnim: null,
  lastWinEvent: null,
  lastSetSummary: null
};

let lastRecordedWinEventId = null;
let lastShownSummaryId = null;
let myRematchVote = false;
let peerRematchVote = false;

let turnHistory = [];
let selectedFrom = null;
let validTargets = [];
let isAnimatingDice = false;
let isAnimatingChecker = false;
let lastPointTap = { idx: -1, time: 0 };

let peer = null;
let conn = null;             // Primary opponent connection (W <-> B) or Spectator -> Host connection
let spectatorConns = [];     // Active spectator connections managed by Host (W)
let myRole = "BOTH";         // 'BOTH' | 'W' | 'B' | 'SPECTATOR'
let activeRoomCode = "";
let opponentLeftHandled = false;
let localTypingTimeout = null;
let remoteTypingTimeout = null;
let helloRetryTimer = null;  // Handshake retry loop for reliable Spectator & Joiner connection

let packetQueue = [];
let isProcessingPacket = false;

function stopHelloRetry() {
  if (helloRetryTimer) {
    clearInterval(helloRetryTimer);
    helloRetryTimer = null;
  }
}

function updateSpectatorBadge(count) {
  const badge = document.getElementById("spectatorCountBadge");
  if (!badge) return;
  const n = Math.max(0, parseInt(count, 10) || 0);
  state.spectatorCount = n;
  if (n > 0 || myRole === "SPECTATOR") {
    badge.style.display = "inline-block";
    badge.textContent = `👁️ ${Math.max(n, myRole === "SPECTATOR" ? 1 : 0)}`;
  } else {
    badge.style.display = "none";
  }
}

async function openPlaySetupModal(role) {
  const tr = t();
  checkPersistentLoginSession();

  const guestAuthBox = document.getElementById("inviteGuestAuthSection");
  const isJoinOrSpectate = (role === "JOIN" || role === "SPECTATE");
  const isUnloggedInvite = (isJoinOrSpectate && pendingRoomFromUrl && !isAuthenticatedAccount);

  if (isUnloggedInvite) {
    guestAuthBox.style.display = "block";
    const savedLocalName = localStorage.getItem("tavli_player_name");
    if (savedLocalName && savedLocalName !== "Player 1" && savedLocalName !== "Player 2") {
      document.getElementById("modalGuestNameInput").value = savedLocalName;
    }
  } else {
    guestAuthBox.style.display = "none";
    const ok = await verifyIdentityOnLanding(false);
    if (!ok && myStoreDetailsPref) {
      return;
    }
  }

  modalRole = role;
  const joinRoleToggle = document.getElementById("joinRoleToggleSection");
  const clrSec = document.getElementById("checkerColorSection");

  if (role === "HOST") {
    document.getElementById("playConfigTitle").textContent = tr.titleHostModal;
    document.getElementById("modalSubmitBtn").textContent = tr.btnStartGame;
    if (joinRoleToggle) joinRoleToggle.style.display = "none";
    if (clrSec) clrSec.style.display = "block";
  } else if (role === "JOIN" || role === "SPECTATE") {
    if (joinRoleToggle) joinRoleToggle.style.display = "block";
    selectJoinParticipationMode(role);
  } else {
    document.getElementById("playConfigTitle").textContent = tr.titleAiModal;
    document.getElementById("modalSubmitBtn").textContent = tr.btnStartAi;
    if (joinRoleToggle) joinRoleToggle.style.display = "none";
    if (clrSec) clrSec.style.display = "block";
  }

  document.getElementById("hostOnlySettings").style.display = (role === "HOST" || role === "AI") ? "block" : "none";
  document.getElementById("joinOnlySettings").style.display = (role === "JOIN" || role === "SPECTATE") ? "block" : "none";
  document.getElementById("aiOnlySettings").style.display = role === "AI" ? "block" : "none";

  renderColorPicker();
  renderTargetScorePicker();
  document.getElementById("playConfigModal").style.display = "flex";
}

function closePlayConfigModal() {
  document.getElementById("playConfigModal").style.display = "none";
}

async function confirmStartSelectedMode() {
  ensureAudio();
  const tr = t();
  isTutorialMode = false;
  if (typeof syncTutorialPanelPlacement === "function") {
    syncTutorialPanelPlacement();
  }

  checkPersistentLoginSession();

  const guestAuthBox = document.getElementById("inviteGuestAuthSection");
  if (guestAuthBox && guestAuthBox.style.display === "block") {
    const gName = document.getElementById("modalGuestNameInput").value.trim() || tr.defaultPlayer;
    const isStore = document.getElementById("modalOptStoreYes").classList.contains("active");
    const gPin = document.getElementById("modalGuestPinInput").value.trim();

    if (isStore) {
      const auth = await window.TavliDB.authenticateOrCreateAsync(gName, gPin);
      if (!auth.ok) {
        const errEl = document.getElementById("modalAuthErrorBox");
        errEl.textContent = auth.message;
        errEl.style.display = "block";
        return;
      }
      myPlayerName = auth.user.name;
      isAuthenticatedAccount = true;
      localStorage.setItem("tavli_logged_in_name", myPlayerName);
      localStorage.setItem("tavli_logged_in_pinhash", auth.user.pinHash);
      checkPersistentLoginSession();
    } else {
      await window.TavliDB.pullFromServer();
      if (window.TavliDB.userExists(gName)) {
        const errEl = document.getElementById("modalAuthErrorBox");
        errEl.textContent = tr.errRegisteredNeedsPin;
        errEl.style.display = "block";
        return;
      }
      myPlayerName = gName;
      isAuthenticatedAccount = false;
    }
    localStorage.setItem("tavli_player_name", myPlayerName);
  } else if (!isAuthenticatedAccount) {
    const landingInputName = document.getElementById("playerNameInput").value.trim();
    if (landingInputName) {
      myPlayerName = landingInputName;
      localStorage.setItem("tavli_player_name", myPlayerName);
    }
  }

  localStorage.setItem("tavli_player_color", myChosenColor);

  if (modalRole === "JOIN" || modalRole === "SPECTATE") {
    const joinCode = (pendingRoomFromUrl || document.getElementById("modalRoomInput").value || "").trim().toUpperCase();
    if (joinCode.length !== 6) {
      alert(tr.enter6CodeAlert);
      return;
    }
    const asSpectator = (modalRole === "SPECTATE");
    pendingRoomFromUrl = null;
    closePlayConfigModal();
    showScreen("GAME");
    joinRoomWithCode(joinCode, asSpectator);
    return;
  }

  localStorage.setItem("tavli_end_turn_pref", myEndTurnPref ? "1" : "0");
  localStorage.setItem("tavli_auto_roll_pref", myAutoRollPref ? "1" : "0");
  localStorage.setItem("tavli_target_score", String(myTargetScorePref));
  localStorage.setItem("tavli_game_mode", myGameModePref);

  closePlayConfigModal();
  showScreen("GAME");

  if (modalRole === "HOST") {
    hostRoom();
  } else if (modalRole === "AI") {
    isAiMatch = true;
    myRole = "W";
    playerNames.W = myPlayerName;
    playerNames.B = `AI (${myAiDifficulty})`;
    state.playerNames = { W: playerNames.W, B: playerNames.B };
    state.colors.W = myChosenColor;
    state.colors.B = getDistinctFallbackColor(state.colors.W);
    state.requireEndTurn = myEndTurnPref;
    state.autoRoll = myAutoRollPref;
    state.targetScore = myTargetScorePref;
    state.variantSequence = getSequenceForMode(myGameModePref);
    state.variantIdx = 0;
    state.scoreW = 0;
    state.scoreB = 0;
    resetSetTracking();
    document.getElementById("shareBtn").style.display = "none";
    document.getElementById("netStatus").textContent = tr.netAiMode(myAiDifficulty);
    updateSpectatorBadge(0);
    initGame("ROLL_OFF");
  }
}

function saveActiveRoomBackup() {
  if (!activeRoomCode || isAiMatch || isTutorialMode || myRole === "SPECTATOR" || state.phase === "SET_OVER") return;
  try {
    state.playerNames = { W: playerNames.W, B: playerNames.B };
    const backup = {
      roomCode: activeRoomCode,
      myRole,
      myPlayerName,
      playerNames: cloneState(playerNames),
      state: cloneState(state),
      savedAt: Date.now()
    };
    localStorage.setItem(ROOM_BACKUP_KEY, JSON.stringify(backup));
  } catch (_) {}
}

function getActiveRoomBackup(code) {
  try {
    const raw = localStorage.getItem(ROOM_BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.roomCode) return null;
    if (Date.now() - (parsed.savedAt || 0) > RECONNECT_WINDOW_MS) {
      localStorage.removeItem(ROOM_BACKUP_KEY);
      return null;
    }
    if (code && parsed.roomCode.toUpperCase() !== code.toUpperCase()) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function clearActiveRoomBackup() {
  localStorage.removeItem(ROOM_BACKUP_KEY);
}

function currentVariant() {
  const seq = state.variantSequence && state.variantSequence.length ? state.variantSequence : ["PORTES", "PLAKOTO", "FEVGA"];
  return seq[state.variantIdx % seq.length];
}

function resetSetTracking() {
  state.setGamesLog = [];
  state.setRollCounts = { W: {}, B: {} };
  state.lastSetSummary = null;
  activeSetSummaryObj = null;
  myRematchVote = false;
  peerRematchVote = false;
}

function recordDiceComboInSet(player, d1, d2) {
  if (!state.setRollCounts) state.setRollCounts = { W: {}, B: {} };
  if (!state.setRollCounts[player]) state.setRollCounts[player] = {};
  const hi = Math.max(d1, d2);
  const lo = Math.min(d1, d2);
  const key = `${hi}-${lo}`;
  state.setRollCounts[player][key] = (state.setRollCounts[player][key] || 0) + 1;
}

function getMostRolledComboStr(countsMap) {
  const tr = t();
  if (!countsMap || typeof countsMap !== "object") return tr.noRollsRecorded;
  const entries = Object.entries(countsMap);
  if (entries.length === 0) return tr.noRollsRecorded;
  entries.sort((a, b) => b[1] - a[1]);
  const [combo, count] = entries[0];
  return `${combo} (${count}x)`;
}

function recordWinEventToDatabase(winEv) {
  if (isAiMatch || isTutorialMode || myRole === "SPECTATOR") return;
  if (!winEv || !winEv.id || winEv.id === lastRecordedWinEventId) return;
  lastRecordedWinEventId = winEv.id;

  const wName = (winEv.nameW || (state.playerNames && state.playerNames.W) || playerNames.W || "Player 1").trim();
  const bName = (winEv.nameB || (state.playerNames && state.playerNames.B) || playerNames.B || "Player 2").trim();
  playerNames.W = wName;
  playerNames.B = bName;

  const wWon = winEv.winner === "W";

  if (!winEv.forfeitSetOnly) {
    window.TavliDB.recordGameOutcome(wName, bName, winEv.variant, wWon);
    window.TavliDB.recordGameOutcome(bName, wName, winEv.variant, !wWon);
  }

  if (winEv.matchOver) {
    window.TavliDB.recordSetOutcome(wName, bName, wWon);
    window.TavliDB.recordSetOutcome(bName, wName, !wWon);
  }

  syncDatabaseWithPeer();
}

function updateHeaderLabels() {
  const metaW = getColorMeta(state.colors.W);
  const metaB = getColorMeta(state.colors.B);
  document.getElementById("colorLabelW").textContent = metaW.label;
  document.getElementById("colorLabelB").textContent = metaB.label;
  document.getElementById("nameW").textContent = playerNames.W;
  document.getElementById("nameB").textContent = playerNames.B;
  document.getElementById("targetW").textContent = state.targetScore;
  document.getElementById("targetB").textContent = state.targetScore;
}

function cryptoDie() {
  const buf = new Uint8Array(1);
  while (true) {
    window.crypto.getRandomValues(buf);
    if (buf[0] < 252) return (buf[0] % 6) + 1;
  }
}

function generateSecureRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = new Uint8Array(6);
  window.crypto.getRandomValues(buf);
  return Array.from(buf, b => chars[b % 32]).join("");
}

function cloneState(s) {
  return JSON.parse(JSON.stringify(s));
}

function getPath(variant, player) {
  if (variant === "PORTES") {
    if (player === "W") return Array.from({ length: 24 }, (_, i) => i);
    return Array.from({ length: 24 }, (_, i) => 23 - i);
  }
  if (variant === "PLAKOTO") {
    if (player === "W") return Array.from({ length: 24 }, (_, i) => 23 - i);
    return Array.from({ length: 24 }, (_, i) => i);
  }
  if (player === "W") return Array.from({ length: 24 }, (_, i) => i);
  return Array.from({ length: 24 }, (_, i) => (12 + i) % 24);
}

function initGame(starter = "ROLL_OFF") {
  if (rollOffTimer) { clearTimeout(rollOffTimer); rollOffTimer = null; }
  if (autoRollTimer) { clearTimeout(autoRollTimer); autoRollTimer = null; }
  if (aiTurnTimer) { clearTimeout(aiTurnTimer); aiTurnTimer = null; }

  const v = currentVariant();
  if (starter === "ROLL_OFF") {
    state.phase = "ROLL_OFF";
    state.rollOff = { W: null, B: null };
    state.turn = "W";
  } else {
    state.phase = "PLAY";
    state.rollOff = { W: null, B: null };
    state.turn = starter;
  }
  state.dice = [];
  state.displayDice = [];
  state.rolled = false;
  state.bar = { W: 0, B: 0 };
  state.off = { W: 0, B: 0 };
  state.fevgaPassed = { W: false, B: false };
  state.playerNames = { W: playerNames.W, B: playerNames.B };
  state.lastAction = "INIT";
  state.lastMoveAnim = null;
  state.points = Array.from({ length: 24 }, () => ({ owner: null, count: 0, pinned: null }));

  if (v === "PORTES") {
    setPt(0, "W", 2); setPt(11, "W", 5); setPt(16, "W", 3); setPt(18, "W", 5);
    setPt(23, "B", 2); setPt(12, "B", 5); setPt(7, "B", 3); setPt(5, "B", 5);
  } else if (v === "PLAKOTO") {
    setPt(23, "W", 15);
    setPt(0, "B", 15);
  } else if (v === "FEVGA") {
    setPt(0, "W", 15);
    setPt(12, "B", 15);
  }
  turnHistory = [];
  selectedFrom = null;
  validTargets = [];
  updateHeaderLabels();
  saveActiveRoomBackup();
  render();
  checkTriggerAutoRollOrAI();
}

function setPt(idx, owner, count) {
  state.points[idx] = { owner, count, pinned: null };
}

function checkTriggerAutoRollOrAI() {
  if (autoRollTimer) { clearTimeout(autoRollTimer); autoRollTimer = null; }
  if (aiTurnTimer) { clearTimeout(aiTurnTimer); aiTurnTimer = null; }
  if (state.phase === "SET_OVER" || isWaitingForReconnect || isTutorialMode || myRole === "SPECTATOR") return;

  if (isAiMatch && state.turn === "B" && !state.rolled && !isAnimatingDice && !isAnimatingChecker) {
    aiTurnTimer = setTimeout(() => {
      if (isAiMatch && state.turn === "B" && !state.rolled && state.phase !== "SET_OVER") {
        handleRoll(true);
      }
    }, 650);
    return;
  }

  if (!state.autoRoll || state.phase !== "PLAY" || state.rolled || isAnimatingDice) return;
  const isMyTurn = (myRole === "BOTH" && !isAiMatch) || myRole === state.turn;
  if (!isMyTurn) return;

  autoRollTimer = setTimeout(() => {
    if (state.autoRoll && state.phase === "PLAY" && !state.rolled && !isAnimatingDice && !isWaitingForReconnect) {
      handleRoll();
    }
  }, 450);
}

function handleRoll(triggeredByAi = false) {
  if (myRole === "SPECTATOR" || isTutorialMode) return;
  if (state.phase === "SET_OVER" || isWaitingForReconnect || state.rolled || isAnimatingDice || isAnimatingChecker) return;
  if (!triggeredByAi && myRole !== "BOTH" && myRole !== state.turn) return;

  const tr = t();

  if (state.phase === "ROLL_OFF") {
    const d = cryptoDie();
    const roller = state.turn;
    state.rollOff[roller] = d;
    state.lastAction = "ROLL_OFF";
    state.lastMoveAnim = null;

    if (roller === "W") {
      state.turn = "B";
      syncState();
      animateBoardRollOffDie("W", () => {
        setStatus(tr.rolled1DieWait(playerNames.W, d, playerNames.B));
        if (myRole === "BOTH" && !isAiMatch) playTurnChime();
        render();
        checkTriggerAutoRollOrAI();
      });
    } else {
      state.rolled = true;
      syncState();
      animateBoardRollOffDie("B", () => {
        resolveRollOffOutcome();
      });
    }
    return;
  }

  const d1 = cryptoDie();
  const d2 = cryptoDie();
  recordDiceComboInSet(state.turn, d1, d2);
  state.displayDice = [d1, d2];
  state.dice = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
  state.rolled = true;
  state.lastAction = "ROLL";
  state.lastMoveAnim = null;
  turnHistory = [];

  syncState();
  animateDiceRoll(2, () => {
    setStatus(t().rolledPair(d1, d2, d1 === d2));
    if (!hasAnyLegalMove(state.turn)) {
      const curName = state.turn === "W" ? playerNames.W : playerNames.B;
      setStatus(t().noLegalMoves(curName));
      setTimeout(() => {
        handleEndTurn(true);
      }, 1100);
      return;
    }
    render();
    if (isAiMatch && state.turn === "B") {
      setTimeout(() => playAiTurnSequence(), 500);
    }
  });
}

// --- Fevga Temporary 6-Block Rule ---
function isFevgaStartingPrimeOccupied(s, player) {
  const seq = s.variantSequence && s.variantSequence.length ? s.variantSequence : ["PORTES", "PLAKOTO", "FEVGA"];
  const v = seq[s.variantIdx % seq.length];
  if (v !== "FEVGA") return false;
  const path = getPath("FEVGA", player);
  const startQuad = path.slice(0, 6);
  return startQuad.every(qIdx => s.points[qIdx].owner === player && s.points[qIdx].count > 0);
}

function canUnblockFevgaPrimeBeforeTurnEnd(stateAfterMove, player) {
  if (!isFevgaStartingPrimeOccupied(stateAfterMove, player)) return true;
  if (stateAfterMove.dice.length === 0) return false;

  for (let i = 0; i < 24; i++) {
    if (stateAfterMove.points[i].owner === player && stateAfterMove.points[i].count > 0) {
      const nextMoves = getRawSingleMovesIgnoringPrime(stateAfterMove, i, player);
      for (const m of nextMoves) {
        const nextS = cloneState(stateAfterMove);
        applySingleStepToState(nextS, m);
        if (!isFevgaStartingPrimeOccupied(nextS, player)) return true;
        if (nextS.dice.length > 0 && canUnblockFevgaPrimeBeforeTurnEnd(nextS, player)) return true;
      }
    }
  }
  return false;
}

function getRawSingleMovesIgnoringPrime(s, origin, player) {
  const seq = s.variantSequence && s.variantSequence.length ? s.variantSequence : ["PORTES", "PLAKOTO", "FEVGA"];
  const v = seq[s.variantIdx % seq.length];
  const path = getPath(v, player);
  const opp = player === "W" ? "B" : "W";
  const uniqueDice = [...new Set(s.dice)];
  const moves = [];

  if (s.bar[player] > 0 && origin !== "BAR") return [];
  if (origin === "BAR" && s.bar[player] === 0) return [];

  let startStep = -1;
  if (origin !== "BAR") {
    const pt = s.points[origin];
    if (!pt || pt.owner !== player || pt.count === 0) return [];
    startStep = path.indexOf(origin);
    if (v === "FEVGA" && startStep === 0 && !s.fevgaPassed[player] && pt.count <= 14) {
      return [];
    }
  }

  const canBearOff = isReadyToBearOffState(s, player, v, path);

  for (const die of uniqueDice) {
    const targetStep = startStep + die;
    if (targetStep >= 24) {
      if (!canBearOff || origin === "BAR") continue;
      if (targetStep === 24) {
        moves.push({ from: origin, to: "OFF", die, exact: true });
      } else {
        const hasFurtherBack = path.slice(18, startStep).some(idx => s.points[idx].owner === player && s.points[idx].count > 0);
        if (!hasFurtherBack) moves.push({ from: origin, to: "OFF", die, exact: false });
      }
      continue;
    }

    const destIdx = path[targetStep];
    const destPt = s.points[destIdx];

    if (v === "PORTES") {
      if (destPt.owner === opp && destPt.count >= 2) continue;
      moves.push({ from: origin, to: destIdx, die });
    } else if (v === "PLAKOTO") {
      if (destPt.owner === opp && destPt.count >= 2) continue;
      if (destPt.pinned !== null && destPt.owner === opp) continue;
      moves.push({ from: origin, to: destIdx, die });
    } else if (v === "FEVGA") {
      if (destPt.owner === opp && destPt.count >= 1) continue;
      moves.push({ from: origin, to: destIdx, die });
    }
  }
  return moves;
}

function getSingleStepMovesFrom(s, origin, player) {
  const rawMoves = getRawSingleMovesIgnoringPrime(s, origin, player);
  const seq = s.variantSequence && s.variantSequence.length ? s.variantSequence : ["PORTES", "PLAKOTO", "FEVGA"];
  const v = seq[s.variantIdx % seq.length];
  if (v !== "FEVGA") return rawMoves;

  return rawMoves.filter(m => {
    const nextS = cloneState(s);
    applySingleStepToState(nextS, m);
    return canUnblockFevgaPrimeBeforeTurnEnd(nextS, player);
  });
}

function isReadyToBearOffState(s, player, variant, path) {
  if (s.bar[player] > 0) return false;
  if (variant === "PLAKOTO" && s.points.some(p => p.pinned === player)) return false;
  for (let step = 0; step < 18; step++) {
    const pt = s.points[path[step]];
    if (pt.owner === player && pt.count > 0) return false;
  }
  return true;
}

function applySingleStepToState(s, step) {
  const { from, to, die } = step;
  const player = s.turn;
  const opp = player === "W" ? "B" : "W";
  const seq = s.variantSequence && s.variantSequence.length ? s.variantSequence : ["PORTES", "PLAKOTO", "FEVGA"];
  const v = seq[s.variantIdx % seq.length];
  const path = getPath(v, player);
  let wasHit = false;
  let wasPin = false;

  if (from === "BAR") {
    s.bar[player]--;
  } else {
    const src = s.points[from];
    src.count--;
    if (src.count === 0) {
      if (src.pinned) {
        src.owner = src.pinned;
        src.count = 1;
        src.pinned = null;
      } else {
        src.owner = null;
      }
    }
  }

  if (to === "OFF") {
    s.off[player]++;
  } else {
    const dst = s.points[to];
    if (v === "PORTES" && dst.owner === opp && dst.count === 1) {
      dst.owner = player;
      dst.count = 1;
      s.bar[opp]++;
      wasHit = true;
    } else if (v === "PLAKOTO" && dst.owner === opp && dst.count === 1) {
      dst.pinned = opp;
      dst.owner = player;
      dst.count = 1;
      wasPin = true;
    } else {
      dst.owner = player;
      dst.count++;
    }

    if (v === "FEVGA" && path.indexOf(to) >= 12) {
      s.fevgaPassed[player] = true;
    }
  }

  const dieIdx = s.dice.indexOf(die);
  if (dieIdx > -1) s.dice.splice(dieIdx, 1);

  let manaWin = false;
  if (v === "PLAKOTO") {
    const oppStartIdx = opp === "W" ? 23 : 0;
    const myStartIdx = player === "W" ? 23 : 0;
    if (s.points[oppStartIdx].pinned === opp && s.points[myStartIdx].pinned !== player) {
      manaWin = true;
    }
  }

  return { wasHit, wasPin, wasHitOrPin: (wasHit || wasPin), manaWin, bearOffWin: s.off[player] === 15 };
}

function getMovesFrom(origin, player) {
  const resultsByDest = new Map();

  function explore(currentState, currentOrigin, stepsSoFar) {
    const singleMoves = getSingleStepMovesFrom(currentState, currentOrigin, player);
    for (const step of singleMoves) {
      const nextState = cloneState(currentState);
      const outcome = applySingleStepToState(nextState, step);
      const newSteps = [...stepsSoFar, step];
      const totalDist = newSteps.reduce((sum, st) => sum + st.die, 0);

      if (!resultsByDest.has(step.to)) {
        resultsByDest.set(step.to, {
          to: step.to,
          steps: newSteps,
          badge: `${totalDist}`
        });
      }

      if (
        step.to !== "OFF" &&
        !outcome.manaWin &&
        !outcome.bearOffWin &&
        nextState.dice.length > 0 &&
        nextState.bar[player] === 0
      ) {
        explore(nextState, step.to, newSteps);
      }
    }
  }

  explore(state, origin, []);
  return Array.from(resultsByDest.values());
}

function hasAnyLegalMove(player) {
  if (state.bar[player] > 0) return getSingleStepMovesFrom(state, "BAR", player).length > 0;
  for (let i = 0; i < 24; i++) {
    if (getSingleStepMovesFrom(state, i, player).length > 0) return true;
  }
  return false;
}

// --- AI Engine ---
function generateAllLegalTurnSequences(rootState, player) {
  const completed = [];
  const MAX_BRANCHES = 220;

  function dfs(curState, seqSoFar) {
    if (completed.length >= MAX_BRANCHES) return;
    if (curState.dice.length === 0) {
      if (!isFevgaStartingPrimeOccupied(curState, player)) {
        completed.push({ finalState: curState, steps: seqSoFar });
      }
      return;
    }

    const singleMoves = [];
    if (curState.bar[player] > 0) {
      singleMoves.push(...getSingleStepMovesFrom(curState, "BAR", player));
    } else {
      for (let i = 0; i < 24; i++) {
        if (curState.points[i].owner === player && curState.points[i].count > 0) {
          singleMoves.push(...getSingleStepMovesFrom(curState, i, player));
        }
      }
    }

    if (singleMoves.length === 0) {
      if (!isFevgaStartingPrimeOccupied(curState, player)) {
        completed.push({ finalState: curState, steps: seqSoFar });
      }
      return;
    }

    const seen = new Set();
    for (const m of singleMoves) {
      const key = `${m.from}->${m.to}:${m.die}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const nextS = cloneState(curState);
      const out = applySingleStepToState(nextS, m);
      const nextSeq = [...seqSoFar, m];

      if (out.manaWin || out.bearOffWin) {
        completed.push({ finalState: nextS, steps: nextSeq, instantWin: true });
      } else {
        dfs(nextS, nextSeq);
      }
    }
  }

  dfs(rootState, []);
  return completed;
}

function evaluateStateProbability(s, aiPlayer) {
  const human = aiPlayer === "W" ? "B" : "W";
  const v = currentVariant();
  const aiPath = getPath(v, aiPlayer);
  const huPath = getPath(v, human);

  if (s.off[aiPlayer] === 15) return 100000;
  if (v === "PLAKOTO") {
    const huStart = human === "W" ? 23 : 0;
    const aiStart = aiPlayer === "W" ? 23 : 0;
    if (s.points[huStart].pinned === human && s.points[aiStart].pinned !== aiPlayer) return 100000;
  }

  let score = (s.off[aiPlayer] - s.off[human]) * 48;
  let aiPips = s.bar[aiPlayer] * 25;
  let huPips = s.bar[human] * 25;

  for (let step = 0; step < 24; step++) {
    const idxAi = aiPath[step];
    if (s.points[idxAi].owner === aiPlayer) aiPips += s.points[idxAi].count * (24 - step);
    const idxHu = huPath[step];
    if (s.points[idxHu].owner === human) huPips += s.points[idxHu].count * (24 - step);
  }
  score += (huPips - aiPips) * 1.35;
  return score;
}

function playAiTurnSequence() {
  if (!isAiMatch || state.turn !== "B" || !state.rolled || state.phase !== "PLAY") return;

  const allSeqs = generateAllLegalTurnSequences(state, "B");
  if (allSeqs.length === 0 || allSeqs[0].steps.length === 0) {
    handleEndTurn(true);
    return;
  }

  let chosen = allSeqs[0];
  let bestScore = -Infinity;
  for (const item of allSeqs) {
    if (item.instantWin) { chosen = item; break; }
    const noise = myAiDifficulty === "EASY" ? (Math.random() * 120 - 60) : (myAiDifficulty === "MEDIUM" ? (Math.random() * 28 - 14) : 0);
    const sc = evaluateStateProbability(item.finalState, "B") + noise;
    if (sc > bestScore) { bestScore = sc; chosen = item; }
  }

  const stepsQueue = [...chosen.steps];
  function runNextAiStep() {
    if (stepsQueue.length === 0 || state.turn !== "B" || state.phase !== "PLAY") {
      if (state.turn === "B" && state.phase === "PLAY") setTimeout(() => handleEndTurn(true), 320);
      return;
    }
    const nextStep = stepsQueue.shift();
    executeMoveSequence([nextStep], () => {
      if (state.turn === "B" && state.phase === "PLAY" && stepsQueue.length > 0) {
        setTimeout(runNextAiStep, 260);
      } else if (state.turn === "B" && state.phase === "PLAY") {
        setTimeout(() => handleEndTurn(true), 340);
      }
    });
  }
  runNextAiStep();
}

// --- Animations & Board Interaction ---
function animateBoardRollOffDie(side, onComplete) {
  isAnimatingDice = true;
  playDiceRattle();
  const leftZone = document.getElementById("rollOffLeftZone");
  const rightZone = document.getElementById("rollOffRightZone");

  const shuffleTimer = setInterval(() => {
    if (side === "W") {
      leftZone.innerHTML = "";
      leftZone.appendChild(createDieEl(cryptoDie(), true, false, "W"));
    } else {
      if (state.rollOff.W !== null && leftZone.children.length === 0) {
        leftZone.appendChild(createDieEl(state.rollOff.W, false, false, "W"));
      }
      rightZone.innerHTML = "";
      rightZone.appendChild(createDieEl(cryptoDie(), true, false, "B"));
    }
  }, 85);

  setTimeout(() => {
    clearInterval(shuffleTimer);
    isAnimatingDice = false;
    render();
    if (onComplete) onComplete();
  }, 550);
}

function resolveRollOffOutcome() {
  const wRoll = state.rollOff.W;
  const bRoll = state.rollOff.B;
  if (wRoll === null || bRoll === null) return;
  const tr = t();

  if (wRoll === bRoll) {
    setStatus(tr.rollOffTie(wRoll, bRoll));
    render();
    rollOffTimer = setTimeout(() => {
      state.rollOff = { W: null, B: null };
      state.displayDice = [];
      state.rolled = false;
      state.turn = "W";
      if (myRole === "W" || myRole === "BOTH") playTurnChime();
      render();
      checkTriggerAutoRollOrAI();
    }, 1500);
  } else {
    const winner = wRoll > bRoll ? "W" : "B";
    const winName = winner === "W" ? playerNames.W : playerNames.B;
    setStatus(tr.rollOffWin(playerNames.W, wRoll, playerNames.B, bRoll, winName));
    render();
    rollOffTimer = setTimeout(() => {
      state.phase = "PLAY";
      state.rollOff = { W: null, B: null };
      state.displayDice = [];
      state.dice = [];
      state.rolled = false;
      state.turn = winner;
      if (myRole === winner || (myRole === "BOTH" && !isAiMatch)) playTurnChime();
      setStatus(t().rollOffStart(winName, state.autoRoll || (isAiMatch && winner === "B")));
      saveActiveRoomBackup();
      render();
      checkTriggerAutoRollOrAI();
    }, 1500);
  }
}

function animateDiceRoll(numDice = 2, onComplete) {
  isAnimatingDice = true;
  playDiceRattle();
  const leftZone = document.getElementById("rollOffLeftZone");
  const rightZone = document.getElementById("rollOffRightZone");
  const activePlayer = state.turn;

  const shuffleTimer = setInterval(() => {
    leftZone.innerHTML = "";
    rightZone.innerHTML = "";
    leftZone.appendChild(createDieEl(cryptoDie(), true, false, activePlayer));
    if (numDice > 1) rightZone.appendChild(createDieEl(cryptoDie(), true, false, activePlayer));
  }, 85);

  setTimeout(() => {
    clearInterval(shuffleTimer);
    isAnimatingDice = false;
    render();
    if (onComplete) onComplete();
  }, 550);
}

function animateCheckerTransition(fromLoc, toLoc, player, onComplete) {
  const srcEl = getSlotOrPointElement(fromLoc, player);
  const dstEl = getSlotOrPointElement(toLoc, player);
  if (!srcEl || !dstEl) {
    if (onComplete) onComplete();
    return;
  }

  const srcCheckers = srcEl.querySelectorAll(".checker:not(.pinned-base)");
  const startTarget = srcCheckers.length > 0 ? srcCheckers[srcCheckers.length - 1] : srcEl;
  const startRect = startTarget.getBoundingClientRect();

  const dstCheckers = dstEl.querySelectorAll(".checker");
  const endTarget = dstCheckers.length > 0 ? dstCheckers[dstCheckers.length - 1] : dstEl;
  const endRect = endTarget.getBoundingClientRect();

  const size = startTarget.classList && startTarget.classList.contains("checker")
    ? startRect.width
    : Math.min(srcEl.getBoundingClientRect().width * 0.78, 38);

  const startX = startRect.left + (startRect.width - size) / 2;
  const startY = startRect.top + (startRect.height - size) / 2;
  const endX = endRect.left + (endRect.width - size) / 2;
  const endY = endRect.top + (endRect.height - size) / 2;

  const flyer = document.createElement("div");
  const ownerColor = state.colors[player];
  flyer.className = `checker clr-${ownerColor} flying-checker`;
  flyer.style.width = `${size}px`;
  flyer.style.height = `${size}px`;
  flyer.style.left = `${startX}px`;
  flyer.style.top = `${startY}px`;

  if (startTarget !== srcEl) {
    const originCount = fromLoc === "BAR"
      ? state.bar[player]
      : (state.points[fromLoc] ? state.points[fromLoc].count : 1);
    const maxVis = (fromLoc !== "BAR" && state.points[fromLoc] && state.points[fromLoc].pinned) ? 4 : 5;
    if (originCount > maxVis) {
      startTarget.textContent = originCount - 1 > maxVis ? String(originCount - 1) : "";
    } else {
      startTarget.style.opacity = "0";
    }
  }

  document.body.appendChild(flyer);
  void flyer.offsetWidth;
  flyer.style.left = `${endX}px`;
  flyer.style.top = `${endY}px`;
  flyer.style.transform = "scale(1.12)";

  isAnimatingChecker = true;
  setTimeout(() => {
    flyer.remove();
    isAnimatingChecker = false;
    if (onComplete) onComplete();
  }, 275);
}

function getSlotOrPointElement(loc, player) {
  if (loc === "BAR") return document.querySelector(`[data-bar-owner="${player}"]`);
  if (loc === "OFF") return document.querySelector(`[data-off-owner="${player}"]`);
  return document.querySelector(`.point[data-pt-idx="${loc}"]`);
}

function tryBearOffFromPoint(idx) {
  if (myRole === "SPECTATOR") return false;
  if (state.phase !== "PLAY" || isWaitingForReconnect || !state.rolled || isAnimatingDice || isAnimatingChecker) return false;
  if (myRole !== "BOTH" && myRole !== state.turn) return false;

  const player = state.turn;
  const moves = getSingleStepMovesFrom(state, idx, player).filter(m => m.to === "OFF");
  if (moves.length === 0) return false;

  moves.sort((a, b) => {
    if (a.exact !== b.exact) return a.exact ? -1 : 1;
    return a.die - b.die;
  });

  executeMoveSequence([moves[0]]);
  return true;
}

function selectBar(player) {
  if (myRole === "SPECTATOR") return;
  if (state.phase !== "PLAY" || isWaitingForReconnect || !state.rolled || isAnimatingDice || isAnimatingChecker || state.turn !== player) return;
  if (myRole !== "BOTH" && myRole !== state.turn) return;
  selectedFrom = "BAR";
  validTargets = getMovesFrom("BAR", player);
  render();
}

function handlePointClick(idx) {
  if (myRole === "SPECTATOR") return;
  if (state.phase !== "PLAY" || isWaitingForReconnect || !state.rolled || isAnimatingDice || isAnimatingChecker) return;
  if (myRole !== "BOTH" && myRole !== state.turn) return;

  const now = Date.now();
  const isDoubleTap = (lastPointTap.idx === idx && (now - lastPointTap.time) < 360);
  lastPointTap = { idx, time: now };

  if (isDoubleTap && state.points[idx].owner === state.turn && state.points[idx].count > 0) {
    if (tryBearOffFromPoint(idx)) {
      lastPointTap = { idx: -1, time: 0 };
      return;
    }
  }

  const move = validTargets.find(m => m.to === idx);
  if (move && selectedFrom !== null) {
    executeMoveSequence(move.steps);
    return;
  }

  if (state.points[idx].owner === state.turn && state.points[idx].count > 0) {
    selectedFrom = idx;
    validTargets = getMovesFrom(idx, state.turn);
    render();
  }
}

function attemptBearOff() {
  if (myRole === "SPECTATOR") return;
  if (state.phase !== "PLAY" || isWaitingForReconnect || !state.rolled || isAnimatingDice || isAnimatingChecker || selectedFrom === null) return;
  if (myRole !== "BOTH" && myRole !== state.turn) return;
  const move = validTargets.find(m => m.to === "OFF");
  if (move) executeMoveSequence(move.steps);
}

function executeMoveSequence(steps, onSequenceDone = null) {
  const startOrigin = steps[0].from;
  const finalDest = steps[steps.length - 1].to;
  const movingPlayer = state.turn;

  selectedFrom = null;
  validTargets = [];

  animateCheckerTransition(startOrigin, finalDest, movingPlayer, () => {
    turnHistory.push(cloneState(state));

    const player = state.turn;
    const opp = player === "W" ? "B" : "W";
    let anyHit = false;
    let anyPin = false;
    let manaWin = false;
    let bearOffWin = false;

    for (const step of steps) {
      const outcome = applySingleStepToState(state, step);
      if (outcome.wasHit) anyHit = true;
      if (outcome.wasPin) anyPin = true;
      if (outcome.manaWin) { manaWin = true; break; }
      if (outcome.bearOffWin) { bearOffWin = true; break; }
    }

    const soundAction = anyPin ? "PIN" : (anyHit ? "HIT" : "MOVE");
    playCheckerClack(soundAction);
    state.lastAction = soundAction;
    state.lastMoveAnim = { from: startOrigin, to: finalDest, player };

    if (isTutorialMode) {
      render();
      if (typeof checkTutorialStepCompletion === "function") {
        checkTutorialStepCompletion();
      }
      return;
    }

    if (manaWin) {
      finishGame(player, 2, t().manaWin, { from: startOrigin, to: finalDest, player });
      return;
    }

    if (bearOffWin) {
      const pts = state.off[opp] === 0 ? 2 : 1;
      const wName = player === "W" ? playerNames.W : playerNames.B;
      finishGame(player, pts, t().gameWin(wName, pts, wName), { from: startOrigin, to: finalDest, player });
      return;
    }

    if (onSequenceDone) {
      render();
      onSequenceDone();
      return;
    }

    const turnFinished = state.dice.length === 0 || !hasAnyLegalMove(state.turn);
    if (turnFinished && !isFevgaStartingPrimeOccupied(state, state.turn)) {
      if (!state.requireEndTurn) {
        syncState();
        render();
        setTimeout(() => {
          handleEndTurn(true);
        }, 320);
        return;
      }
      setStatus(t().movesComplete);
    }

    syncState();
    render();
  });
}

function handleUndo() {
  if (myRole === "SPECTATOR") return;
  if (turnHistory.length === 0 || isWaitingForReconnect || isAnimatingDice || isAnimatingChecker) return;
  if (myRole !== "BOTH" && myRole !== state.turn) return;

  state = turnHistory.pop();
  state.lastAction = "UNDO";
  state.lastMoveAnim = null;
  selectedFrom = null;
  validTargets = [];
  playCheckerClack("MOVE");
  setStatus(t().moveUndone);
  syncState();
  render();
}

function handleEndTurn(forcedOrAuto = false) {
  if (myRole === "SPECTATOR" || isTutorialMode) return;
  if (!state.rolled || isWaitingForReconnect || isAnimatingDice || isAnimatingChecker) return;
  if (!forcedOrAuto && myRole !== "BOTH" && myRole !== state.turn) return;
  if (!forcedOrAuto && state.dice.length > 0 && hasAnyLegalMove(state.turn)) return;
  if (!forcedOrAuto && isFevgaStartingPrimeOccupied(state, state.turn)) return;

  state.turn = state.turn === "W" ? "B" : "W";
  state.rolled = false;
  state.dice = [];
  state.displayDice = [];
  state.lastAction = "END_TURN";
  state.lastMoveAnim = null;
  turnHistory = [];
  selectedFrom = null;
  validTargets = [];

  const nextName = state.turn === "W" ? playerNames.W : playerNames.B;
  const willAutoRoll = state.autoRoll || (isAiMatch && state.turn === "B");
  setStatus(t().nextTurnStatus(nextName, willAutoRoll));

  if ((myRole === "BOTH" && !isAiMatch) || (isAiMatch && state.turn === "W")) {
    playTurnChime();
  }

  syncState();
  render();
  checkTriggerAutoRollOrAI();
}

function finishGame(winner, pts, reason, winningMoveAnim = null) {
  playWinFanfare();
  const playedVariant = currentVariant();
  turnHistory = [];
  if (winner === "W") state.scoreW += pts; else state.scoreB += pts;
  setStatus(reason);

  if (!Array.isArray(state.setGamesLog)) state.setGamesLog = [];
  state.setGamesLog.push({
    gameNum: state.setGamesLog.length + 1,
    variant: playedVariant,
    winner,
    pts
  });

  const target = state.targetScore || 7;
  const isMatchOver = (state.scoreW >= target || state.scoreB >= target);

  let winEv = null;
  if (!isAiMatch && !isTutorialMode) {
    winEv = {
      id: Date.now() + "-" + cryptoDie(),
      winner,
      nameW: playerNames.W,
      nameB: playerNames.B,
      variant: playedVariant,
      matchOver: isMatchOver
    };
    state.lastWinEvent = winEv;
    recordWinEventToDatabase(winEv);
  } else {
    state.lastWinEvent = null;
  }

  if (isMatchOver) {
    clearActiveRoomBackup();
    const summaryObj = {
      id: "SET-" + Date.now() + "-" + cryptoDie(),
      champRole: winner,
      scoreW: state.scoreW,
      scoreB: state.scoreB,
      target,
      gamesLog: cloneState(state.setGamesLog),
      rollCounts: cloneState(state.setRollCounts || { W: {}, B: {} })
    };
    state.phase = "SET_OVER";
    state.rolled = false;
    state.dice = [];
    state.displayDice = [];
    state.lastSetSummary = summaryObj;
    state.lastAction = "WIN";
    state.lastMoveAnim = winningMoveAnim;
    state.lastWinEvent = winEv;

    syncState();
    render();
    showSetVictoryModal(summaryObj);
  } else {
    state.variantIdx = (state.variantIdx + 1) % state.variantSequence.length;
    initGame(winner);
    state.lastAction = "WIN";
    state.lastMoveAnim = winningMoveAnim;
    state.lastWinEvent = winEv;
    syncState();
    render();
  }
}

function openResignOfferModal() {
  if (myRole === "SPECTATOR" || isTutorialMode || state.phase !== "PLAY" || isWaitingForReconnect) return;
  document.getElementById("resignOfferModal").style.display = "flex";
}

function closeResignOfferModal() {
  document.getElementById("resignOfferModal").style.display = "none";
}

function sendResignOffer(pts) {
  if (myRole === "SPECTATOR" || isTutorialMode) return;
  closeResignOfferModal();
  const validPts = pts === 2 ? 2 : 1;
  const resigningRole = myRole === "BOTH" ? state.turn : myRole;
  const winnerRole = resigningRole === "W" ? "B" : "W";
  const loserName = resigningRole === "W" ? playerNames.W : playerNames.B;
  const winnerName = winnerRole === "W" ? playerNames.W : playerNames.B;
  const tr = t();

  if (isAiMatch) {
    finishGame(winnerRole, validPts, tr.resignAcceptedReason(loserName, winnerName, validPts));
    return;
  }

  if (conn && conn.open) {
    pendingResignOffer = { fromRole: resigningRole, pts: validPts };
    conn.send({
      type: "RESIGN_OFFER",
      fromRole: resigningRole,
      pts: validPts
    });
    setStatus(tr.resignSent(validPts));
    return;
  }

  pendingResignOffer = { fromRole: resigningRole, pts: validPts };
  document.getElementById("resignRespDesc").textContent = tr.resignRespDesc(loserName, validPts);
  document.getElementById("resignRespondModal").style.display = "flex";
}

function respondToResignOffer(accepted) {
  document.getElementById("resignRespondModal").style.display = "none";
  if (!pendingResignOffer) return;

  const { fromRole, pts } = pendingResignOffer;
  pendingResignOffer = null;
  const winnerRole = fromRole === "W" ? "B" : "W";
  const loserName = fromRole === "W" ? playerNames.W : playerNames.B;
  const winnerName = winnerRole === "W" ? playerNames.W : playerNames.B;
  const tr = t();

  if (conn && conn.open) {
    conn.send({
      type: "RESIGN_RESPONSE",
      accepted,
      fromRole,
      pts
    });
  }

  if (accepted) {
    finishGame(winnerRole, pts, tr.resignAcceptedReason(loserName, winnerName, pts));
  } else {
    setStatus(tr.resignDeclined(winnerName));
  }
}

function spawnCelebrationConfetti() {
  const layer = document.getElementById("confettiLayer");
  if (!layer) return;
  if (confettiCleanupTimer) clearTimeout(confettiCleanupTimer);
  layer.innerHTML = "";
  const colors = ["#ffb300", "#00e676", "#4fc3f7", "#ff5252", "#ce93d8", "#ffee58"];
  for (let i = 0; i < 36; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = `${(i * 2.8) % 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDuration = `${1.4 + (i % 4) * 0.18}s`;
    piece.style.animationDelay = `${(i % 5) * 0.08}s`;
    layer.appendChild(piece);
  }
  confettiCleanupTimer = setTimeout(() => {
    layer.innerHTML = "";
  }, 2000);
}

function changeSetGamesPage(delta) {
  setGamesCurrentPage += delta;
  renderSetVictoryModalBody();
}

function showSetVictoryModal(summary) {
  if (!summary || summary.id === lastShownSummaryId) return;
  lastShownSummaryId = summary.id;
  activeSetSummaryObj = summary;
  setGamesCurrentPage = 1;
  myRematchVote = false;
  peerRematchVote = false;

  renderSetVictoryModalBody();
  spawnCelebrationConfetti();
  document.getElementById("setSummaryModal").style.display = "flex";
}

function renderSetVictoryModalBody() {
  const summary = activeSetSummaryObj;
  if (!summary) return;

  const tr = t();
  const champName = summary.champRole === "W" ? playerNames.W : playerNames.B;
  const topComboW = getMostRolledComboStr(summary.rollCounts && summary.rollCounts.W);
  const topComboB = getMostRolledComboStr(summary.rollCounts && summary.rollCounts.B);

  const allGames = summary.gamesLog || [];
  const gamesWonW = allGames.filter(g => g.winner === "W").length;
  const gamesWonB = allGames.filter(g => g.winner === "B").length;

  const totalPages = Math.max(1, Math.ceil(allGames.length / PAGE_SIZE));
  if (setGamesCurrentPage > totalPages) setGamesCurrentPage = totalPages;
  if (setGamesCurrentPage < 1) setGamesCurrentPage = 1;

  const startIdx = (setGamesCurrentPage - 1) * PAGE_SIZE;
  const pageGames = allGames.slice(startIdx, startIdx + PAGE_SIZE);

  let gamesRows = "";
  pageGames.forEach(g => {
    const wName = g.winner === "W" ? playerNames.W : playerNames.B;
    const vLabel = tr.variants[g.variant] || g.variant;
    const ptsLabel = g.forfeit ? "Forfeit (Set Win)" : (g.pts === 2 ? "+2 (Diplo • 1 Game Win)" : "+1 (Moni • 1 Game Win)");
    gamesRows += `
      <tr>
        <td>#${g.gameNum}</td>
        <td>${escapeHtml(vLabel)}</td>
        <td><strong style="color:var(--accent);">${escapeHtml(wName)}</strong></td>
        <td>${ptsLabel}</td>
      </tr>
    `;
  });

  const pagerHtml = totalPages > 1 ? `
    <div class="pagination-bar">
      <button onclick="changeSetGamesPage(-1)" ${setGamesCurrentPage <= 1 ? "disabled" : ""}>${tr.prevPage}</button>
      <span>${tr.pageOf(setGamesCurrentPage, totalPages)}</span>
      <button onclick="changeSetGamesPage(1)" ${setGamesCurrentPage >= totalPages ? "disabled" : ""}>${tr.nextPage}</button>
    </div>
  ` : "";

  const isSpectator = (myRole === "SPECTATOR");
  const actionButtonsHtml = isSpectator
    ? `<div class="set-Action-row">
         <button class="btn-exit-menu" onclick="handleExitToInitialMenu(true)">${tr.btnExitMenu}</button>
       </div>`
    : `<p style="font-size:0.8rem; color:#d7ccc8; text-align:center; margin-top:8px;">
         ${escapeHtml(tr.setPlayAgainPrompt)}
       </p>
       <div id="rematchWaitMsg" style="font-size:0.78rem; color:var(--valid); text-align:center; font-weight:bold; min-height:18px; margin-top:4px;">
         ${myRematchVote ? escapeHtml(tr.waitingOpponentRematch) : ""}
       </div>
       <div class="set-Action-row">
         <button class="btn-play-again" id="btnRematchConfirm" onclick="handlePlayAgainSameSettings()" ${myRematchVote ? "disabled" : ""}>${tr.btnPlayAgain}</button>
         <button class="btn-exit-menu" onclick="handleExitToInitialMenu(true)">${tr.btnExitMenu}</button>
       </div>`;

  const content = document.getElementById("setSummaryContent");
  content.innerHTML = `
    <div class="trophy-banner">
      <div class="trophy-icon">🏆</div>
      <div class="winner-headline">${escapeHtml(tr.setWinHeadline(champName))}</div>
      <div style="font-size:0.82rem; color:#ffecb3; margin-top:4px;">
        ${escapeHtml(tr.setScoreSub(summary.scoreW, summary.scoreB, summary.target, gamesWonW, gamesWonB, allGames.length))}
      </div>
    </div>

    <div class="sub-heading">${tr.setGamesHeading}</div>
    <table class="data-table">
      <thead>
        <tr>
          <th>${tr.colGameNum}</th>
          <th>${tr.colVariant}</th>
          <th>${tr.colWinner}</th>
          <th>${tr.colPts}</th>
        </tr>
      </thead>
      <tbody>${gamesRows}</tbody>
    </table>
    ${pagerHtml}

    <div class="sub-heading">${tr.setTopDiceHeading}</div>
    <div class="stat-grid" style="grid-template-columns: 1fr 1fr;">
      <div class="stat-box">
        <div class="val" style="font-size:1rem;">🎲 ${escapeHtml(topComboW)}</div>
        <div class="lbl">${escapeHtml(playerNames.W)}</div>
      </div>
      <div class="stat-box">
        <div class="val" style="font-size:1rem;">🎲 ${escapeHtml(topComboB)}</div>
        <div class="lbl">${escapeHtml(playerNames.B)}</div>
      </div>
    </div>

    ${actionButtonsHtml}
  `;
}

function startNewSetWithSameSettings() {
  document.getElementById("setSummaryModal").style.display = "none";
  state.scoreW = 0;
  state.scoreB = 0;
  state.variantIdx = 0;
  resetSetTracking();
  initGame("ROLL_OFF");
  if (myRole === "W") syncState();
}

function handlePlayAgainSameSettings() {
  if (myRole === "SPECTATOR") return;
  if (!conn || !conn.open || isAiMatch) {
    startNewSetWithSameSettings();
    return;
  }

  myRematchVote = true;
  const btn = document.getElementById("btnRematchConfirm");
  if (btn) btn.disabled = true;
  const waitEl = document.getElementById("rematchWaitMsg");
  if (waitEl) waitEl.textContent = t().waitingOpponentRematch;

  conn.send({ type: "SET_DECISION", decision: "PLAY_AGAIN" });
  if (peerRematchVote) startNewSetWithSameSettings();
}

function handleExitToInitialMenu(notifyPeer = true) {
  stopHelloRetry();
  stopDisconnectCountdown();
  clearActiveRoomBackup();
  isTutorialMode = false;
  if (typeof syncTutorialPanelPlacement === "function") {
    syncTutorialPanelPlacement();
  }

  document.getElementById("setSummaryModal").style.display = "none";
  document.getElementById("playConfigModal").style.display = "none";

  if (notifyPeer && myRole !== "SPECTATOR" && conn && conn.open) {
    try { conn.send({ type: "SET_DECISION", decision: "EXIT_MENU" }); } catch (_) {}
  }
  if (conn) {
    try { conn.close(); } catch (_) {}
    conn = null;
  }
  spectatorConns.forEach(sc => {
    try { sc.close(); } catch (_) {}
  });
  spectatorConns = [];

  if (peer) {
    try { peer.destroy(); } catch (_) {}
    peer = null;
  }

  if (window.location.search) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  activeRoomCode = "";
  pendingRoomFromUrl = null;
  isAiMatch = false;
  myRole = "BOTH";
  opponentLeftHandled = false;
  updateSpectatorBadge(0);
  document.getElementById("shareBtn").style.display = "none";
  document.getElementById("netBar").classList.remove("left-alert");
  document.getElementById("netStatus").textContent = t().netDefault;

  showScreen("LANDING");
}

function stopDisconnectCountdown() {
  if (disconnectInterval) {
    clearInterval(disconnectInterval);
    disconnectInterval = null;
  }
  isWaitingForReconnect = false;
  opponentLeftHandled = false;
  const pill = document.getElementById("disconnectCountdown");
  if (pill) pill.style.display = "none";
  document.getElementById("netBar").classList.remove("left-alert");
}

function formatCountdownMMSS(msRemaining) {
  const totalSec = Math.max(0, Math.ceil(msRemaining / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function awardForfeitSetWinToConnectedPlayer() {
  stopDisconnectCountdown();
  clearActiveRoomBackup();

  const winnerRole = myRole === "B" ? "B" : "W";
  const loserRole = winnerRole === "W" ? "B" : "W";
  const winnerName = winnerRole === "W" ? playerNames.W : playerNames.B;
  const loserName = loserRole === "W" ? playerNames.W : playerNames.B;
  const tr = t();
  const target = state.targetScore || 7;

  if (winnerRole === "W") state.scoreW = Math.max(state.scoreW, target);
  else state.scoreB = Math.max(state.scoreB, target);

  const reason = tr.forfeitTimeoutReason(loserName, winnerName);
  setStatus(reason);

  const playedVariant = currentVariant();
  if (!Array.isArray(state.setGamesLog)) state.setGamesLog = [];
  state.setGamesLog.push({
    gameNum: state.setGamesLog.length + 1,
    variant: playedVariant,
    winner: winnerRole,
    pts: 1,
    forfeit: true
  });

  const winEv = {
    id: "FORFEIT-" + Date.now(),
    winner: winnerRole,
    nameW: playerNames.W,
    nameB: playerNames.B,
    variant: playedVariant,
    matchOver: true,
    forfeitSetOnly: false
  };
  recordWinEventToDatabase(winEv);

  const summaryObj = {
    id: "SET-FORFEIT-" + Date.now(),
    champRole: winnerRole,
    scoreW: state.scoreW,
    scoreB: state.scoreB,
    target,
    gamesLog: cloneState(state.setGamesLog),
    rollCounts: cloneState(state.setRollCounts || { W: {}, B: {} })
  };
  state.phase = "SET_OVER";
  state.rolled = false;
  state.dice = [];
  state.displayDice = [];
  state.lastSetSummary = summaryObj;

  playWinFanfare();
  render();
  showSetVictoryModal(summaryObj);
}

// ============================================================================
// WEBRTC MULTIPLAYER & RELIABLE SPECTATOR HANDSHAKE RELAY HUB (v20)
// ============================================================================
function safeSend(targetConn, payload) {
  if (!targetConn) return;
  if (targetConn.open) {
    try { targetConn.send(payload); } catch (_) {}
  } else {
    targetConn.once("open", () => {
      try { targetConn.send(payload); } catch (_) {}
    });
  }
}

function broadcastFromHostToAll(packet, excludeConn = null) {
  if (myRole !== "W") return;
  if (conn && conn.open && conn !== excludeConn) {
    try { conn.send(packet); } catch (_) {}
  }
  spectatorConns = spectatorConns.filter(sc => sc && sc.open);
  spectatorConns.forEach(sc => {
    if (sc !== excludeConn) {
      try { sc.send(packet); } catch (_) {}
    }
  });
}

function broadcastSpectatorCountFromHost() {
  if (myRole !== "W") return;
  spectatorConns = spectatorConns.filter(sc => sc && sc.open);
  const count = spectatorConns.length;
  updateSpectatorBadge(count);
  broadcastFromHostToAll({ type: "SPECTATOR_COUNT", count });
}

function hostRoom(reconnectingCode = null, restoredBackup = null) {
  ensureAudio();
  stopHelloRetry();
  stopDisconnectCountdown();
  isAiMatch = false;
  isTutorialMode = false;
  if (typeof syncTutorialPanelPlacement === "function") {
    syncTutorialPanelPlacement();
  }
  spectatorConns = [];
  const code = reconnectingCode || generateSecureRoomCode();
  activeRoomCode = code;
  packetQueue = [];
  isProcessingPacket = false;
  if (peer) peer.destroy();

  peer = new Peer("tavli-net-" + code, PEER_CONFIG);
  document.getElementById("netStatus").textContent = t().hostingWait(code);
  document.getElementById("shareBtn").style.display = "inline-block";
  myRole = "W";
  updateSpectatorBadge(0);

  if (restoredBackup && restoredBackup.state) {
    playerNames = cloneState(restoredBackup.playerNames || { W: myPlayerName, B: "Friend" });
    state = cloneState(restoredBackup.state);
    state.playerNames = { W: playerNames.W, B: playerNames.B };
    updateHeaderLabels();
    render();
  } else {
    playerNames.W = myPlayerName;
    state.playerNames = { W: playerNames.W, B: playerNames.B };
    state.colors.W = myChosenColor;
    if (state.colors.B === state.colors.W) {
      state.colors.B = getDistinctFallbackColor(state.colors.W);
    }
    state.requireEndTurn = myEndTurnPref;
    state.autoRoll = myAutoRollPref;
    state.targetScore = myTargetScorePref;
    state.variantSequence = getSequenceForMode(myGameModePref);
    state.variantIdx = 0;
    state.scoreW = 0;
    state.scoreB = 0;
    resetSetTracking();
    initGame("ROLL_OFF");
  }

  peer.on("open", () => {
    if (!restoredBackup) shareInviteLink(code);
  });

  peer.on("connection", incomingConn => {
    setupIncomingHostConn(incomingConn, code);
  });
  peer.on("disconnected", () => peer.reconnect());
}

function joinRoomWithCode(rawCode, asSpectator = false) {
  ensureAudio();
  stopHelloRetry();
  isAiMatch = false;
  isTutorialMode = false;
  if (typeof syncTutorialPanelPlacement === "function") {
    syncTutorialPanelPlacement();
  }
  spectatorConns = [];
  const code = String(rawCode || "").trim().toUpperCase();
  if (code.length !== 6) return alert(t().enter6CodeAlert);

  if (!asSpectator) {
    const backup = getActiveRoomBackup(code);
    if (backup && backup.myRole === "W") {
      hostRoom(code, backup);
      return;
    }
  }

  stopDisconnectCountdown();
  activeRoomCode = code;
  packetQueue = [];
  isProcessingPacket = false;
  if (peer) peer.destroy();

  peer = new Peer(PEER_CONFIG);
  myRole = asSpectator ? "SPECTATOR" : "B";
  document.getElementById("shareBtn").style.display = "inline-block";

  if (!asSpectator) {
    const backup = getActiveRoomBackup(code);
    if (backup && backup.state) {
      playerNames = cloneState(backup.playerNames || { W: "Host", B: myPlayerName });
      playerNames.B = myPlayerName;
      state = cloneState(backup.state);
      state.playerNames = { W: playerNames.W, B: playerNames.B };
    } else {
      playerNames.B = myPlayerName;
      state.playerNames = { W: playerNames.W, B: playerNames.B };
    }
  }

  updateHeaderLabels();
  render();

  document.getElementById("netStatus").textContent = t().connectingTo(code);
  peer.on("open", () => {
    conn = peer.connect("tavli-net-" + code, {
      reliable: true,
      metadata: {
        role: asSpectator ? "SPECTATOR" : "B",
        name: myPlayerName,
        color: myChosenColor
      }
    });
    setupClientConn(code, asSpectator);
  });
  peer.on("disconnected", () => peer.reconnect());
}

function handleOpponentLeft() {
  if (myRole === "SPECTATOR" || isTutorialMode || opponentLeftHandled || state.phase === "SET_OVER") return;
  opponentLeftHandled = true;
  isWaitingForReconnect = true;

  saveActiveRoomBackup();

  const oppName = myRole === "W" ? playerNames.B : playerNames.W;
  const tr = t();
  document.getElementById("typingIndicator").textContent = "";
  document.getElementById("netBar").classList.add("left-alert");
  document.getElementById("netStatus").textContent = tr.oppLeftBanner(oppName, activeRoomCode);
  setStatus(tr.oppLeftStatus(oppName));
  appendChatLine(tr.sysLabel, tr.oppLeftChat(oppName, activeRoomCode), "SYS");

  disconnectDeadline = Date.now() + RECONNECT_WINDOW_MS;
  const pill = document.getElementById("disconnectCountdown");
  pill.style.display = "inline-block";
  pill.textContent = formatCountdownMMSS(RECONNECT_WINDOW_MS);

  if (disconnectInterval) clearInterval(disconnectInterval);
  disconnectInterval = setInterval(() => {
    const rem = disconnectDeadline - Date.now();
    if (rem <= 0) {
      awardForfeitSetWinToConnectedPlayer();
      return;
    }
    pill.textContent = formatCountdownMMSS(rem);

    if (myRole === "B" && isWaitingForReconnect && peer && !peer.destroyed && Math.ceil(rem / 1000) % 4 === 0) {
      try {
        const probeConn = peer.connect("tavli-net-" + activeRoomCode, {
          reliable: true,
          metadata: { role: "B", name: myPlayerName, color: myChosenColor }
        });
        probeConn.on("open", () => {
          conn = probeConn;
          setupClientConn(activeRoomCode, false, true);
        });
      } catch (_) {}
    }
  }, 1000);

  render();
}

function syncDatabaseWithPeer() {
  const pkt = {
    type: "DB_SYNC",
    snapshot: window.TavliDB.exportPublicSnapshot(),
    role: myRole,
    name: myPlayerName
  };
  if (myRole === "W") {
    broadcastFromHostToAll(pkt);
  } else if (conn && conn.open) {
    conn.send(pkt);
  }
}

function setupIncomingHostConn(incomingConn, code) {
  const registerSpectatorAndSendAck = (rawName) => {
    const cleanName = String(rawName || "Spectator").trim().slice(0, 16) || "Spectator";
    const firstTime = !incomingConn._ackSent;
    incomingConn._isSpectator = true;
    incomingConn._spectatorName = cleanName;
    incomingConn._ackSent = true;

    if (!spectatorConns.includes(incomingConn)) {
      spectatorConns.push(incomingConn);
    }
    broadcastSpectatorCountFromHost();

    state.playerNames = { W: playerNames.W, B: playerNames.B };
    safeSend(incomingConn, {
      type: "HELLO_ACK",
      assignedRole: "SPECTATOR",
      playerNames: cloneState(playerNames),
      state: cloneState(state),
      spectatorCount: spectatorConns.length,
      dbSnapshot: window.TavliDB.exportPublicSnapshot()
    });

    if (firstTime) {
      const joinMsg = t().spectatorJoinedChat(cleanName);
      appendChatLine(t().sysLabel, joinMsg, "SYS");
      broadcastFromHostToAll({ type: "SYS_CHAT", text: joinMsg }, incomingConn);
    }
  };

  incomingConn.on("open", () => {
    if (incomingConn.metadata && incomingConn.metadata.role === "SPECTATOR") {
      registerSpectatorAndSendAck(incomingConn.metadata.name);
    }
  });

  incomingConn.on("data", packet => {
    if (!packet || typeof packet !== "object") return;

    if (packet.type === "HELLO") {
      if (packet.dbSnapshot) {
        window.TavliDB.mergePublicSnapshot(packet.dbSnapshot);
      }
      const cleanName = String(packet.name || "Friend").trim().slice(0, 16) || "Friend";

      const playerSlotTaken = (conn && conn.open && conn !== incomingConn && !isWaitingForReconnect);
      const isSpectatorConn = (packet.role === "SPECTATOR" || playerSlotTaken);

      if (isSpectatorConn) {
        registerSpectatorAndSendAck(cleanName);
        return;
      }

      const alreadyInitializedOpponent = (incomingConn === conn && incomingConn._ackSent);
      incomingConn._isSpectator = false;
      incomingConn._ackSent = true;
      conn = incomingConn;
      stopDisconnectCountdown();
      document.getElementById("netStatus").textContent = t().roomLocked(code);

      const reqColor = CHECKER_COLORS.some(c => c.id === packet.color) ? packet.color : "black";
      playerNames.W = myPlayerName;
      playerNames.B = cleanName;
      state.playerNames = { W: playerNames.W, B: playerNames.B };
      state.colors.B = (reqColor === state.colors.W) ? getDistinctFallbackColor(state.colors.W) : reqColor;

      if (alreadyInitializedOpponent) {
        safeSend(conn, {
          type: "HELLO_ACK",
          assignedRole: "B",
          playerNames: cloneState(playerNames),
          state: cloneState(state),
          spectatorCount: spectatorConns.length,
          dbSnapshot: window.TavliDB.exportPublicSnapshot()
        });
        return;
      }

      const localHasProgress = (state.scoreW > 0 || state.scoreB > 0 || state.rolled || (state.setGamesLog && state.setGamesLog.length > 0));
      if (packet.isReconnect && (localHasProgress || packet.savedState)) {
        if (!localHasProgress && packet.savedState) {
          state = cloneState(packet.savedState);
        }
        state.playerNames = { W: playerNames.W, B: playerNames.B };
        updateHeaderLabels();
        appendChatLine(t().sysLabel, t().oppRejoinedChat(cleanName), "SYS");
        setStatus(t().oppRejoinedStatus(cleanName));
        saveActiveRoomBackup();

        safeSend(conn, {
          type: "HELLO_ACK",
          assignedRole: "B",
          playerNames: cloneState(playerNames),
          state: cloneState(state),
          spectatorCount: spectatorConns.length,
          dbSnapshot: window.TavliDB.exportPublicSnapshot()
        });
        syncState();
        syncDatabaseWithPeer();
        playTurnChime();
        render();
        checkTriggerAutoRollOrAI();
        return;
      }

      updateHeaderLabels();
      appendChatLine(t().sysLabel, t().joinedTableChat(cleanName), "SYS");

      state.scoreW = 0;
      state.scoreB = 0;
      state.variantIdx = 0;
      resetSetTracking();
      initGame("ROLL_OFF");

      safeSend(conn, {
        type: "HELLO_ACK",
        assignedRole: "B",
        playerNames: cloneState(playerNames),
        state: cloneState(state),
        spectatorCount: spectatorConns.length,
        dbSnapshot: window.TavliDB.exportPublicSnapshot()
      });
      syncState();
      syncDatabaseWithPeer();
      playTurnChime();
      render();
      return;
    }

    handleCommonPacketOnPeer(packet, incomingConn);
  });

  incomingConn.on("close", () => {
    if (incomingConn._isSpectator) {
      spectatorConns = spectatorConns.filter(sc => sc !== incomingConn);
      broadcastSpectatorCountFromHost();
    } else if (incomingConn === conn) {
      handleOpponentLeft();
    }
  });

  incomingConn.on("error", () => {
    if (incomingConn._isSpectator) {
      spectatorConns = spectatorConns.filter(sc => sc !== incomingConn);
      broadcastSpectatorCountFromHost();
    } else if (incomingConn === conn) {
      handleOpponentLeft();
    }
  });
}

function setupClientConn(code, asSpectator = false, isReconnectingAttempt = false) {
  let receivedAck = false;

  const sendHelloPacket = () => {
    if (!conn || !conn.open || receivedAck) return;
    const wasWaiting = isWaitingForReconnect;
    const backup = !asSpectator ? getActiveRoomBackup(code) : null;
    const hasProgress = !asSpectator && (state.scoreW > 0 || state.scoreB > 0 || state.rolled || (state.setGamesLog && state.setGamesLog.length > 0));

    try {
      conn.send({
        type: "HELLO",
        role: asSpectator ? "SPECTATOR" : "B",
        name: myPlayerName,
        color: myChosenColor,
        isReconnect: Boolean(!asSpectator && (wasWaiting || isReconnectingAttempt || hasProgress || backup)),
        savedState: (!asSpectator && (wasWaiting || hasProgress)) ? cloneState(state) : (backup ? backup.state : null),
        savedNames: (!asSpectator && (wasWaiting || hasProgress)) ? cloneState(playerNames) : (backup ? backup.playerNames : null),
        dbSnapshot: window.TavliDB.exportPublicSnapshot()
      });
    } catch (_) {}
  };

  const onChannelOpen = () => {
    stopDisconnectCountdown();
    sendHelloPacket();
    stopHelloRetry();
    helloRetryTimer = setInterval(() => {
      if (receivedAck || !conn || !conn.open) {
        stopHelloRetry();
        return;
      }
      sendHelloPacket();
    }, 1200);
  };

  conn.on("open", onChannelOpen);
  if (conn.open) onChannelOpen();

  conn.on("close", () => {
    stopHelloRetry();
    handleOpponentLeft();
  });
  conn.on("error", () => {
    stopHelloRetry();
    handleOpponentLeft();
  });

  conn.on("data", packet => {
    if (!packet || typeof packet !== "object") return;

    if (packet.type === "HELLO_ACK") {
      receivedAck = true;
      stopHelloRetry();

      if (packet.dbSnapshot) {
        window.TavliDB.mergePublicSnapshot(packet.dbSnapshot);
      }
      if (packet.assignedRole === "SPECTATOR") {
        myRole = "SPECTATOR";
        document.getElementById("netStatus").textContent = t().spectatingStatus(code);
      } else {
        document.getElementById("netStatus").textContent = t().roomLocked(code);
      }
      if (packet.playerNames) {
        if (packet.playerNames.W) playerNames.W = packet.playerNames.W;
        if (packet.playerNames.B) playerNames.B = packet.playerNames.B;
      }
      if (packet.spectatorCount !== undefined) {
        updateSpectatorBadge(packet.spectatorCount);
      }
      if (packet.state) {
        state = packet.state;
        state.playerNames = { W: playerNames.W, B: playerNames.B };
      }
      updateHeaderLabels();
      saveActiveRoomBackup();
      render();
      return;
    }

    if (packet.type === "STATE") {
      receivedAck = true;
      stopHelloRetry();
      document.getElementById("netStatus").textContent =
        (myRole === "SPECTATOR") ? t().spectatingStatus(code) : t().roomLocked(code);
    }

    handleCommonPacketOnPeer(packet, conn);
  });
}

function handleCommonPacketOnPeer(packet, sourceConn) {
  if (packet.type === "SPECTATOR_COUNT") {
    updateSpectatorBadge(packet.count);
    return;
  }

  if (packet.type === "SYS_CHAT") {
    if (packet.text) appendChatLine(t().sysLabel, packet.text, "SYS");
    return;
  }

  if (packet.type === "BYE") {
    if (sourceConn && sourceConn._isSpectator) {
      spectatorConns = spectatorConns.filter(sc => sc !== sourceConn);
      broadcastSpectatorCountFromHost();
    } else {
      handleOpponentLeft();
    }
    return;
  }

  if (packet.type === "RESIGN_OFFER") {
    if (myRole === "SPECTATOR") return;
    const fromRole = packet.fromRole === "W" ? "W" : "B";
    const pts = packet.pts === 2 ? 2 : 1;
    const offererName = fromRole === "W" ? playerNames.W : playerNames.B;
    pendingResignOffer = { fromRole, pts };
    playChatSound();
    document.getElementById("resignRespDesc").textContent = t().resignRespDesc(offererName, pts);
    document.getElementById("resignRespondModal").style.display = "flex";
    return;
  }

  if (packet.type === "RESIGN_RESPONSE") {
    pendingResignOffer = null;
    if (!packet.accepted) {
      const winnerRole = packet.fromRole === "W" ? "B" : "W";
      const winnerName = winnerRole === "W" ? playerNames.W : playerNames.B;
      setStatus(t().resignDeclined(winnerName));
    }
    return;
  }

  if (packet.type === "SET_DECISION") {
    if (packet.decision === "EXIT_MENU") {
      opponentLeftHandled = true;
      handleExitToInitialMenu(false);
    } else if (packet.decision === "PLAY_AGAIN") {
      peerRematchVote = true;
      if (myRematchVote) startNewSetWithSameSettings();
    }
    return;
  }

  if (packet.type === "DB_SYNC") {
    if (packet.snapshot) window.TavliDB.mergePublicSnapshot(packet.snapshot);
    if (packet.name && (packet.role === "W" || packet.role === "B")) {
      const cleanName = String(packet.name).trim().slice(0, 16);
      if (packet.role === "W" && cleanName) playerNames.W = cleanName;
      if (packet.role === "B" && cleanName) playerNames.B = cleanName;
      if (state.playerNames) {
        state.playerNames.W = playerNames.W;
        state.playerNames.B = playerNames.B;
      }
      updateHeaderLabels();
      render();
    }
    if (typeof updateUnreadMessageBadges === "function") {
      updateUnreadMessageBadges();
    }
    const msgModal = document.getElementById("messagesModal");
    if (msgModal && msgModal.style.display === "flex" && typeof renderMessagesModalContent === "function") {
      renderMessagesModalContent();
    }
    if (myRole === "W") {
      broadcastFromHostToAll(packet, sourceConn);
    }
    return;
  }

  if (packet.type === "TYPING") {
    const senderName = packet.sender || (myRole === "W" ? playerNames.B : playerNames.W);
    const ind = document.getElementById("typingIndicator");
    if (packet.isTyping) {
      ind.textContent = t().isTyping(senderName);
      if (remoteTypingTimeout) clearTimeout(remoteTypingTimeout);
      remoteTypingTimeout = setTimeout(() => { ind.textContent = ""; }, 2600);
    } else {
      ind.textContent = "";
    }
    if (myRole === "W") {
      broadcastFromHostToAll(packet, sourceConn);
    }
    return;
  }

  if (packet.type === "CHAT") {
    const sender = String(packet.sender || "Friend").slice(0, 16);
    const text = String(packet.text || "").slice(0, 140);
    const senderRole = packet.role === "SPECTATOR" ? "SPECTATOR" : (packet.role === "W" ? "W" : "B");
    document.getElementById("typingIndicator").textContent = "";
    if (text) {
      playChatSound();
      appendChatLine(sender, text, senderRole);
      if (myRole === "W") {
        broadcastFromHostToAll(packet, sourceConn);
      }
    }
    return;
  }

  if (myRole === "W" && sourceConn === conn) {
    spectatorConns = spectatorConns.filter(sc => sc && sc.open);
    spectatorConns.forEach(sc => {
      try { sc.send(packet); } catch (_) {}
    });
  }

  packetQueue.push(packet);
  processNextStatePacket();
}

function processNextStatePacket() {
  if (isProcessingPacket || packetQueue.length === 0) return;
  isProcessingPacket = true;

  const packet = packetQueue.shift();
  const incoming = packet.type === "STATE" ? packet.state : packet;

  if (!incoming || !Array.isArray(incoming.points) || incoming.points.length !== 24) {
    isProcessingPacket = false;
    processNextStatePacket();
    return;
  }

  if (!Array.isArray(incoming.dice) || incoming.dice.length > 4 || incoming.dice.some(d => !Number.isInteger(d) || d < 1 || d > 6)) {
    isProcessingPacket = false;
    processNextStatePacket();
    return;
  }

  const incomingNames = packet.playerNames || incoming.playerNames;
  if (incomingNames) {
    if (incomingNames.W && incomingNames.W !== "Player 1") playerNames.W = incomingNames.W;
    if (incomingNames.B && incomingNames.B !== "Player 2") playerNames.B = incomingNames.B;
  }
  if (myRole === "W" && myPlayerName) playerNames.W = myPlayerName;
  if (myRole === "B" && myPlayerName) playerNames.B = myPlayerName;
  incoming.playerNames = { W: playerNames.W, B: playerNames.B };

  const prevTurn = state.turn;
  const animInfo = incoming.lastMoveAnim;
  const shouldAnimateMove =
    (incoming.lastAction === "MOVE" || incoming.lastAction === "HIT" || incoming.lastAction === "PIN" || incoming.lastAction === "WIN") &&
    animInfo &&
    animInfo.from !== undefined &&
    animInfo.to !== undefined;

  const finishPacketStep = () => {
    isProcessingPacket = false;
    processNextStatePacket();
  };

  const applyIncomingState = () => {
    state = incoming;
    turnHistory = [];
    selectedFrom = null;
    validTargets = [];
    updateHeaderLabels();
    saveActiveRoomBackup();

    if (state.lastWinEvent) {
      recordWinEventToDatabase(state.lastWinEvent);
    }

    if (state.phase === "SET_OVER" && state.lastSetSummary) {
      clearActiveRoomBackup();
      playWinFanfare();
      render();
      showSetVictoryModal(state.lastSetSummary);
      finishPacketStep();
      return;
    }

    if (state.lastAction === "ROLL_OFF") {
      const rolledSide = state.rollOff.B !== null ? "B" : "W";
      animateBoardRollOffDie(rolledSide, () => {
        if (state.rollOff.W !== null && state.rollOff.B !== null) {
          resolveRollOffOutcome();
        } else if (state.turn === myRole) {
          setStatus(t().rolled1DieYourTurn(playerNames.W, state.rollOff.W));
          playTurnChime();
        }
        finishPacketStep();
      });
    } else if (state.lastAction === "ROLL") {
      animateDiceRoll(2, () => {
        finishPacketStep();
      });
    } else {
      if (state.lastAction === "MOVE" || state.lastAction === "UNDO") playCheckerClack("MOVE");
      if (state.lastAction === "HIT") playCheckerClack("HIT");
      if (state.lastAction === "PIN") playCheckerClack("PIN");
      if (state.lastAction === "WIN") {
        playWinFanfare();
        if (state.turn === myRole) checkTriggerAutoRollOrAI();
      }
      if ((state.lastAction === "END_TURN" || prevTurn !== state.turn) && state.turn === myRole) {
        playTurnChime();
        checkTriggerAutoRollOrAI();
      }
      render();
      finishPacketStep();
    }
  };

  if (shouldAnimateMove) {
    animateCheckerTransition(animInfo.from, animInfo.to, animInfo.player, applyIncomingState);
  } else {
    applyIncomingState();
  }
}

function notifyLeavingTab() {
  saveActiveRoomBackup();
  if (conn && conn.open) {
    try { conn.send({ type: "BYE" }); } catch (_) {}
    try { conn.close(); } catch (_) {}
  }
}
window.addEventListener("beforeunload", notifyLeavingTab);
window.addEventListener("pagehide", notifyLeavingTab);

function syncState() {
  if (myRole === "SPECTATOR" || isTutorialMode) return;
  if (myRole === "W" && myPlayerName) playerNames.W = myPlayerName;
  if (myRole === "B" && myPlayerName) playerNames.B = myPlayerName;
  state.playerNames = { W: playerNames.W, B: playerNames.B };

  saveActiveRoomBackup();
  const pkt = {
    type: "STATE",
    state: cloneState(state),
    playerNames: cloneState(playerNames)
  };

  if (myRole === "W") {
    broadcastFromHostToAll(pkt);
  } else if (conn && conn.open) {
    conn.send(pkt);
  }
}

function handleChatTyping() {
  const val = document.getElementById("chatInput").value.trim();
  const pkt = { type: "TYPING", isTyping: val.length > 0, sender: myPlayerName };
  if (myRole === "W") {
    broadcastFromHostToAll(pkt);
  } else if (conn && conn.open) {
    conn.send(pkt);
  }
  if (localTypingTimeout) clearTimeout(localTypingTimeout);
  localTypingTimeout = setTimeout(() => {
    const stopPkt = { type: "TYPING", isTyping: false, sender: myPlayerName };
    if (myRole === "W") broadcastFromHostToAll(stopPkt);
    else if (conn && conn.open) conn.send(stopPkt);
  }, 1800);
}

function sendChat() {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  if (localTypingTimeout) clearTimeout(localTypingTimeout);

  const myChatRole = myRole === "SPECTATOR" ? "SPECTATOR" : (myRole === "B" ? "B" : "W");
  appendChatLine(myPlayerName, text, myChatRole);

  const stopPkt = { type: "TYPING", isTyping: false, sender: myPlayerName };
  const chatPkt = { type: "CHAT", sender: myPlayerName, role: myChatRole, text };

  if (myRole === "W") {
    broadcastFromHostToAll(stopPkt);
    broadcastFromHostToAll(chatPkt);
  } else if (conn && conn.open) {
    conn.send(stopPkt);
    conn.send(chatPkt);
  }
}

function appendChatLine(sender, text, role = "W") {
  const box = document.getElementById("chatMessages");
  const line = document.createElement("div");
  line.className = "chat-line";

  const nameSpan = document.createElement("span");
  nameSpan.className = "chat-sender";
  if (role === "SYS") {
    nameSpan.style.color = "#81c784";
    nameSpan.textContent = `${sender}:`;
  } else if (role === "SPECTATOR") {
    nameSpan.style.color = "#4db6ac";
    nameSpan.textContent = `👁️ ${sender} [${t().spectatorTag}]:`;
  } else {
    const cId = role === "B" ? state.colors.B : state.colors.W;
    nameSpan.style.color = getColorMeta(cId).chatHex;
    nameSpan.textContent = `${sender}:`;
  }

  const msgSpan = document.createElement("span");
  msgSpan.textContent = ` ${text}`;

  line.appendChild(nameSpan);
  line.appendChild(msgSpan);
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

function shareInviteLink(code) {
  if (!code) return;
  const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${code}`;
  if (navigator.share) {
    navigator.share({
      title: "Greek Tavli Online",
      text: `Join or Watch my Greek Tavli match (Room ${code}):`,
      url: inviteUrl
    }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(inviteUrl);
    setStatus(t().inviteCopied);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.TavliDB.onRemoteUpdate(() => {
    checkPersistentLoginSession();
    handleNameInputCheck();
    if (typeof updateUnreadMessageBadges === "function") {
      updateUnreadMessageBadges();
    }
    if (document.getElementById("leaderboardModal").style.display === "flex") {
      renderLeaderboardModalContent();
    }
    if (document.getElementById("profileModal").style.display === "flex") {
      renderProfileModalContent();
    }
    const msgModal = document.getElementById("messagesModal");
    if (msgModal && msgModal.style.display === "flex" && typeof renderMessagesModalContent === "function") {
      renderMessagesModalContent();
    }
  });

  // Periodically pull from Firebase every 20 seconds so new Global Messages & Unread Badges update automatically
  setInterval(() => {
    if (window.TavliDB && typeof window.TavliDB.pullFromServer === "function") {
      window.TavliDB.pullFromServer();
    }
  }, 20000);

  const savedTheme = localStorage.getItem("tavli_theme");
  if (savedTheme) selectTheme(savedTheme);

  const savedLang = localStorage.getItem("tavli_lang");
  if (savedLang === "el" || savedLang === "en") {
    selectLangPref(savedLang);
  } else {
    selectLangPref("en");
  }

  const savedName = localStorage.getItem("tavli_player_name");
  if (savedName) {
    myPlayerName = savedName;
    document.getElementById("playerNameInput").value = savedName;
  }

  const savedStore = localStorage.getItem("tavli_store_enabled");
  if (savedStore !== null) {
    selectStoreDetailsPref(savedStore === "1");
  } else {
    selectStoreDetailsPref(true);
  }

  const savedColor = localStorage.getItem("tavli_player_color");
  if (savedColor && CHECKER_COLORS.some(c => c.id === savedColor)) {
    myChosenColor = savedColor;
  }

  const savedEndTurn = localStorage.getItem("tavli_end_turn_pref");
  if (savedEndTurn !== null) selectEndTurnPref(savedEndTurn === "1");

  const savedAutoRoll = localStorage.getItem("tavli_auto_roll_pref");
  if (savedAutoRoll !== null) selectAutoRollPref(savedAutoRoll === "1");

  const savedTarget = parseInt(localStorage.getItem("tavli_target_score"), 10);
  if (ALLOWED_TARGETS.includes(savedTarget)) myTargetScorePref = savedTarget;

  const savedMode = localStorage.getItem("tavli_game_mode");
  if (["FULL", "PORTES", "PLAKOTO", "FEVGA"].includes(savedMode)) {
    selectGameMode(savedMode);
  }

  const recentBackup = getActiveRoomBackup();
  if (recentBackup && recentBackup.roomCode) {
    document.getElementById("modalRoomInput").value = recentBackup.roomCode;
  }

  checkPersistentLoginSession();
  handleNameInputCheck();
  renderColorPicker();
  renderTargetScorePicker();
  showScreen("LANDING");

  const params = new URLSearchParams(window.location.search);
  const roomFromUrl = params.get("room");
  if (roomFromUrl && roomFromUrl.trim().length === 6) {
    pendingRoomFromUrl = roomFromUrl.trim().toUpperCase();
    document.getElementById("modalRoomInput").value = pendingRoomFromUrl;
    openPlaySetupModal("JOIN");
  }
});

initGame("ROLL_OFF");