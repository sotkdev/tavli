// e-Tavli — UI, Auth, Modals, Active Game Banner, Turn Timer Selector, ELO, Online Presence, Challenges, Emoji Pickers & Board Renderer (ui.js — v27)

function t() {
  return I18N[myLang] || I18N.en;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeJsStr(str) {
  return String(str || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, "&quot;");
}

function setStatus(msg) {
  const el = document.getElementById("statusLog");
  if (el) el.textContent = msg;
}

// ============================================================================
// VERSION 24: EMOJI PICKER POPOVER FOR IN-GAME CHAT & GLOBAL MESSAGES
// ============================================================================
function toggleEmojiPicker(popoverId, inputId) {
  const pop = document.getElementById(popoverId);
  if (!pop) return;
  const isOpen = pop.classList.contains("open");
  document.querySelectorAll(".emoji-popover.open").forEach(el => el.classList.remove("open"));
  if (isOpen) return;

  const list = (typeof TAVLI_EMOJIS !== "undefined" && Array.isArray(TAVLI_EMOJIS))
    ? TAVLI_EMOJIS
    : ["😀","😂","😎","🎲","🏆","🔥","👏","👍","☕","🧿","🇬🇷","👑"];

  pop.innerHTML = "";
  list.forEach(em => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "emoji-item-btn";
    btn.textContent = em;
    btn.onclick = (e) => {
      e.stopPropagation();
      insertEmojiIntoInput(inputId, popoverId, em);
    };
    pop.appendChild(btn);
  });
  pop.classList.add("open");
}

function insertEmojiIntoInput(inputId, popoverId, emojiChar) {
  const input = document.getElementById(inputId);
  const pop = document.getElementById(popoverId);
  if (pop) pop.classList.remove("open");
  if (!input) return;
  const maxLen = parseInt(input.getAttribute("maxlength"), 10) || 200;
  if ((input.value + emojiChar).length <= maxLen) {
    input.value += emojiChar;
  }
  input.focus();
  if (inputId === "chatInput" && typeof handleChatTyping === "function") {
    handleChatTyping();
  }
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".emoji-picker-wrap")) {
    document.querySelectorAll(".emoji-popover.open").forEach(el => el.classList.remove("open"));
  }
});

// ============================================================================
// VERSION 24: ONLINE PRESENCE BADGE & CHALLENGE BUTTON HELPER
// ============================================================================
function renderPresenceDotOnlyHtml(targetName) {
  if (!window.TavliDB || typeof window.TavliDB.getPlayerPresence !== "function") return "";
  const tr = t();
  const pr = window.TavliDB.getPlayerPresence(targetName);
  let dotClass = "presence-offline";
  let titleText = tr.presenceOffline || "Offline";
  if (pr && pr.online) {
    if (pr.status === "online_idle") {
      dotClass = "presence-green";
      titleText = tr.presenceOnlineIdle || "Online";
    } else if (pr.status === "hosting") {
      dotClass = "presence-orange";
      titleText = tr.presenceHosting || "Hosting Room";
    } else {
      dotClass = "presence-orange";
      titleText = tr.presencePlaying || "In a Game";
    }
  }
  return `<span class="presence-dot ${dotClass}" title="${escapeHtml(titleText)}"></span>`;
}

function renderSwordChallengeBtnHtml(targetName, swordOnly = false) {
  if (!window.TavliDB || typeof window.TavliDB.getPlayerPresence !== "function") return "";
  const tr = t();
  const pr = window.TavliDB.getPlayerPresence(targetName);
  const isSelf = window.TavliDB.normalizeKey(targetName) === window.TavliDB.normalizeKey(myPlayerName);
  if (!isSelf && pr && pr.online && pr.status === "online_idle") {
    const safeJs = escapeJsStr(targetName);
    if (swordOnly) {
      return `<button type="button" class="btn-challenge-sword" title="${escapeHtml(tr.challengeBtnLabel || "Challenge")}" onclick="event.stopPropagation(); openChallengeSetupForPlayer('${safeJs}')">⚔️</button>`;
    }
    return `<button type="button" class="btn-challenge-inline" onclick="event.stopPropagation(); openChallengeSetupForPlayer('${safeJs}')">${escapeHtml(tr.challengeBtnLabel || "⚔️ Challenge")}</button>`;
  }
  return "";
}

function renderWinStreakBadgeHtml(targetName) {
  if (!window.TavliDB || typeof window.TavliDB.getPlayerWinStreak !== "function") return "";
  const streak = window.TavliDB.getPlayerWinStreak(targetName);
  if (streak <= 0) return "";
  const tr = t();
  const titleTxt = tr.streakBadgeTitle ? tr.streakBadgeTitle(streak) : `Winning Streak: ${streak}`;
  return `<span class="streak-fire-badge" title="${escapeHtml(titleTxt)}">🔥 ${streak}</span>`;
}

function renderAddFriendToggleBtnHtml(targetName) {
  if (!window.TavliDB || !targetName) return "";
  const isSelf = window.TavliDB.normalizeKey(targetName) === window.TavliDB.normalizeKey(myPlayerName);
  if (isSelf || window.TavliDB.isAiPlayerName(targetName)) return "";
  const tr = t();
  const isFr = window.TavliDB.isFriend(myPlayerName, targetName);
  const safeJs = escapeJsStr(targetName);
  const label = isFr ? (tr.friendsAddedBtn || "⭐ Friend") : (tr.friendsAddBtn || "+ Friend");
  return `<button type="button" class="btn-friend-add-sm ${isFr ? "is-friend" : ""}" onclick="event.stopPropagation(); toggleFriendStatusForPlayer('${safeJs}')">${escapeHtml(label)}</button>`;
}

function renderPresenceAndChallengeHtml(targetName, includeChallengeBtn = true) {
  const dotHtml = renderPresenceDotOnlyHtml(targetName);
  if (!includeChallengeBtn) return dotHtml;
  return `${dotHtml}${renderSwordChallengeBtnHtml(targetName, false)}`;
}

function openChallengeSetupForPlayer(targetName) {
  if (!targetName) return;
  closeLeaderboardModal();
  closeProfileModal();
  closeMessagesModal();
  closeFriendsModal();
  closeRoomRosterModal();
  pendingChallengeTarget = String(targetName).trim();
  openPlaySetupModal("CHALLENGE");
}

function selectPrivateRoomPref(isPriv) {
  myPrivateRoomPref = Boolean(isPriv);
  localStorage.setItem("tavli_v25_private_room", myPrivateRoomPref ? "1" : "0");
  const pubEl = document.getElementById("optRoomPublic");
  const privEl = document.getElementById("optRoomPrivate");
  if (pubEl) pubEl.classList.toggle("active", !myPrivateRoomPref);
  if (privEl) privEl.classList.toggle("active", myPrivateRoomPref);
}

function applyHorizontalMobileModeToDOM() {
  const b = document.body;
  const gameApp = document.getElementById("gameAppLayout");
  if (b) {
    b.classList.toggle("mobile-horizontal-mode", Boolean(isMobileHorizontalMode));
  }
  const btn = document.getElementById("rotateBoardBtn");
  if (btn) {
    btn.style.background = isMobileHorizontalMode ? "var(--accent)" : "#5c6bc0";
    btn.style.color = isMobileHorizontalMode ? "#111" : "#fff";
  }
  if (gameApp && gameApp.classList.contains("active-game")) {
    gameApp.style.display = (window.innerWidth >= 960 || isMobileHorizontalMode) ? "grid" : "flex";
  }
  if (typeof syncTutorialPanelPlacement === "function") {
    syncTutorialPanelPlacement();
  }
}

function toggleMobileBoardRotation() {
  isMobileHorizontalMode = !isMobileHorizontalMode;
  localStorage.setItem("tavli_v26_horiz_mode", isMobileHorizontalMode ? "1" : "0");
  // Attempt native screen orientation lock when supported on mobile fullscreen/PWA
  if (screen && screen.orientation && typeof screen.orientation.lock === "function") {
    const targetOrientation = isMobileHorizontalMode ? "landscape" : "portrait";
    screen.orientation.lock(targetOrientation).catch(() => {});
  }
  applyHorizontalMobileModeToDOM();
  render();
}

function getTimerLabelText(sec) {
  const tr = t();
  const s = parseInt(sec, 10) || 0;
  if (s === 30) return tr.timerOpt30s || "30s";
  if (s === 60) return tr.timerOpt60s || "60s";
  if (s === 120) return tr.timerOpt2m || "2m";
  if (s === 300) return tr.timerOpt5m || "5m";
  return tr.timerOptUnlimited || "Unlimited";
}

function selectTurnTimerPref(seconds) {
  const s = ALLOWED_TURN_TIMERS.includes(Number(seconds)) ? Number(seconds) : 0;
  myTurnTimerPref = s;
  localStorage.setItem("tavli_v24_turn_timer", String(s));
  ALLOWED_TURN_TIMERS.forEach(val => {
    const el = document.getElementById("timerOpt_" + val);
    if (el) el.classList.toggle("active", val === s);
  });
}

// ============================================================================
// VERSION 24: MAIN MENU ACTIVE GAME BANNER (ONLINE & BOT RESUME / RESIGN / END)
// ============================================================================
function renderAdminBroadcastBannerOnLanding() {
  const bannerEl = document.getElementById("adminBroadcastBanner");
  const textEl = document.getElementById("adminBroadcastText");
  const editBtn = document.getElementById("btnEditBroadcastInline");
  if (!bannerEl || !textEl) return;

  const bObj = window.TavliDB && typeof window.TavliDB.getBroadcastBanner === "function"
    ? window.TavliDB.getBroadcastBanner()
    : null;
  const isAdmin = isAuthenticatedAccount && window.TavliDB && window.TavliDB.isAdminName(myPlayerName);

  if (bObj && bObj.text) {
    textEl.textContent = bObj.text;
    bannerEl.style.display = "flex";
    if (editBtn) editBtn.style.display = isAdmin ? "inline-block" : "none";
  } else {
    bannerEl.style.display = "none";
  }
}

function renderActiveGameBannerOnLanding() {
  const banner = document.getElementById("activeGameResumeBanner");
  const titleEl = document.getElementById("activeGameBannerTitle");
  const subEl = document.getElementById("activeGameBannerSub");
  const btnsEl = document.getElementById("activeGameBannerBtns");
  if (!banner || !titleEl || !subEl || !btnsEl) return;

  const tr = t();

  // 1. Check if an Online Multiplayer Game is still active (within 5 minutes & room still active with >=1 player or spectator)
  const roomBackup = (typeof getActiveRoomBackup === "function") ? getActiveRoomBackup() : null;
  if (roomBackup && roomBackup.roomCode && roomBackup.state && roomBackup.state.phase !== "SET_OVER") {
    const code = String(roomBackup.roomCode).toUpperCase();
    const liveRm = window.TavliDB && typeof window.TavliDB.getLiveRoom === "function"
      ? window.TavliDB.getLiveRoom(code)
      : null;
    const isStillConnectedInMemory = Boolean(
      activeRoomCode &&
      activeRoomCode.toUpperCase() === code &&
      ((conn && conn.open) || isCloudRelayConnected || (spectatorConns && spectatorConns.some(sc => sc && sc.open)))
    );

    if (liveRm || isStillConnectedInMemory) {
      const names = roomBackup.playerNames || { W: "Player 1", B: "Player 2" };
      const st = roomBackup.state;
      titleEl.textContent = tr.activeOnlineBannerTitle ? tr.activeOnlineBannerTitle(code) : `🟢 Active Online Game (Room ${code})`;
      subEl.textContent = tr.activeOnlineBannerSub
        ? tr.activeOnlineBannerSub(names.W || "Player 1", names.B || "Player 2", st.scoreW || 0, st.scoreB || 0, st.targetScore || 7)
        : `${names.W} vs ${names.B} • Score: ${st.scoreW || 0} - ${st.scoreB || 0}`;

      btnsEl.innerHTML = `
        <button type="button" class="btn-resume-big" onclick="resumeActiveOnlineGameFromBanner()">${escapeHtml(tr.btnReturnToActiveGame || "▶ Return to Active Game")}</button>
        <button type="button" class="btn-resign-big" onclick="resignActiveOnlineGameFromBanner()">${escapeHtml(tr.btnResignActiveSet || "🏳️ Resign")}</button>
      `;
      banner.style.display = "flex";
      return;
    }
  }

  // 2. Check if a Bot (vs AI) Game is currently saved/paused
  const botBackup = (typeof getActiveBotBackup === "function") ? getActiveBotBackup() : null;
  if (botBackup && botBackup.state && botBackup.state.phase !== "SET_OVER") {
    const st = botBackup.state;
    const diff = botBackup.aiDifficulty || myAiDifficulty || "MEDIUM";
    titleEl.textContent = tr.activeBotBannerTitle ? tr.activeBotBannerTitle(diff) : `🤖 Active Game vs AI (${diff})`;
    subEl.textContent = tr.activeBotBannerSub
      ? tr.activeBotBannerSub(st.scoreW || 0, st.scoreB || 0, st.targetScore || 7)
      : `Score: ${st.scoreW || 0} - ${st.scoreB || 0}`;

    btnsEl.innerHTML = `
      <button type="button" class="btn-resume-big" onclick="resumeActiveBotGameFromBanner()">${escapeHtml(tr.btnReturnToBotGame || "▶ Return to Game")}</button>
      <button type="button" class="btn-resign-big" onclick="endActiveBotGameFromBanner()">${escapeHtml(tr.btnEndBotGame || "✕ End Game")}</button>
    `;
    banner.style.display = "flex";
    return;
  }

  banner.style.display = "none";
}

// ============================================================================
// VERSION 21–23: 7 BOARD & GAMEPLAY SETTINGS HANDLERS
// ============================================================================
function setActiveToggleOpt(id, isActive) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle("active", Boolean(isActive));
}

function applyV21SettingsToDOM() {
  const b = document.body;
  if (!b) return;

  // 1. Point Numbers Toggle (Pip Index)
  b.classList.toggle("pip-index-off", myPipIndexMode === "OFF");
  setActiveToggleOpt("btnPipOff", myPipIndexMode === "OFF");
  setActiveToggleOpt("btnPipAbs", myPipIndexMode === "ABSOLUTE");
  setActiveToggleOpt("btnPipRel", myPipIndexMode === "RELATIVE");

  // 2. Real-Time Pip Count Display
  b.classList.toggle("pip-count-off", !myPipCountDisplay);
  setActiveToggleOpt("btnPipCountOn", myPipCountDisplay === true);
  setActiveToggleOpt("btnPipCountOff", myPipCountDisplay === false);

  // 3. Legal Move Target Indicators
  b.classList.remove("move-ind-badges", "move-ind-glow");
  b.classList.add(myMoveIndicatorMode === "GLOW" ? "move-ind-glow" : "move-ind-badges");
  setActiveToggleOpt("btnIndBadges", myMoveIndicatorMode === "BADGES");
  setActiveToggleOpt("btnIndGlow", myMoveIndicatorMode === "GLOW");

  // 4. Checker & Dice Animation Speed
  setActiveToggleOpt("btnSpeedInstant", myAnimSpeed === "INSTANT");
  setActiveToggleOpt("btnSpeedNormal", myAnimSpeed === "NORMAL");
  setActiveToggleOpt("btnSpeedSmooth", myAnimSpeed === "SMOOTH");

  // 5. Board Texture Style
  b.classList.remove("board-tex-gloss", "board-tex-matte", "board-tex-wood");
  const texSuffix = (myBoardTexture || "WOOD").toLowerCase();
  b.classList.add(`board-tex-${texSuffix}`);
  setActiveToggleOpt("btnTexGloss", myBoardTexture === "GLOSS");
  setActiveToggleOpt("btnTexMatte", myBoardTexture === "MATTE");
  setActiveToggleOpt("btnTexWood", myBoardTexture === "WOOD");

  // 6. Single-Tap / Double-Tap Controls (v23)
  setActiveToggleOpt("btnTapSelect", myTapControlMode !== "AUTO_LARGEST");
  setActiveToggleOpt("btnTapAutoMax", myTapControlMode === "AUTO_LARGEST");

  // 7. Auto-Bearoff Confirmation (v23)
  setActiveToggleOpt("btnAutoBearOffOff", !myAutoBearOff);
  setActiveToggleOpt("btnAutoBearOffOn", Boolean(myAutoBearOff));

  // Turn Timer Preference (v24)
  ALLOWED_TURN_TIMERS.forEach(val => {
    setActiveToggleOpt("timerOpt_" + val, val === myTurnTimerPref);
  });
}

