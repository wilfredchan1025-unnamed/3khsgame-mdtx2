'use strict';

const fs = require('fs');
const path = require('path');

// 1. 模擬瀏覽器全域環境，直接載入遊戲模組
global.window = global;
global.localStorage = { getItem: () => null, setItem: () => {} };
global.Sanguo = global.Sanguo || {};
global.Sanguo.Sound = new Proxy({}, { get: () => () => {} });

require('./constants.js');
require('./cards.js');
require('./engine.js');

const Sanguo = global.Sanguo;
const {
  CARD_DB,
  FACTION_LIST,
  DECK_SIZE,
  MAX_COPIES,
  MAX_SUB_FACTION_CARDS,
  SUB_FACTION_MAX_COST,
  createGameState,
  performMulligan,
  startTurn,
  getDeckForFaction
} = Sanguo;

// 2. 攔截出牌函式，記錄對局中實際打出的卡牌（不計算 AI 模擬分身）
let currentGameTracker = null;
const origPlayGeneral = Sanguo.playGeneral;
const origPlayTactic = Sanguo.playTactic;

Sanguo.playGeneral = function (G, pIdx, uid, slot) {
  const card = G.players[pIdx] && G.players[pIdx].hand.find(c => c.uid === uid);
  const ok = origPlayGeneral(G, pIdx, uid, slot);
  if (ok && card && currentGameTracker && !G.silent) {
    currentGameTracker[pIdx].played.add(card.id);
  }
  return ok;
};

Sanguo.playTactic = function (G, pIdx, uid, targetSlot) {
  const card = G.players[pIdx] && G.players[pIdx].hand.find(c => c.uid === uid);
  const ok = origPlayTactic(G, pIdx, uid, targetSlot);
  if (ok && card && currentGameTracker && !G.silent) {
    currentGameTracker[pIdx].played.add(card.id);
  }
  return ok;
};

require('./ai.js');
const { aiChooseMulligan, runAIStep } = Sanguo;

// 3. 隨機建立符合 v3.1 規則的 30 張雙勢力合法卡組
function buildRandomLegalDeck(mainFaction) {
  const subCandidates = FACTION_LIST.filter(f => f !== mainFaction);
  const subFaction = Math.random() < 0.7
    ? subCandidates[Math.floor(Math.random() * subCandidates.length)]
    : null;

  const mainAndNeuPool = Object.values(CARD_DB).filter(
    c => !c.token && (c.faction === mainFaction || c.faction === 'NEU')
  );
  const subPool = subFaction
    ? Object.values(CARD_DB).filter(
        c => !c.token && c.faction === subFaction && c.cost <= SUB_FACTION_MAX_COST
      )
    : [];

  const deck = [];
  const counts = {};
  let subCount = 0;

  while (deck.length < DECK_SIZE) {
    const useSub = subPool.length > 0 && subCount < MAX_SUB_FACTION_CARDS && Math.random() < 0.28;
    const pool = useSub ? subPool : mainAndNeuPool;
    const card = pool[Math.floor(Math.random() * pool.length)];
    if ((counts[card.id] || 0) >= MAX_COPIES) continue;

    deck.push(card.id);
    counts[card.id] = (counts[card.id] || 0) + 1;
    if (useSub) subCount += 1;
  }
  return deck;
}

const stats = {};
for (const card of Object.values(CARD_DB)) {
  if (card.token) continue;
  stats[card.id] = {
    id: card.id,
    name: card.name,
    faction: card.faction,
    type: card.type,
    cost: card.cost,
    deckGames: 0,
    deckWins: 0,
    drawnGames: 0,
    drawnWins: 0,
    playedGames: 0,
    playedWins: 0
  };
}

function recordHand(G, tracker) {
  for (let pIdx = 0; pIdx < 2; pIdx++) {
    for (const c of G.players[pIdx].hand) {
      if (!c.token) tracker[pIdx].drawn.add(c.id);
    }
  }
}

