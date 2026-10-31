// Greek Tavli Online — UI, Auth, Modals, Global Messaging, 3-Mode Custom Audio & Board Renderer (ui.js — v20)

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

// Dynamically positions the Tutorial Coach Panel:
// - Desktop (>= 960px): inside .side-column where the Chat Box was (next to the board)
// - Mobile (< 960px): inside .main-column right above the board (where it originally was)
// Also hides the Chat Box completely whenever isTutorialMode is active.
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
  if (window.innerWidth >= 960) {
    // Desktop: put Tutorial in the Side Column where Chat was
    if (tutPanel.parentElement !== sideCol) {
      if (adminBtn && adminBtn.parentElement === sideCol) {
        sideCol.insertBefore(tutPanel, adminBtn);
      } else {
        sideCol.appendChild(tutPanel);
      }
    }
  } else {
    // Mobile: keep Tutorial in the Main Column above the board
    if (tutPanel.parentElement !== mainCol) {
      if (fevgaWarn && fevgaWarn.parentElement === mainCol) {
        mainCol.insertBefore(tutPanel, fevgaWarn);
      } else {
        mainCol.insertBefore(tutPanel, mainCol.children[1] || null);
      }
    }
  }
}

// Switches between the Standalone Landing Hub and the Active Gameplay Board
function showScreen(screenName) {
  const landing = document.getElementById("landingPage");
  const gameApp = document.getElementById("gameAppLayout");
  if (screenName === "GAME") {
    landing.style.display = "none";
    gameApp.classList.add("active-game");
    gameApp.style.display = window.innerWidth >= 960 ? "grid" : "flex";
    document.body.classList.add("in-game-mode");
    syncTutorialPanelPlacement();
    updateUnreadMessageBadges();
    render();
  } else {
    gameApp.classList.remove("active-game");
    gameApp.style.display = "none";
    document.body.classList.remove("in-game-mode");
    document.body.classList.remove("tutorial-mode");
    landing.style.display = "flex";
    checkPersistentLoginSession();
    updateUnreadMessageBadges();
  }
}

window.addEventListener("resize", () => {
  const gameApp = document.getElementById("gameAppLayout");
  if (gameApp && gameApp.classList.contains("active-game")) {
    gameApp.style.display = window.innerWidth >= 960 ? "grid" : "flex";
    syncTutorialPanelPlacement();
  }
});