function setPipIndexMode(mode) {
  myPipIndexMode = (mode === "OFF" || mode === "ABSOLUTE" || mode === "RELATIVE") ? mode : "RELATIVE";
  localStorage.setItem("tavli_v21_pip_index", myPipIndexMode);
  applyV21SettingsToDOM();
  render();
}

function setPipCountDisplay(enabled) {
  myPipCountDisplay = Boolean(enabled);
  localStorage.setItem("tavli_v21_pip_count", myPipCountDisplay ? "ON" : "OFF");
  applyV21SettingsToDOM();
  render();
}

function setMoveIndicatorMode(mode) {
  myMoveIndicatorMode = (mode === "GLOW") ? "GLOW" : "BADGES";
  localStorage.setItem("tavli_v21_move_ind", myMoveIndicatorMode);
  applyV21SettingsToDOM();
  render();
}

function setAnimSpeed(speed) {
  myAnimSpeed = (speed === "INSTANT" || speed === "NORMAL" || speed === "SMOOTH") ? speed : "NORMAL";
  localStorage.setItem("tavli_v21_anim_speed", myAnimSpeed);
  applyV21SettingsToDOM();
}

function setBoardTexture(tex) {
  myBoardTexture = (tex === "GLOSS" || tex === "MATTE" || tex === "WOOD") ? tex : "WOOD";
  localStorage.setItem("tavli_v21_board_tex", myBoardTexture);
  applyV21SettingsToDOM();
}

function setTapControlMode(mode) {
  myTapControlMode = (mode === "AUTO_LARGEST") ? "AUTO_LARGEST" : "SELECT";
  localStorage.setItem("tavli_v23_tap_mode", myTapControlMode);
  applyV21SettingsToDOM();
}

function setAutoBearOff(enabled) {
  myAutoBearOff = Boolean(enabled);
  localStorage.setItem("tavli_v23_auto_bearoff", myAutoBearOff ? "ON" : "OFF");
  applyV21SettingsToDOM();
  if (myAutoBearOff && typeof checkAndRunForcedAutoBearOff === "function") {
    checkAndRunForcedAutoBearOff();
  }
}

function calculatePipCount(player) {
  if (!state || !Array.isArray(state.points) || state.points.length !== 24) return 0;
  const v = typeof currentVariant === "function" ? currentVariant() : "PORTES";
  const path = typeof getPath === "function" ? getPath(v, player) : Array.from({ length: 24 }, (_, i) => i);
  let totalPips = 0;

  if (state.bar && state.bar[player] > 0) {
    totalPips += state.bar[player] * 25;
  }

  for (let step = 0; step < 24; step++) {
    const ptIdx = path[step];
    const pt = state.points[ptIdx];
    if (!pt) continue;
    const pipsForPoint = 24 - step;
    if (pt.owner === player && pt.count > 0) {
      totalPips += pt.count * pipsForPoint;
    }
    if (v === "PLAKOTO" && pt.pinned === player) {
      totalPips += pipsForPoint;
    }
  }
  return totalPips;
}

function getDisplayPointNumber(idx) {
  if (myPipIndexMode === "OFF") return "";
  if (myPipIndexMode === "ABSOLUTE") {
    return String(idx + 1);
  }
  const v = typeof currentVariant === "function" ? currentVariant() : "PORTES";
  const activePlayer = (state && state.turn) ? state.turn : "W";
  const path = typeof getPath === "function" ? getPath(v, activePlayer) : Array.from({ length: 24 }, (_, i) => i);
  const step = path.indexOf(idx);
  return step > -1 ? String(24 - step) : String(idx + 1);
}

function syncTutorialPanelPlacement() {
  const tutPanel = document.getElementById("tutorialCoachPanel");
  const mainCol = document.getElementById("mainColumn") || document.querySelector(".main-column");
  const sideCol = document.getElementById("sideColumn") || document.querySelector(".side-column");
  const fevgaWarn = document.getElementById("fevgaPrimeWarning");
  const adminBtn = document.getElementById("btnAdminPanel");

  document.body.classList.toggle("tutorial-mode", Boolean(isTutorialMode));

  if (!tutPanel || !mainCol || !sideCol) return;

  if (!isTutorialMode) {
    tutPanel.style.display = "none";
    if (tutPanel.parentElement !== mainCol && fevgaWarn) {
      mainCol.insertBefore(tutPanel, fevgaWarn);
    }
    return;
  }

  tutPanel.style.display = "flex";
  if (window.innerWidth >= 960 || isMobileHorizontalMode) {
    if (tutPanel.parentElement !== sideCol) {
      if (adminBtn && adminBtn.parentElement === sideCol) {
        sideCol.insertBefore(tutPanel, adminBtn);
      } else {
        sideCol.appendChild(tutPanel);
      }
    }
  } else {
    if (tutPanel.parentElement !== mainCol) {
      if (fevgaWarn && fevgaWarn.parentElement === mainCol) {
        mainCol.insertBefore(tutPanel, fevgaWarn);
      } else {
        mainCol.insertBefore(tutPanel, mainCol.children[1] || null);
      }
    }
  }
}

function showScreen(screenName) {
  const landing = document.getElementById("landingPage");
  const gameApp = document.getElementById("gameAppLayout");
  if (screenName === "GAME") {
    landing.style.display = "none";
    gameApp.classList.add("active-game");
    applyHorizontalMobileModeToDOM();
    gameApp.style.display = (window.innerWidth >= 960 || isMobileHorizontalMode) ? "grid" : "flex";
    document.body.classList.add("in-game-mode");
    syncTutorialPanelPlacement();
    updateUnreadMessageBadges();
    if (typeof broadcastMyPresenceHeartbeat === "function") {
      broadcastMyPresenceHeartbeat();
    }
    render();
  } else {
    gameApp.classList.remove("active-game");
    gameApp.style.display = "none";
    document.body.classList.remove("in-game-mode");
    document.body.classList.remove("tutorial-mode");
    landing.style.display = "flex";
    checkPersistentLoginSession();
    updateUnreadMessageBadges();
    renderAdminBroadcastBannerOnLanding();
    renderActiveGameBannerOnLanding();
    if (typeof broadcastMyPresenceHeartbeat === "function") {
      broadcastMyPresenceHeartbeat();
    }
  }
}

window.addEventListener("resize", () => {
  const gameApp = document.getElementById("gameAppLayout");
  if (gameApp && gameApp.classList.contains("active-game")) {
    gameApp.style.display = (window.innerWidth >= 960 || isMobileHorizontalMode) ? "grid" : "flex";
    syncTutorialPanelPlacement();
  }
});

function selectTheme(themeId) {
  myTheme = ALL_THEMES.includes(themeId) ? themeId : "classic";
  document.body.setAttribute("data-theme", myTheme);
  localStorage.setItem("tavli_theme", myTheme);
  const sel = document.getElementById("themeSelectDropdown");
  if (sel && sel.value !== myTheme) {
    sel.value = myTheme;
  }
  ALL_THEMES.forEach(id => {
    const el = document.getElementById("themeCard_" + id);
    if (el) el.classList.toggle("active", id === myTheme);
  });
}

function selectLangPref(lang) {
  myLang = (lang === "el") ? "el" : "en";
  localStorage.setItem("tavli_lang", myLang);
  const sEN = document.getElementById("setLangEN");
  const sEL = document.getElementById("setLangEL");
  if (sEN) sEN.classList.toggle("active", myLang === "en");
  if (sEL) sEL.classList.toggle("active", myLang === "el");
  applyLanguageToUI();
  if (isTutorialMode && typeof loadTutorialScenario === "function") {
    loadTutorialScenario();
  }
}

function selectAiDifficulty(diff) {
  myAiDifficulty = diff;
  document.getElementById("aiEasy").classList.toggle("active", diff === "EASY");
  document.getElementById("aiMedium").classList.toggle("active", diff === "MEDIUM");
  document.getElementById("aiHard").classList.toggle("active", diff === "HARD");
}

function selectStoreDetailsPref(enable) {
  myStoreDetailsPref = enable;
  document.getElementById("optStoreYes").classList.toggle("active", enable);
  document.getElementById("optStoreNo").classList.toggle("active", !enable);
  document.getElementById("playerPinInput").style.display = enable ? "block" : "none";
  document.getElementById("authErrorBox").style.display = "none";
  handleNameInputCheck();
}

function selectModalGuestStore(enable) {
  const yesOpt = document.getElementById("modalOptStoreYes");
  const noOpt = document.getElementById("modalOptStoreNo");
  const pinInput = document.getElementById("modalGuestPinInput");
  if (yesOpt && noOpt && pinInput) {
    yesOpt.classList.toggle("active", enable);
    noOpt.classList.toggle("active", !enable);
    pinInput.style.display = enable ? "block" : "none";
  }
}

function selectJoinParticipationMode(mode) {
  modalRole = (mode === "SPECTATE") ? "SPECTATE" : "JOIN";
  const tr = t();
  const pOpt = document.getElementById("optJoinAsPlayer");
  const sOpt = document.getElementById("optJoinAsSpectator");
  if (pOpt && sOpt) {
    pOpt.classList.toggle("active", modalRole === "JOIN");
    sOpt.classList.toggle("active", modalRole === "SPECTATE");
  }
  const clrSec = document.getElementById("checkerColorSection");
  if (clrSec) {
    clrSec.style.display = modalRole === "SPECTATE" ? "none" : "block";
  }
  document.getElementById("playConfigTitle").textContent =
    modalRole === "SPECTATE" ? tr.titleSpectateModal : tr.titleJoinModal;
  document.getElementById("modalSubmitBtn").textContent =
    modalRole === "SPECTATE" ? tr.btnSpectateGame : tr.btnJoinGame;
}

function handleNameInputCheck() {
  if (isAuthenticatedAccount) return;
  const rawName = document.getElementById("playerNameInput").value.trim();
  const hintEl = document.getElementById("pinPromptHint");
  const errBox = document.getElementById("authErrorBox");
  errBox.style.display = "none";
  const tr = t();

  if (!myStoreDetailsPref) {
    hintEl.textContent = tr.guestBadge(rawName || tr.defaultPlayer);
    hintEl.style.color = "#ffecb3";
    return;
  }

  if (!rawName) {
    hintEl.textContent = tr.pinHintDefault;
    hintEl.style.color = "#ffecb3";
    return;
  }

  if (window.TavliDB.userExists(rawName)) {
    hintEl.textContent = tr.pinHintExisting(rawName);
    hintEl.style.color = "#4fc3f7";
  } else {
    hintEl.textContent = tr.pinHintNew(rawName);
    hintEl.style.color = "#81c784";
  }
}

function showAuthError(msg) {
  const errBox = document.getElementById("authErrorBox");
  errBox.textContent = msg;
  errBox.style.display = "block";
}

function updateAdminButtonVisibility() {
  const isAdmin = isAuthenticatedAccount && window.TavliDB.isAdminName(myPlayerName);
  const btn1 = document.getElementById("btnAdminPanel");
  const btn2 = document.getElementById("btnLandingAdmin");
  if (btn1) btn1.style.display = isAdmin ? "flex" : "none";
  if (btn2) btn2.style.display = isAdmin ? "flex" : "none";
}

function updateUnreadMessageBadges() {
  const count = isAuthenticatedAccount ? window.TavliDB.getUnreadCount(myPlayerName) : 0;
  const bLanding = document.getElementById("unreadBadgeLanding");
  const bGame = document.getElementById("unreadBadgeGame");
  if (bLanding) {
    bLanding.textContent = String(count);
    bLanding.style.display = count > 0 ? "inline-block" : "none";
  }
  if (bGame) {
    bGame.textContent = String(count);
    bGame.style.display = count > 0 ? "inline-block" : "none";
  }
}

function checkPersistentLoginSession() {
  const savedName = localStorage.getItem("tavli_logged_in_name");
  const savedPinHash = localStorage.getItem("tavli_logged_in_pinhash");
  const tr = t();

  if (savedName && savedName.trim()) {
    const u = window.TavliDB.getUser(savedName);
    if (!u || !savedPinHash || !u.pinHash || u.pinHash === savedPinHash) {
      myPlayerName = u ? u.name : savedName.trim();
      isAuthenticatedAccount = true;
      localStorage.setItem("tavli_player_name", myPlayerName);

      document.getElementById("playerNameInput").value = myPlayerName;
      document.getElementById("playerNameInput").disabled = true;
      document.getElementById("playerPinInput").style.display = "none";
      document.getElementById("storeToggleGroup").style.display = "none";
      document.getElementById("btnVerifyIdentity").style.display = "none";
      document.getElementById("btnLogoutIdentity").style.display = "inline-block";

      const hintEl = document.getElementById("pinPromptHint");
      hintEl.textContent = tr.verifiedBadge(myPlayerName);
      hintEl.style.color = "#00e676";
      updateAdminButtonVisibility();
      updateUnreadMessageBadges();
      return;
    }
  }

  document.getElementById("playerNameInput").disabled = false;
  document.getElementById("playerPinInput").style.display = myStoreDetailsPref ? "block" : "none";
  document.getElementById("storeToggleGroup").style.display = "flex";
  document.getElementById("btnVerifyIdentity").style.display = "inline-block";
  document.getElementById("btnLogoutIdentity").style.display = "none";
  updateAdminButtonVisibility();
  updateUnreadMessageBadges();
}

async function verifyIdentityOnLanding(showSuccessHint = false) {
  ensureAudio();
  if (isAuthenticatedAccount && myPlayerName && myPlayerName !== "Player 1" && myPlayerName !== "Player 2") {
    return true;
  }

  const tr = t();
  const rawName = document.getElementById("playerNameInput").value.trim() || tr.defaultPlayer;
  const rawPin = document.getElementById("playerPinInput").value.trim();

  if (myStoreDetailsPref) {
    const auth = await window.TavliDB.authenticateOrCreateAsync(rawName, rawPin);
    if (!auth.ok) {
      showAuthError(auth.message);
      return false;
    }
    myPlayerName = auth.user.name;
    mySessionPin = rawPin;
    isAuthenticatedAccount = true;
    localStorage.setItem("tavli_store_enabled", "1");
    localStorage.setItem("tavli_logged_in_name", myPlayerName);
    localStorage.setItem("tavli_logged_in_pinhash", auth.user.pinHash);
    checkPersistentLoginSession();
  } else {
    await window.TavliDB.pullFromServer();
    if (window.TavliDB.userExists(rawName)) {
      showAuthError(tr.errRegisteredNeedsPin);
      return false;
    }
    myPlayerName = rawName;
    mySessionPin = "";
    isAuthenticatedAccount = false;
    localStorage.setItem("tavli_store_enabled", "0");
    localStorage.removeItem("tavli_logged_in_name");
    localStorage.removeItem("tavli_logged_in_pinhash");

    if (showSuccessHint) {
      const hintEl = document.getElementById("pinPromptHint");
      hintEl.textContent = tr.guestBadge(myPlayerName);
      hintEl.style.color = "#00e676";
    }
  }

  localStorage.setItem("tavli_player_name", myPlayerName);
  document.getElementById("authErrorBox").style.display = "none";
  updateAdminButtonVisibility();
  updateUnreadMessageBadges();
  updateHeaderLabels();
  if (typeof broadcastMyPresenceHeartbeat === "function") {
    broadcastMyPresenceHeartbeat();
  }
  return true;
}

function logoutIdentity() {
  isAuthenticatedAccount = false;
  mySessionPin = "";
  localStorage.removeItem("tavli_logged_in_name");
  localStorage.removeItem("tavli_logged_in_pinhash");
  document.getElementById("playerPinInput").value = "";
  checkPersistentLoginSession();
  handleNameInputCheck();
}

