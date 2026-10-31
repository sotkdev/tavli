// Greek Tavli Online — Global Firebase Realtime Database Engine with Salted SHA-256 PIN Hashing & Global Messaging (database.js — v20)
// Always points to: https://greek-tavli-online-default-rtdb.europe-west1.firebasedatabase.app/tavli_db.json

const TAVLI_DB_STORAGE_KEY = "tavli_players_database_v1";
const TAVLI_CLOUD_URL_KEY  = "tavli_cloud_server_url_v1";
const TAVLI_HASH_SALT      = "GreekTavli_SHA256_Salt_2026_v2";

// PERMANENT FIREBASE REALTIME DATABASE ENDPOINT:
const DEFAULT_CLOUD_ENDPOINT = "https://greek-tavli-online-default-rtdb.europe-west1.firebasedatabase.app/tavli_db.json";

const INITIAL_TAVLI_DATABASE = {
  version: 3,
  lastUpdated: Date.now(),
  users: {},
  messages: []
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
        if (!Array.isArray(this.data.messages)) {
          this.data.messages = [];
        }
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

  sanitizeAllStatsConsistency() {
    if (!this.data || !this.data.users) return;
    if (!Array.isArray(this.data.messages)) this.data.messages = [];
    Object.values(this.data.users).forEach(u => {
      if (!u || !u.stats) return;
      const s = u.stats;
      s.setsWon = Math.max(0, parseInt(s.setsWon, 10) || 0);
      s.setsLost = Math.max(0, parseInt(s.setsLost, 10) || 0);
      s.setsPlayed = s.setsWon + s.setsLost;

      s.gamesWon = Math.max(0, parseInt(s.gamesWon, 10) || 0);
      s.gamesLost = Math.max(0, parseInt(s.gamesLost, 10) || 0);
      s.gamesPlayed = s.gamesWon + s.gamesLost;

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
    // Keep up to 400 recent messages so the DB stays lightweight
    this.data.messages = merged.slice(-400);
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
        const locSets  = ((locUser.stats && locUser.stats.setsWon) || 0) + ((locUser.stats && locUser.stats.setsLost) || 0);

        if (remTime > locTime || remGames > locGames || remSets > locSets) {
          locUser.name = remUser.name;
          locUser.stats = JSON.parse(JSON.stringify(remUser.stats));
          locUser.updatedAt = Math.max(remTime, locTime);
        }
      }
    }

    if (Array.isArray(remoteDB.messages)) {
      this.mergeMessagesList(remoteDB.messages);
    }

    if (saveToLocal) this.saveLocalOnly();
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
      stats: {
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

  recordGameOutcome(playerName, opponentName, variant, didWin) {
    if (this.isAiPlayerName(playerName) || this.isAiPlayerName(opponentName)) return;
    if (!this.data) this.init();
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
    this.save();
  },

  recordSetOutcome(playerName, opponentName, didWin) {
    if (this.isAiPlayerName(playerName) || this.isAiPlayerName(opponentName)) return;
    if (!this.data) this.init();
    const user = this.getUser(playerName);
    if (!user) return;

    if (didWin) {
      user.stats.setsWon = (user.stats.setsWon || 0) + 1;
    } else {
      user.stats.setsLost = (user.stats.setsLost || 0) + 1;
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
    this.save();
  },

  // --- Global Player-to-Player Messaging System (v20) ---
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

  getLeaderboard() {
    if (!this.data) this.init();
    const list = Object.values(this.data.users).map(u => {
      const s = u.stats || {};
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
    return found ? { rank: found.rank, total: lb.length } : null;
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
        updatedAt: u.updatedAt || 0,
        stats: u.stats
      };
    });
    return {
      users: snapshot,
      messages: Array.isArray(this.data.messages) ? this.data.messages.slice(-200) : []
    };
  },

  mergePublicSnapshot(remoteSnapshot) {
    if (!remoteSnapshot || typeof remoteSnapshot !== "object") return;
    if (!this.data) this.init();
    let changed = false;

    const usersMap = remoteSnapshot.users || remoteSnapshot;
    Object.entries(usersMap).forEach(([k, remUser]) => {
      if (!remUser || !remUser.name || !remUser.stats) return;
      const localUser = this.data.users[k];
      if (!localUser) {
        this.data.users[k] = {
          name: remUser.name,
          pinHash: remUser.pinHash || null,
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
        if ((remUser.updatedAt || 0) > (localUser.updatedAt || 0)) {
          localUser.stats = remUser.stats;
          localUser.name = remUser.name;
          localUser.updatedAt = remUser.updatedAt;
          changed = true;
        }
      }
    });

    if (Array.isArray(remoteSnapshot.messages)) {
      const beforeLen = (this.data.messages || []).length;
      this.mergeMessagesList(remoteSnapshot.messages);
      if ((this.data.messages || []).length !== beforeLen) changed = true;
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