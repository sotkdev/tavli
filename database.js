// e-Tavli — Global Firebase Realtime Database Engine with Salted SHA-256 PIN Hashing, ELO Rating, Online Presence, Direct Challenges, Live Rooms & Global Messaging (database.js — v27)
// Always points to: https://greek-tavli-online-default-rtdb.europe-west1.firebasedatabase.app/tavli_db.json

const TAVLI_DB_STORAGE_KEY = "tavli_players_database_v1";
const TAVLI_CLOUD_URL_KEY  = "tavli_cloud_server_url_v1";
const TAVLI_HASH_SALT      = "GreekTavli_SHA256_Salt_2026_v2";
const LIVE_ROOM_TTL_MS     = 5 * 60 * 1000; // 5 minutes TTL while at least 1 player or spectator keeps room alive
const PRESENCE_TTL_MS      = 65 * 1000;     // 65 seconds online presence heartbeat window
const CHALLENGE_TTL_MS     = 90 * 1000;     // 90 seconds challenge validity window
const DEFAULT_ELO          = 1200;

// PERMANENT FIREBASE REALTIME DATABASE ENDPOINT:
const DEFAULT_CLOUD_ENDPOINT = "https://greek-tavli-online-default-rtdb.europe-west1.firebasedatabase.app/tavli_db.json";

const ACHIEVEMENT_CATALOG = [
  { id: "MANA_HUNTER", icon: "🪤", nameKey: "badge_mana_hunter_name", descKey: "badge_mana_hunter_desc" },
  { id: "COMEBACK_KING", icon: "👑", nameKey: "badge_comeback_king_name", descKey: "badge_comeback_king_desc" },
  { id: "DIPLOMAT", icon: "🏛️", nameKey: "badge_diplomat_name", descKey: "badge_diplomat_desc" },
  { id: "FIRST_BLOOD", icon: "🥇", nameKey: "badge_first_blood_name", descKey: "badge_first_blood_desc" },
  { id: "HOT_STREAK", icon: "🔥", nameKey: "badge_hot_streak_name", descKey: "badge_hot_streak_desc" },
  { id: "GRANDMASTER", icon: "⚡", nameKey: "badge_grandmaster_name", descKey: "badge_grandmaster_desc" }
];

const INITIAL_TAVLI_DATABASE = {
  version: 7,
  lastUpdated: Date.now(),
  users: {},
  messages: [],
  lobbyChat: [],
  broadcastBanner: { text: "", updatedAt: 0, author: "Sotiris" },
  liveRooms: {},
  presence: {},
  challenges: {},
  processedWinEvents: {}
};