function selectTheme(themeId) {
  myTheme = ALL_THEMES.includes(themeId) ? themeId : "classic";
  document.body.setAttribute("data-theme", myTheme);
  localStorage.setItem("tavli_theme", myTheme);
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
  document.getElementById("hubBtnSpectate").textContent = tr.hubBtnSpectate;
  document.getElementById("hubBtnAi").textContent = tr.hubBtnAi;
  const learnBtnEl = document.getElementById("hubBtnLearn");
  if (learnBtnEl && tr.hubBtnLearn) learnBtnEl.textContent = tr.hubBtnLearn;

  document.getElementById("hubBtnProfile").textContent = tr.btnProfile;
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
  document.getElementById("profCloseBtn").textContent = tr.closeBtn;
  document.getElementById("lbCloseBtn").textContent = tr.closeBtn;
  document.getElementById("settingsCloseBtn").textContent = tr.closeBtn;

  const wSender = document.getElementById("welcomeSender");
  const wMsg = document.getElementById("welcomeMsg");
  if (wSender) wSender.textContent = `${tr.sysLabel}:`;
  if (wMsg) wMsg.textContent = tr.welcomeMsg;

  document.getElementById("chatInput").placeholder = tr.chatPlaceholder;
  document.getElementById("sendChatBtn").textContent = tr.sendBtn;

  checkPersistentLoginSession();
  handleNameInputCheck();
  renderColorPicker();
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
// CLICKABLE PLAYER PROFILES & GLOBAL PLAYER MESSAGING SYSTEM (v20)
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
  renderSettingsAccountSection();
  document.getElementById("settingsModal").style.display = "flex";
}
function closeSettingsModal() {
  document.getElementById("settingsModal").style.display = "none";
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
      oppRowsHtml += `
        <tr>
          <td><span class="player-link" onclick="openPlayerProfileFromLink('${safeOppJs}')">👤 ${escapeHtml(o.displayName)}</span></td>
          <td><span style="color:#00e676;font-weight:bold;">${o.gamesWon}W</span> / <span style="color:#ff8a80;font-weight:bold;">${o.gamesLost}L</span> (${o.gamesPlayed})</td>
          <td><span style="color:#00e676;font-weight:bold;">${o.setsWon}W</span> / <span style="color:#ff8a80;font-weight:bold;">${o.setsLost}L</span> (${o.setsPlayed})</td>
        </tr>
      `;
    });
  }

  const safeTargetJs = escapeJsStr(user.name);
  const headerActionsHtml = !isViewingSelf
    ? `<div style="display:flex; gap:6px; flex-wrap:wrap;">
         <button class="btn-sm" style="background:var(--valid); color:#111; padding:6px 11px;" onclick="openMessageToPlayerFromProfile('${safeTargetJs}')">${escapeHtml(tr.profSendMsgBtn(user.name))}</button>
         <button class="btn-sm" style="background:#546e7a; color:#fff; padding:6px 10px;" onclick="openProfileModal()">${escapeHtml(tr.profBackToMyProfile)}</button>
       </div>`
    : `<button class="btn-sm" style="background:#00897b; color:#fff; padding:6px 11px;" onclick="closeProfileModal(); openMessagesModal();">💬 ${escapeHtml(tr.btnMessages)}</button>`;

  container.innerHTML = `
    <div class="profile-name-header">
      <span>👤 ${escapeHtml(user.name)}</span>
      ${headerActionsHtml}
    </div>

    <div class="stat-grid">
      <div class="stat-box">
        <div class="val">${rankStr}</div>
        <div class="lbl">${tr.profRank}</div>
      </div>
      <div class="stat-box">
        <div class="val" style="font-size:0.98rem;"><span style="color:#00e676;">${setsW}W</span> / <span style="color:#ff8a80;">${setsL}L</span> (${setsTot})</div>
        <div class="lbl">${tr.profSets}</div>
      </div>
      <div class="stat-box">
        <div class="val" style="font-size:0.98rem;"><span style="color:#00e676;">${gamesW}W</span> / <span style="color:#ff8a80;">${gamesL}L</span> (${gamesTot})</div>
        <div class="lbl">${tr.profGames}</div>
      </div>
    </div>

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

// --- Global Player Messages Modal (Accessible from All Screens) ---
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

function startNewMessageThreadFromDropdown() {
  const sel = document.getElementById("msgNewRecipientSelect");
  if (!sel || !sel.value) return;
  selectMessageThread(sel.value);
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

  // If no partner is selected yet, default to the most recent conversation thread
  if (!activeMessagePartner && threads.length > 0) {
    activeMessagePartner = threads[0].partnerName;
    window.TavliDB.markConversationRead(myPlayerName, activeMessagePartner);
  }

  const activePartnerKey = window.TavliDB.normalizeKey(activeMessagePartner);
  const allUsers = window.TavliDB.getAllUsers().filter(u => window.TavliDB.normalizeKey(u.name) !== myKey);

  let recipientOptions = `<option value="">${escapeHtml(tr.msgNewRecipientPh)}</option>`;
  allUsers.forEach(u => {
    recipientOptions += `<option value="${escapeHtml(u.name)}">${escapeHtml(u.name)}</option>`;
  });

  let threadsListHtml = "";
  if (threads.length === 0) {
    threadsListHtml = `<div style="font-size:0.75rem; color:#90a4ae; padding:8px; text-align:center;">${escapeHtml(tr.msgNoThreads)}</div>`;
  } else {
    threads.forEach(th => {
      const isAct = (th.partnerKey === activePartnerKey);
      const safePartnerJs = escapeJsStr(th.partnerName);
      const unreadPill = th.unreadCount > 0
        ? `<span style="background:#e53935; color:#fff; border-radius:999px; padding:1px 6px; font-size:0.65rem; font-weight:900;">${th.unreadCount}</span>`
        : "";
      threadsListHtml += `
        <div class="msg-thread-item ${isAct ? "active" : ""}" onclick="selectMessageThread('${safePartnerJs}')">
          <div class="msg-thread-top">
            <span>👤 ${escapeHtml(th.partnerName)}</span>
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
        <span>💬 ${escapeHtml(tr.msgChattingWith(displayPartnerName))}</span>
        <button class="btn-sm" style="padding:4px 8px; font-size:0.72rem;" onclick="closeMessagesModal(); openProfileModal('${safePartnerJs}');">${escapeHtml(tr.msgViewProfBtn)}</button>
      </div>
      <div class="msg-chat-history" id="directMsgHistoryBox">${bubblesHtml}</div>
      <div class="chat-input-row" style="margin-top:6px;">
        <input type="text" id="directMsgInput" placeholder="${escapeHtml(tr.msgInputPlaceholder)}" maxlength="240" onkeydown="if(event.key==='Enter') handleSendDirectMessage()" />
        <button onclick="handleSendDirectMessage()">${escapeHtml(tr.msgSendBtn)}</button>
      </div>
    `;
  }

  container.innerHTML = `
    <div style="display:flex; gap:6px; align-items:center; margin-bottom:6px;">
      <select id="msgNewRecipientSelect" style="flex:1; padding:7px 10px; border-radius:7px; border:1px solid var(--wood-mid); background:#141414; color:#fff; font-size:0.82rem;">
        ${recipientOptions}
      </select>
      <button class="btn-sm" style="padding:7px 12px;" onclick="startNewMessageThreadFromDropdown()">+ ${escapeHtml(tr.msgStartChatBtn)}</button>
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
    return;
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
    rowsHtml += `
      <tr style="${rowStyle}">
        <td>#${item.rank}</td>
        <td><span class="player-link" onclick="openPlayerProfileFromLink('${safeNameJs}')">👤 ${escapeHtml(item.name)}</span></td>
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

// --- Sotiris Admin Database Manager ---
async function openAdminModal() {
  if (!isAuthenticatedAccount || !window.TavliDB.isAdminName(myPlayerName)) return;
  adminCurrentPage = 1;
  document.getElementById("adminOpponentsEditor").style.display = "none";
  document.getElementById("adminFeedback").textContent = "Syncing with server...";
  document.getElementById("adminCloudUrlInput").value = window.TavliDB.getCloudUrl();
  renderAdminTable();
  document.getElementById("adminModal").style.display = "flex";
  await window.TavliDB.pullFromServer();
  document.getElementById("adminFeedback").textContent = "🌐 Server database synced (PINs SHA-256 hashed).";
  renderAdminTable();
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
    const vP = (s.variants && s.variants.PORTES) || { won: 0, played: 0 };
    const vPl = (s.variants && s.variants.PLAKOTO) || { won: 0, played: 0 };
    const vF = (s.variants && s.variants.FEVGA) || { won: 0, played: 0 };

    rows += `
      <tr>
        <td><input type="text" class="admin-input" id="adm_name_${idx}" value="${escapeHtml(u.name)}" /></td>
        <td><input type="password" class="admin-input" id="adm_pin_${idx}" value="" placeholder="🔒 Hashed" maxlength="4" /></td>
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
          <th style="width:78px;">New PIN</th>
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
  const sw = parseInt(document.getElementById(`adm_sw_${idx}`).value, 10) || 0;
  const sl = parseInt(document.getElementById(`adm_sl_${idx}`).value, 10) || 0;
  const gw = parseInt(document.getElementById(`adm_gw_${idx}`).value, 10) || 0;
  const gl = parseInt(document.getElementById(`adm_gl_${idx}`).value, 10) || 0;

  const fields = {
    name: document.getElementById(`adm_name_${idx}`).value,
    newPin: document.getElementById(`adm_pin_${idx}`).value,
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

  const isBlackView = (myRole === "B");

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

  const targetMove = validTargets.find(m => m.to === idx);
  if (targetMove) {
    el.classList.add("valid-dest");
    const badge = document.createElement("div");
    badge.className = "dest-badge";
    badge.textContent = targetMove.badge;
    el.appendChild(badge);
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
    const badge = document.createElement("div");
    badge.className = "dest-badge";
    badge.textContent = offMove.badge;
    el.appendChild(badge);
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