function applyLanguageToUI() {
  const tr = t();
  document.documentElement.lang = myLang;
  document.getElementById("landingMainTitle").textContent = tr.landingMainTitle;
  document.getElementById("landingSubTitle").textContent = tr.landingSubTitle;
  document.getElementById("lblIdentityHeader").textContent = tr.lblIdentityHeader;
  document.getElementById("btnVerifyIdentity").textContent = tr.btnVerifyIdentity;
  document.getElementById("btnLogoutIdentity").textContent = tr.btnLogoutIdentity || "Logout";
  document.getElementById("hubBtnHost").textContent = tr.hubBtnHost;
  document.getElementById("hubBtnJoin").textContent = tr.hubBtnJoin;
  const liveBtnEl = document.getElementById("hubBtnLiveGames");
  if (liveBtnEl && tr.hubBtnLiveGames) liveBtnEl.textContent = tr.hubBtnLiveGames;
  const liveTitleEl = document.getElementById("liveModalTitle");
  if (liveTitleEl && tr.liveModalTitle) liveTitleEl.textContent = tr.liveModalTitle;
  const liveRefreshEl = document.getElementById("liveRefreshBtn");
  if (liveRefreshEl && tr.liveRefreshBtn) liveRefreshEl.textContent = tr.liveRefreshBtn;
  const liveCloseEl = document.getElementById("liveCloseBtn");
  if (liveCloseEl && tr.closeBtn) liveCloseEl.textContent = tr.closeBtn;
  document.getElementById("hubBtnSpectate").textContent = tr.hubBtnSpectate;
  document.getElementById("hubBtnAi").textContent = tr.hubBtnAi;
  const learnBtnEl = document.getElementById("hubBtnLearn");
  if (learnBtnEl && tr.hubBtnLearn) learnBtnEl.textContent = tr.hubBtnLearn;

  document.getElementById("hubBtnProfile").textContent = tr.btnProfile;
  const hubFriendsEl = document.getElementById("hubBtnFriends");
  if (hubFriendsEl && tr.btnFriends) hubFriendsEl.textContent = tr.btnFriends;
  document.getElementById("hubBtnLeaderboard").textContent = tr.btnLeaderboard;
  const hubMsgEl = document.getElementById("hubBtnMessages");
  if (hubMsgEl) hubMsgEl.textContent = tr.btnMessages;
  document.getElementById("hubBtnSettings").textContent = tr.btnSettings;
  document.getElementById("lblLandingAdmin").textContent = tr.btnAdmin;
  document.getElementById("hubArtCaption").textContent = tr.hubArtCaption;
  document.getElementById("btnConfigBack").textContent = tr.btnBack;
  document.getElementById("menuReturnBtn").textContent = tr.menuReturnBtn;

  document.getElementById("lblJoinModeType").textContent = tr.lblJoinModeType;
  document.getElementById("optJoinAsPlayer").textContent = tr.optJoinAsPlayer;
  document.getElementById("optJoinAsSpectator").textContent = tr.optJoinAsSpectator;

  const fevgaWarn = document.getElementById("fevgaPrimeWarning");
  if (fevgaWarn && tr.fevgaWarnMsg) fevgaWarn.textContent = tr.fevgaWarnMsg;

  document.getElementById("playerNameInput").placeholder = tr.namePlaceholder;
  document.getElementById("optStoreNo").textContent = tr.optGuestNoPin;
  document.getElementById("optStoreYes").textContent = tr.optEnableStore;
  document.getElementById("playerPinInput").placeholder = tr.pinPlaceholder;
  document.getElementById("lblCheckerColor").textContent = tr.lblCheckerColor;
  document.getElementById("lblAiDiff").textContent = tr.lblAiDiff;
  document.getElementById("aiEasy").textContent = tr.aiEasy;
  document.getElementById("aiMedium").textContent = tr.aiMedium;
  document.getElementById("aiHard").textContent = tr.aiHard;
  document.getElementById("lblRoomCode").textContent = tr.lblRoomCode;
  document.getElementById("modalRoomInput").placeholder = tr.roomPlaceholder;
  document.getElementById("lblGameSel").textContent = tr.lblGameSel;
  document.getElementById("modeFull").textContent = tr.modeFull;
  document.getElementById("modePortes").textContent = tr.modePortes;
  document.getElementById("modePlakoto").textContent = tr.modePlakoto;
  document.getElementById("modeFevga").textContent = tr.modeFevga;
  document.getElementById("lblNumGames").textContent = tr.lblNumGames;

  // Version 24 Turn Timer & Challenge Modal Labels
  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el && val) el.textContent = val;
  };
  setTxt("lblTurnTimer", tr.lblTurnTimer);
  setTxt("timerOpt_0", tr.timerOptUnlimited);
  setTxt("timerOpt_30", tr.timerOpt30s);
  setTxt("timerOpt_60", tr.timerOpt60s);
  setTxt("timerOpt_120", tr.timerOpt2m);
  setTxt("timerOpt_300", tr.timerOpt5m);
  setTxt("challengeModalTitle", tr.challengeModalTitle);
  setTxt("btnAcceptChallenge", tr.btnAcceptChallenge);
  setTxt("btnDeclineChallenge", tr.btnDeclineChallenge);
  setTxt("lblRoomPrivacy", tr.lblRoomPrivacy);
  setTxt("optRoomPublic", tr.optRoomPublic);
  setTxt("optRoomPrivate", tr.optRoomPrivate);
  setTxt("lblBtnFriends", tr.btnFriends);
  setTxt("friendsModalTitle", tr.friendsModalTitle);
  setTxt("friendsAddInputBtn", tr.friendsAddBtn);
  setTxt("friendsCloseBtn", tr.closeBtn);
  setTxt("roomRosterTitle", tr.roomRosterTitle);
  setTxt("roomRosterCloseBtn", tr.closeBtn);
  setTxt("roomPeopleBtn", tr.btnRoomPeople);
  setTxt("rotateBoardBtn", tr.btnRotateBoard);
  setTxt("lblLiveTabRooms", tr.liveTabRooms);
  setTxt("lblLiveTabKafeneio", tr.liveTabKafeneio);
  setTxt("kafeneioHeaderNote", tr.kafeneioHeaderNote);
  setTxt("kafeneioSendBtn", tr.sendBtn);
  setTxt("kafeneioChallengeCallBtn", tr.kafeneioPostChallengeBtn);
  setTxt("lblAdminBannerHeading", tr.adminBannerHeading);
  setTxt("btnAdminPostBanner", tr.adminBannerPostBtn);
  setTxt("btnAdminClearBanner", tr.adminBannerClearBtn);
  const kafInput = document.getElementById("kafeneioChatInput");
  if (kafInput && tr.kafeneioInputPh) kafInput.placeholder = tr.kafeneioInputPh;
  const admBannerInput = document.getElementById("adminBroadcastInput");
  if (admBannerInput && tr.adminBannerPlaceholder) admBannerInput.placeholder = tr.adminBannerPlaceholder;
  const frSearchEl = document.getElementById("friendsSearchInput");
  if (frSearchEl && tr.friendsSearchPh) frSearchEl.placeholder = tr.friendsSearchPh;
  const specMuteBtn = document.getElementById("specChatMuteBtn");
  if (specMuteBtn) {
    specMuteBtn.textContent = isSpectatorChatMuted ? (tr.specMuteOn || "🔇 Spec Chat: OFF") : (tr.specMuteOff || "💬 Spec Chat: ON");
  }

  document.getElementById("lblEndTurn").textContent = tr.lblEndTurn;
  document.getElementById("optEndTurnYes").textContent = tr.optOn;
  document.getElementById("optEndTurnNo").textContent = tr.optOffAutoEnd;
  document.getElementById("lblAutoRoll").textContent = tr.lblAutoRoll;
  document.getElementById("optAutoRollNo").textContent = tr.optOffManual;
  document.getElementById("optAutoRollYes").textContent = tr.optOnAutoRoll;

  if (isTutorialMode) {
    document.getElementById("netStatus").textContent = tr.netTutorialMode;
  } else if (isAiMatch) {
    document.getElementById("netStatus").textContent = tr.netAiMode(myAiDifficulty);
  } else if (myRole === "SPECTATOR" && activeRoomCode) {
    document.getElementById("netStatus").textContent = tr.spectatingStatus(activeRoomCode);
  } else if (!activeRoomCode) {
    document.getElementById("netStatus").textContent = tr.netDefault;
  }
  document.getElementById("shareBtn").textContent = tr.shareBtn;
  document.getElementById("muteBtn").textContent = soundEnabled ? tr.soundOn : tr.soundOff;

  document.getElementById("lblBar").textContent = tr.bar;
  document.getElementById("lblOff").textContent = tr.off;
  document.getElementById("rollBtn").textContent = tr.rollBtn;
  document.getElementById("undoBtn").textContent = tr.undoBtn;
  document.getElementById("endTurnBtn").textContent = tr.endTurnBtn;
  document.getElementById("resignBtn").textContent = tr.resignBtn;

  document.getElementById("resignModalTitle").textContent = tr.resignTitle;
  document.getElementById("resignModalDesc").textContent = tr.resignDesc;
  document.getElementById("btnOfferMoni").textContent = tr.offerMoni;
  document.getElementById("btnOfferDiplo").textContent = tr.offerDiplo;
  document.getElementById("btnCancelResign").textContent = tr.cancelBtn;
  document.getElementById("resignRespTitle").textContent = tr.resignRespTitle;
  document.getElementById("btnAcceptResign").textContent = tr.acceptResign;
  document.getElementById("btnDeclineResign").textContent = tr.declineResign;

  document.getElementById("lblBtnProfile").textContent = tr.btnProfile;
  document.getElementById("lblBtnLeaderboard").textContent = tr.btnLeaderboard;
  const gameMsgEl = document.getElementById("lblBtnMessages");
  if (gameMsgEl) gameMsgEl.textContent = tr.btnMessages;
  document.getElementById("lblBtnSettings").textContent = tr.btnSettings;
  document.getElementById("lblBtnAdmin").textContent = tr.btnAdmin;
  document.getElementById("profModalTitle").textContent = tr.profTitle;
  document.getElementById("lbModalTitle").textContent = tr.lbTitle;
  const msgTitleEl = document.getElementById("msgModalTitle");
  if (msgTitleEl) msgTitleEl.textContent = tr.msgModalTitle;
  const msgCloseEl = document.getElementById("msgCloseBtn");
  if (msgCloseEl) msgCloseEl.textContent = tr.closeBtn;

  document.getElementById("settingsModalTitle").textContent = tr.settingsTitle;
  document.getElementById("lblSettingsTheme").textContent = tr.lblSettingsTheme;
  document.getElementById("thNameClassic").textContent = tr.thClassic;
  document.getElementById("thNameBlue").textContent = tr.thBlue;
  document.getElementById("thNameGreen").textContent = tr.thGreen;
  document.getElementById("thNameWhite").textContent = tr.thWhite;
  document.getElementById("thNameAmethyst").textContent = tr.thAmethyst;
  document.getElementById("thNameTerracotta").textContent = tr.thTerracotta;
  document.getElementById("thNameMidnight").textContent = tr.thMidnight;
  document.getElementById("thNameSakura").textContent = tr.thSakura;
  const themeDrop = document.getElementById("themeSelectDropdown");
  if (themeDrop) themeDrop.value = myTheme;

  setTxt("lblPipIndex", tr.lblPipIndex);
  setTxt("btnPipOff", tr.optPipOff);
  setTxt("btnPipAbs", tr.optPipAbs);
  setTxt("btnPipRel", tr.optPipRel);
  setTxt("lblPipCounter", tr.lblPipCounter);
  setTxt("btnPipCountOn", tr.optPipCountOn);
  setTxt("btnPipCountOff", tr.optPipCountOff);
  setTxt("lblMoveIndicators", tr.lblMoveIndicators);
  setTxt("btnIndBadges", tr.optIndBadges);
  setTxt("btnIndGlow", tr.optIndGlow);
  setTxt("lblAnimSpeed", tr.lblAnimSpeed);
  setTxt("btnSpeedInstant", tr.optSpeedInstant);
  setTxt("btnSpeedNormal", tr.optSpeedNormal);
  setTxt("btnSpeedSmooth", tr.optSpeedSmooth);
  setTxt("lblBoardTexture", tr.lblBoardTexture);
  setTxt("btnTexGloss", tr.optTexGloss);
  setTxt("btnTexMatte", tr.optTexMatte);
  setTxt("btnTexWood", tr.optTexWood);
  setTxt("lblTapControls", tr.lblTapControls);
  setTxt("btnTapSelect", tr.optTapSelect);
  setTxt("btnTapAutoMax", tr.optTapAutoMax);
  setTxt("lblAutoBearOff", tr.lblAutoBearOff);
  setTxt("btnAutoBearOffOff", tr.optAutoBearOffOff);
  setTxt("btnAutoBearOffOn", tr.optAutoBearOffOn);

  document.getElementById("profCloseBtn").textContent = tr.closeBtn;
  document.getElementById("lbCloseBtn").textContent = tr.closeBtn;
  document.getElementById("settingsCloseBtn").textContent = tr.saveCloseSettingsBtn || "💾 Save & Close settings";

  const wSender = document.getElementById("welcomeSender");
  const wMsg = document.getElementById("welcomeMsg");
  if (wSender) wSender.textContent = `${tr.sysLabel}:`;
  if (wMsg) wMsg.textContent = tr.welcomeMsg;

  document.getElementById("chatInput").placeholder = tr.chatPlaceholder;
  document.getElementById("sendChatBtn").textContent = tr.sendBtn;

  checkPersistentLoginSession();
  handleNameInputCheck();
  renderColorPicker();
  applyV21SettingsToDOM();
  applyHorizontalMobileModeToDOM();
  renderAdminBroadcastBannerOnLanding();
  renderActiveGameBannerOnLanding();
  updateHeaderLabels();
  render();
}

function renderColorPicker() {
  const grid = document.getElementById("colorGrid");
  if (!grid) return;
  grid.innerHTML = "";
  const tr = t();
  CHECKER_COLORS.forEach(c => {
    const opt = document.createElement("div");
    opt.className = "color-option" + (c.id === myChosenColor ? " active" : "");
    opt.onclick = () => {
      myChosenColor = c.id;
      renderColorPicker();
    };
    const swatch = document.createElement("div");
    swatch.className = `swatch-circle clr-${c.id}`;
    const lbl = document.createElement("span");
    lbl.textContent = tr.colors[c.id] || c.id;
    opt.appendChild(swatch);
    opt.appendChild(lbl);
    grid.appendChild(opt);
  });
}

function renderTargetScorePicker() {
  const row = document.getElementById("targetScoreRow");
  if (!row) return;
  row.innerHTML = "";
  ALLOWED_TARGETS.forEach(n => {
    const btn = document.createElement("div");
    btn.className = "num-opt" + (n === myTargetScorePref ? " active" : "");
    btn.textContent = n;
    btn.onclick = () => {
      myTargetScorePref = n;
      renderTargetScorePicker();
    };
    row.appendChild(btn);
  });
}

function selectGameMode(mode) {
  myGameModePref = mode;
  document.getElementById("modeFull").classList.toggle("active", mode === "FULL");
  document.getElementById("modePortes").classList.toggle("active", mode === "PORTES");
  document.getElementById("modePlakoto").classList.toggle("active", mode === "PLAKOTO");
  document.getElementById("modeFevga").classList.toggle("active", mode === "FEVGA");
}

function selectEndTurnPref(useBtn) {
  myEndTurnPref = useBtn;
  document.getElementById("optEndTurnYes").classList.toggle("active", useBtn);
  document.getElementById("optEndTurnNo").classList.toggle("active", !useBtn);
}

function selectAutoRollPref(autoRoll) {
  myAutoRollPref = autoRoll;
  document.getElementById("optAutoRollYes").classList.toggle("active", autoRoll);
  document.getElementById("optAutoRollNo").classList.toggle("active", !autoRoll);
}

function getDistinctFallbackColor(takenId) {
  const preferred = ["black", "white", "red", "blue", "yellow", "green", "purple", "brown"];
  return preferred.find(id => id !== takenId) || "black";
}

function getColorMeta(colorId) {
  const base = CHECKER_COLORS.find(c => c.id === colorId) || CHECKER_COLORS[0];
  return {
    id: base.id,
    chatHex: base.chatHex,
    label: t().colors[base.id] || base.id
  };
}

