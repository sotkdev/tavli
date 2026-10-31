// Greek Tavli Online — Interactive Learn-to-Play Engine & Scenarios (tutorial.js — v20)

let tutVariant = "PORTES";
let tutStepIdx = 0;

const TUTORIAL_SCENARIOS = {
  PORTES: [
    {
      title: {
        en: "Portes 1/3: Building a Door (Porta) & Hitting a Blot",
        el: "Πόρτες 1/3: Χτίσιμο Πόρτας & Χτύπημα Μονού Πουλιού"
      },
      body: {
        en: "In Portes, you move from top-right (0) counter-clockwise to bottom-right (23). A single opponent checker is vulnerable ('blot'). You rolled 3 & 1: use your checkers on points 16 and 18 to hit Black's blot on point 19 AND stack a second checker on 19 to build a safe 'Porta' (Door)!",
        el: "Στις Πόρτες κινείστε από πάνω δεξιά (0) προς κάτω δεξιά (23). Ένα μονό αντίπαλο πούλι χτυπιέται και πάει στη Μπάρα. Φέρατε 3 & 1: κινήστε από το 16 και το 18 στο 19 για να χτυπήσετε το μαύρο πούλι ΚΑΙ να χτίσετε ασφαλή Πόρτα!"
      },
      tip: {
        en: "💡 Pro Tip: The 5-point (point 19 for White) is the most valuable point on the board. Securing it early blocks your opponent's escape!",
        el: "💡 Συμβουλή: Το «πεντάρι» (θέση 19) είναι η πιο στρατηγική πόρτα στο ταμπλό. Αν το πιάσετε νωρίς, εγκλωβίζετε τον αντίπαλο!"
      },
      dice: [3, 1],
      displayDice: [3, 1],
      setup: s => {
        s.points[0] = { owner: "W", count: 2, pinned: null };
        s.points[11] = { owner: "W", count: 5, pinned: null };
        s.points[16] = { owner: "W", count: 3, pinned: null };
        s.points[18] = { owner: "W", count: 5, pinned: null };
        s.points[19] = { owner: "B", count: 1, pinned: null };
        s.points[12] = { owner: "B", count: 5, pinned: null };
        s.points[5] = { owner: "B", count: 5, pinned: null };
      },
      checkSuccess: s => s.points[19].owner === "W" && s.points[19].count >= 2 && s.bar.B === 1,
      successMsg: {
        en: "✅ Awesome! You knocked Black to the Bar and locked Point 19 with a Porta! Click 'Next ▶' for Lesson 2.",
        el: "✅ Μπράβο! Στείλατε το μαύρο στη Μπάρα και κλειδώσατε την Πόρτα στο 19! Πατήστε «Επόμ. ▶»."
      }
    },
    {
      title: {
        en: "Portes 2/3: Re-Entering from the Bar",
        el: "Πόρτες 2/3: Είσοδος από τη Μπάρα"
      },
      body: {
        en: "When your checker is hit to the middle BAR, you MUST re-enter it into the opponent's home quadrant (top-right, points 0–5) before moving any other checker. You rolled 4 & 2: click your checker on the BAR to enter on point 3 (using the 4), then play your remaining 2!",
        el: "Όταν έχετε πούλι στη ΜΠΑΡΑ, ΠΡΕΠΕΙ να το βάλετε πρώτα στην περιοχή εκκίνησης (θέσεις 0–5) πριν κινήσετε άλλο πούλι. Φέρατε 4 & 2: πατήστε το πούλι σας στη ΜΠΑΡΑ για να μπείτε και παίξτε και το 2!"
      },
      tip: {
        en: "💡 Pro Tip: If your opponent builds 6 consecutive doors in their home board, a checker on the Bar is completely locked out until they open a point!",
        el: "💡 Συμβουλή: Αν ο αντίπαλος κάνει «εξάπορτο» στην περιοχή του, δεν μπορείτε να μπείτε από τη Μπάρα μέχρι να ανοίξει κάποια πόρτα!"
      },
      dice: [4, 2],
      displayDice: [4, 2],
      setup: s => {
        s.bar.W = 1;
        s.points[0] = { owner: "B", count: 2, pinned: null };
        s.points[1] = { owner: "B", count: 2, pinned: null };
        s.points[2] = { owner: "B", count: 2, pinned: null };
        s.points[4] = { owner: "B", count: 2, pinned: null };
        s.points[11] = { owner: "W", count: 5, pinned: null };
        s.points[18] = { owner: "W", count: 9, pinned: null };
      },
      checkSuccess: s => s.bar.W === 0 && s.dice.length === 0,
      successMsg: {
        en: "✅ Well done! You re-entered from the Bar onto the only open point. Click 'Next ▶' for Lesson 3.",
        el: "✅ Εξαιρετικά! Μπήκατε από τη Μπάρα στη μόνη ανοιχτή θέση. Πατήστε «Επόμ. ▶»."
      }
    },
    {
      title: {
        en: "Portes 3/3: Bearing Off (Smart Double-Tap)",
        el: "Πόρτες 3/3: Μάζεμα Πούλιων (Διπλό Πατήμα)"
      },
      body: {
        en: "Once all 15 of your checkers are inside your home quadrant (bottom-right, points 18–23), you can bear them OFF! You rolled 6 & 5: double-tap (or select and click OFF) the checkers on points 18 and 19 to bear off your final 2 checkers and win!",
        el: "Μόλις μαζέψετε και τα 15 πούλια σας στην περιοχή σας (κάτω δεξιά, θέσεις 18–23), μπορείτε να τα πάρετε ΕΞΩ! Φέρατε 6 & 5: κάντε διπλό κλικ στα πούλια στις θέσεις 18 και 19 για να τα βγάλετε έξω!"
      },
      tip: {
        en: "💡 Pro Tip: Bearing off all 15 checkers before your opponent bears off even 1 awards a 'Diplo' (+2 match points)!",
        el: "💡 Συμβουλή: Αν βγάλετε και τα 15 πούλια σας πριν ο αντίπαλος πάρει έστω και 1, κερδίζετε «Διπλό» (+2 πόντους)!"
      },
      dice: [6, 5],
      displayDice: [6, 5],
      setup: s => {
        s.off.W = 13;
        s.off.B = 4;
        s.points[18] = { owner: "W", count: 1, pinned: null };
        s.points[19] = { owner: "W", count: 1, pinned: null };
        s.points[0] = { owner: "B", count: 11, pinned: null };
      },
      checkSuccess: s => s.off.W === 15,
      successMsg: {
        en: "🎉 Portes Complete! Now click the 'Plakoto' tab above to learn Greek Plakoto!",
        el: "🎉 Ολοκληρώσατε τις Πόρτες! Πατήστε την καρτέλα «Plakoto» ψηλά για να μάθετε Πλακωτό!"
      }
    }
  ],
  PLAKOTO: [
    {
      title: {
        en: "Plakoto 1/3: Pinning (Trapping) an Opponent Checker",
        el: "Πλακωτό 1/3: Πλάκωμα Αντίπαλου Πουλιού"
      },
      body: {
        en: "In Plakoto, all 15 checkers start stacked on your bottom-right (point 23) and move to top-right (point 0). There is NO hitting to the Bar! Instead, landing on a lone opponent checker PINS (traps) it underneath yours. Roll 4 & 2: move from 23 to 19 to pin Black's checker, then stack a second checker on 19!",
        el: "Στο Πλακωτό ξεκινάτε με 15 πούλια κάτω δεξιά (23) και πάτε πάνω δεξιά (0). Δεν υπάρχει Μπάρα! Αν πατήσετε σε μονό αντίπαλο πούλι, το ΠΛΑΚΩΝΕΤΕ (εγκλωβίζετε). Με 4 & 2, κινήστε από το 23 στο 19 για να πλακώσετε το μαύρο πούλι!"
      },
      tip: {
        en: "💡 Pro Tip: A pinned point acts as your own Door (Porta), and the trapped opponent checker cannot move—nor can your opponent bear off while any of their checkers is pinned!",
        el: "💡 Συμβουλή: Ένα πλακωμένο πούλι αποτελεί δική σας Πόρτα, ενώ ο αντίπαλος ΔΕΝ μπορεί να μαζέψει πούλια όσο έχει έστω και 1 πλακωμένο πούλι!"
      },
      dice: [4, 2],
      displayDice: [4, 2],
      setup: s => {
        s.points[23] = { owner: "W", count: 14, pinned: null };
        s.points[21] = { owner: "W", count: 1, pinned: null };
        s.points[19] = { owner: "B", count: 1, pinned: null };
        s.points[0] = { owner: "B", count: 14, pinned: null };
      },
      checkSuccess: s => s.points[19].pinned === "B" && s.points[19].owner === "W",
      successMsg: {
        en: "✅ Pinned! Hear that deep thud? That checker is trapped until you move off point 19. Click 'Next ▶'!",
        el: "✅ Το πλακώσατε! Ακούσατε τον βαθύ ήχο; Το μαύρο πούλι είναι παγιδευμένο. Πατήστε «Επόμ. ▶»!"
      }
    },
    {
      title: {
        en: "Plakoto 2/3: Pinning the Mother Checker (Mana) for Instant +2 Win!",
        el: "Πλακωτό 2/3: Πιάσιμο της «Μάνας» για Άμεση Διπλή Νίκη (+2)!"
      },
      body: {
        en: "The last checker remaining on a player's starting point is called the 'Mana' (Mother checker). If your own Mana has already left base (23) and you pin the opponent's Mana on their starting point (0), you win the game INSTANTLY for 2 points! Move from point 3 to point 0 to pin Black's Mana!",
        el: "Το τελευταίο πούλι στην αρχική θέση λέγεται «Μάνα». Αν έχετε ήδη φύγει τη δική σας Μάνα (από το 23) και πλακώσετε τη Μάνα του αντιπάλου (στο 0), κερδίζετε ΑΜΕΣΩΣ Διπλό (+2)! Κινήστε από το 3 στο 0!"
      },
      tip: {
        en: "💡 Pro Tip: Never leave your Mana alone unless forced! Keep at least 2 checkers on your starting point until it is safe to run.",
        el: "💡 Συμβουλή: Μην αφήνετε ποτέ τη Μάνα σας μόνη αν υπάρχουν αντίπαλα πούλια κοντά! Κρατήστε τουλάχιστον 2 πούλια στην εκκίνηση."
      },
      dice: [3, 2],
      displayDice: [3, 2],
      setup: s => {
        s.points[3] = { owner: "W", count: 2, pinned: null };
        s.points[5] = { owner: "W", count: 13, pinned: null };
        s.points[0] = { owner: "B", count: 1, pinned: null };
        s.points[18] = { owner: "B", count: 14, pinned: null };
      },
      checkSuccess: s => s.points[0].pinned === "B",
      successMsg: {
        en: "🏆 MANA PINNED! In a real match, that's an instant +2 Diplo victory! Click 'Next ▶' for Lesson 3.",
        el: "🏆 ΠΙΑΣΤΗΚΕ Η ΜΑΝΑ! Σε κανονικό αγώνα αυτό δίνει άμεση νίκη +2 πόντων! Πατήστε «Επόμ. ▶»."
      }
    },
    {
      title: {
        en: "Plakoto 3/3: Releasing a Pin Safely",
        el: "Πλακωτό 3/3: Απελευθέρωση & Μάζεμα στο Πλακωτό"
      },
      body: {
        en: "In Plakoto, White bears off from the top-right quadrant (points 5 down to 0). You have 2 checkers left on point 4 and point 1. Double-tap both checkers using your 5 and 2 roll to bear off!",
        el: "Στο Πλακωτό, τα Λευκά μαζεύουν πάνω δεξιά (θέσεις 5 έως 0). Έχετε 2 τελευταία πούλια στις θέσεις 4 και 1. Κάντε διπλό κλικ και στα δύο με τη ζαριά 5 & 2 για να τα βγάλετε έξω!"
      },
      tip: {
        en: "💡 Pro Tip: When bearing off in Plakoto, avoid leaving a single blot if your opponent still has checkers waiting behind you in your home quadrant!",
        el: "💡 Συμβουλή: Όταν μαζεύετε στο Πλακωτό, προσέξτε να μην αφήσετε μονό πούλι αν ο αντίπαλος έχει ακόμα πούλια μέσα στην περιοχή σας!"
      },
      dice: [5, 2],
      displayDice: [5, 2],
      setup: s => {
        s.off.W = 13;
        s.off.B = 8;
        s.points[4] = { owner: "W", count: 1, pinned: null };
        s.points[1] = { owner: "W", count: 1, pinned: null };
        s.points[22] = { owner: "B", count: 7, pinned: null };
      },
      checkSuccess: s => s.off.W === 15,
      successMsg: {
        en: "🎉 Plakoto Complete! Now click the 'Fevga' tab above to master Fevga!",
        el: "🎉 Ολοκληρώσατε το Πλακωτό! Πατήστε την καρτέλα «Fevga» ψηλά για να μάθετε Φεύγα!"
      }
    }
  ],
  FEVGA: [
    {
      title: {
        en: "Fevga 1/3: The 'First Checker Must Pass' Rule",
        el: "Φεύγα 1/3: Ο Κανόνας του «Πρώτου Πουλιού»"
      },
      body: {
        en: "In Fevga, BOTH players move counter-clockwise in the same direction! White starts at top-right (point 0) and Black starts diagonally opposite at bottom-left (point 12). You may ONLY move 1 single starter checker until it crosses past Black's starting point (point 12)! Use your 6 & 6 roll to advance your first checker from point 0 -> 12 -> 18!",
        el: "Στο Φεύγα και οι δύο παίκτες κινούνται προς την ίδια κατεύθυνση! Ξεκινάτε με 15 πούλια στο 0, αλλά μπορείτε να κουνήσετε ΜΟΝΟ ΕΝΑ πούλι μέχρι να περάσει τη «μάνα» του αντιπάλου (θέση 12)! Κουνήστε το πρώτο πούλι με τις εξάρες!"
      },
      tip: {
        en: "💡 Pro Tip: In Fevga, even a SINGLE checker blocks a point completely! There is no hitting and no pinning.",
        el: "💡 Συμβουλή: Στο Φεύγα, ακόμα και ΕΝΑ ΜΟΝΟ πούλι κλείνει («πιάνει») τη θέση! Δεν υπάρχει ούτε χτύπημα ούτε πλάκωμα."
      },
      dice: [6, 6, 6, 6],
      displayDice: [6, 6],
      setup: s => {
        s.fevgaPassed = { W: false, B: false };
        s.points[0] = { owner: "W", count: 15, pinned: null };
        s.points[12] = { owner: "B", count: 15, pinned: null };
      },
      checkSuccess: s => s.fevgaPassed.W === true && s.points[0].count < 14,
      successMsg: {
        en: "✅ Your first checker passed point 12, unlocking the rest of your stack on point 0! Click 'Next ▶'!",
        el: "✅ Το πρώτο σας πούλι πέρασε το 12 και ξεκλείδωσε όλα τα υπόλοιπα πούλια σας στο 0! Πατήστε «Επόμ. ▶»!"
      }
    },
    {
      title: {
        en: "Fevga 2/3: The Temporary 6-Starting-Point Block Rule",
        el: "Φεύγα 2/3: Κανόνας Απαγόρευσης 6άρας στην Εκκίνηση"
      },
      body: {
        en: "In Fevga, you are forbidden from ending your turn occupying all 6 points of your starting quadrant (points 0–5), because that would permanently trap your opponent before they start! However, you CAN temporarily occupy all 6 if your second die unblocks one! Roll 1 & 4: move 0->1 (temporarily blocking all 6—watch the red warning banner!), then move 5->9 to unblock point 5!",
        el: "Στο Φεύγα απαγορεύεται να τελειώσετε τη σειρά σας έχοντας πιάσει και τις 6 πρώτες θέσεις (0–5). Επιτρέπεται όμως ΠΡΟΣΩΡΙΝΑ στην 1η κίνηση αν η 2η κίνηση ξεμπλοκάρει μία θέση! Παίξτε 0->1 (δείτε την προειδοποίηση!) και μετά 5->9!"
      },
      tip: {
        en: "💡 Pro Tip: Building a 5-point prime right outside your starting quadrant (e.g., points 2 to 7) is 100% legal and devastatingly strong!",
        el: "💡 Συμβουλή: Ενώ απαγορεύεται να κλείσετε και τις 6 θέσεις 0–5, μπορείτε νόμιμα να κλείσετε 6 συνεχόμενες θέσεις από το 1 έως το 6!"
      },
      dice: [1, 4],
      displayDice: [1, 4],
      setup: s => {
        s.fevgaPassed = { W: true, B: true };
        s.points[0] = { owner: "W", count: 10, pinned: null };
        s.points[2] = { owner: "W", count: 1, pinned: null };
        s.points[3] = { owner: "W", count: 1, pinned: null };
        s.points[4] = { owner: "W", count: 1, pinned: null };
        s.points[5] = { owner: "W", count: 1, pinned: null };
        s.points[14] = { owner: "W", count: 1, pinned: null };
        s.points[12] = { owner: "B", count: 15, pinned: null };
      },
      checkSuccess: s => s.dice.length === 0 && !isFevgaStartingPrimeOccupied(s, "W"),
      successMsg: {
        en: "✅ Masterclass! You used the temporary 6-block and unblocked point 5 before your turn ended! Click 'Next ▶'!",
        el: "✅ Άψογα! Κλείσατε προσωρινά τις 6 θέσεις και ξεμπλοκάρατε το 5 με τη δεύτερη ζαριά! Πατήστε «Επόμ. ▶»!"
      }
    },
    {
      title: {
        en: "Fevga 3/3: Controlling Key Corners & Bearing Off",
        el: "Φεύγα 3/3: Έλεγχος Γωνιών & Μάζεμα στο Φεύγα"
      },
      body: {
        en: "Just like Portes, White bears off in the bottom-right quadrant (points 18–23). Because single checkers cannot be hit in Fevga, spreading 1 checker onto each home point gives you maximum flexibility. Bear off your final 2 checkers on points 20 and 22 with your 4 & 2 roll!",
        el: "Όπως στις Πόρτες, τα Λευκά μαζεύουν κάτω δεξιά (18–23). Επειδή στο Φεύγα τα μονά πούλια δεν χτυπιούνται, απλώστε από 1 πούλι σε κάθε θέση για άνετο μάζεμα. Βγάλτε έξω τα 2 τελευταία πούλια (θέσεις 20 & 22) με 4 & 2!"
      },
      tip: {
        en: "💡 Pro Tip: In Fevga, try to occupy points in your opponent's home quadrant early to starve them of landing spots!",
        el: "💡 Συμβουλή: Στο Φεύγα, προσπαθήστε να πιάσετε γρήγορα θέσεις στην περιοχή μαζέματος του αντιπάλου για να του κόψετε τις ζαριές!"
      },
      dice: [4, 2],
      displayDice: [4, 2],
      setup: s => {
        s.fevgaPassed = { W: true, B: true };
        s.off.W = 13;
        s.off.B = 9;
        s.points[20] = { owner: "W", count: 1, pinned: null };
        s.points[22] = { owner: "W", count: 1, pinned: null };
        s.points[6] = { owner: "B", count: 6, pinned: null };
      },
      checkSuccess: s => s.off.W === 15,
      successMsg: {
        en: "🎓 Congratulations! You have mastered all 3 Greek Tavli games (Portes, Plakoto & Fevga)!",
        el: "🎓 Συγχαρητήρια! Έχετε μάθει και τα 3 παιχνίδια του Ελληνικού Ταβλιού (Πόρτες, Πλακωτό & Φεύγα)!"
      }
    }
  ]
};