window.TavliDB = {
  data: null,
  cloudUrl: DEFAULT_CLOUD_ENDPOINT,
  lastCloudSyncOk: false,
  onRemoteUpdateCallbacks: [],

  init() {
    const savedUrl = localStorage.getItem(TAVLI_CLOUD_URL_KEY);
    if (
      savedUrl &&
      savedUrl.trim().startsWith("https://") &&
      !savedUrl.includes("YOUR-FIREBASE-PROJECT") &&
      !savedUrl.includes("kvdb.io")
    ) {
      this.cloudUrl = this.normalizeEndpointUrl(savedUrl.trim());
    } else {
      this.cloudUrl = DEFAULT_CLOUD_ENDPOINT;
      localStorage.setItem(TAVLI_CLOUD_URL_KEY, DEFAULT_CLOUD_ENDPOINT);
    }

    const raw = localStorage.getItem(TAVLI_DB_STORAGE_KEY);
    if (raw) {
      try {
        this.data = JSON.parse(raw);
        if (!this.data || typeof this.data.users !== "object") {
          this.data = JSON.parse(JSON.stringify(INITIAL_TAVLI_DATABASE));
        }
        if (!Array.isArray(this.data.messages)) this.data.messages = [];
        if (!Array.isArray(this.data.lobbyChat)) this.data.lobbyChat = [];
        if (!this.data.broadcastBanner || typeof this.data.broadcastBanner !== "object") {
          this.data.broadcastBanner = { text: "", updatedAt: 0, author: "Sotiris" };
        }
        if (!this.data.liveRooms || typeof this.data.liveRooms !== "object") this.data.liveRooms = {};
        if (!this.data.presence || typeof this.data.presence !== "object") this.data.presence = {};
        if (!this.data.challenges || typeof this.data.challenges !== "object") this.data.challenges = {};
        if (!this.data.processedWinEvents || typeof this.data.processedWinEvents !== "object") this.data.processedWinEvents = {};
      } catch (e) {
        this.data = JSON.parse(JSON.stringify(INITIAL_TAVLI_DATABASE));
      }
    } else {
      this.data = JSON.parse(JSON.stringify(INITIAL_TAVLI_DATABASE));
      this.saveLocalOnly();
    }

    this.sanitizeAllStatsConsistency();
    this.migrateLegacyPlaintextPins();
    this.pullFromServer();
    return this.data;
  },

  computeBaselineEloFromStats(s) {
    if (!s) return DEFAULT_ELO;
    const sw = parseInt(s.setsWon, 10) || 0;
    const sl = parseInt(s.setsLost, 10) || 0;
    const gw = parseInt(s.gamesWon, 10) || 0;
    const gl = parseInt(s.gamesLost, 10) || 0;
    if (sw === 0 && sl === 0 && gw === 0 && gl === 0) return DEFAULT_ELO;
    const raw = DEFAULT_ELO + (sw - sl) * 24 + (gw - gl) * 8;
    return Math.max(800, raw);
  },

  sanitizeAllStatsConsistency() {
    if (!this.data || !this.data.users) return;
    if (!Array.isArray(this.data.messages)) this.data.messages = [];
    if (!this.data.liveRooms || typeof this.data.liveRooms !== "object") this.data.liveRooms = {};
    if (!this.data.presence || typeof this.data.presence !== "object") this.data.presence = {};
    if (!this.data.challenges || typeof this.data.challenges !== "object") this.data.challenges = {};
    if (!this.data.processedWinEvents || typeof this.data.processedWinEvents !== "object") this.data.processedWinEvents = {};

    const now = Date.now();
    // Prune rooms that are closed, have 0 players & 0 spectators, or exceeded 5-minute TTL
    Object.keys(this.data.liveRooms).forEach(code => {
      const rm = this.data.liveRooms[code];
      const pCount = rm ? (parseInt(rm.playerCount, 10) || 0) : 0;
      const sCount = rm ? (parseInt(rm.spectatorCount, 10) || 0) : 0;
      if (!rm || !rm.roomCode || rm.closed || (pCount <= 0 && sCount <= 0) || (now - (rm.updatedAt || 0) > LIVE_ROOM_TTL_MS)) {
        delete this.data.liveRooms[code];
      }
    });

    // Prune stale presence entries older than 5 minutes
    Object.keys(this.data.presence).forEach(k => {
      const pr = this.data.presence[k];
      if (!pr || (now - (pr.updatedAt || 0) > 5 * 60 * 1000)) {
        delete this.data.presence[k];
      }
    });

    // Prune expired challenges
    Object.keys(this.data.challenges).forEach(k => {
      const ch = this.data.challenges[k];
      if (!ch || (now - (ch.ts || 0) > CHALLENGE_TTL_MS)) {
        delete this.data.challenges[k];
      }
    });

    const evKeys = Object.keys(this.data.processedWinEvents);
    if (evKeys.length > 500) {
      evKeys
        .sort((a, b) => (this.data.processedWinEvents[a] || 0) - (this.data.processedWinEvents[b] || 0))
        .slice(0, evKeys.length - 500)
        .forEach(k => delete this.data.processedWinEvents[k]);
    }

    Object.values(this.data.users).forEach(u => {
      if (!u || !u.stats) return;
      const s = u.stats;
      s.setsWon = Math.max(0, parseInt(s.setsWon, 10) || 0);
      s.setsLost = Math.max(0, parseInt(s.setsLost, 10) || 0);
      s.setsPlayed = s.setsWon + s.setsLost;

      s.gamesWon = Math.max(0, parseInt(s.gamesWon, 10) || 0);
      s.gamesLost = Math.max(0, parseInt(s.gamesLost, 10) || 0);
      s.gamesPlayed = s.gamesWon + s.gamesLost;

      if (typeof s.elo !== "number" || Number.isNaN(s.elo) || s.elo < 100) {
        s.elo = this.computeBaselineEloFromStats(s);
      } else {
        s.elo = Math.round(s.elo);
      }
      s.winStreak = Math.max(0, parseInt(s.winStreak, 10) || 0);
      s.bestWinStreak = Math.max(s.winStreak, parseInt(s.bestWinStreak, 10) || 0);
      if (!s.badges || typeof s.badges !== "object" || Array.isArray(s.badges)) {
        s.badges = {};
      }
      if (!Array.isArray(s.recentSets)) {
        s.recentSets = [];
      } else if (s.recentSets.length > 10) {
        s.recentSets = s.recentSets.slice(-10);
      }
      if (!Array.isArray(s.eloHistory) || s.eloHistory.length === 0) {
        s.eloHistory = [s.elo];
      } else if (s.eloHistory.length > 15) {
        s.eloHistory = s.eloHistory.slice(-15);
      }
      // Retroactively award milestone badges if criteria already met
      if (s.setsWon >= 1 && !s.badges.FIRST_BLOOD) s.badges.FIRST_BLOOD = u.updatedAt || Date.now();
      if (s.bestWinStreak >= 3 && !s.badges.HOT_STREAK) s.badges.HOT_STREAK = u.updatedAt || Date.now();
      if (s.elo >= 1350 && !s.badges.GRANDMASTER) s.badges.GRANDMASTER = u.updatedAt || Date.now();
      if (!Array.isArray(u.friends)) {
        u.friends = [];
      }

      if (s.opponents && typeof s.opponents === "object") {
        Object.values(s.opponents).forEach(opp => {
          opp.setsWon = Math.max(0, parseInt(opp.setsWon, 10) || 0);
          opp.setsLost = Math.max(0, parseInt(opp.setsLost, 10) || 0);
          opp.setsPlayed = opp.setsWon + opp.setsLost;

          opp.gamesWon = Math.max(0, parseInt(opp.gamesWon, 10) || 0);
          if (opp.gamesLost === undefined) {
            const gp = Math.max(opp.gamesWon, parseInt(opp.gamesPlayed, 10) || 0);
            opp.gamesLost = Math.max(0, gp - opp.gamesWon);
          } else {
            opp.gamesLost = Math.max(0, parseInt(opp.gamesLost, 10) || 0);
          }
          opp.gamesPlayed = opp.gamesWon + opp.gamesLost;
        });
      }
    });
  },

  async hashPin(name, pin) {
    const normName = this.normalizeKey(name);
    const cleanPin = String(pin || "").trim();
    const payload = `${TAVLI_HASH_SALT}::${normName}::${cleanPin}`;

    if (window.crypto && window.crypto.subtle) {
      const msgBuffer = new TextEncoder().encode(payload);
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    }
    let h1 = 0xdeadbeef ^ payload.length, h2 = 0x41c6ce57 ^ payload.length;
    for (let i = 0, ch; i < payload.length; i++) {
      ch = payload.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
  },

  async migrateLegacyPlaintextPins() {
    if (!this.data || !this.data.users) return;
    let migrated = false;
    for (const [k, u] of Object.entries(this.data.users)) {
      if (u && u.pin && /^\d{4}$/.test(String(u.pin))) {
        u.pinHash = await this.hashPin(u.name || k, u.pin);
        delete u.pin;
        migrated = true;
      } else if (u && "pin" in u) {
        delete u.pin;
        migrated = true;
      }
    }
    if (migrated) {
      this.saveLocalOnly();
    }
  },

  onRemoteUpdate(cb) {
    if (typeof cb === "function") this.onRemoteUpdateCallbacks.push(cb);
  },

  notifyListeners() {
    this.onRemoteUpdateCallbacks.forEach(cb => {
      try { cb(this.data); } catch (_) {}
    });
  },

  normalizeEndpointUrl(rawUrl) {
    let clean = String(rawUrl || "").trim();
    if (!clean || clean.includes("YOUR-FIREBASE-PROJECT") || clean.includes("kvdb.io")) {
      return DEFAULT_CLOUD_ENDPOINT;
    }
    if ((clean.includes("firebaseio.com") || clean.includes("firebasedatabase.app")) && !clean.endsWith(".json")) {
      clean = clean.replace(/\/+$/, "") + "/tavli_db.json";
    }
    return clean;
  },

  getCloudUrl() {
    return this.normalizeEndpointUrl(this.cloudUrl || DEFAULT_CLOUD_ENDPOINT);
  },

  async setCloudUrl(newUrl) {
    const clean = this.normalizeEndpointUrl(newUrl);
    this.cloudUrl = clean;
    localStorage.setItem(TAVLI_CLOUD_URL_KEY, clean);
    const pulled = await this.pullFromServer();
    await this.pushToServer(true);
    return pulled || this.lastCloudSyncOk;
  },

  saveLocalOnly() {
    if (!this.data) return;
    this.sanitizeAllStatsConsistency();
    localStorage.setItem(TAVLI_DB_STORAGE_KEY, JSON.stringify(this.data));
  },

  save(skipMergeBeforePush = false) {
    if (!this.data) this.init();
    this.data.lastUpdated = Date.now();
    this.saveLocalOnly();
    return this.pushToServer(!skipMergeBeforePush);
  },

  async pullFromServer() {
    const url = this.getCloudUrl();
    if (!url) return false;
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json" },
        cache: "no-store"
      });
      if (res.ok) {
        const remoteData = await res.json();
        if (remoteData === null) {
          await this.pushToServer(false);
          this.lastCloudSyncOk = true;
          return true;
        }
        if (remoteData && typeof remoteData.users === "object") {
          await this.mergeFullDatabase(remoteData);
          this.lastCloudSyncOk = true;
          this.notifyListeners();
          return true;
        }
      }
    } catch (e) {
      // Offline fallback
    }
    return false;
  },

  async pushToServer(mergeRemoteFirst = true) {
    const url = this.getCloudUrl();
    if (!url) return false;
    try {
      await this.migrateLegacyPlaintextPins();
      if (mergeRemoteFirst) {
        try {
          const checkRes = await fetch(url, {
            method: "GET",
            headers: { "Accept": "application/json" },
            cache: "no-store"
          });
          if (checkRes.ok) {
            const remoteData = await checkRes.json();
            if (remoteData && typeof remoteData.users === "object") {
              await this.mergeFullDatabase(remoteData, false);
            }
          }
        } catch (_) {}
      }

      this.sanitizeAllStatsConsistency();
      const putRes = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.data)
      });
      if (putRes.ok) {
        this.lastCloudSyncOk = true;
        this.saveLocalOnly();
        this.notifyListeners();
        return true;
      }
    } catch (e) {
      // Ignore network errors
    }
    return false;
  },

  mergeMessagesList(remoteMessages) {
    if (!Array.isArray(remoteMessages)) return;
    if (!this.data) this.init();
    if (!Array.isArray(this.data.messages)) this.data.messages = [];

    const byId = new Map();
    this.data.messages.forEach(m => {
      if (m && m.id) byId.set(m.id, m);
    });

    remoteMessages.forEach(rm => {
      if (!rm || !rm.id || !rm.from || !rm.to || !rm.text) return;
      const existing = byId.get(rm.id);
      if (!existing) {
        byId.set(rm.id, {
          id: String(rm.id),
          from: String(rm.from),
          fromKey: this.normalizeKey(rm.fromKey || rm.from),
          to: String(rm.to),
          toKey: this.normalizeKey(rm.toKey || rm.to),
          text: String(rm.text).slice(0, 240),
          ts: Number(rm.ts) || Date.now(),
          read: Boolean(rm.read)
        });
      } else if (rm.read && !existing.read) {
        existing.read = true;
      }
    });

    const merged = Array.from(byId.values()).sort((a, b) => (a.ts || 0) - (b.ts || 0));
    this.data.messages = merged.slice(-400);
  },

  mergeLobbyChatList(remoteLobby) {
    if (!Array.isArray(remoteLobby)) return;
    if (!this.data) this.init();
    if (!Array.isArray(this.data.lobbyChat)) this.data.lobbyChat = [];

    const byId = new Map();
    this.data.lobbyChat.forEach(m => {
      if (m && m.id) byId.set(m.id, m);
    });
    remoteLobby.forEach(rm => {
      if (!rm || !rm.id || !rm.sender || !rm.text) return;
      if (!byId.has(rm.id)) {
        byId.set(rm.id, {
          id: String(rm.id),
          sender: String(rm.sender).slice(0, 16),
          senderKey: this.normalizeKey(rm.senderKey || rm.sender),
          text: String(rm.text).slice(0, 220),
          ts: Number(rm.ts) || Date.now()
        });
      }
    });
    const merged = Array.from(byId.values()).sort((a, b) => (a.ts || 0) - (b.ts || 0));
    this.data.lobbyChat = merged.slice(-80);
  },

  mergeBroadcastBanner(remoteBanner) {
    if (!remoteBanner || typeof remoteBanner !== "object") return;
    if (!this.data) this.init();
    if (!this.data.broadcastBanner || typeof this.data.broadcastBanner !== "object") {
      this.data.broadcastBanner = { text: "", updatedAt: 0, author: "Sotiris" };
    }
    const remTs = Number(remoteBanner.updatedAt) || 0;
    const locTs = Number(this.data.broadcastBanner.updatedAt) || 0;
    if (remTs >= locTs) {
      this.data.broadcastBanner = {
        text: String(remoteBanner.text || "").trim().slice(0, 240),
        updatedAt: remTs,
        author: String(remoteBanner.author || "Sotiris")
      };
    }
  },

  mergeLiveRoomsMap(remoteRooms) {
    if (!remoteRooms || typeof remoteRooms !== "object") return;
    if (!this.data) this.init();
    if (!this.data.liveRooms || typeof this.data.liveRooms !== "object") {
      this.data.liveRooms = {};
    }

    const now = Date.now();
    Object.entries(remoteRooms).forEach(([code, remRoom]) => {
      if (!remRoom || !code) return;
      const cleanCode = String(code).trim().toUpperCase();
      const locRoom = this.data.liveRooms[cleanCode];
      const remTime = Number(remRoom.updatedAt) || 0;
      const locTime = locRoom ? (Number(locRoom.updatedAt) || 0) : 0;

      const pCount = parseInt(remRoom.playerCount, 10) || 0;
      const sCount = parseInt(remRoom.spectatorCount, 10) || 0;

      if (remRoom.closed || (pCount <= 0 && sCount <= 0)) {
        if (!locRoom || remTime >= locTime) {
          delete this.data.liveRooms[cleanCode];
        }
        return;
      }

      if (now - remTime > LIVE_ROOM_TTL_MS) {
        if (locRoom && (now - locTime > LIVE_ROOM_TTL_MS)) {
          delete this.data.liveRooms[cleanCode];
        }
        return;
      }

      if (!locRoom || remTime >= locTime) {
        this.data.liveRooms[cleanCode] = JSON.parse(JSON.stringify(remRoom));
      }
    });
  },

  mergePresenceMap(remotePresence) {
    if (!remotePresence || typeof remotePresence !== "object") return;
    if (!this.data) this.init();
    if (!this.data.presence || typeof this.data.presence !== "object") {
      this.data.presence = {};
    }
    const now = Date.now();
    Object.entries(remotePresence).forEach(([k, remPr]) => {
      if (!remPr || !k) return;
      const key = this.normalizeKey(k);
      const remTime = Number(remPr.updatedAt) || 0;
      if (now - remTime > 5 * 60 * 1000) return;
      const locPr = this.data.presence[key];
      const locTime = locPr ? (Number(locPr.updatedAt) || 0) : 0;
      if (!locPr || remTime >= locTime) {
        this.data.presence[key] = JSON.parse(JSON.stringify(remPr));
      }
    });
  },

  mergeChallengesMap(remoteChallenges) {
    if (!remoteChallenges || typeof remoteChallenges !== "object") return;
    if (!this.data) this.init();
    if (!this.data.challenges || typeof this.data.challenges !== "object") {
      this.data.challenges = {};
    }
    const now = Date.now();
    Object.entries(remoteChallenges).forEach(([k, remCh]) => {
      if (!remCh || !k) return;
      const key = this.normalizeKey(k);
      const remTime = Number(remCh.ts) || 0;
      if (now - remTime > CHALLENGE_TTL_MS) {
        delete this.data.challenges[key];
        return;
      }
      const locCh = this.data.challenges[key];
      const locTime = locCh ? (Number(locCh.ts) || 0) : 0;
      if (!locCh || remTime >= locTime) {
        this.data.challenges[key] = JSON.parse(JSON.stringify(remCh));
      }
    });
  },

  async mergeFullDatabase(remoteDB, saveToLocal = true) {
    if (!remoteDB || typeof remoteDB.users !== "object") return;
    if (!this.data) this.init();

    for (const [k, remUser] of Object.entries(remoteDB.users)) {
      if (!remUser || !remUser.name) continue;

      if (remUser.pin && /^\d{4}$/.test(String(remUser.pin)) && !remUser.pinHash) {
        remUser.pinHash = await this.hashPin(remUser.name || k, remUser.pin);
      }
      delete remUser.pin;

      if (!remUser.stats) {
        remUser.stats = {
          elo: DEFAULT_ELO,
          setsPlayed: 0, setsWon: 0, setsLost: 0,
          gamesPlayed: 0, gamesWon: 0, gamesLost: 0,
          variants: { PORTES: { played: 0, won: 0 }, PLAKOTO: { played: 0, won: 0 }, FEVGA: { played: 0, won: 0 } },
          opponents: {}
        };
      }
      if (!remUser.stats.opponents) remUser.stats.opponents = {};
      if (!remUser.stats.variants) {
        remUser.stats.variants = { PORTES: { played: 0, won: 0 }, PLAKOTO: { played: 0, won: 0 }, FEVGA: { played: 0, won: 0 } };
      }
      if (typeof remUser.stats.elo !== "number") {
        remUser.stats.elo = this.computeBaselineEloFromStats(remUser.stats);
      }
      remUser.stats.winStreak = Math.max(0, parseInt(remUser.stats.winStreak, 10) || 0);
      remUser.stats.bestWinStreak = Math.max(remUser.stats.winStreak, parseInt(remUser.stats.bestWinStreak, 10) || 0);
      if (!Array.isArray(remUser.friends)) remUser.friends = [];

      const locUser = this.data.users[k];
      if (!locUser) {
        this.data.users[k] = JSON.parse(JSON.stringify(remUser));
      } else {
        const remTime = remUser.updatedAt || 0;
        const locTime = locUser.updatedAt || 0;

        if (remUser.pinHash && (!locUser.pinHash || remTime >= locTime)) {
          locUser.pinHash = remUser.pinHash;
        }
        delete locUser.pin;

        const remGames = ((remUser.stats && remUser.stats.gamesWon) || 0) + ((remUser.stats && remUser.stats.gamesLost) || 0);
        const locGames = ((locUser.stats && locUser.stats.gamesWon) || 0) + ((locUser.stats && locUser.stats.gamesLost) || 0);
        const remSets  = ((remUser.stats && remUser.stats.setsWon) || 0) + ((remUser.stats && remUser.stats.setsLost) || 0);
        const locSets  = ((localUserStatsCheck(locUser).setsWon) || 0) + ((localUserStatsCheck(locUser).setsLost) || 0);

        function localUserStatsCheck(u) { return u.stats || {}; }

        const mergedBadges = Object.assign(
          {},
          (locUser.stats && locUser.stats.badges) || {},
          (remUser.stats && remUser.stats.badges) || {}
        );
        if (remTime > locTime || remGames > locGames || remSets > locSets) {
          locUser.name = remUser.name;
          locUser.stats = JSON.parse(JSON.stringify(remUser.stats));
          locUser.stats.badges = mergedBadges;
          if (Array.isArray(remUser.friends) && remTime >= locTime) {
            locUser.friends = Array.from(new Set([...(locUser.friends || []), ...remUser.friends]));
          }
          locUser.updatedAt = Math.max(remTime, locTime);
        } else {
          if (!locUser.stats.badges) locUser.stats.badges = {};
          Object.assign(locUser.stats.badges, mergedBadges);
          if (Array.isArray(remUser.friends) && remUser.friends.length > 0) {
            locUser.friends = Array.from(new Set([...(locUser.friends || []), ...remUser.friends]));
          }
        }
      }
    }

    if (Array.isArray(remoteDB.messages)) {
      this.mergeMessagesList(remoteDB.messages);
    }
    if (Array.isArray(remoteDB.lobbyChat)) {
      this.mergeLobbyChatList(remoteDB.lobbyChat);
    }
    if (remoteDB.broadcastBanner && typeof remoteDB.broadcastBanner === "object") {
      this.mergeBroadcastBanner(remoteDB.broadcastBanner);
    }

    if (remoteDB.liveRooms && typeof remoteDB.liveRooms === "object") {
      this.mergeLiveRoomsMap(remoteDB.liveRooms);
    }

    if (remoteDB.presence && typeof remoteDB.presence === "object") {
      this.mergePresenceMap(remoteDB.presence);
    }

    if (remoteDB.challenges && typeof remoteDB.challenges === "object") {
      this.mergeChallengesMap(remoteDB.challenges);
    }

    if (remoteDB.processedWinEvents && typeof remoteDB.processedWinEvents === "object") {
      if (!this.data.processedWinEvents) this.data.processedWinEvents = {};
      Object.entries(remoteDB.processedWinEvents).forEach(([evId, ts]) => {
        if (evId && !this.data.processedWinEvents[evId]) {
          this.data.processedWinEvents[evId] = Number(ts) || Date.now();
        }
      });
    }

    if (saveToLocal) this.saveLocalOnly();
  },

  getSubPathUrl(subPath) {
    const base = this.getCloudUrl();
    if (!base || !base.endsWith(".json")) return null;
    const cleanSub = String(subPath || "").replace(/^\/+|\/+$/g, "");
    return base.replace(/\.json$/, `/${cleanSub}.json`);
  },

  async pushRoomSignalPacket(roomCode, targetRole, packet) {
    const code = String(roomCode || "").trim().toUpperCase();
    if (!code || !targetRole || !packet) return false;
    const url = this.getSubPathUrl(`roomSignals/${encodeURIComponent(code)}/${encodeURIComponent(targetRole)}`);
    if (!url) return false;
    const envelope = {
      id: Date.now() + "-" + Math.floor(Math.random() * 1000000),
      ts: Date.now(),
      packet
    };
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(envelope)
      });
      return res.ok;
    } catch (_) {
      return false;
    }
  },

  async pullRoomSignalPackets(roomCode, myTargetRole) {
    const code = String(roomCode || "").trim().toUpperCase();
    if (!code || !myTargetRole) return [];
    const url = this.getSubPathUrl(`roomSignals/${encodeURIComponent(code)}/${encodeURIComponent(myTargetRole)}`);
    if (!url) return [];
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json" },
        cache: "no-store"
      });
      if (!res.ok) return [];
      const data = await res.json();
      if (!data || typeof data !== "object") return [];
      if (data.id && data.packet) return [data];
      return Object.values(data)
        .filter(item => item && item.id && item.packet)
        .sort((a, b) => (a.ts || 0) - (b.ts || 0));
    } catch (_) {
      return [];
    }
  },

  async clearRoomSignalPackets(roomCode) {
    const code = String(roomCode || "").trim().toUpperCase();
    if (!code) return false;
    const url = this.getSubPathUrl(`roomSignals/${encodeURIComponent(code)}`);
    if (!url) return false;
    try {
      await fetch(url, { method: "DELETE" });
      return true;
    } catch (_) {
      return false;
    }
  },

  // --- Version 24: Online Presence & Direct Match Challenges ---
  async updatePlayerPresence(playerName, status = "online_idle", roomCode = null) {
    const cleanName = String(playerName || "").trim();
    const key = this.normalizeKey(cleanName);
    if (!key || this.isAiPlayerName(cleanName)) return false;
    if (!this.data) this.init();
    if (!this.data.presence) this.data.presence = {};

    const entry = {
      name: cleanName,
      key,
      status: String(status || "online_idle"), // 'online_idle' | 'hosting' | 'playing'
      roomCode: roomCode ? String(roomCode).trim().toUpperCase() : null,
      updatedAt: Date.now()
    };
    this.data.presence[key] = entry;
    this.saveLocalOnly();

    const subUrl = this.getSubPathUrl(`presence/${encodeURIComponent(key)}`);
    if (subUrl) {
      try {
        const res = await fetch(subUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry)
        });
        if (res.ok) return true;
      } catch (_) {}
    }
    return false;
  },

  getPlayerPresence(playerName) {
    if (!this.data) this.init();
    const key = this.normalizeKey(playerName);
    if (!key) return { status: "offline", online: false };
    const now = Date.now();

    // Check if the player is actively in a live room first (including private rooms)
    const rooms = this.getAllActiveRooms(true);
    for (const rm of rooms) {
      const isHost = this.normalizeKey(rm.hostName) === key;
      const isGuest = rm.guestName && this.normalizeKey(rm.guestName) === key;
      if (isHost || isGuest) {
        if ((rm.playerCount || 1) >= 2) {
          return { status: "playing", online: true, roomCode: rm.roomCode };
        }
        return { status: "hosting", online: true, roomCode: rm.roomCode };
      }
    }

    const pr = this.data.presence ? this.data.presence[key] : null;
    if (!pr || (now - (pr.updatedAt || 0) > PRESENCE_TTL_MS)) {
      return { status: "offline", online: false };
    }
    return {
      status: pr.status || "online_idle",
      online: true,
      roomCode: pr.roomCode || null
    };
  },

  async sendDirectChallenge(challengeObj) {
    if (!challengeObj || !challengeObj.from || !challengeObj.to || !challengeObj.roomCode) return false;
    if (!this.data) this.init();
    if (!this.data.challenges) this.data.challenges = {};

    const toKey = this.normalizeKey(challengeObj.to);
    const payload = {
      id: "CHAL-" + Date.now() + "-" + Math.floor(Math.random() * 10000),
      from: String(challengeObj.from).trim(),
      fromKey: this.normalizeKey(challengeObj.from),
      to: String(challengeObj.to).trim(),
      toKey,
      roomCode: String(challengeObj.roomCode).trim().toUpperCase(),
      gameMode: String(challengeObj.gameMode || "FULL"),
      targetScore: parseInt(challengeObj.targetScore, 10) || 7,
      turnTimerSec: parseInt(challengeObj.turnTimerSec, 10) || 0,
      status: "PENDING",
      ts: Date.now()
    };

    this.data.challenges[toKey] = payload;
    this.saveLocalOnly();

    const subUrl = this.getSubPathUrl(`challenges/${encodeURIComponent(toKey)}`);
    if (subUrl) {
      try {
        const res = await fetch(subUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (res.ok) return payload;
      } catch (_) {}
    }
    await this.save();
    return payload;
  },

  async getChallengeForUser(userName) {
    const key = this.normalizeKey(userName);
    if (!key) return null;
    const subUrl = this.getSubPathUrl(`challenges/${encodeURIComponent(key)}`);
    if (subUrl) {
      try {
        const res = await fetch(subUrl, {
          method: "GET",
          headers: { "Accept": "application/json" },
          cache: "no-store"
        });
        if (res.ok) {
          const remoteCh = await res.json();
          if (remoteCh && remoteCh.id) {
            if (!this.data.challenges) this.data.challenges = {};
            this.data.challenges[key] = remoteCh;
          } else if (remoteCh === null && this.data.challenges) {
            delete this.data.challenges[key];
          }
        }
      } catch (_) {}
    }
    const ch = this.data.challenges ? this.data.challenges[key] : null;
    if (!ch) return null;
    if (Date.now() - (ch.ts || 0) > CHALLENGE_TTL_MS) {
      await this.clearChallengeForUser(userName);
      return null;
    }
    return ch;
  },

  async updateChallengeStatus(targetUserName, newStatus) {
    const key = this.normalizeKey(targetUserName);
    if (!key) return false;
    const ch = this.data.challenges ? this.data.challenges[key] : null;
    if (ch) {
      ch.status = newStatus;
      ch.ts = Date.now();
      this.saveLocalOnly();
    }
    const subUrl = this.getSubPathUrl(`challenges/${encodeURIComponent(key)}`);
    if (subUrl && ch) {
      try {
        await fetch(subUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ch)
        });
      } catch (_) {}
    }
    return true;
  },

  async clearChallengeForUser(userName) {
    const key = this.normalizeKey(userName);
    if (!key) return false;
    if (this.data && this.data.challenges) {
      delete this.data.challenges[key];
      this.saveLocalOnly();
    }
    const subUrl = this.getSubPathUrl(`challenges/${encodeURIComponent(key)}`);
    if (subUrl) {
      try {
        await fetch(subUrl, { method: "DELETE" });
      } catch (_) {}
    }
    return true;
  },

  // --- Live Games Lobby Registry (Room stays active as long as >=1 player or spectator is in it) ---
  async upsertLiveRoom(roomInfo) {
    if (!roomInfo || !roomInfo.roomCode) return false;
    if (!this.data) this.init();
    if (!this.data.liveRooms) this.data.liveRooms = {};

    const code = String(roomInfo.roomCode).trim().toUpperCase();
    const pCount = roomInfo.playerCount !== undefined ? Math.max(0, parseInt(roomInfo.playerCount, 10) || 0) : 1;
    const sCount = Math.max(0, parseInt(roomInfo.spectatorCount, 10) || 0);

    // If neither players nor spectators remain in the room, remove the room immediately
    if (pCount <= 0 && sCount <= 0) {
      return this.removeLiveRoom(code);
    }

    const entry = {
      roomCode: code,
      hostName: String(roomInfo.hostName || "Player 1").trim().slice(0, 16),
      guestName: roomInfo.guestName ? String(roomInfo.guestName).trim().slice(0, 16) : null,
      playerCount: pCount,
      spectatorCount: sCount,
      variant: String(roomInfo.variant || "PORTES"),
      gameMode: String(roomInfo.gameMode || "FULL"),
      targetScore: parseInt(roomInfo.targetScore, 10) || 7,
      turnTimerSec: parseInt(roomInfo.turnTimerSec, 10) || 0,
      isPrivate: Boolean(roomInfo.isPrivate),
      spectatorsList: Array.isArray(roomInfo.spectatorsList) ? roomInfo.spectatorsList.slice(0, 30) : [],
      scoreW: parseInt(roomInfo.scoreW, 10) || 0,
      scoreB: parseInt(roomInfo.scoreB, 10) || 0,
      updatedAt: Date.now(),
      closed: false
    };
    this.data.liveRooms[code] = entry;
    this.saveLocalOnly();

    const subUrl = this.getSubPathUrl(`liveRooms/${encodeURIComponent(code)}`);
    if (subUrl) {
      try {
        const res = await fetch(subUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry)
        });
        if (res.ok) return true;
      } catch (_) {}
    }
    return this.save();
  },

  async removeLiveRoom(roomCode) {
    if (!roomCode) return false;
    if (!this.data) this.init();
    const code = String(roomCode).trim().toUpperCase();
    if (!this.data.liveRooms) this.data.liveRooms = {};
    delete this.data.liveRooms[code];
    this.saveLocalOnly();

    const subUrl = this.getSubPathUrl(`liveRooms/${encodeURIComponent(code)}`);
    if (subUrl) {
      try {
        await fetch(subUrl, { method: "DELETE" });
      } catch (_) {}
    }
    await this.clearRoomSignalPackets(code);
    return true;
  },

  getLiveRoom(roomCode) {
    if (!roomCode) return null;
    if (!this.data) this.init();
    const code = String(roomCode).trim().toUpperCase();
    const rm = this.data.liveRooms ? this.data.liveRooms[code] : null;
    if (!rm || rm.closed) return null;
    const pCount = parseInt(rm.playerCount, 10) || 0;
    const sCount = parseInt(rm.spectatorCount, 10) || 0;
    if (pCount <= 0 && sCount <= 0) return null;
    if (Date.now() - (rm.updatedAt || 0) > LIVE_ROOM_TTL_MS) return null;
    return rm;
  },

  getAllActiveRooms(includePrivate = true) {
    if (!this.data) this.init();
    if (!this.data.liveRooms || typeof this.data.liveRooms !== "object") return [];
    const now = Date.now();
    const active = [];
    Object.entries(this.data.liveRooms).forEach(([code, rm]) => {
      if (!rm || rm.closed) return;
      const pCount = parseInt(rm.playerCount, 10) || 0;
      const sCount = parseInt(rm.spectatorCount, 10) || 0;
      if ((pCount > 0 || sCount > 0) && (now - (rm.updatedAt || 0) <= LIVE_ROOM_TTL_MS)) {
        if (includePrivate || !rm.isPrivate) {
          active.push(rm);
        }
      } else {
        delete this.data.liveRooms[code];
      }
    });
    active.sort((a, b) => {
      if ((a.playerCount || 1) !== (b.playerCount || 1)) {
        return (a.playerCount || 1) - (b.playerCount || 1);
      }
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
    return active;
  },

  getLiveRooms() {
    // Public Live Games lobby excludes private rooms
    return this.getAllActiveRooms(false);
  },

  normalizeKey(name) {
    return String(name || "").trim().toLowerCase();
  },

  isAiPlayerName(name) {
    const k = this.normalizeKey(name);
    return k.startsWith("ai (") || k === "ai";
  },

  isAdminName(name) {
    return this.normalizeKey(name) === "sotiris";
  },

  userExists(name) {
    if (!this.data) this.init();
    const key = this.normalizeKey(name);
    return Boolean(key && this.data.users[key]);
  },

  getUser(name) {
    if (!this.data) this.init();
    const key = this.normalizeKey(name);
    return key ? (this.data.users[key] || null) : null;
  },

  getAllUsers() {
    if (!this.data) this.init();
    return Object.values(this.data.users).sort((a, b) => a.name.localeCompare(b.name));
  },

  createBlankUserWithHash(name, pinHash) {
    const cleanName = String(name || "").trim();
    return {
      name: cleanName,
      pinHash: String(pinHash || ""),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      friends: [],
      stats: {
        elo: DEFAULT_ELO,
        eloHistory: [DEFAULT_ELO],
        recentSets: [],
        badges: {},
        winStreak: 0,
        bestWinStreak: 0,
        setsPlayed: 0,
        setsWon: 0,
        setsLost: 0,
        gamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0,
        variants: {
          PORTES:  { played: 0, won: 0 },
          PLAKOTO: { played: 0, won: 0 },
          FEVGA:   { played: 0, won: 0 }
        },
        opponents: {}
      }
    };
  },

  async authenticateOrCreateAsync(name, pin) {
    await this.pullFromServer();
    if (!this.data) this.init();
    const cleanName = String(name || "").trim();
    const cleanPin = String(pin || "").trim();

    if (!cleanName) {
      return { ok: false, code: "ERR_EMPTY_NAME", message: "Please enter a valid name." };
    }
    if (!/^\d{4}$/.test(cleanPin)) {
      return { ok: false, code: "ERR_INVALID_PIN_FORMAT", message: "PIN must be exactly 4 digits (0-9)." };
    }

    const key = this.normalizeKey(cleanName);
    const computedHash = await this.hashPin(cleanName, cleanPin);
    const existing = this.data.users[key];

    if (existing) {
      if (existing.pin && !existing.pinHash) {
        existing.pinHash = await this.hashPin(existing.name || cleanName, existing.pin);
        delete existing.pin;
      }
      if (existing.pinHash && existing.pinHash !== computedHash) {
        return {
          ok: false,
          code: "ERR_WRONG_PIN",
          message: "ERROR CODE: ERR_WRONG_PIN (401) — Wrong 4-digit PIN for this name."
        };
      }
      existing.pinHash = computedHash;
      delete existing.pin;
      existing.name = cleanName;
      existing.updatedAt = Date.now();
      await this.save();
      return { ok: true, mode: "LOGIN", user: existing };
    }

    const newUser = this.createBlankUserWithHash(cleanName, computedHash);
    this.data.users[key] = newUser;
    await this.save();
    return { ok: true, mode: "CREATED", user: newUser };
  },

  async updateCredentialsAsync(oldName, newName, newPinOptional, currentPinForRehash = "") {
    await this.pullFromServer();
    if (!this.data) this.init();
    const oldKey = this.normalizeKey(oldName);
    const cleanNewName = String(newName || "").trim();
    const newKey = this.normalizeKey(cleanNewName);
    const cleanPin = String(newPinOptional || "").trim();

    const user = this.data.users[oldKey];
    if (!user) {
      return { ok: false, code: "ERR_USER_NOT_FOUND", message: "Account not found in database." };
    }
    if (!cleanNewName) {
      return { ok: false, code: "ERR_EMPTY_NAME", message: "Name cannot be empty." };
    }
    if (newKey !== oldKey && this.data.users[newKey]) {
      return { ok: false, code: "ERR_NAME_TAKEN", message: "That name already exists in the database." };
    }

    if (cleanPin) {
      if (!/^\d{4}$/.test(cleanPin)) {
        return { ok: false, code: "ERR_INVALID_PIN_FORMAT", message: "New PIN must be exactly 4 digits." };
      }
      user.pinHash = await this.hashPin(cleanNewName, cleanPin);
    } else if (newKey !== oldKey) {
      if (!/^\d{4}$/.test(currentPinForRehash)) {
        return { ok: false, code: "ERR_PIN_NEEDED_FOR_RENAME", message: "Please enter your 4-digit PIN to confirm changing your username." };
      }
      user.pinHash = await this.hashPin(cleanNewName, currentPinForRehash);
    }

    delete user.pin;
    user.name = cleanNewName;
    user.updatedAt = Date.now();

    if (newKey !== oldKey) {
      this.data.users[newKey] = user;
      delete this.data.users[oldKey];

      Object.values(this.data.users).forEach(other => {
        if (other.stats && other.stats.opponents && other.stats.opponents[oldKey]) {
          const oppRecord = other.stats.opponents[oldKey];
          oppRecord.displayName = cleanNewName;
          other.stats.opponents[newKey] = oppRecord;
          delete other.stats.opponents[oldKey];
        }
      });

      if (Array.isArray(this.data.messages)) {
        this.data.messages.forEach(m => {
          if (m.fromKey === oldKey) { m.fromKey = newKey; m.from = cleanNewName; }
          if (m.toKey === oldKey) { m.toKey = newKey; m.to = cleanNewName; }
        });
      }
    }

    await this.save(true);
    return { ok: true, user };
  },

  async adminSaveUserRecordAsync(originalKey, updatedFields) {
    if (!this.data) this.init();
    const oldKey = this.normalizeKey(originalKey);
    const user = this.data.users[oldKey];
    if (!user) return { ok: false, message: "User not found." };

    const cleanNewName = String(updatedFields.name || user.name).trim();
    const newKey = this.normalizeKey(cleanNewName);
    if (!cleanNewName) return { ok: false, message: "Name cannot be empty." };
    if (newKey !== oldKey && this.data.users[newKey]) {
      return { ok: false, message: "Another user already has that name." };
    }

    const newPin = String(updatedFields.newPin || "").trim();
    if (newPin) {
      if (!/^\d{4}$/.test(newPin)) {
        return { ok: false, message: "New PIN must be 4 digits (or leave blank to keep current PIN)." };
      }
      user.pinHash = await this.hashPin(cleanNewName, newPin);
    } else if (newKey !== oldKey) {
      return { ok: false, message: "When renaming a user, enter a 4-digit PIN in 'New PIN' so their login hash updates." };
    }
    delete user.pin;

    user.name = cleanNewName;
    if (updatedFields.elo !== undefined) {
      user.stats.elo = Math.max(100, parseInt(updatedFields.elo, 10) || DEFAULT_ELO);
    }
    user.stats.setsWon = Math.max(0, parseInt(updatedFields.setsWon, 10) || 0);
    user.stats.setsLost = Math.max(0, parseInt(updatedFields.setsLost, 10) || 0);
    user.stats.setsPlayed = user.stats.setsWon + user.stats.setsLost;

    user.stats.gamesWon = Math.max(0, parseInt(updatedFields.gamesWon, 10) || 0);
    user.stats.gamesLost = Math.max(0, parseInt(updatedFields.gamesLost, 10) || 0);
    user.stats.gamesPlayed = user.stats.gamesWon + user.stats.gamesLost;

    if (!user.stats.variants) {
      user.stats.variants = { PORTES: { played: 0, won: 0 }, PLAKOTO: { played: 0, won: 0 }, FEVGA: { played: 0, won: 0 } };
    }
    ["PORTES", "PLAKOTO", "FEVGA"].forEach(v => {
      if (updatedFields[v]) {
        const w = Math.max(0, parseInt(updatedFields[v].won, 10) || 0);
        const p = Math.max(w, parseInt(updatedFields[v].played, 10) || 0);
        user.stats.variants[v] = { won: w, played: p };
      }
    });

    user.updatedAt = Date.now();

    if (newKey !== oldKey) {
      this.data.users[newKey] = user;
      delete this.data.users[oldKey];
    }

    await this.save(true);
    return { ok: true, user };
  },

  adminSaveOpponentRecord(userKey, oppKey, fields) {
    if (!this.data) this.init();
    const u = this.data.users[this.normalizeKey(userKey)];
    if (!u || !u.stats || !u.stats.opponents) return false;
    const ok = this.normalizeKey(oppKey);
    const opp = u.stats.opponents[ok];
    if (!opp) return false;

    opp.gamesWon = Math.max(0, parseInt(fields.gamesWon, 10) || 0);
    opp.gamesLost = Math.max(0, parseInt(fields.gamesLost, 10) || 0);
    opp.gamesPlayed = opp.gamesWon + opp.gamesLost;

    opp.setsWon = Math.max(0, parseInt(fields.setsWon, 10) || 0);
    opp.setsLost = Math.max(0, parseInt(fields.setsLost, 10) || 0);
    opp.setsPlayed = opp.setsWon + opp.setsLost;

    u.updatedAt = Date.now();
    this.save(true);
    return true;
  },

  adminDeleteOpponentRecord(userKey, oppKey) {
    if (!this.data) this.init();
    const u = this.data.users[this.normalizeKey(userKey)];
    if (!u || !u.stats || !u.stats.opponents) return false;
    const ok = this.normalizeKey(oppKey);
    if (u.stats.opponents[ok]) {
      delete u.stats.opponents[ok];
      u.updatedAt = Date.now();
      this.save(true);
      return true;
    }
    return false;
  },

  adminDeleteUser(nameOrKey) {
    if (!this.data) this.init();
    const k = this.normalizeKey(nameOrKey);
    if (this.data.users[k]) {
      delete this.data.users[k];
      this.save(true);
      return true;
    }
    return false;
  },

  ensureOpponentEntry(user, oppName) {
    if (!user.stats.opponents) user.stats.opponents = {};
    const oppKey = this.normalizeKey(oppName) || "guest";
    const cleanOpp = String(oppName || "Guest").trim();
    if (!user.stats.opponents[oppKey]) {
      user.stats.opponents[oppKey] = {
        displayName: cleanOpp,
        gamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0,
        setsPlayed: 0,
        setsWon: 0,
        setsLost: 0
      };
    } else {
      user.stats.opponents[oppKey].displayName = cleanOpp;
      if (user.stats.opponents[oppKey].gamesLost === undefined) {
        const gp = user.stats.opponents[oppKey].gamesPlayed || 0;
        const gw = user.stats.opponents[oppKey].gamesWon || 0;
        user.stats.opponents[oppKey].gamesLost = Math.max(0, gp - gw);
      }
    }
    return user.stats.opponents[oppKey];
  },

  unlockAchievementBadge(playerName, badgeId) {
    const u = this.getUser(playerName);
    if (!u || !u.stats || !badgeId) return false;
    if (!u.stats.badges || typeof u.stats.badges !== "object" || Array.isArray(u.stats.badges)) {
      u.stats.badges = {};
    }
    if (!u.stats.badges[badgeId]) {
      u.stats.badges[badgeId] = Date.now();
      u.updatedAt = Date.now();
      return true;
    }
    return false;
  },

  getPlayerBadgesList(playerName) {
    const u = this.getUser(playerName);
    const unlockedMap = (u && u.stats && u.stats.badges && typeof u.stats.badges === "object") ? u.stats.badges : {};
    return ACHIEVEMENT_CATALOG.map(b => ({
      ...b,
      unlocked: Boolean(unlockedMap[b.id]),
      unlockedAt: unlockedMap[b.id] || null
    }));
  },

  _applyEloUpdateBetweenPlayers(wName, bName, wWon, kFactor = 16) {
    const uW = this.getUser(wName);
    const uB = this.getUser(bName);
    if (!uW && !uB) return { deltaW: 0, deltaB: 0, newEloW: DEFAULT_ELO, newEloB: DEFAULT_ELO };

    const eloW = (uW && uW.stats && typeof uW.stats.elo === "number") ? uW.stats.elo : DEFAULT_ELO;
    const eloB = (uB && uB.stats && typeof uB.stats.elo === "number") ? uB.stats.elo : DEFAULT_ELO;

    const expectedW = 1 / (1 + Math.pow(10, (eloB - eloW) / 400));
    const expectedB = 1 - expectedW;

    const actualW = wWon ? 1 : 0;
    const actualB = wWon ? 0 : 1;

    let newEloW = eloW;
    let newEloB = eloB;

    if (uW && uW.stats) {
      newEloW = Math.max(800, Math.round(eloW + kFactor * (actualW - expectedW)));
      uW.stats.elo = newEloW;
      if (newEloW >= 1350) this.unlockAchievementBadge(wName, "GRANDMASTER");
      uW.updatedAt = Date.now();
    }
    if (uB && uB.stats) {
      newEloB = Math.max(800, Math.round(eloB + kFactor * (actualB - expectedB)));
      uB.stats.elo = newEloB;
      if (newEloB >= 1350) this.unlockAchievementBadge(bName, "GRANDMASTER");
      uB.updatedAt = Date.now();
    }
    return {
      deltaW: newEloW - eloW,
      deltaB: newEloB - eloB,
      newEloW,
      newEloB
    };
  },

  _recordCompletedSetHistoryAndBadges(winEv, totalEloDeltaW, totalEloDeltaB) {
    const wName = String(winEv.nameW || "Player 1").trim();
    const bName = String(winEv.nameB || "Player 2").trim();
    const wWon = winEv.winner === "W";
    const winnerName = wWon ? wName : bName;
    const scoreW = parseInt(winEv.scoreW, 10) || 0;
    const scoreB = parseInt(winEv.scoreB, 10) || 0;
    const targetScore = parseInt(winEv.targetScore, 10) || 7;
    const ts = Date.now();

    // 1. Check Set-Level Achievements (Comeback King, Diplomat, First Blood, Hot Streak)
    this.unlockAchievementBadge(winnerName, "FIRST_BLOOD");
    const winUser = this.getUser(winnerName);
    if (winUser && winUser.stats && (winUser.stats.winStreak || 0) >= 3) {
      this.unlockAchievementBadge(winnerName, "HOT_STREAK");
    }
    if (winEv.comebackKing) {
      this.unlockAchievementBadge(winnerName, "COMEBACK_KING");
    }
    if (winEv.diplomatCount && winEv.diplomatCount >= 3) {
      this.unlockAchievementBadge(winnerName, "DIPLOMAT");
    }
    // Also evaluate from gamesLog if attached
    if (Array.isArray(winEv.gamesLog) && winEv.gamesLog.length > 0) {
      const winnerRole = wWon ? "W" : "B";
      const diplosWon = winEv.gamesLog.filter(g => g && g.winner === winnerRole && g.pts === 2 && !g.forfeit).length;
      if (diplosWon >= 3) {
        this.unlockAchievementBadge(winnerName, "DIPLOMAT");
      }
      if (targetScore >= 7) {
        let runW = 0, runB = 0, trailed0to5 = false;
        for (const g of winEv.gamesLog) {
          if (!g) continue;
          const p = parseInt(g.pts, 10) || 1;
          if (g.winner === "W") runW += p; else runB += p;
          const mySc = winnerRole === "W" ? runW : runB;
          const oppSc = winnerRole === "W" ? runB : runW;
          if (mySc === 0 && oppSc >= 5) trailed0to5 = true;
        }
        if (trailed0to5) {
          this.unlockAchievementBadge(winnerName, "COMEBACK_KING");
        }
      }
    }

    // 2. Append to each player's Last 10 Completed Sets & ELO Sparkline History
    const uW = this.getUser(wName);
    if (uW && uW.stats) {
      if (!Array.isArray(uW.stats.recentSets)) uW.stats.recentSets = [];
      if (!Array.isArray(uW.stats.eloHistory) || uW.stats.eloHistory.length === 0) {
        uW.stats.eloHistory = [Math.max(800, (uW.stats.elo || DEFAULT_ELO) - totalEloDeltaW)];
      }
      uW.stats.eloHistory.push(uW.stats.elo || DEFAULT_ELO);
      if (uW.stats.eloHistory.length > 15) uW.stats.eloHistory = uW.stats.eloHistory.slice(-15);

      uW.stats.recentSets.push({
        id: String(winEv.id),
        opponent: bName,
        myScore: scoreW,
        oppScore: scoreB,
        target: targetScore,
        won: wWon,
        eloDelta: totalEloDeltaW,
        eloAfter: uW.stats.elo || DEFAULT_ELO,
        ts
      });
      if (uW.stats.recentSets.length > 10) uW.stats.recentSets = uW.stats.recentSets.slice(-10);
    }

    const uB = this.getUser(bName);
    if (uB && uB.stats) {
      if (!Array.isArray(uB.stats.recentSets)) uB.stats.recentSets = [];
      if (!Array.isArray(uB.stats.eloHistory) || uB.stats.eloHistory.length === 0) {
        uB.stats.eloHistory = [Math.max(800, (uB.stats.elo || DEFAULT_ELO) - totalEloDeltaB)];
      }
      uB.stats.eloHistory.push(uB.stats.elo || DEFAULT_ELO);
      if (uB.stats.eloHistory.length > 15) uB.stats.eloHistory = uB.stats.eloHistory.slice(-15);

      uB.stats.recentSets.push({
        id: String(winEv.id),
        opponent: wName,
        myScore: scoreB,
        oppScore: scoreW,
        target: targetScore,
        won: !wWon,
        eloDelta: totalEloDeltaB,
        eloAfter: uB.stats.elo || DEFAULT_ELO,
        ts
      });
      if (uB.stats.recentSets.length > 10) uB.stats.recentSets = uB.stats.recentSets.slice(-10);
    }
  },

  recordWinEventOnce(winEv) {
    if (!winEv || !winEv.id) return false;
    if (!this.data) this.init();
    if (!this.data.processedWinEvents) this.data.processedWinEvents = {};

    const evId = String(winEv.id);
    if (this.data.processedWinEvents[evId]) {
      return false;
    }

    const wName = String(winEv.nameW || "Player 1").trim();
    const bName = String(winEv.nameB || "Player 2").trim();
    if (this.isAiPlayerName(wName) || this.isAiPlayerName(bName)) return false;

    this.data.processedWinEvents[evId] = Date.now();

    const wWon = winEv.winner === "W";
    const winnerName = wWon ? wName : bName;
    const variant = winEv.variant || "PORTES";

    // Check Mana Hunter badge (winning Plakoto by pinning opponent's Mother checker)
    if (winEv.manaWin && variant === "PLAKOTO") {
      this.unlockAchievementBadge(winnerName, "MANA_HUNTER");
    }

    let totalDeltaW = 0;
    let totalDeltaB = 0;

    if (!winEv.forfeitSetOnly) {
      this._applySingleGameIncrement(wName, bName, variant, wWon);
      this._applySingleGameIncrement(bName, wName, variant, !wWon);
      const gElo = this._applyEloUpdateBetweenPlayers(wName, bName, wWon, 14);
      totalDeltaW += gElo.deltaW;
      totalDeltaB += gElo.deltaB;
    }

    if (winEv.matchOver) {
      this._applySingleSetIncrement(wName, bName, wWon);
      this._applySingleSetIncrement(bName, wName, !wWon);
      const sElo = this._applyEloUpdateBetweenPlayers(wName, bName, wWon, 24);
      totalDeltaW += sElo.deltaW;
      totalDeltaB += sElo.deltaB;
      this._recordCompletedSetHistoryAndBadges(winEv, totalDeltaW, totalDeltaB);
    }

    this.save();
    return true;
  },

  _applySingleGameIncrement(playerName, opponentName, variant, didWin) {
    const user = this.getUser(playerName);
    if (!user) return;

    if (didWin) {
      user.stats.gamesWon = (user.stats.gamesWon || 0) + 1;
    } else {
      user.stats.gamesLost = (user.stats.gamesLost || 0) + 1;
    }
    user.stats.gamesPlayed = (user.stats.gamesWon || 0) + (user.stats.gamesLost || 0);

    if (!user.stats.variants) {
      user.stats.variants = { PORTES: { played: 0, won: 0 }, PLAKOTO: { played: 0, won: 0 }, FEVGA: { played: 0, won: 0 } };
    }
    if (!user.stats.variants[variant]) {
      user.stats.variants[variant] = { played: 0, won: 0 };
    }
    user.stats.variants[variant].played += 1;
    if (didWin) user.stats.variants[variant].won += 1;

    const oppRec = this.ensureOpponentEntry(user, opponentName);
    if (didWin) {
      oppRec.gamesWon = (oppRec.gamesWon || 0) + 1;
    } else {
      oppRec.gamesLost = (oppRec.gamesLost || 0) + 1;
    }
    oppRec.gamesPlayed = (oppRec.gamesWon || 0) + (oppRec.gamesLost || 0);

    user.updatedAt = Date.now();
  },

  _applySingleSetIncrement(playerName, opponentName, didWin) {
    const user = this.getUser(playerName);
    if (!user) return;

    if (didWin) {
      user.stats.setsWon = (user.stats.setsWon || 0) + 1;
      user.stats.winStreak = (user.stats.winStreak || 0) + 1;
      if (user.stats.winStreak > (user.stats.bestWinStreak || 0)) {
        user.stats.bestWinStreak = user.stats.winStreak;
      }
    } else {
      user.stats.setsLost = (user.stats.setsLost || 0) + 1;
      user.stats.winStreak = 0;
    }
    user.stats.setsPlayed = (user.stats.setsWon || 0) + (user.stats.setsLost || 0);

    const oppRec = this.ensureOpponentEntry(user, opponentName);
    if (didWin) {
      oppRec.setsWon = (oppRec.setsWon || 0) + 1;
    } else {
      oppRec.setsLost = (oppRec.setsLost || 0) + 1;
    }
    oppRec.setsPlayed = (oppRec.setsWon || 0) + (oppRec.setsLost || 0);

    user.updatedAt = Date.now();
  },

  recordGameOutcome(playerName, opponentName, variant, didWin) {
    if (this.isAiPlayerName(playerName) || this.isAiPlayerName(opponentName)) return;
    if (!this.data) this.init();
    this._applySingleGameIncrement(playerName, opponentName, variant, didWin);
    this.save();
  },

  recordSetOutcome(playerName, opponentName, didWin) {
    if (this.isAiPlayerName(playerName) || this.isAiPlayerName(opponentName)) return;
    if (!this.data) this.init();
    this._applySingleSetIncrement(playerName, opponentName, didWin);
    this.save();
  },

  // --- Global Player-to-Player Messaging System ---
  async sendMessageAsync(fromName, toName, rawText) {
    if (!this.data) this.init();
    if (!Array.isArray(this.data.messages)) this.data.messages = [];

    const cleanFrom = String(fromName || "").trim();
    const cleanTo = String(toName || "").trim();
    const cleanText = String(rawText || "").trim().slice(0, 240);

    if (!cleanFrom || !cleanTo || !cleanText) {
      return { ok: false, message: "Invalid message." };
    }

    const fromUser = this.getUser(cleanFrom);
    const toUser = this.getUser(cleanTo);

    const msgObj = {
      id: "MSG-" + Date.now() + "-" + Math.floor(Math.random() * 100000),
      from: fromUser ? fromUser.name : cleanFrom,
      fromKey: this.normalizeKey(cleanFrom),
      to: toUser ? toUser.name : cleanTo,
      toKey: this.normalizeKey(cleanTo),
      text: cleanText,
      ts: Date.now(),
      read: false
    };

    this.data.messages.push(msgObj);
    if (this.data.messages.length > 400) {
      this.data.messages = this.data.messages.slice(-400);
    }

    await this.save();
    return { ok: true, msg: msgObj };
  },

  getMessagesForUser(userName) {
    if (!this.data) this.init();
    if (!Array.isArray(this.data.messages)) return [];
    const myKey = this.normalizeKey(userName);
    if (!myKey) return [];
    return this.data.messages
      .filter(m => m && (m.fromKey === myKey || m.toKey === myKey))
      .sort((a, b) => (a.ts || 0) - (b.ts || 0));
  },

  getConversationThreads(userName) {
    const myKey = this.normalizeKey(userName);
    if (!myKey) return [];
    const all = this.getMessagesForUser(userName);
    const map = new Map();

    all.forEach(m => {
      const isIncoming = (m.toKey === myKey);
      const partnerKey = isIncoming ? m.fromKey : m.toKey;
      const partnerName = isIncoming ? m.from : m.to;
      if (!partnerKey) return;

      if (!map.has(partnerKey)) {
        const regUser = this.getUser(partnerKey);
        map.set(partnerKey, {
          partnerKey,
          partnerName: regUser ? regUser.name : partnerName,
          lastMsg: m,
          unreadCount: 0,
          messages: []
        });
      }
      const thread = map.get(partnerKey);
      thread.lastMsg = m;
      thread.messages.push(m);
      if (isIncoming && !m.read) {
        thread.unreadCount += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) => (b.lastMsg.ts || 0) - (a.lastMsg.ts || 0));
  },

  getUnreadCount(userName) {
    if (!this.data) this.init();
    if (!Array.isArray(this.data.messages)) return 0;
    const myKey = this.normalizeKey(userName);
    if (!myKey) return 0;
    return this.data.messages.filter(m => m && m.toKey === myKey && !m.read).length;
  },

  markConversationRead(myName, partnerName) {
    if (!this.data) this.init();
    if (!Array.isArray(this.data.messages)) return false;
    const myKey = this.normalizeKey(myName);
    const pKey = this.normalizeKey(partnerName);
    if (!myKey || !pKey) return false;

    let changed = false;
    this.data.messages.forEach(m => {
      if (m && m.toKey === myKey && m.fromKey === pKey && !m.read) {
        m.read = true;
        changed = true;
      }
    });

    if (changed) {
      this.save();
    }
    return changed;
  },

  // --- Version 25: Friends List & Win Streak Helpers ---
  getPlayerWinStreak(playerName) {
    const u = this.getUser(playerName);
    if (!u || !u.stats) return 0;
    return Math.max(0, parseInt(u.stats.winStreak, 10) || 0);
  },

  getFriendsKeys(myName) {
    const u = this.getUser(myName);
    if (u && Array.isArray(u.friends)) {
      return u.friends.map(k => this.normalizeKey(k)).filter(Boolean);
    }
    try {
      const localRaw = localStorage.getItem("tavli_v25_local_friends");
      if (localRaw) {
        const arr = JSON.parse(localRaw);
        if (Array.isArray(arr)) return arr.map(k => this.normalizeKey(k)).filter(Boolean);
      }
    } catch (_) {}
    return [];
  },

  isFriend(myName, targetName) {
    const myKey = this.normalizeKey(myName);
    const targetKey = this.normalizeKey(targetName);
    if (!targetKey || myKey === targetKey) return false;
    return this.getFriendsKeys(myName).includes(targetKey);
  },

  async addFriendAsync(myName, targetName) {
    const myKey = this.normalizeKey(myName);
    const targetKey = this.normalizeKey(targetName);
    if (!targetKey || myKey === targetKey || this.isAiPlayerName(targetName)) return false;

    const u = this.getUser(myName);
    if (u) {
      if (!Array.isArray(u.friends)) u.friends = [];
      if (!u.friends.includes(targetKey)) {
        u.friends.push(targetKey);
        u.updatedAt = Date.now();
        await this.save();
      }
    }
    try {
      const localRaw = localStorage.getItem("tavli_v25_local_friends");
      const arr = localRaw ? JSON.parse(localRaw) : [];
      if (Array.isArray(arr) && !arr.includes(targetKey)) {
        arr.push(targetKey);
        localStorage.setItem("tavli_v25_local_friends", JSON.stringify(arr));
      }
    } catch (_) {}
    return true;
  },

  async removeFriendAsync(myName, targetName) {
    const targetKey = this.normalizeKey(targetName);
    if (!targetKey) return false;
    const u = this.getUser(myName);
    if (u && Array.isArray(u.friends)) {
      u.friends = u.friends.filter(k => this.normalizeKey(k) !== targetKey);
      u.updatedAt = Date.now();
      await this.save();
    }
    try {
      const localRaw = localStorage.getItem("tavli_v25_local_friends");
      const arr = localRaw ? JSON.parse(localRaw) : [];
      if (Array.isArray(arr)) {
        const filtered = arr.filter(k => this.normalizeKey(k) !== targetKey);
        localStorage.setItem("tavli_v25_local_friends", JSON.stringify(filtered));
      }
    } catch (_) {}
    return true;
  },

  getFriendsDetailedList(myName) {
    const keys = this.getFriendsKeys(myName);
    const results = [];
    keys.forEach(k => {
      const u = this.getUser(k);
      const pr = this.data && this.data.presence ? this.data.presence[k] : null;
      const displayName = u ? u.name : (pr && pr.name ? pr.name : k);
      const s = (u && u.stats) ? u.stats : {};
      const elo = typeof s.elo === "number" ? Math.round(s.elo) : DEFAULT_ELO;
      const winStreak = Math.max(0, parseInt(s.winStreak, 10) || 0);
      const presence = this.getPlayerPresence(displayName);
      results.push({
        key: k,
        name: displayName,
        elo,
        winStreak,
        presence
      });
    });
    results.sort((a, b) => {
      const scorePr = p => (!p || !p.online) ? 2 : (p.status === "online_idle" ? 0 : 1);
      const diff = scorePr(a.presence) - scorePr(b.presence);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    });
    return results;
  },

  // --- Version 26: Admin Broadcast Banner (Sotiris Only) & Global Kafeneio Lobby Chat ---
  getBroadcastBanner() {
    if (!this.data) this.init();
    const b = this.data.broadcastBanner;
    if (!b || !b.text || !String(b.text).trim()) return null;
    return {
      text: String(b.text).trim(),
      updatedAt: Number(b.updatedAt) || 0,
      author: String(b.author || "Sotiris")
    };
  },

  async setBroadcastBannerAsync(adminName, rawText) {
    if (!this.isAdminName(adminName)) {
      return { ok: false, message: "Only Sotiris can update the Broadcast Banner." };
    }
    if (!this.data) this.init();
    const cleanText = String(rawText || "").trim().slice(0, 240);
    const bannerObj = {
      text: cleanText,
      updatedAt: Date.now(),
      author: "Sotiris"
    };
    this.data.broadcastBanner = bannerObj;
    this.saveLocalOnly();

    const subUrl = this.getSubPathUrl("broadcastBanner");
    if (subUrl) {
      try {
        await fetch(subUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bannerObj)
        });
      } catch (_) {}
    }
    await this.save();
    this.notifyListeners();
    return { ok: true, banner: bannerObj };
  },

  getLobbyChatMessages() {
    if (!this.data) this.init();
    if (!Array.isArray(this.data.lobbyChat)) this.data.lobbyChat = [];
    return this.data.lobbyChat.slice(-60).sort((a, b) => (a.ts || 0) - (b.ts || 0));
  },

  async sendLobbyChatMessageAsync(senderName, rawText) {
    if (!this.data) this.init();
    if (!Array.isArray(this.data.lobbyChat)) this.data.lobbyChat = [];
    const cleanSender = String(senderName || "Player").trim().slice(0, 16) || "Player";
    const cleanText = String(rawText || "").trim().slice(0, 220);
    if (!cleanText) return { ok: false };

    const msgObj = {
      id: "KAF-" + Date.now() + "-" + Math.floor(Math.random() * 100000),
      sender: cleanSender,
      senderKey: this.normalizeKey(cleanSender),
      text: cleanText,
      ts: Date.now()
    };
    this.data.lobbyChat.push(msgObj);
    if (this.data.lobbyChat.length > 80) {
      this.data.lobbyChat = this.data.lobbyChat.slice(-80);
    }
    this.saveLocalOnly();
    await this.save();
    return { ok: true, msg: msgObj };
  },

  // --- Version 24/25: Leaderboard Sorted by ELO (All Other Stats Preserved) ---
  getLeaderboard() {
    if (!this.data) this.init();
    const list = Object.values(this.data.users).map(u => {
      const s = u.stats || {};
      const elo = typeof s.elo === "number" ? Math.round(s.elo) : this.computeBaselineEloFromStats(s);
      const winStreak = Math.max(0, parseInt(s.winStreak, 10) || 0);
      const bestWinStreak = Math.max(winStreak, parseInt(s.bestWinStreak, 10) || 0);
      const setsWon = s.setsWon || 0;
      const setsLost = s.setsLost || 0;
      const setsPlayed = setsWon + setsLost;
      const gamesWon = s.gamesWon || 0;
      const gamesLost = s.gamesLost || 0;
      const gamesPlayed = gamesWon + gamesLost;
      const setWinRate = setsPlayed > 0 ? (setsWon / setsPlayed) * 100 : 0;
      const gameWinRate = gamesPlayed > 0 ? (gamesWon / gamesPlayed) * 100 : 0;
      return {
        name: u.name,
        elo,
        winStreak,
        bestWinStreak,
        setsPlayed,
        setsWon,
        setsLost,
        gamesPlayed,
        gamesWon,
        gamesLost,
        setWinRate,
        gameWinRate,
        overallWinRate: gamesPlayed > 0 ? gameWinRate : setWinRate
      };
    });

    list.sort((a, b) => {
      if (b.elo !== a.elo) return b.elo - a.elo;
      if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon;
      if (Math.abs(b.overallWinRate - a.overallWinRate) > 0.01) return b.overallWinRate - a.overallWinRate;
      if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
      return a.name.localeCompare(b.name);
    });

    return list.map((item, idx) => ({ ...item, rank: idx + 1 }));
  },

  getPlayerRank(name) {
    const key = this.normalizeKey(name);
    if (!key) return null;
    const lb = this.getLeaderboard();
    const found = lb.find(entry => this.normalizeKey(entry.name) === key);
    return found ? { rank: found.rank, total: lb.length, elo: found.elo } : null;
  },

  getTopOpponents(name, limit = 3) {
    const user = this.getUser(name);
    if (!user || !user.stats || !user.stats.opponents) return [];
    const arr = Object.values(user.stats.opponents).filter(o => !this.isAiPlayerName(o.displayName));
    arr.forEach(o => {
      o.gamesWon = o.gamesWon || 0;
      o.gamesLost = o.gamesLost !== undefined ? o.gamesLost : Math.max(0, (o.gamesPlayed || 0) - o.gamesWon);
      o.gamesPlayed = o.gamesWon + o.gamesLost;
      o.setsWon = o.setsWon || 0;
      o.setsLost = o.setsLost || 0;
      o.setsPlayed = o.setsWon + o.setsLost;
    });
    arr.sort((a, b) => {
      if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
      return b.setsPlayed - a.setsPlayed;
    });
    return arr.slice(0, limit);
  },

  exportPublicSnapshot() {
    if (!this.data) this.init();
    const snapshot = {};
    Object.entries(this.data.users).forEach(([k, u]) => {
      snapshot[k] = {
        name: u.name,
        pinHash: u.pinHash || null,
        friends: Array.isArray(u.friends) ? u.friends : [],
        updatedAt: u.updatedAt || 0,
        stats: u.stats
      };
    });
    return {
      users: snapshot,
      messages: Array.isArray(this.data.messages) ? this.data.messages.slice(-200) : [],
      lobbyChat: Array.isArray(this.data.lobbyChat) ? this.data.lobbyChat.slice(-60) : [],
      broadcastBanner: this.data.broadcastBanner || { text: "", updatedAt: 0, author: "Sotiris" },
      liveRooms: this.data.liveRooms || {},
      presence: this.data.presence || {},
      challenges: this.data.challenges || {},
      processedWinEvents: this.data.processedWinEvents || {}
    };
  },

  mergePublicSnapshot(remoteSnapshot) {
    if (!remoteSnapshot || typeof remoteSnapshot !== "object") return;
    if (!this.data) this.init();
    let changed = false;

    const usersMap = remoteSnapshot.users || remoteSnapshot;
    Object.entries(usersMap).forEach(([k, remUser]) => {
      if (!remUser || !remUser.name || !remUser.stats) return;
      if (typeof remUser.stats.elo !== "number") {
        remUser.stats.elo = this.computeBaselineEloFromStats(remUser.stats);
      }
      const localUser = this.data.users[k];
      if (!localUser) {
        this.data.users[k] = {
          name: remUser.name,
          pinHash: remUser.pinHash || null,
          friends: Array.isArray(remUser.friends) ? remUser.friends : [],
          createdAt: Date.now(),
          updatedAt: remUser.updatedAt || Date.now(),
          stats: remUser.stats
        };
        changed = true;
      } else {
        if (remUser.pinHash && !localUser.pinHash) {
          localUser.pinHash = remUser.pinHash;
          changed = true;
        }
        const remGames = ((remUser.stats && remUser.stats.gamesWon) || 0) + ((remUser.stats && remUser.stats.gamesLost) || 0);
        const locGames = ((localUser.stats && localUser.stats.gamesWon) || 0) + ((localUser.stats && localUser.stats.gamesLost) || 0);
        const remSets  = ((remUser.stats && remUser.stats.setsWon) || 0) + ((remUser.stats && remUser.stats.setsLost) || 0);
        const locSets  = ((localUser.stats && localUser.stats.setsWon) || 0) + ((localUser.stats && localUser.stats.setsLost) || 0);

        if ((remUser.updatedAt || 0) > (localUser.updatedAt || 0) || remGames > locGames || remSets > locSets) {
          localUser.stats = remUser.stats;
          localUser.name = remUser.name;
          localUser.updatedAt = Math.max(remUser.updatedAt || 0, localUser.updatedAt || 0);
          changed = true;
        }
      }
    });

    if (Array.isArray(remoteSnapshot.messages)) {
      const beforeLen = (this.data.messages || []).length;
      this.mergeMessagesList(remoteSnapshot.messages);
      if ((this.data.messages || []).length !== beforeLen) changed = true;
    }
    if (Array.isArray(remoteSnapshot.lobbyChat)) {
      const beforeLobby = (this.data.lobbyChat || []).length;
      this.mergeLobbyChatList(remoteSnapshot.lobbyChat);
      if ((this.data.lobbyChat || []).length !== beforeLobby) changed = true;
    }
    if (remoteSnapshot.broadcastBanner && typeof remoteSnapshot.broadcastBanner === "object") {
      const oldTs = (this.data.broadcastBanner && this.data.broadcastBanner.updatedAt) || 0;
      this.mergeBroadcastBanner(remoteSnapshot.broadcastBanner);
      if (((this.data.broadcastBanner && this.data.broadcastBanner.updatedAt) || 0) !== oldTs) changed = true;
    }

    if (remoteSnapshot.liveRooms && typeof remoteSnapshot.liveRooms === "object") {
      this.mergeLiveRoomsMap(remoteSnapshot.liveRooms);
    }

    if (remoteSnapshot.presence && typeof remoteSnapshot.presence === "object") {
      this.mergePresenceMap(remoteSnapshot.presence);
    }

    if (remoteSnapshot.challenges && typeof remoteSnapshot.challenges === "object") {
      this.mergeChallengesMap(remoteSnapshot.challenges);
    }

    if (remoteSnapshot.processedWinEvents && typeof remoteSnapshot.processedWinEvents === "object") {
      if (!this.data.processedWinEvents) this.data.processedWinEvents = {};
      Object.entries(remoteSnapshot.processedWinEvents).forEach(([evId, ts]) => {
        if (evId && !this.data.processedWinEvents[evId]) {
          this.data.processedWinEvents[evId] = Number(ts) || Date.now();
          changed = true;
        }
      });
    }

    if (changed) this.save();
  },

  downloadDatabaseFile() {
    if (!this.data) this.init();
    const blob = new Blob([JSON.stringify(this.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tavli-database.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  async importDatabaseJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed.users !== "object") {
        return { ok: false, message: "Invalid database file structure." };
      }
      this.data = parsed;
      if (!Array.isArray(this.data.messages)) this.data.messages = [];
      if (!this.data.liveRooms || typeof this.data.liveRooms !== "object") this.data.liveRooms = {};
      if (!this.data.presence || typeof this.data.presence !== "object") this.data.presence = {};
      if (!this.data.challenges || typeof this.data.challenges !== "object") this.data.challenges = {};
      if (!this.data.processedWinEvents || typeof this.data.processedWinEvents !== "object") this.data.processedWinEvents = {};
      this.sanitizeAllStatsConsistency();
      await this.migrateLegacyPlaintextPins();
      await this.save(true);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: "Could not parse JSON database file." };
    }
  }
};

window.TavliDB.init();