function getSequenceForMode(mode) {
  if (mode === "PORTES") return ["PORTES"];
  if (mode === "PLAKOTO") return ["PLAKOTO"];
  if (mode === "FEVGA") return ["FEVGA"];
  return ["PORTES", "PLAKOTO", "FEVGA"];
}

// ============================================================================
// CLICKABLE PLAYER PROFILES, ELO & GLOBAL PLAYER MESSAGING SYSTEM (v24)
// ============================================================================
async function openProfileModal(targetPlayerName = null) {
  if (!targetPlayerName && !isAuthenticatedAccount && myStoreDetailsPref) {
    await verifyIdentityOnLanding(false);
  }
  inspectedProfileName = targetPlayerName ? String(targetPlayerName).trim() : myPlayerName;
  renderProfileModalContent(inspectedProfileName);
  document.getElementById("profileModal").style.display = "flex";
  await window.TavliDB.pullFromServer();
  renderProfileModalContent(inspectedProfileName);
}

function closeProfileModal() {
  document.getElementById("profileModal").style.display = "none";
}

function openPlayerProfileFromLink(playerName) {
  if (!playerName) return;
  closeLeaderboardModal();
  openProfileModal(playerName);
}

function openMessageToPlayerFromProfile(targetName) {
  if (!targetName) return;
  closeProfileModal();
  openMessagesModal(targetName);
}

async function openSettingsModal() {
  if (!isAuthenticatedAccount && myStoreDetailsPref) {
    await verifyIdentityOnLanding(false);
  }
  applyV21SettingsToDOM();
  const themeDrop = document.getElementById("themeSelectDropdown");
  if (themeDrop) themeDrop.value = myTheme;
  renderSettingsAccountSection();
  document.getElementById("settingsModal").style.display = "flex";
}
function closeSettingsModal() {
  document.getElementById("settingsModal").style.display = "none";
}
async function saveAndCloseSettingsModal() {
  const nameInput = document.getElementById("profEditName");
  const pinInput = document.getElementById("profEditPin");
  if (isAuthenticatedAccount && nameInput) {
    const newName = nameInput.value.trim();
    const newPin = pinInput ? pinInput.value.trim() : "";
    if ((newName && newName !== myPlayerName) || newPin.length > 0) {
      const ok = await saveProfileEdits();
      if (!ok) return;
    }
  }
  closeSettingsModal();
}

function renderProfileModalContent(targetNameOverride = null) {
  const container = document.getElementById("profileContent");
  const tr = t();
  const targetName = targetNameOverride || inspectedProfileName || myPlayerName;
  const isViewingSelf = window.TavliDB.normalizeKey(targetName) === window.TavliDB.normalizeKey(myPlayerName);
  const user = window.TavliDB.getUser(targetName);

  if (!user) {
    if (isViewingSelf && !isAuthenticatedAccount) {
      container.innerHTML = `
        <div class="profile-name-header"><span>👤 ${escapeHtml(myPlayerName)}</span></div>
        <p style="font-size:0.85rem; color:#ffecb3; text-align:center; padding:12px;">${tr.profGuestMsg}</p>
      `;
    } else {
      container.innerHTML = `
        <div class="profile-name-header">
          <span>👤 ${escapeHtml(targetName)}</span>
          ${!isViewingSelf ? `<button class="btn-sm" onclick="openProfileModal()">${tr.profBackToMyProfile}</button>` : ""}
        </div>
        <p style="font-size:0.85rem; color:#ffecb3; text-align:center; padding:12px;">${escapeHtml(tr.profNotFoundMsg(targetName))}</p>
      `;
    }
    return;
  }

  const s = user.stats || {};
  const eloRating = typeof s.elo === "number" ? Math.round(s.elo) : window.TavliDB.computeBaselineEloFromStats(s);
  const setsW = s.setsWon || 0;
  const setsL = s.setsLost || 0;
  const setsTot = setsW + setsL;

  const gamesW = s.gamesWon || 0;
  const gamesL = s.gamesLost || 0;
  const gamesTot = gamesW + gamesL;

  const rankInfo = window.TavliDB.getPlayerRank(user.name);
  const rankStr = rankInfo ? `#${rankInfo.rank} / ${rankInfo.total}` : "-";

  const calcRate = (won, played) => played > 0 ? `${Math.round((won / played) * 100)}% (${won}/${played})` : `0% (0/0)`;
  const vPortes = (s.variants && s.variants.PORTES) || { played: 0, won: 0 };
  const vPlakoto = (s.variants && s.variants.PLAKOTO) || { played: 0, won: 0 };
  const vFevga = (s.variants && s.variants.FEVGA) || { played: 0, won: 0 };

  const topOpps = window.TavliDB.getTopOpponents(user.name, 3);
  let oppRowsHtml = "";
  if (topOpps.length === 0) {
    oppRowsHtml = `<tr><td colspan="3" style="text-align:center; color:#90a4ae;">${tr.profNoOpp}</td></tr>`;
  } else {
    topOpps.forEach(o => {
      const safeOppJs = escapeJsStr(o.displayName);
      const oppDotHtml = renderPresenceDotOnlyHtml(o.displayName);
      const oppStreakHtml = renderWinStreakBadgeHtml(o.displayName);
      const oppSwordHtml = renderSwordChallengeBtnHtml(o.displayName, true);
      oppRowsHtml += `
        <tr>
          <td>${oppDotHtml}<span class="player-link" onclick="openPlayerProfileFromLink('${safeOppJs}')">👤 ${escapeHtml(o.displayName)}</span>${oppStreakHtml}${oppSwordHtml}</td>
          <td><span style="color:#00e676;font-weight:bold;">${o.gamesWon}W</span> / <span style="color:#ff8a80;font-weight:bold;">${o.gamesLost}L</span> (${o.gamesPlayed})</td>
          <td><span style="color:#00e676;font-weight:bold;">${o.setsWon}W</span> / <span style="color:#ff8a80;font-weight:bold;">${o.setsLost}L</span> (${o.setsPlayed})</td>
        </tr>
      `;
    });
  }

  const safeTargetJs = escapeJsStr(user.name);
  const dotHtml = renderPresenceDotOnlyHtml(user.name);
  const swordHtml = !isViewingSelf ? renderSwordChallengeBtnHtml(user.name, true) : "";
  const streakHtml = renderWinStreakBadgeHtml(user.name);
  const friendBtnHtml = !isViewingSelf ? renderAddFriendToggleBtnHtml(user.name) : "";
  const headerActionsHtml = !isViewingSelf
    ? `<div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
         ${friendBtnHtml}
         <button class="btn-sm" style="background:var(--valid); color:#111; padding:6px 11px;" onclick="openMessageToPlayerFromProfile('${safeTargetJs}')">${escapeHtml(tr.profSendMsgBtn(user.name))}</button>
         <button class="btn-sm" style="background:#546e7a; color:#fff; padding:6px 10px;" onclick="openProfileModal()">${escapeHtml(tr.profBackToMyProfile)}</button>
       </div>`
    : `<div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
         <button class="btn-sm" style="background:#5c6bc0; color:#fff; padding:6px 11px;" onclick="closeProfileModal(); openFriendsModal();">👥 ${escapeHtml(tr.btnFriends || "Friends")}</button>
         <button class="btn-sm" style="background:#00897b; color:#fff; padding:6px 11px;" onclick="closeProfileModal(); openMessagesModal();">💬 ${escapeHtml(tr.btnMessages)}</button>
       </div>`;

  // Version 26: Achievement Badges (Τρόπαια)
  const badgesList = window.TavliDB.getPlayerBadgesList ? window.TavliDB.getPlayerBadgesList(user.name) : [];
  let badgesHtml = `<div class="trophy-badges-grid">`;
  badgesList.forEach(b => {
    const bName = tr[b.nameKey] || b.id;
    const bDesc = tr[b.descKey] || "";
    const stateCls = b.unlocked ? "unlocked" : "locked";
    badgesHtml += `
      <div class="trophy-badge-card ${stateCls}" title="${escapeHtml(bDesc)}">
        <div class="trophy-badge-icon">${b.icon}</div>
        <div class="trophy-badge-info">
          <div class="trophy-badge-title">${escapeHtml(bName)} ${b.unlocked ? "✅" : "🔒"}</div>
          <div class="trophy-badge-desc">${escapeHtml(bDesc)}</div>
        </div>
      </div>
    `;
  });
  badgesHtml += `</div>`;

  // Version 26: ELO Sparkline & Last 10 Completed Matches Log
  const eloHist = (Array.isArray(s.eloHistory) && s.eloHistory.length > 0) ? s.eloHistory.slice(-12) : [eloRating];
  const sparkPts = eloHist.length === 1 ? [eloHist[0], eloHist[0]] : eloHist;
  const minElo = Math.min(...sparkPts) - 10;
  const maxElo = Math.max(...sparkPts) + 10;
  const rangeElo = Math.max(20, maxElo - minElo);
  const svgW = 240;
  const svgH = 46;
  const polyCoords = sparkPts.map((val, idx) => {
    const x = Math.round((idx / (sparkPts.length - 1)) * (svgW - 16) + 8);
    const y = Math.round(svgH - 8 - ((val - minElo) / rangeElo) * (svgH - 16));
    return `${x},${y}`;
  }).join(" ");
  const lastVal = sparkPts[sparkPts.length - 1];
  const firstVal = sparkPts[0];
  const netTrend = lastVal - firstVal;
  const trendColor = netTrend >= 0 ? "#00e676" : "#ff5252";
  const trendSign = netTrend >= 0 ? `+${netTrend}` : `${netTrend}`;

  const sparklineHtml = `
    <div class="elo-sparkline-box">
      <div>
        <div style="font-size:0.78rem; color:#ffecb3; font-weight:800;">${escapeHtml(tr.profElo || "ELO Rating")}: <span style="color:#ffd54f; font-size:0.95rem;">${eloRating}</span></div>
        <div style="font-size:0.68rem; color:${trendColor}; font-weight:700;">Trend (${sparkPts.length} pts): ${trendSign} ELO</div>
      </div>
      <svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" style="background:rgba(0,0,0,0.28); border-radius:6px; border:1px solid rgba(255,255,255,0.1);">
        <polyline fill="none" stroke="${trendColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${polyCoords}" />
      </svg>
    </div>
  `;

  const recentSets = Array.isArray(s.recentSets) ? [...s.recentSets].reverse().slice(0, 10) : [];
  let recentMatchRowsHtml = "";
  if (recentSets.length === 0) {
    recentMatchRowsHtml = `<tr><td colspan="4" style="text-align:center; color:#90a4ae;">${escapeHtml(tr.profNoMatchHistory || "No completed human sets recorded yet.")}</td></tr>`;
  } else {
    recentSets.forEach(m => {
      const oppName = m.opponent || "Opponent";
      const safeOppJs = escapeJsStr(oppName);
      const deltaNum = parseInt(m.eloDelta, 10) || 0;
      const deltaStr = deltaNum >= 0 ? `+${deltaNum}` : `${deltaNum}`;
      const deltaClr = deltaNum >= 0 ? "#00e676" : "#ff8a80";
      const resBadge = m.won
        ? `<span style="color:#00e676; font-weight:800;">W</span>`
        : `<span style="color:#ff8a80; font-weight:800;">L</span>`;
      recentMatchRowsHtml += `
        <tr>
          <td><span class="player-link" onclick="openPlayerProfileFromLink('${safeOppJs}')">👤 ${escapeHtml(oppName)}</span></td>
          <td>${resBadge} (${m.myScore || 0} - ${m.oppScore || 0})</td>
          <td style="color:${deltaClr}; font-weight:800;">${deltaStr} ELO</td>
          <td style="font-size:0.7rem; color:#b0bec5;">${escapeHtml(formatMessageTime(m.ts))}</td>
        </tr>
      `;
    });
  }

  container.innerHTML = `
    <div class="profile-name-header">
      <span>${dotHtml}👤 ${escapeHtml(user.name)}${streakHtml}${swordHtml} <span style="font-size:0.88rem; color:#ffe082; margin-left:6px;">(${eloRating} ELO)</span></span>
      ${headerActionsHtml}
    </div>

    <div class="stat-grid" style="grid-template-columns: repeat(4, 1fr);">
      <div class="stat-box">
        <div class="val">${rankStr}</div>
        <div class="lbl">${tr.profRank}</div>
      </div>
      <div class="stat-box">
        <div class="val" style="color:#ffd54f;">${eloRating}</div>
        <div class="lbl">${tr.profElo || "ELO Rating"}</div>
      </div>
      <div class="stat-box">
        <div class="val" style="font-size:0.95rem;"><span style="color:#00e676;">${setsW}W</span> / <span style="color:#ff8a80;">${setsL}L</span> (${setsTot})</div>
        <div class="lbl">${tr.profSets}</div>
      </div>
      <div class="stat-box">
        <div class="val" style="font-size:0.95rem;"><span style="color:#00e676;">${gamesW}W</span> / <span style="color:#ff8a80;">${gamesL}L</span> (${gamesTot})</div>
        <div class="lbl">${tr.profGames}</div>
      </div>
    </div>

    <div class="sub-heading">${escapeHtml(tr.profTrophiesHeading || "🏆 Trophies & Achievements (Τρόπαια)")}</div>
    ${badgesHtml}

    <div class="sub-heading">${escapeHtml(tr.profSparklineHeading || "📈 ELO Rating Trend & Last 10 Completed Sets")}</div>
    ${sparklineHtml}
    <table class="data-table">
      <thead>
        <tr>
          <th>${tr.colOpponent}</th>
          <th>${escapeHtml(tr.colScore || "Score")}</th>
          <th>${escapeHtml(tr.colEloDelta || "ELO Δ")}</th>
          <th>${escapeHtml(tr.colDate || "Date")}</th>
        </tr>
      </thead>
      <tbody>${recentMatchRowsHtml}</tbody>
    </table>

    <div class="sub-heading">${tr.profVariantHeading}</div>
    <div class="stat-grid">
      <div class="stat-box">
        <div class="val" style="font-size:0.95rem;">${calcRate(vPortes.won, vPortes.played)}</div>
        <div class="lbl">${tr.variants.PORTES}</div>
      </div>
      <div class="stat-box">
        <div class="val" style="font-size:0.95rem;">${calcRate(vPlakoto.won, vPlakoto.played)}</div>
        <div class="lbl">${tr.variants.PLAKOTO}</div>
      </div>
      <div class="stat-box">
        <div class="val" style="font-size:0.95rem;">${calcRate(vFevga.won, vFevga.played)}</div>
        <div class="lbl">${tr.variants.FEVGA}</div>
      </div>
    </div>

    <div class="sub-heading">${tr.profTopOppHeading}</div>
    <table class="data-table">
      <thead>
        <tr>
          <th>${tr.colOpponent}</th>
          <th>${tr.colOppGames}</th>
          <th>${tr.colOppSetsWL}</th>
        </tr>
      </thead>
      <tbody>${oppRowsHtml}</tbody>
    </table>
    <div style="font-size:0.72rem; color:#ffecb3; text-align:center; margin-top:4px;">${escapeHtml(tr.profClickHint)}</div>
  `;
}

// --- Global Player Messages Modal ---
async function openMessagesModal(initialPartnerName = null) {
  if (!isAuthenticatedAccount && myStoreDetailsPref) {
    await verifyIdentityOnLanding(false);
  }
  if (initialPartnerName) {
    activeMessagePartner = String(initialPartnerName).trim();
    if (isAuthenticatedAccount) {
      window.TavliDB.markConversationRead(myPlayerName, activeMessagePartner);
    }
  }
  renderMessagesModalContent();
  document.getElementById("messagesModal").style.display = "flex";
  updateUnreadMessageBadges();

  await window.TavliDB.pullFromServer();
  if (activeMessagePartner && isAuthenticatedAccount) {
    window.TavliDB.markConversationRead(myPlayerName, activeMessagePartner);
  }
  renderMessagesModalContent();
  updateUnreadMessageBadges();
}

function closeMessagesModal() {
  document.getElementById("messagesModal").style.display = "none";
  updateUnreadMessageBadges();
}