function startInteractiveTutorial() {
  ensureAudio();
  isTutorialMode = true;
  isAiMatch = false;
  myRole = "W";
  tutVariant = "PORTES";
  tutStepIdx = 0;

  playerNames.W = myPlayerName || "Student";
  playerNames.B = "Coach";
  state.colors.W = myChosenColor || "white";
  state.colors.B = getDistinctFallbackColor(state.colors.W);
  state.requireEndTurn = false;
  state.autoRoll = false;

  document.getElementById("shareBtn").style.display = "none";
  document.getElementById("netStatus").textContent = t().netTutorialMode;
  updateSpectatorBadge(0);

  showScreen("GAME");
  if (typeof syncTutorialPanelPlacement === "function") {
    syncTutorialPanelPlacement();
  }
  loadTutorialScenario();
}

function selectTutorialVariant(v) {
  if (!["PORTES", "PLAKOTO", "FEVGA"].includes(v)) return;
  tutVariant = v;
  tutStepIdx = 0;
  loadTutorialScenario();
}

function changeTutorialStep(delta) {
  const list = TUTORIAL_SCENARIOS[tutVariant] || [];
  const next = tutStepIdx + delta;
  if (next < 0 || next >= list.length) return;
  tutStepIdx = next;
  loadTutorialScenario();
}