function runSingleGame(gameIndex, deckMode, p0Diff, p1Diff) {
  const f0 = FACTION_LIST[Math.floor(Math.random() * FACTION_LIST.length)];
  const f1 = FACTION_LIST[Math.floor(Math.random() * FACTION_LIST.length)];
  const firstPlayer = gameIndex % 2;

  const p0Deck = deckMode === 'starter' ? getDeckForFaction(f0) : buildRandomLegalDeck(f0);
  const p1Deck = deckMode === 'starter' ? getDeckForFaction(f1) : buildRandomLegalDeck(f1);

  const G = createGameState({
    mode: 'AI',
    p0Faction: f0,
    p1Faction: f1,
    firstPlayer,
    p0Deck,
    p1Deck
  });

  G.players[0].isAI = true;
  G.players[1].isAI = true;
  G.players[0].aiDifficulty = p0Diff;
  G.players[1].aiDifficulty = p1Diff;

  currentGameTracker = [
    { deck: new Set(p0Deck), drawn: new Set(), played: new Set() },
    { deck: new Set(p1Deck), drawn: new Set(), played: new Set() }
  ];

  if (G.phase === 'MULLIGAN') {
    performMulligan(G, 0, aiChooseMulligan(G, 0));
    performMulligan(G, 1, aiChooseMulligan(G, 1));
  }
  if (G.phase !== 'MAIN' && G.phase !== 'GAMEOVER') {
    startTurn(G, G.firstPlayer);
  }
  recordHand(G, currentGameTracker);

  let guardSteps = 0;
  const MAX_STEPS = 1200;
  while (G.phase !== 'GAMEOVER' && guardSteps < MAX_STEPS) {
    guardSteps += 1;
    const prevTurn = G.turnNumber;
    const stepped = runAIStep(G);
    recordHand(G, currentGameTracker);

    // 若既未執行動作、回合數也沒有推進，才視為卡住並跳出
    if (!stepped && G.turnNumber === prevTurn && G.phase !== 'GAMEOVER') {
      break;
    }
  }

  let winner = G.winner;
  if (winner === null || winner === undefined) {
    if (G.players[0].hp > G.players[1].hp) winner = 0;
    else if (G.players[1].hp > G.players[0].hp) winner = 1;
    else winner = 'DRAW';
  }

  for (let pIdx = 0; pIdx < 2; pIdx++) {
    const won = winner === pIdx ? 1 : 0;
    const t = currentGameTracker[pIdx];
    for (const id of t.deck) {
      if (!stats[id]) continue;
      stats[id].deckGames += 1;
      stats[id].deckWins += won;
    }
    for (const id of t.drawn) {
      if (!stats[id]) continue;
      stats[id].drawnGames += 1;
      stats[id].drawnWins += won;
    }
    for (const id of t.played) {
      if (!stats[id]) continue;
      stats[id].playedGames += 1;
      stats[id].playedWins += won;
    }
  }

  return winner;
}

// 用法：node simulate.js [場數=200] [模式=random|starter] [P0難度=normal] [P1難度=normal]
const TOTAL_GAMES = Number(process.argv[2]) || 200;
const DECK_MODE = process.argv[3] || 'random';
const P0_DIFF = process.argv[4] || 'normal';
const P1_DIFF = process.argv[5] || P0_DIFF;

const startTime = Date.now();
let p0Wins = 0, p1Wins = 0, draws = 0;

for (let i = 0; i < TOTAL_GAMES; i++) {
  const w = runSingleGame(i, DECK_MODE, P0_DIFF, P1_DIFF);
  if (w === 0) p0Wins += 1;
  else if (w === 1) p1Wins += 1;
  else draws += 1;
}

const pct = (wins, games) => (games > 0 ? ((wins / games) * 100).toFixed(2) + '%' : 'N/A');
const rows = [
  ['ID', '卡牌名稱', '勢力', '類型', '費用', '牌組場數', '牌組勝率', '抽到場數', '抽到勝率', '打出場數', '打出勝率'].join(',')
];

const sorted = Object.values(stats).sort((a, b) => {
  const rateA = a.drawnGames > 0 ? a.drawnWins / a.drawnGames : 0;
  const rateB = b.drawnGames > 0 ? b.drawnWins / b.drawnGames : 0;
  return rateB - rateA;
});

for (const s of sorted) {
  rows.push([
    s.id,
    s.name,
    s.faction,
    s.type,
    s.cost,
    s.deckGames,
    pct(s.deckWins, s.deckGames),
    s.drawnGames,
    pct(s.drawnWins, s.drawnGames),
    s.playedGames,
    pct(s.playedWins, s.playedGames)
  ].join(','));
}

const outPath = path.join(__dirname, 'card_winrates.csv');
fs.writeFileSync(outPath, '\uFEFF' + rows.join('\n'), 'utf8');

const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
console.log(`模擬完成：共 ${TOTAL_GAMES} 場（模式: ${DECK_MODE}，難度: ${P0_DIFF} vs ${P1_DIFF}，耗時 ${elapsed}s）`);
console.log(`結果分佈：P0 勝 ${p0Wins} / P1 勝 ${p1Wins} / 平局 ${draws}`);
console.log(`報表已輸出至：${outPath}`);