function selectMessageThread(partnerName) {
  if (!partnerName) return;
  activeMessagePartner = String(partnerName).trim();
  if (isAuthenticatedAccount) {
    window.TavliDB.markConversationRead(myPlayerName, activeMessagePartner);
  }
  renderMessagesModalContent();
  updateUnreadMessageBadges();
}

// --- Live Games Lobby Modal Functions ---
function switchLiveLobbyTab(tabName) {
  activeLiveLobbyTab = (tabName === "KAFENEIO") ? "KAFENEIO" : "ROOMS";
  const btnRooms = document.getElementById("btnLiveTabRooms");
  const btnKaf = document.getElementById("btnLiveTabKafeneio");
  const paneRooms = document.getElementById("liveRoomsTabPane");
  const paneKaf = document.getElementById("kafeneioChatTabPane");

  if (btnRooms) btnRooms.classList.toggle("active", activeLiveLobbyTab === "ROOMS");
  if (btnKaf) btnKaf.classList.toggle("active", activeLiveLobbyTab === "KAFENEIO");
  if (paneRooms) paneRooms.style.display = activeLiveLobbyTab === "ROOMS" ? "block" : "none";
  if (paneKaf) paneKaf.style.display = activeLiveLobbyTab === "KAFENEIO" ? "block" : "none";

  if (activeLiveLobbyTab === "KAFENEIO") {
    renderKafeneioLobbyChatContent();
  } else {
    renderLiveGamesModalContent();
  }
}

function renderKafeneioLobbyChatContent() {
  const box = document.getElementById("kafeneioMessagesBox");
  if (!box) return;
  const tr = t();
  const msgs = window.TavliDB && typeof window.TavliDB.getLobbyChatMessages === "function"
    ? window.TavliDB.getLobbyChatMessages()
    : [];

  if (msgs.length === 0) {
    box.innerHTML = `<div style="margin:auto; text-align:center; color:#90a4ae; font-size:0.82rem; padding:16px;">${escapeHtml(tr.kafeneioEmptyMsg || "No messages in the Kafeneio yet.")}</div>`;
    return;
  }

  let html = "";
  msgs.forEach(m => {
    const sender = m.sender || "Player";
    const safeJs = escapeJsStr(sender);
    const dotHtml = renderPresenceDotOnlyHtml(sender);
    const streakHtml = renderWinStreakBadgeHtml(sender);
    const swordHtml = renderSwordChallengeBtnHtml(sender, true);
    html += `
      <div class="kafeneio-msg-row">
        <div>
          ${dotHtml}<span class="player-link" onclick="closeLiveGamesModal(); openProfileModal('${safeJs}')">${escapeHtml(sender)}</span>${streakHtml}${swordHtml}:
          <span style="color:#eceff1; margin-left:4px;">${escapeHtml(m.text)}</span>
        </div>
        <span style="font-size:0.65rem; color:#90a4ae; white-space:nowrap;">${escapeHtml(formatMessageTime(m.ts))}</span>
      </div>
    `;
  });
  box.innerHTML = html;
  box.scrollTop = box.scrollHeight;
}

async function handleSendKafeneioChat() {
  const input = document.getElementById("kafeneioChatInput");
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  const senderName = myPlayerName || (document.getElementById("playerNameInput")?.value.trim()) || t().defaultPlayer;
  const res = await window.TavliDB.sendLobbyChatMessageAsync(senderName, text);
  if (res && res.ok) {
    playChatSound();
    renderKafeneioLobbyChatContent();
  }
}

async function postOpenChallengeInKafeneio() {
  const tr = t();
  const senderName = myPlayerName || (document.getElementById("playerNameInput")?.value.trim()) || tr.defaultPlayer;
  const modeLabel = myGameModePref === "FULL" ? tr.modeFull : (tr.variants[myGameModePref] || myGameModePref);
  const text = tr.kafeneioOpenChallengeText
    ? tr.kafeneioOpenChallengeText(senderName, modeLabel, myTargetScorePref || 7)
    : `⚔️ I'm looking for a match (${modeLabel} • Target: ${myTargetScorePref || 7})!`;
  const res = await window.TavliDB.sendLobbyChatMessageAsync(senderName, text);
  if (res && res.ok) {
    playChatSound();
    renderKafeneioLobbyChatContent();
  }
}

async function openLiveGamesModal(defaultTab = "ROOMS") {
  if (!isAuthenticatedAccount && myStoreDetailsPref) {
    const ok = await verifyIdentityOnLanding(false);
    if (!ok) return;
  }
  const tr = t();
  const statusEl = document.getElementById("liveSyncStatus");
  if (statusEl && tr.liveSyncing) statusEl.textContent = tr.liveSyncing;
  switchLiveLobbyTab(defaultTab);
  document.getElementById("liveGamesModal").style.display = "flex";

  await window.TavliDB.pullFromServer();
  if (statusEl && tr.liveSynced) statusEl.textContent = tr.liveSynced;
  renderLiveGamesModalContent();
  renderKafeneioLobbyChatContent();
}

function closeLiveGamesModal() {
  document.getElementById("liveGamesModal").style.display = "none";
}

async function refreshLiveGamesLobby() {
  const tr = t();
  const statusEl = document.getElementById("liveSyncStatus");
  if (statusEl && tr.liveSyncing) statusEl.textContent = tr.liveSyncing;
  await window.TavliDB.pullFromServer();
  if (statusEl && tr.liveSynced) statusEl.textContent = tr.liveSynced;
  renderLiveGamesModalContent();
  renderKafeneioLobbyChatContent();
}