function resetCurrentTutorialScenario() {
  loadTutorialScenario();
}

function loadTutorialScenario() {
  const list = TUTORIAL_SCENARIOS[tutVariant] || [];
  const scen = list[tutStepIdx];
  if (!scen) return;

  ["PORTES", "PLAKOTO", "FEVGA"].forEach(v => {
    const tab = document.getElementById("tutTab_" + v);
    if (tab) tab.classList.toggle("active", v === tutVariant);
  });

  const langKey = (myLang === "el") ? "el" : "en";
  document.getElementById("tutStepCounter").textContent =
    myLang === "el" ? `Μάθημα ${tutStepIdx + 1} / ${list.length}` : `Lesson ${tutStepIdx + 1} / ${list.length}`;
  document.getElementById("btnTutPrev").disabled = (tutStepIdx <= 0);
  document.getElementById("btnTutNext").disabled = (tutStepIdx >= list.length - 1);

  document.getElementById("tutLessonTitle").textContent = scen.title[langKey] || scen.title.en;
  document.getElementById("tutLessonBody").textContent = scen.body[langKey] || scen.body.en;
  document.getElementById("tutTipBox").textContent = scen.tip[langKey] || scen.tip.en;

  state.variantSequence = [tutVariant];
  state.variantIdx = 0;
  state.phase = "PLAY";
  state.turn = "W";
  state.rolled = true;
  state.dice = [...scen.dice];
  state.displayDice = [...scen.displayDice];
  state.bar = { W: 0, B: 0 };
  state.off = { W: 0, B: 0 };
  state.fevgaPassed = { W: true, B: true };
  state.points = Array.from({ length: 24 }, () => ({ owner: null, count: 0, pinned: null }));

  scen.setup(state);
  turnHistory = [];
  selectedFrom = null;
  validTargets = [];
  render();
}

function checkTutorialStepCompletion() {
  if (!isTutorialMode) return false;
  const list = TUTORIAL_SCENARIOS[tutVariant] || [];
  const scen = list[tutStepIdx];
  if (!scen) return false;

  if (scen.checkSuccess(state)) {
    playWinFanfare();
    const langKey = (myLang === "el") ? "el" : "en";
    const msg = scen.successMsg[langKey] || scen.successMsg.en;
    document.getElementById("tutLessonBody").innerHTML = `<strong style="color:#00e676;">${escapeHtml(msg)}</strong>`;
    return true;
  }
  return false;
}