function renderLiveGamesModalContent() {
  const container = document.getElementById("liveGamesListContainer");
  if (!container) return;
  const tr = t();
  const rooms = window.TavliDB.getLiveRooms ? window.TavliDB.getLiveRooms() : [];

  if (rooms.length === 0) {
    container.innerHTML = `<p style="font-size:0.86rem; color:#90a4ae; text-align:center; padding:18px;">${escapeHtml(tr.liveEmpty || "No live games right now.")}</p>`;
    return;
  }

  let html = "";
  rooms.forEach(rm => {
    const code = escapeHtml(rm.roomCode);
    const codeJs = escapeJsStr(rm.roomCode);
    const hostName = rm.hostName || "Player 1";
    const guestName = rm.guestName || "Player 2";
    const isFull = (rm.playerCount >= 2);
    const vName = (tr.variants && tr.variants[rm.variant]) ? tr.variants[rm.variant] : (rm.variant || "PORTES");
    const specCount = Math.max(0, parseInt(rm.spectatorCount, 10) || 0);
    const timerTxt = getTimerLabelText(rm.turnTimerSec || 0);

    const playersLine = isFull
      ? (tr.livePlayers2 ? tr.livePlayers2(hostName, guestName) : `${hostName} vs ${guestName} (2/2)`)
      : (tr.livePlayers1 ? tr.livePlayers1(hostName) : `${hostName} (1/2)`);

    const scoreInfo = isFull
      ? ` • Score: ${rm.scoreW || 0} - ${rm.scoreB || 0} (Target: ${rm.targetScore || 7})`
      : ` • Target: ${rm.targetScore || 7}`;

    const actionsHtml = isFull
      ? `<button class="btn-sm" style="background:#00897b; color:#fff; padding:8px 14px;" onclick="handleLiveRoomAction('${codeJs}', 'SPECTATE')">${escapeHtml(tr.liveWatchBtn || "👁️ Spectate")}</button>`
      : `<button class="btn-sm" style="background:var(--accent); color:#111; padding:8px 14px;" onclick="handleLiveRoomAction('${codeJs}', 'JOIN')">${escapeHtml(tr.liveJoinBtn || "🤝 Join as Player")}</button>
         <button class="btn-sm" style="background:#00897b; color:#fff; padding:8px 14px;" onclick="handleLiveRoomAction('${codeJs}', 'SPECTATE')">${escapeHtml(tr.liveWatchBtn || "👁️ Spectate")}</button>`;

    html += `
      <div class="live-game-card">
        <div class="live-game-info">
          <div class="live-game-title">${escapeHtml(playersLine)}</div>
          <div class="live-game-meta">
            Room: <strong>${code}</strong> • ${escapeHtml(vName)}${escapeHtml(scoreInfo)} • ⏱️ ${escapeHtml(timerTxt)} • 👁️ ${specCount}
          </div>
        </div>
        <div class="live-game-actions">
          ${actionsHtml}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function handleLiveRoomAction(roomCode, actionMode) {
  closeLiveGamesModal();
  const cleanCode = String(roomCode || "").trim().toUpperCase();
  pendingRoomFromUrl = cleanCode;
  const roomInput = document.getElementById("modalRoomInput");
  if (roomInput) roomInput.value = cleanCode;

  if (actionMode === "JOIN") {
    openPlaySetupModal("JOIN", cleanCode);
  } else {
    if (!isAuthenticatedAccount && myStoreDetailsPref) {
      openPlaySetupModal("SPECTATE", cleanCode);
    } else {
      pendingRoomFromUrl = null;
      showScreen("GAME");
      joinRoomWithCode(cleanCode, true);
    }
  }
}

// --- Typing Field & Prefix Autocomplete for Player Messaging ---
function handleMsgRecipientTyping() {
  const input = document.getElementById("msgRecipientSearchInput");
  const listEl = document.getElementById("msgRecipientAutocompleteList");
  if (!input || !listEl) return;

  const query = input.value.trim().toLowerCase();
  if (!query) {
    listEl.style.display = "none";
    listEl.innerHTML = "";
    return;
  }

  const myKey = window.TavliDB.normalizeKey(myPlayerName);
  const allUsers = window.TavliDB.getAllUsers().filter(u => window.TavliDB.normalizeKey(u.name) !== myKey);

  const startsWithMatches = allUsers.filter(u => u.name.toLowerCase().startsWith(query));
  const containsMatches = allUsers.filter(u => !u.name.toLowerCase().startsWith(query) && u.name.toLowerCase().includes(query));
  const matches = [...startsWithMatches, ...containsMatches];

  const tr = t();
  if (matches.length === 0) {
    listEl.innerHTML = `<div class="msg-autocomplete-item" style="color:#90a4ae; cursor:default;">${escapeHtml(tr.msgNoMatchUsers || "No matching players found")}</div>`;
    listEl.style.display = "block";
    return;
  }

  let itemsHtml = "";
  matches.forEach(u => {
    const safeJs = escapeJsStr(u.name);
    const prHtml = renderPresenceAndChallengeHtml(u.name, false);
    itemsHtml += `
      <div class="msg-autocomplete-item" onclick="selectTypedMessageRecipient('${safeJs}')">
        <span>${prHtml}👤 <strong>${escapeHtml(u.name)}</strong></span>
        <span style="font-size:0.72rem; color:var(--accent);">💬 ${escapeHtml(tr.msgStartChatBtn || "Chat")}</span>
      </div>
    `;
  });

  listEl.innerHTML = itemsHtml;
  listEl.style.display = "block";
}

function selectTypedMessageRecipient(playerName) {
  const input = document.getElementById("msgRecipientSearchInput");
  const listEl = document.getElementById("msgRecipientAutocompleteList");
  if (input) input.value = "";
  if (listEl) listEl.style.display = "none";
  selectMessageThread(playerName);
}

function startNewMessageThreadFromTypedInput() {
  const input = document.getElementById("msgRecipientSearchInput");
  if (!input) return;
  const query = input.value.trim().toLowerCase();
  if (!query) return;

  const myKey = window.TavliDB.normalizeKey(myPlayerName);
  const allUsers = window.TavliDB.getAllUsers().filter(u => window.TavliDB.normalizeKey(u.name) !== myKey);

  const exact = allUsers.find(u => u.name.toLowerCase() === query);
  const starts = allUsers.find(u => u.name.toLowerCase().startsWith(query));
  const chosen = exact || starts;
  if (chosen) {
    selectTypedMessageRecipient(chosen.name);
  }
}

function formatMessageTime(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    if (sameDay) return `${hh}:${mm}`;
    return `${d.getDate()}/${d.getMonth() + 1} ${hh}:${mm}`;
  } catch (_) {
    return "";
  }
}

async function handleSendDirectMessage() {
  const input = document.getElementById("directMsgInput");
  if (!input || !activeMessagePartner || !isAuthenticatedAccount) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = "";

  const res = await window.TavliDB.sendMessageAsync(myPlayerName, activeMessagePartner, text);
  if (res.ok) {
    playChatSound();
    if (typeof syncDatabaseWithPeer === "function") {
      syncDatabaseWithPeer();
    }
    renderMessagesModalContent();
    updateUnreadMessageBadges();
  }
}

function renderMessagesModalContent() {
  const container = document.getElementById("messagesModalBody");
  if (!container) return;
  const tr = t();

  if (!isAuthenticatedAccount) {
    container.innerHTML = `
      <p style="font-size:0.86rem; color:#ffecb3; text-align:center; padding:18px;">
        ${escapeHtml(tr.msgLoginReq)}
      </p>
    `;
    return;
  }

  const myKey = window.TavliDB.normalizeKey(myPlayerName);
  const threads = window.TavliDB.getConversationThreads(myPlayerName);

  if (!activeMessagePartner && threads.length > 0) {
    activeMessagePartner = threads[0].partnerName;
    window.TavliDB.markConversationRead(myPlayerName, activeMessagePartner);
  }

  const activePartnerKey = window.TavliDB.normalizeKey(activeMessagePartner);

  let threadsListHtml = "";
  if (threads.length === 0) {
    threadsListHtml = `<div style="font-size:0.75rem; color:#90a4ae; padding:8px; text-align:center;">${escapeHtml(tr.msgNoThreads)}</div>`;
  } else {
    threads.forEach(th => {
      const isAct = (th.partnerKey === activePartnerKey);
      const safePartnerJs = escapeJsStr(th.partnerName);
      const prDot = renderPresenceAndChallengeHtml(th.partnerName, false);
      const unreadPill = th.unreadCount > 0
        ? `<span style="background:#e53935; color:#fff; border-radius:999px; padding:1px 6px; font-size:0.65rem; font-weight:900;">${th.unreadCount}</span>`
        : "";
      threadsListHtml += `
        <div class="msg-thread-item ${isAct ? "active" : ""}" onclick="selectMessageThread('${safePartnerJs}')">
          <div class="msg-thread-top">
            <span>${prDot}👤 ${escapeHtml(th.partnerName)}</span>
            ${unreadPill}
          </div>
          <div class="msg-thread-preview">${escapeHtml(th.lastMsg.text)}</div>
        </div>
      `;
    });
  }

  let rightPaneHtml = "";
  if (!activeMessagePartner) {
    rightPaneHtml = `
      <div style="margin:auto; text-align:center; color:#90a4ae; font-size:0.82rem; padding:16px;">
        ${escapeHtml(tr.msgSelectPrompt)}
      </div>
    `;
  } else {
    const partnerUser = window.TavliDB.getUser(activeMessagePartner);
    const displayPartnerName = partnerUser ? partnerUser.name : activeMessagePartner;
    const safePartnerJs = escapeJsStr(displayPartnerName);
    const partnerPrHtml = renderPresenceAndChallengeHtml(displayPartnerName, true);

    const allMyMsgs = window.TavliDB.getMessagesForUser(myPlayerName);
    const convMsgs = allMyMsgs.filter(m =>
      (m.fromKey === myKey && m.toKey === activePartnerKey) ||
      (m.fromKey === activePartnerKey && m.toKey === myKey)
    );

    let bubblesHtml = "";
    if (convMsgs.length === 0) {
      bubblesHtml = `<div style="margin:auto; text-align:center; color:#90a4ae; font-size:0.78rem;">👋 ${escapeHtml(tr.msgChattingWith(displayPartnerName))}</div>`;
    } else {
      convMsgs.forEach(m => {
        const isSent = (m.fromKey === myKey);
        bubblesHtml += `
          <div class="msg-bubble ${isSent ? "sent" : "received"}">
            <div>${escapeHtml(m.text)}</div>
            <div class="msg-bubble-meta">${escapeHtml(formatMessageTime(m.ts))}</div>
          </div>
        `;
      });
    }

    rightPaneHtml = `
      <div class="msg-chat-header">
        <span>${partnerPrHtml}💬 ${escapeHtml(tr.msgChattingWith(displayPartnerName))}</span>
        <button class="btn-sm" style="padding:4px 8px; font-size:0.72rem;" onclick="closeMessagesModal(); openProfileModal('${safePartnerJs}');">${escapeHtml(tr.msgViewProfBtn)}</button>
      </div>
      <div class="msg-chat-history" id="directMsgHistoryBox">${bubblesHtml}</div>
      <div class="chat-input-row" style="margin-top:6px;">
        <div class="emoji-picker-wrap">
          <button type="button" class="btn-emoji-toggle" onclick="toggleEmojiPicker('directMsgEmojiPopover', 'directMsgInput')" title="Emojis">😀</button>
          <div class="emoji-popover" id="directMsgEmojiPopover"></div>
        </div>
        <input type="text" id="directMsgInput" placeholder="${escapeHtml(tr.msgInputPlaceholder)}" maxlength="240" onkeydown="if(event.key==='Enter') handleSendDirectMessage()" />
        <button onclick="handleSendDirectMessage()">${escapeHtml(tr.msgSendBtn)}</button>
      </div>
    `;
  }

  container.innerHTML = `
    <div style="display:flex; gap:6px; align-items:center; margin-bottom:6px;">
      <div class="msg-search-wrap">
        <input
          type="text"
          id="msgRecipientSearchInput"
          placeholder="${escapeHtml(tr.msgNewRecipientPh)}"
          autocomplete="off"
          style="width:100%; padding:8px 12px; border-radius:7px; border:1px solid var(--wood-mid); background:#141414; color:#fff; font-size:0.84rem; text-align:left;"
          oninput="handleMsgRecipientTyping()"
          onfocus="handleMsgRecipientTyping()"
          onkeydown="if(event.key==='Enter') startNewMessageThreadFromTypedInput()"
        />
        <div class="msg-autocomplete-list" id="msgRecipientAutocompleteList"></div>
      </div>
      <button class="btn-sm" style="padding:8px 12px;" onclick="startNewMessageThreadFromTypedInput()">+ ${escapeHtml(tr.msgStartChatBtn)}</button>
    </div>

    <div class="msg-layout">
      <div class="msg-threads-col">
        <div style="font-size:0.75rem; font-weight:bold; color:#ffecb3; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">
          ${escapeHtml(tr.msgConversationsHdr)}
        </div>
        ${threadsListHtml}
      </div>
      <div class="msg-chat-col">
        ${rightPaneHtml}
      </div>
    </div>
  `;

  const histBox = document.getElementById("directMsgHistoryBox");
  if (histBox) {
    histBox.scrollTop = histBox.scrollHeight;
  }
}

function renderSettingsAccountSection(feedbackMsg = "") {
  const container = document.getElementById("settingsAccountSection");
  if (!container) return;
  const tr = t();
  const user = window.TavliDB.getUser(myPlayerName);

  if (!user || !isAuthenticatedAccount) {
    container.innerHTML = `
      <div class="sub-heading">${tr.profEditHeading}</div>
      <p style="font-size:0.78rem; color:#ffecb3; padding:6px 0;">${tr.profGuestMsg}</p>
    `;
    return;
  }

  container.innerHTML = `
    <div class="sub-heading">${tr.profEditHeading}</div>
    <div class="edit-row">
      <input type="text" id="profEditName" value="${escapeHtml(user.name)}" maxlength="16" placeholder="Name" />
      <input type="password" id="profEditPin" value="" maxlength="4" inputmode="numeric" placeholder="${tr.profNewPinPh}" />
      <button class="btn-sm" style="padding:9px 14px;" onclick="saveProfileEdits()">${tr.profSaveBtn}</button>
    </div>
    ${feedbackMsg ? `<div style="margin-top:6px; font-size:0.78rem; color:#00e676; font-weight:bold;">${escapeHtml(feedbackMsg)}</div>` : ""}
  `;
}

async function saveProfileEdits() {
  const newName = document.getElementById("profEditName").value.trim();
  const newPin = document.getElementById("profEditPin").value.trim();
  const res = await window.TavliDB.updateCredentialsAsync(myPlayerName, newName, newPin, mySessionPin);
  if (!res.ok) {
    alert(res.message);
    return false;
  }

  if (newPin) mySessionPin = newPin;
  const oldName = myPlayerName;
  myPlayerName = res.user.name;
  document.getElementById("playerNameInput").value = myPlayerName;
  localStorage.setItem("tavli_player_name", myPlayerName);
  localStorage.setItem("tavli_logged_in_name", myPlayerName);
  localStorage.setItem("tavli_logged_in_pinhash", res.user.pinHash);

  if (myRole === "B") {
    playerNames.B = myPlayerName;
    if (state.playerNames) state.playerNames.B = myPlayerName;
  } else if (myRole === "W" || myRole === "BOTH") {
    playerNames.W = myPlayerName;
    if (state.playerNames) state.playerNames.W = myPlayerName;
    if (playerNames.B === oldName) playerNames.B = myPlayerName;
  }
  checkPersistentLoginSession();
  updateHeaderLabels();
  render();
  syncDatabaseWithPeer();
  renderSettingsAccountSection(t().profSavedMsg);
  return true;
}

async function openLeaderboardModal() {
  const tr = t();
  lbCurrentPage = 1;
  document.getElementById("lbSyncStatus").textContent = tr.lbSyncing;
  renderLeaderboardModalContent();
  document.getElementById("leaderboardModal").style.display = "flex";

  await window.TavliDB.pullFromServer();
  document.getElementById("lbSyncStatus").textContent = tr.lbSynced;
  renderLeaderboardModalContent();
}
function closeLeaderboardModal() {
  document.getElementById("leaderboardModal").style.display = "none";
}

// ============================================================================
// VERSION 25: FRIENDS LIST MODAL & IN-GAME ROOM ROSTER MODAL
// ============================================================================
async function toggleFriendStatusForPlayer(targetName) {
  if (!targetName || !window.TavliDB) return;
  const isFr = window.TavliDB.isFriend(myPlayerName, targetName);
  if (isFr) {
    await window.TavliDB.removeFriendAsync(myPlayerName, targetName);
  } else {
    await window.TavliDB.addFriendAsync(myPlayerName, targetName);
  }
  if (typeof syncDatabaseWithPeer === "function") {
    syncDatabaseWithPeer();
  }
  if (document.getElementById("friendsModal").style.display === "flex") {
    renderFriendsModalContent();
  }
  if (document.getElementById("leaderboardModal").style.display === "flex") {
    renderLeaderboardModalContent();
  }
  if (document.getElementById("profileModal").style.display === "flex") {
    renderProfileModalContent(inspectedProfileName);
  }
  if (document.getElementById("roomRosterModal").style.display === "flex") {
    renderRoomRosterModalContent();
  }
}

async function openFriendsModal() {
  if (!isAuthenticatedAccount && myStoreDetailsPref) {
    await verifyIdentityOnLanding(false);
  }
  renderFriendsModalContent();
  document.getElementById("friendsModal").style.display = "flex";
  await window.TavliDB.pullFromServer();
  renderFriendsModalContent();
}

function closeFriendsModal() {
  const modal = document.getElementById("friendsModal");
  if (modal) modal.style.display = "none";
}

function handleFriendsSearchTyping() {
  const input = document.getElementById("friendsSearchInput");
  const listEl = document.getElementById("friendsAutocompleteList");
  if (!input || !listEl) return;

  const query = input.value.trim().toLowerCase();
  if (!query) {
    listEl.style.display = "none";
    listEl.innerHTML = "";
    return;
  }

  const myKey = window.TavliDB.normalizeKey(myPlayerName);
  const allUsers = window.TavliDB.getAllUsers().filter(u => window.TavliDB.normalizeKey(u.name) !== myKey);
  const startsWith = allUsers.filter(u => u.name.toLowerCase().startsWith(query));
  const contains = allUsers.filter(u => !u.name.toLowerCase().startsWith(query) && u.name.toLowerCase().includes(query));
  const matches = [...startsWith, ...contains];

  const tr = t();
  if (matches.length === 0) {
    listEl.innerHTML = `<div class="msg-autocomplete-item" style="color:#90a4ae; cursor:default;">${escapeHtml(tr.msgNoMatchUsers || "No matching players found")}</div>`;
    listEl.style.display = "block";
    return;
  }

  let html = "";
  matches.forEach(u => {
    const safeJs = escapeJsStr(u.name);
    const dotHtml = renderPresenceDotOnlyHtml(u.name);
    const streakHtml = renderWinStreakBadgeHtml(u.name);
    const isFr = window.TavliDB.isFriend(myPlayerName, u.name);
    html += `
      <div class="msg-autocomplete-item" onclick="selectFriendFromAutocomplete('${safeJs}')">
        <span>${dotHtml}👤 <strong>${escapeHtml(u.name)}</strong>${streakHtml}</span>
        <span style="font-size:0.74rem; color:${isFr ? "#00e676" : "var(--accent)"}; font-weight:800;">
          ${escapeHtml(isFr ? (tr.friendsAddedBtn || "⭐ Friend") : (tr.friendsAddBtn || "+ Add Friend"))}
        </span>
      </div>
    `;
  });
  listEl.innerHTML = html;
  listEl.style.display = "block";
}

async function selectFriendFromAutocomplete(playerName) {
  const input = document.getElementById("friendsSearchInput");
  const listEl = document.getElementById("friendsAutocompleteList");
  if (input) input.value = "";
  if (listEl) listEl.style.display = "none";
  if (!playerName) return;
  await window.TavliDB.addFriendAsync(myPlayerName, playerName);
  renderFriendsModalContent();
}

async function addFriendFromTypedInput() {
  const input = document.getElementById("friendsSearchInput");
  if (!input) return;
  const query = input.value.trim();
  if (!query) return;
  const myKey = window.TavliDB.normalizeKey(myPlayerName);
  const allUsers = window.TavliDB.getAllUsers().filter(u => window.TavliDB.normalizeKey(u.name) !== myKey);
  const exact = allUsers.find(u => u.name.toLowerCase() === query.toLowerCase());
  const starts = allUsers.find(u => u.name.toLowerCase().startsWith(query.toLowerCase()));
  const targetName = exact ? exact.name : (starts ? starts.name : query);
  await selectFriendFromAutocomplete(targetName);
}

function renderFriendsModalContent() {
  const container = document.getElementById("friendsListContent");
  if (!container) return;
  const tr = t();
  const friendsList = window.TavliDB.getFriendsDetailedList(myPlayerName);

  if (friendsList.length === 0) {
    container.innerHTML = `<p style="font-size:0.85rem; color:#90a4ae; text-align:center; padding:18px;">${escapeHtml(tr.friendsEmpty || "Your Friends list is empty.")}</p>`;
    return;
  }

  let html = "";
  friendsList.forEach(fr => {
    const safeJs = escapeJsStr(fr.name);
    const dotHtml = renderPresenceDotOnlyHtml(fr.name);
    const streakHtml = renderWinStreakBadgeHtml(fr.name);
    const swordHtml = renderSwordChallengeBtnHtml(fr.name, true);
    let statusLbl = tr.presenceOffline || "Offline";
    if (fr.presence && fr.presence.online) {
      if (fr.presence.status === "online_idle") statusLbl = tr.presenceOnlineIdle || "Online";
      else if (fr.presence.status === "hosting") statusLbl = tr.presenceHosting || "Hosting Room";
      else statusLbl = tr.presencePlaying || "In a Game";
    }

    html += `
      <div class="roster-item-row">
        <div>
          ${dotHtml}<span class="player-link" onclick="closeFriendsModal(); openProfileModal('${safeJs}')">👤 ${escapeHtml(fr.name)}</span>${streakHtml}${swordHtml}
          <span style="font-size:0.75rem; color:#ffd54f; margin-left:6px;">${fr.elo} ELO</span>
          <div style="font-size:0.7rem; color:#b0bec5; margin-top:2px;">${escapeHtml(statusLbl)}</div>
        </div>
        <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
          <button class="btn-sm" style="background:#00897b; color:#fff; padding:5px 10px;" onclick="closeFriendsModal(); openMessagesModal('${safeJs}')">💬 ${escapeHtml(tr.msgStartChatBtn || "Chat")}</button>
          <button class="btn-sm" style="background:#546e7a; color:#fff; padding:5px 9px;" onclick="toggleFriendStatusForPlayer('${safeJs}')">${escapeHtml(tr.friendsRemoveBtn || "✕")}</button>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function openRoomRosterModal() {
  renderRoomRosterModalContent();
  const modal = document.getElementById("roomRosterModal");
  if (modal) modal.style.display = "flex";
}

function closeRoomRosterModal() {
  const modal = document.getElementById("roomRosterModal");
  if (modal) modal.style.display = "none";
}

function renderRoomRosterModalContent() {
  const container = document.getElementById("roomRosterContent");
  if (!container) return;
  const tr = t();

  const wName = (playerNames && playerNames.W) ? playerNames.W : "Player 1";
  const bName = (playerNames && playerNames.B) ? playerNames.B : "Player 2";
  const specs = (state && Array.isArray(state.spectatorNames)) ? state.spectatorNames : [];

  const buildPersonRow = (pName, roleBadge) => {
    if (!pName || pName === "Player 2") {
      return `
        <div class="roster-item-row">
          <span style="color:#90a4ae;">⏳ ${escapeHtml(pName || "Waiting...")} (${escapeHtml(roleBadge)})</span>
        </div>
      `;
    }
    const isAi = window.TavliDB.isAiPlayerName(pName);
    const isMe = window.TavliDB.normalizeKey(pName) === window.TavliDB.normalizeKey(myPlayerName);
    const safeJs = escapeJsStr(pName);
    const dotHtml = isAi ? "🤖 " : renderPresenceDotOnlyHtml(pName);
    const streakHtml = !isAi ? renderWinStreakBadgeHtml(pName) : "";
    const friendBtn = (!isAi && !isMe) ? renderAddFriendToggleBtnHtml(pName) : "";
    const msgBtn = (!isAi && !isMe)
      ? `<button class="btn-sm" style="background:#00897b; color:#fff; padding:4px 8px;" onclick="closeRoomRosterModal(); openMessagesModal('${safeJs}')">💬</button>`
      : "";

    return `
      <div class="roster-item-row">
        <div>
          ${dotHtml}<span class="${!isAi ? "player-link" : ""}" ${!isAi ? `onclick="closeRoomRosterModal(); openProfileModal('${safeJs}')"` : ""}>${escapeHtml(pName)}</span>${streakHtml}
          <span style="font-size:0.7rem; color:#ffecb3; margin-left:6px;">(${escapeHtml(roleBadge)})</span>
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
          ${friendBtn}
          ${msgBtn}
        </div>
      </div>
    `;
  };

  let specsHtml = "";
  if (specs.length === 0) {
    specsHtml = `<p style="font-size:0.8rem; color:#90a4ae; padding:8px; text-align:center;">${escapeHtml(tr.roomNoSpectators || "No spectators watching right now.")}</p>`;
  } else {
    specs.forEach(sName => {
      specsHtml += buildPersonRow(sName, tr.spectatorTag || "Spectator");
    });
  }

  container.innerHTML = `
    <div class="sub-heading">${escapeHtml(tr.roomPlayersHdr || "Players in Match")}</div>
    ${buildPersonRow(wName, getColorMeta(state.colors.W).label)}
    ${buildPersonRow(bName, getColorMeta(state.colors.B).label)}

    <div class="sub-heading">${escapeHtml(tr.roomSpectatorsHdr || "Spectators Watching")} (${specs.length})</div>
    ${specsHtml}
  `;
}


function changeLeaderboardPage(delta) {
  lbCurrentPage += delta;
  renderLeaderboardModalContent();
}

function renderLeaderboardModalContent() {
  const container = document.getElementById("leaderboardContent");
  const tr = t();
  const list = window.TavliDB.getLeaderboard();

  if (list.length === 0) {
    container.innerHTML = `<p style="font-size:0.85rem; color:#90a4ae; text-align:center; padding:12px;">${tr.lbEmpty}</p>`;
    return;
  }

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  if (lbCurrentPage > totalPages) lbCurrentPage = totalPages;
  if (lbCurrentPage < 1) lbCurrentPage = 1;

  const startIdx = (lbCurrentPage - 1) * PAGE_SIZE;
  const pageItems = list.slice(startIdx, startIdx + PAGE_SIZE);

  let rowsHtml = "";
  pageItems.forEach(item => {
    const isMe = window.TavliDB.normalizeKey(item.name) === window.TavliDB.normalizeKey(myPlayerName);
    const rowStyle = isMe ? "background:rgba(255,179,0,0.16); font-weight:bold;" : "";
    const safeNameJs = escapeJsStr(item.name);
    const dotHtml = renderPresenceDotOnlyHtml(item.name);
    const streakHtml = renderWinStreakBadgeHtml(item.name);
    const swordRightHtml = renderSwordChallengeBtnHtml(item.name, true);
    rowsHtml += `
      <tr style="${rowStyle}">
        <td>#${item.rank}</td>
        <td>${dotHtml}<span class="player-link" onclick="openPlayerProfileFromLink('${safeNameJs}')">👤 ${escapeHtml(item.name)}</span>${streakHtml}${swordRightHtml}</td>
        <td style="color:#ffd54f; font-weight:800;">${item.elo}</td>
        <td>${item.setsWon} / ${item.setsPlayed}</td>
        <td>${item.gamesWon} / ${item.gamesPlayed}</td>
        <td style="color:var(--accent); font-weight:bold;">${Math.round(item.overallWinRate)}%</td>
      </tr>
    `;
  });

  const pagerHtml = totalPages > 1 ? `
    <div class="pagination-bar">
      <button onclick="changeLeaderboardPage(-1)" ${lbCurrentPage <= 1 ? "disabled" : ""}>${tr.prevPage}</button>
      <span>${tr.pageOf(lbCurrentPage, totalPages)}</span>
      <button onclick="changeLeaderboardPage(1)" ${lbCurrentPage >= totalPages ? "disabled" : ""}>${tr.nextPage}</button>
    </div>
  ` : "";

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>${tr.colRank}</th>
          <th>${tr.colPlayer}</th>
          <th>${tr.colElo || "ELO"}</th>
          <th>${tr.colSets}</th>
          <th>${tr.colGames}</th>
          <th>${tr.colWinRate}</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    ${pagerHtml}
  `;
}

// --- Sotiris Admin Database Manager (Includes ELO Column) ---
async function openAdminModal() {
  if (!isAuthenticatedAccount || !window.TavliDB.isAdminName(myPlayerName)) return;
  adminCurrentPage = 1;
  document.getElementById("adminOpponentsEditor").style.display = "none";
  document.getElementById("adminFeedback").textContent = "Syncing with server...";
  document.getElementById("adminCloudUrlInput").value = window.TavliDB.getCloudUrl();
  const bInput = document.getElementById("adminBroadcastInput");
  const curBanner = window.TavliDB.getBroadcastBanner ? window.TavliDB.getBroadcastBanner() : null;
  if (bInput) bInput.value = curBanner ? curBanner.text : "";
  renderAdminTable();
  document.getElementById("adminModal").style.display = "flex";
  await window.TavliDB.pullFromServer();
  const freshBanner = window.TavliDB.getBroadcastBanner ? window.TavliDB.getBroadcastBanner() : null;
  if (bInput) bInput.value = freshBanner ? freshBanner.text : "";
  document.getElementById("adminFeedback").textContent = "🌐 Server database synced (PINs SHA-256 hashed).";
  renderAdminTable();
}

async function adminSaveBroadcastBanner() {
  if (!isAuthenticatedAccount || !window.TavliDB.isAdminName(myPlayerName)) return;
  const bInput = document.getElementById("adminBroadcastInput");
  const text = bInput ? bInput.value.trim() : "";
  const fb = document.getElementById("adminFeedback");
  const res = await window.TavliDB.setBroadcastBannerAsync(myPlayerName, text);
  if (res && res.ok) {
    if (fb) {
      fb.style.color = "#00e676";
      fb.textContent = t().adminBannerSavedMsg || "Broadcast banner updated on the Main Menu!";
    }
    renderAdminBroadcastBannerOnLanding();
    if (typeof syncDatabaseWithPeer === "function") syncDatabaseWithPeer();
  }
}

async function adminClearBroadcastBanner() {
  if (!isAuthenticatedAccount || !window.TavliDB.isAdminName(myPlayerName)) return;
  const bInput = document.getElementById("adminBroadcastInput");
  if (bInput) bInput.value = "";
  await adminSaveBroadcastBanner();
}
function closeAdminModal() {
  document.getElementById("adminModal").style.display = "none";
}

function changeAdminPage(delta) {
  adminCurrentPage += delta;
  renderAdminTable();
}

async function adminSaveCloudUrl() {
  const newUrl = document.getElementById("adminCloudUrlInput").value.trim();
  const fb = document.getElementById("adminFeedback");
  fb.style.color = "#ffb300";
  fb.textContent = "Connecting to server endpoint...";
  const ok = await window.TavliDB.setCloudUrl(newUrl);
  await window.TavliDB.pushToServer();
  fb.style.color = "#00e676";
  fb.textContent = ok
    ? "Connected & synced with Cloud Server URL!"
    : "Saved URL and pushed current database to endpoint!";
  renderAdminTable();
}

function renderAdminTable() {
  const container = document.getElementById("adminTableContainer");
  const users = window.TavliDB.getAllUsers();
  const tr = t();
  if (users.length === 0) {
    container.innerHTML = `<p style="padding:10px; color:#bcaaa4;">No users in database.</p>`;
    return;
  }

  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  if (adminCurrentPage > totalPages) adminCurrentPage = totalPages;
  if (adminCurrentPage < 1) adminCurrentPage = 1;

  const startIdx = (adminCurrentPage - 1) * PAGE_SIZE;
  const pageUsers = users.slice(startIdx, startIdx + PAGE_SIZE);

  let rows = "";
  pageUsers.forEach((u, pageOffset) => {
    const idx = startIdx + pageOffset;
    const k = window.TavliDB.normalizeKey(u.name);
    const s = u.stats || {};
    const eloVal = typeof s.elo === "number" ? Math.round(s.elo) : 1200;
    const vP = (s.variants && s.variants.PORTES) || { won: 0, played: 0 };
    const vPl = (s.variants && s.variants.PLAKOTO) || { won: 0, played: 0 };
    const vF = (s.variants && s.variants.FEVGA) || { won: 0, played: 0 };

    rows += `
      <tr>
        <td><input type="text" class="admin-input" id="adm_name_${idx}" value="${escapeHtml(u.name)}" /></td>
        <td><input type="password" class="admin-input" id="adm_pin_${idx}" value="" placeholder="🔒 Hashed" maxlength="4" /></td>
        <td><input type="number" class="admin-input" id="adm_elo_${idx}" value="${eloVal}" min="100" /></td>
        <td><input type="number" class="admin-input" id="adm_sw_${idx}" value="${s.setsWon || 0}" min="0" /></td>
        <td><input type="number" class="admin-input" id="adm_sl_${idx}" value="${s.setsLost || 0}" min="0" /></td>
        <td><input type="number" class="admin-input" id="adm_gw_${idx}" value="${s.gamesWon || 0}" min="0" /></td>
        <td><input type="number" class="admin-input" id="adm_gl_${idx}" value="${s.gamesLost || 0}" min="0" /></td>
        <td>
          <div style="display:flex; gap:2px; align-items:center;">
            <input type="number" class="admin-input" id="adm_pw_${idx}" value="${vP.won || 0}" min="0" />/
            <input type="number" class="admin-input" id="adm_pp_${idx}" value="${vP.played || 0}" min="0" />
          </div>
        </td>
        <td>
          <div style="display:flex; gap:2px; align-items:center;">
            <input type="number" class="admin-input" id="adm_plw_${idx}" value="${vPl.won || 0}" min="0" />/
            <input type="number" class="admin-input" id="adm_plp_${idx}" value="${vPl.played || 0}" min="0" />
          </div>
        </td>
        <td>
          <div style="display:flex; gap:2px; align-items:center;">
            <input type="number" class="admin-input" id="adm_fw_${idx}" value="${vF.won || 0}" min="0" />/
            <input type="number" class="admin-input" id="adm_fp_${idx}" value="${vF.played || 0}" min="0" />
          </div>
        </td>
        <td style="white-space:nowrap;">
          <button class="btn-sm" style="padding:4px 6px; margin-right:2px;" onclick="adminSaveRow('${escapeHtml(k)}', ${idx})">Save</button>
          <button class="btn-sm" style="padding:4px 6px; background:#4fc3f7; margin-right:2px;" onclick="adminOpenOpponentsEditor('${escapeHtml(k)}')">Opponents</button>
          <button class="btn-sm" style="padding:4px 6px; background:#e53935; color:#fff;" onclick="adminDeleteRow('${escapeHtml(k)}')">Del</button>
        </td>
      </tr>
    `;
  });

  const pagerHtml = totalPages > 1 ? `
    <div class="pagination-bar">
      <button onclick="changeAdminPage(-1)" ${adminCurrentPage <= 1 ? "disabled" : ""}>${tr.prevPage}</button>
      <span>${tr.pageOf(adminCurrentPage, totalPages)}</span>
      <button onclick="changeAdminPage(1)" ${adminCurrentPage >= totalPages ? "disabled" : ""}>${tr.nextPage}</button>
    </div>
  ` : "";

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th style="width:74px;">New PIN</th>
          <th style="width:66px;">ELO</th>
          <th>Sets W</th>
          <th>Sets L</th>
          <th>Games W</th>
          <th>Games L</th>
          <th>Portes W/P</th>
          <th>Plakoto W/P</th>
          <th>Fevga W/P</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${pagerHtml}
  `;
}

function adminOpenOpponentsEditor(userKey) {
  const box = document.getElementById("adminOpponentsEditor");
  const u = window.TavliDB.getUser(userKey);
  if (!u) return;
  const opps = (u.stats && u.stats.opponents) ? Object.entries(u.stats.opponents) : [];

  let rowsHtml = "";
  if (opps.length === 0) {
    rowsHtml = `<tr><td colspan="6" style="text-align:center; color:#90a4ae;">No opponents recorded for ${escapeHtml(u.name)}.</td></tr>`;
  } else {
    opps.forEach(([oppKey, o], i) => {
      rowsHtml += `
        <tr>
          <td><strong>${escapeHtml(o.displayName || oppKey)}</strong></td>
          <td><input type="number" class="admin-input" id="adm_opp_gw_${i}" value="${o.gamesWon || 0}" min="0" /></td>
          <td><input type="number" class="admin-input" id="adm_opp_gl_${i}" value="${o.gamesLost || 0}" min="0" /></td>
          <td><input type="number" class="admin-input" id="adm_opp_sw_${i}" value="${o.setsWon || 0}" min="0" /></td>
          <td><input type="number" class="admin-input" id="adm_opp_sl_${i}" value="${o.setsLost || 0}" min="0" /></td>
          <td style="white-space:nowrap;">
            <button class="btn-sm" style="padding:3px 6px;" onclick="adminSaveSingleOpponent('${escapeHtml(userKey)}', '${escapeHtml(oppKey)}', ${i})">Save</button>
            <button class="btn-sm" style="padding:3px 6px; background:#e53935; color:#fff;" onclick="adminDeleteSingleOpponent('${escapeHtml(userKey)}', '${escapeHtml(oppKey)}')">Del</button>
          </td>
        </tr>
      `;
    });
  }

  box.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
      <strong style="color:var(--accent); font-size:0.82rem;">Head-to-Head Opponents for ${escapeHtml(u.name)}</strong>
      <button class="btn-sm" style="background:#546e7a; color:#fff; padding:3px 8px;" onclick="document.getElementById('adminOpponentsEditor').style.display='none'">Close</button>
    </div>
    <table class="data-table">
      <thead>
        <tr>
          <th>Opponent</th>
          <th>Games W</th>
          <th>Games L</th>
          <th>Sets W</th>
          <th>Sets L</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
  box.style.display = "block";
}

function adminSaveSingleOpponent(userKey, oppKey, i) {
  const fields = {
    gamesWon: document.getElementById(`adm_opp_gw_${i}`).value,
    gamesLost: document.getElementById(`adm_opp_gl_${i}`).value,
    setsWon: document.getElementById(`adm_opp_sw_${i}`).value,
    setsLost: document.getElementById(`adm_opp_sl_${i}`).value
  };
  window.TavliDB.adminSaveOpponentRecord(userKey, oppKey, fields);
  document.getElementById("adminFeedback").style.color = "#00e676";
  document.getElementById("adminFeedback").textContent = `Updated opponent "${oppKey}" for "${userKey}"!`;
  syncDatabaseWithPeer();
  adminOpenOpponentsEditor(userKey);
}

function adminDeleteSingleOpponent(userKey, oppKey) {
  window.TavliDB.adminDeleteOpponentRecord(userKey, oppKey);
  syncDatabaseWithPeer();
  adminOpenOpponentsEditor(userKey);
}

async function adminSaveRow(originalKey, idx) {
  const elo = parseInt(document.getElementById(`adm_elo_${idx}`).value, 10) || 1200;
  const sw = parseInt(document.getElementById(`adm_sw_${idx}`).value, 10) || 0;
  const sl = parseInt(document.getElementById(`adm_sl_${idx}`).value, 10) || 0;
  const gw = parseInt(document.getElementById(`adm_gw_${idx}`).value, 10) || 0;
  const gl = parseInt(document.getElementById(`adm_gl_${idx}`).value, 10) || 0;

  const fields = {
    name: document.getElementById(`adm_name_${idx}`).value,
    newPin: document.getElementById(`adm_pin_${idx}`).value,
    elo,
    setsWon: sw,
    setsLost: sl,
    setsPlayed: sw + sl,
    gamesWon: gw,
    gamesLost: gl,
    gamesPlayed: gw + gl,
    PORTES: {
      won: document.getElementById(`adm_pw_${idx}`).value,
      played: document.getElementById(`adm_pp_${idx}`).value
    },
    PLAKOTO: {
      won: document.getElementById(`adm_plw_${idx}`).value,
      played: document.getElementById(`adm_plp_${idx}`).value
    },
    FEVGA: {
      won: document.getElementById(`adm_fw_${idx}`).value,
      played: document.getElementById(`adm_fp_${idx}`).value
    }
  };

  const res = await window.TavliDB.adminSaveUserRecordAsync(originalKey, fields);
  const fb = document.getElementById("adminFeedback");
  if (!res.ok) {
    fb.style.color = "#ff8a80";
    fb.textContent = res.message;
    return;
  }
  fb.style.color = "#00e676";
  fb.textContent = `Saved & synced "${res.user.name}" to Server!`;
  syncDatabaseWithPeer();
  renderAdminTable();
}

function adminDeleteRow(key) {
  if (!confirm(`Delete user "${key}" from the server database?`)) return;
  window.TavliDB.adminDeleteUser(key);
  document.getElementById("adminFeedback").style.color = "#ffb300";
  document.getElementById("adminFeedback").textContent = `Deleted "${key}" from Server.`;
  renderAdminTable();
}

async function adminAddNewUser() {
  const name = document.getElementById("adminNewName").value.trim();
  const pin = document.getElementById("adminNewPin").value.trim();
  const fb = document.getElementById("adminFeedback");
  if (window.TavliDB.userExists(name)) {
    fb.style.color = "#ff8a80";
    fb.textContent = "User already exists in the table above.";
    return;
  }
  const res = await window.TavliDB.authenticateOrCreateAsync(name, pin);
  if (!res.ok) {
    fb.style.color = "#ff8a80";
    fb.textContent = res.message;
    return;
  }
  document.getElementById("adminNewName").value = "";
  document.getElementById("adminNewPin").value = "";
  fb.style.color = "#00e676";
  fb.textContent = `Created & synced user "${res.user.name}" (PIN SHA-256 Hashed)!`;
  syncDatabaseWithPeer();
  renderAdminTable();
}

function handleImportDBFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    const res = await window.TavliDB.importDatabaseJSON(e.target.result);
    const fb = document.getElementById("adminFeedback");
    if (!res.ok) {
      alert(res.message);
    } else {
      if (fb) {
        fb.style.color = "#00e676";
        fb.textContent = "Database JSON loaded, PINs hashed, and pushed to Server!";
      }
      syncDatabaseWithPeer();
      renderAdminTable();
    }
  };
  reader.readAsText(file);
}

// ============================================================================
// CUSTOM CHECKER SOUND ENGINE (3 DISTINCT VARIATIONS: MOVE, HIT, PIN)
// ============================================================================
let audioCtx = null;
let soundEnabled = true;

function ensureAudio() {
  if (!soundEnabled) return null;
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  document.getElementById("muteBtn").textContent = soundEnabled ? t().soundOn : t().soundOff;
  if (soundEnabled) playCheckerClack("MOVE");
}

function playCheckerClack(mode = "MOVE") {
  const ctx = ensureAudio();
  if (!ctx) return;
  const now = ctx.currentTime;

  const soundType = (mode === true) ? "HIT" : (mode || "MOVE");

  const triggerWoodTap = (offset, startFreq, endFreq, vol, filterFreq) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(startFreq, now + offset);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + offset + 0.075);

    gain.gain.setValueAtTime(vol, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.085);

    const bufferSize = Math.floor(ctx.sampleRate * 0.028);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.32));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = filterFreq;
    filter.Q.value = 3.0;

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(vol * 1.25, now + offset);
    nGain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.028);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now + offset);
  };

  if (soundType === "HIT") {
    triggerWoodTap(0, 260, 72, 0.68, 1850);
    triggerWoodTap(0.055, 330, 90, 0.78, 2250);
  } else if (soundType === "PIN") {
    triggerWoodTap(0, 175, 48, 0.65, 1050);
    triggerWoodTap(0.075, 130, 38, 0.80, 760);

    const lockOsc = ctx.createOscillator();
    const lockGain = ctx.createGain();
    lockOsc.type = "sine";
    lockOsc.frequency.setValueAtTime(110, now + 0.05);
    lockOsc.frequency.exponentialRampToValueAtTime(42, now + 0.21);
    lockGain.gain.setValueAtTime(0.42, now + 0.05);
    lockGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    lockOsc.connect(lockGain);
    lockGain.connect(ctx.destination);
    lockOsc.start(now + 0.05);
    lockOsc.stop(now + 0.23);
  } else {
    triggerWoodTap(0, 195, 58, 0.42, 1450);
  }
}

function playDiceRattle() {
  const ctx = ensureAudio();
  if (!ctx) return;
  const bounceTimes = [0, 0.07, 0.15, 0.24, 0.35, 0.47];
  bounceTimes.forEach((tOffset, idx) => {
    const now = ctx.currentTime + tOffset;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    const freq = 620 + (idx * 65) + (cryptoDie() * 35);
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.035);

    const vol = 0.28 * Math.pow(0.82, idx);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.045);
  });
}

function playTurnChime() {
  const ctx = ensureAudio();
  if (!ctx) return;
  [587.33, 880].forEach((freq, idx) => {
    const now = ctx.currentTime + idx * 0.11;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.29);
  });
}

function playChatSound() {
  const ctx = ensureAudio();
  if (!ctx) return;
  [523.25, 783.99].forEach((freq, idx) => {
    const now = ctx.currentTime + idx * 0.065;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  });
}

function playWinFanfare() {
  const ctx = ensureAudio();
  if (!ctx) return;
  [440, 554.37, 659.25, 880, 1046.5].forEach((freq, i) => {
    const now = ctx.currentTime + i * 0.085;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.37);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.38);
  });
}

// --- Board & Player-Colored Border Dice Renderer ---
const PIP_MAP = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

function createDieEl(val, tumbling = false, isUsed = false, playerRole = null) {
  const roleForColor = playerRole || state.turn || "W";
  const checkerColorId = (state.colors && state.colors[roleForColor]) ? state.colors[roleForColor] : "white";
  const die = document.createElement("div");
  die.className =
    "die" +
    ` die-border-${checkerColorId}` +
    (tumbling ? " tumbling" : "") +
    (isUsed ? " used" : "");

  if (tumbling && typeof ANIM_SPEED_CONFIG !== "undefined" && ANIM_SPEED_CONFIG[myAnimSpeed]) {
    const dMs = ANIM_SPEED_CONFIG[myAnimSpeed].diceMs;
    die.style.animationDuration = `${dMs}ms`;
  }

  const activeCells = PIP_MAP[val] || [];
  for (let cell = 0; cell < 9; cell++) {
    const slot = document.createElement("div");
    if (activeCells.includes(cell)) slot.className = "pip";
    die.appendChild(slot);
  }
  return die;
}

function renderDiceAreas() {
  const leftZone = document.getElementById("rollOffLeftZone");
  const rightZone = document.getElementById("rollOffRightZone");
  if (!leftZone || !rightZone) return;

  leftZone.innerHTML = "";
  rightZone.innerHTML = "";

  if (state.phase === "ROLL_OFF") {
    if (state.rollOff.W !== null) {
      leftZone.appendChild(createDieEl(state.rollOff.W, false, false, "W"));
    }
    if (state.rollOff.B !== null) {
      rightZone.appendChild(createDieEl(state.rollOff.B, false, false, "B"));
    }
    return;
  }

  const pair = state.displayDice || [];
  if (pair.length === 0) return;

  const activePlayer = state.turn;
  if (pair.length === 2 && pair[0] === pair[1]) {
    const rem = state.dice.length;
    const used1 = rem <= 2;
    const used2 = rem === 0;
    leftZone.appendChild(createDieEl(pair[0], false, used1, activePlayer));
    rightZone.appendChild(createDieEl(pair[1], false, used2, activePlayer));
  } else {
    const remCopy = [...state.dice];
    pair.forEach((d, idx) => {
      const targetZone = idx === 0 ? leftZone : rightZone;
      const matchIdx = remCopy.indexOf(d);
      if (matchIdx > -1) {
        remCopy.splice(matchIdx, 1);
        targetZone.appendChild(createDieEl(d, false, false, activePlayer));
      } else {
        targetZone.appendChild(createDieEl(d, false, true, activePlayer));
      }
    });
  }
}

function render() {
  const v = currentVariant();
  const tr = t();

  if (state.playerNames) {
    if (state.playerNames.W) playerNames.W = state.playerNames.W;
    if (state.playerNames.B) playerNames.B = state.playerNames.B;
  }
  updateHeaderLabels();

  document.getElementById("scoreW").textContent = state.scoreW;
  document.getElementById("scoreB").textContent = state.scoreB;
  document.getElementById("targetW").textContent = state.targetScore || 7;
  document.getElementById("targetB").textContent = state.targetScore || 7;
  document.getElementById("gameTitle").textContent = tr.variants[v] || v;

  const sbW = document.getElementById("streakBadgeW");
  const sbB = document.getElementById("streakBadgeB");
  if (sbW) sbW.innerHTML = (!isAiMatch && !isTutorialMode) ? renderWinStreakBadgeHtml(playerNames.W) : "";
  if (sbB) sbB.innerHTML = (!isAiMatch && !isTutorialMode) ? renderWinStreakBadgeHtml(playerNames.B) : "";

  const specMuteBtn = document.getElementById("specChatMuteBtn");
  if (specMuteBtn) {
    const showSpecMute = !isAiMatch && !isTutorialMode && Boolean(activeRoomCode);
    specMuteBtn.style.display = showSpecMute ? "inline-block" : "none";
    specMuteBtn.textContent = isSpectatorChatMuted ? (tr.specMuteOn || "🔇 Spec Chat: OFF") : (tr.specMuteOff || "💬 Spec Chat: ON");
    specMuteBtn.style.background = isSpectatorChatMuted ? "#d32f2f" : "#546e7a";
  }

  const pipElW = document.getElementById("pipCountW");
  const pipElB = document.getElementById("pipCountB");
  const pipsW = calculatePipCount("W");
  const pipsB = calculatePipCount("B");
  const fmtPip = tr.pipCountText ? tr.pipCountText : (c => `${c} pips`);
  if (pipElW) pipElW.textContent = fmtPip(pipsW);
  if (pipElB) pipElB.textContent = fmtPip(pipsB);

  const isSpectator = (myRole === "SPECTATOR");
  const isMyTurn = !isSpectator && ((myRole === "BOTH" && !isAiMatch) || myRole === state.turn);
  const cLabelW = getColorMeta(state.colors.W).label;
  const cLabelB = getColorMeta(state.colors.B).label;
  const pName = state.turn === "W" ? `${cLabelW} (${playerNames.W})` : `${cLabelB} (${playerNames.B})`;
  const turnDone = state.phase === "PLAY" && state.rolled && (state.dice.length === 0 || !hasAnyLegalMove(state.turn));

  const fevgaWarn = document.getElementById("fevgaPrimeWarning");
  if (fevgaWarn) {
    if (v === "FEVGA" && state.phase === "PLAY" && state.rolled && isFevgaStartingPrimeOccupied(state, state.turn) && state.dice.length > 0) {
      fevgaWarn.style.display = "block";
    } else {
      fevgaWarn.style.display = "none";
    }
  }

  if (state.phase === "ROLL_OFF") {
    document.getElementById("turnText").textContent = tr.roll1DieTurn(pName);
  } else if (!state.rolled) {
    document.getElementById("turnText").textContent = tr.toRoll(pName);
  } else if (turnDone && state.requireEndTurn) {
    document.getElementById("turnText").textContent = tr.tapEndTurn(pName);
  } else {
    document.getElementById("turnText").textContent = tr.moveCheckers(pName, state.dice.length);
  }

  const rollBtn = document.getElementById("rollBtn");
  rollBtn.style.display = (isSpectator || isTutorialMode || (state.autoRoll && state.phase === "PLAY")) ? "none" : "inline-block";
  rollBtn.disabled = isSpectator || isTutorialMode || state.phase === "SET_OVER" || isWaitingForReconnect || state.rolled || isAnimatingDice || isAnimatingChecker || !isMyTurn;

  const undoBtn = document.getElementById("undoBtn");
  undoBtn.style.display = isSpectator ? "none" : "inline-block";
  undoBtn.disabled = isSpectator || state.phase !== "PLAY" || isWaitingForReconnect || !state.rolled || isAnimatingDice || isAnimatingChecker || !isMyTurn || turnHistory.length === 0;

  const resignBtn = document.getElementById("resignBtn");
  resignBtn.style.display = (isSpectator || isTutorialMode) ? "none" : "inline-block";
  resignBtn.disabled = isSpectator || isTutorialMode || state.phase !== "PLAY" || isWaitingForReconnect || isAnimatingDice || isAnimatingChecker;

  const endBtn = document.getElementById("endTurnBtn");
  endBtn.style.display = (!isSpectator && !isTutorialMode && state.requireEndTurn) ? "inline-block" : "none";
  endBtn.disabled = isSpectator || isTutorialMode || !turnDone || isWaitingForReconnect || isAnimatingDice || isAnimatingChecker || !isMyTurn || isFevgaStartingPrimeOccupied(state, state.turn);
  if (!endBtn.disabled && state.requireEndTurn) {
    endBtn.classList.add("ready-pulse");
  } else {
    endBtn.classList.remove("ready-pulse");
  }

  if (!isAnimatingDice) renderDiceAreas();

  const tl = document.getElementById("top-left");
  const trEl = document.getElementById("top-right");
  const bl = document.getElementById("bottom-left");
  const br = document.getElementById("bottom-right");
  tl.innerHTML = ""; trEl.innerHTML = ""; bl.innerHTML = ""; br.innerHTML = "";

  const isBlackView = ((myRole === "B") !== Boolean(isMobileBoardFlipped));

  if (!isBlackView) {
    for (let i = 11; i >= 6; i--) tl.appendChild(renderPoint(i));
    for (let i = 5; i >= 0; i--) trEl.appendChild(renderPoint(i));
    for (let i = 12; i <= 17; i++) bl.appendChild(renderPoint(i));
    for (let i = 18; i <= 23; i++) br.appendChild(renderPoint(i));

    renderBarSlot("barTop", "W");
    renderBarSlot("barBottom", "B");

    if (v === "PLAKOTO") {
      renderOffSlot("offTop", "W");
      renderOffSlot("offBottom", "B");
    } else {
      renderOffSlot("offTop", "B");
      renderOffSlot("offBottom", "W");
    }
  } else {
    if (v === "PORTES" || v === "PLAKOTO") {
      for (let i = 12; i <= 17; i++) tl.appendChild(renderPoint(i));
      for (let i = 18; i <= 23; i++) trEl.appendChild(renderPoint(i));
      for (let i = 11; i >= 6; i--) bl.appendChild(renderPoint(i));
      for (let i = 5; i >= 0; i--) br.appendChild(renderPoint(i));
    } else {
      for (let i = 23; i >= 18; i--) tl.appendChild(renderPoint(i));
      for (let i = 17; i >= 12; i--) trEl.appendChild(renderPoint(i));
      for (let i = 0; i <= 5; i++) bl.appendChild(renderPoint(i));
      for (let i = 6; i <= 11; i++) br.appendChild(renderPoint(i));
    }

    renderBarSlot("barTop", "B");
    renderBarSlot("barBottom", "W");

    if (v === "PLAKOTO") {
      renderOffSlot("offTop", "B");
      renderOffSlot("offBottom", "W");
    } else {
      renderOffSlot("offTop", "W");
      renderOffSlot("offBottom", "B");
    }
  }
}

function renderPoint(idx) {
  const el = document.createElement("div");
  el.className = "point";
  el.setAttribute("data-pt-idx", idx);
  if (selectedFrom === idx) el.classList.add("selected");

  if (myPipIndexMode !== "OFF") {
    const numEl = document.createElement("div");
    numEl.className = "point-num";
    numEl.textContent = getDisplayPointNumber(idx);
    el.appendChild(numEl);
  }

  const targetMove = validTargets.find(m => m.to === idx);
  if (targetMove) {
    el.classList.add("valid-dest");
    if (myMoveIndicatorMode !== "GLOW") {
      const badge = document.createElement("div");
      badge.className = "dest-badge";
      badge.textContent = targetMove.badge;
      el.appendChild(badge);
    }
  }
  el.onclick = () => handlePointClick(idx);

  const pt = state.points[idx];
  if (pt.count > 0) {
    if (pt.pinned) {
      const trappedColor = state.colors[pt.pinned];
      const trappedChk = document.createElement("div");
      trappedChk.className = `checker clr-${trappedColor} pinned-base`;
      el.appendChild(trappedChk);
    }

    const ownerColor = state.colors[pt.owner];
    const maxVisible = pt.pinned ? 4 : 5;
    const shown = Math.min(pt.count, maxVisible);
    for (let c = 0; c < shown; c++) {
      const chk = document.createElement("div");
      chk.className = `checker clr-${ownerColor}`;
      if (pt.pinned && c === 0) chk.classList.add("capturing-top");
      chk.style.zIndex = String(c + 3);
      if (c === shown - 1 && pt.count > maxVisible) chk.textContent = pt.count;
      el.appendChild(chk);
    }
  }
  return el;
}

function renderBarSlot(elementId, owner) {
  const el = document.getElementById(elementId);
  el.innerHTML = "";
  el.className = "slot-box";
  el.setAttribute("data-bar-owner", owner);
  el.onclick = () => selectBar(owner);
  if (selectedFrom === "BAR" && state.turn === owner) el.classList.add("selected");
  const count = state.bar[owner];
  if (count > 0) {
    const ownerColor = state.colors[owner];
    const chk = document.createElement("div");
    chk.className = `checker clr-${ownerColor}`;
    chk.style.width = "30px";
    chk.textContent = count;
    el.appendChild(chk);
  }
}

function renderOffSlot(elementId, owner) {
  const el = document.getElementById(elementId);
  el.innerHTML = "";
  el.className = "slot-box";
  el.setAttribute("data-off-owner", owner);
  const offMove = validTargets.find(m => m.to === "OFF");
  if (offMove && state.turn === owner) {
    el.classList.add("valid-dest");
    if (myMoveIndicatorMode !== "GLOW") {
      const badge = document.createElement("div");
      badge.className = "dest-badge";
      badge.textContent = offMove.badge;
      el.appendChild(badge);
    }
  }
  const count = state.off[owner];
  if (count > 0) {
    const ownerColor = state.colors[owner];
    const chk = document.createElement("div");
    chk.className = `checker clr-${ownerColor}`;
    chk.style.width = "30px";
    chk.textContent = count;
    el.appendChild(chk);
  }
}