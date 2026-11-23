(function (global) {
  'use strict';

  const {
    FACTIONS, FACTION_LIST, BOARD_SIZE, SLOT_NAMES, MAX_HAND_SIZE, MAX_RESERVE_FOOD, MAX_SUB_FACTION_CARDS, SUB_FACTION_MAX_COST, DECK_SIZE, MAX_COPIES,
    isCountering, CARD_DB, STARTER_DECKS, customDecks, validateDeck,
    getDeckForFaction, saveCustomDeck, Sound,
    getUnitAtk, getUnitMaxAttacks, unitHasGuard, isProtectedByAdjacentGuard, canUnitAttack, createGameState,
    getTotalFood, performMulligan, getValidAttackTargets, canPlayCard,
    playGeneral, playTactic, executeAttack, endTurn,
    aiChooseMulligan, runAIStep
  } = global.Sanguo;

  const UI = {
    screen: 'LOBBY',
    lobbyMode: 'AI',
    p0Faction: 'SHU',
    p1Faction: 'WEI',
    firstChoice: 'RANDOM',
    G: null,
    selectedHandUid: null,
    selectedAttackerSlot: null,
    mulliganSelected: new Set(),
    hotseatPrivacyFor: null,
    showLogDrawer: false,
    aiTimer: null,
    dbFaction: 'SHU',
    dbSubFaction: null,
    dbCards: [],
    compFaction: 'ALL',
    compType: 'ALL',
    onlineRole: null,
    onlineRoomCode: '',
    onlineInputCode: '',
    onlineStatus: 'IDLE',
    onlineError: '',
    onlinePeer: null,
    onlineConn: null,
    onlineGuestFaction: null,
    onlineGuestDeck: null
  };

  function showToast(msg, tone = 'gold') {
    const box = document.getElementById('toast-container');
    if (!box) return;
    const el = document.createElement('div');
    const colors = tone === 'error'
      ? 'bg-red-950/95 border-red-500/70 text-red-100'
      : tone === 'success'
      ? 'bg-emerald-950/95 border-emerald-500/70 text-emerald-100'
      : 'bg-slate-900/95 border-amber-500/60 text-amber-100';
    el.className = `px-4 py-2 rounded-lg border text-sm font-medium shadow-xl transition-all duration-300 ${colors}`;
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-6px)';
      setTimeout(() => el.remove(), 260);
    }, 2200);
  }


  function ensureFxStyles() {
    if (document.getElementById('sanguo-v21-fx')) return;
    const style = document.createElement('style');
    style.id = 'sanguo-v21-fx';
    style.textContent = `
      @keyframes sgLungeUp {
        0% { transform: translateY(0) scale(1); }
        38% { transform: translateY(-28px) scale(1.07); box-shadow: 0 0 24px rgba(251,191,36,0.75); }
        100% { transform: translateY(0) scale(1); }
      }
      @keyframes sgLungeDown {
        0% { transform: translateY(0) scale(1); }
        38% { transform: translateY(28px) scale(1.07); box-shadow: 0 0 24px rgba(244,63,94,0.75); }
        100% { transform: translateY(0) scale(1); }
      }
      @keyframes sgHitShake {
        0%, 100% { transform: translateX(0); }
        18% { transform: translateX(-8px) rotate(-1.5deg); box-shadow: 0 0 22px rgba(244,63,94,0.85); }
        42% { transform: translateX(8px) rotate(1.5deg); }
        68% { transform: translateX(-5px); }
        85% { transform: translateX(4px); }
      }
      @keyframes sgCounterHit {
        0%, 100% { transform: translateX(0); }
        20% { transform: translateX(-9px) scale(1.03); box-shadow: 0 0 28px rgba(251,191,36,0.95); }
        50% { transform: translateX(9px); }
        75% { transform: translateX(-4px); }
      }
      @keyframes sgDeathBurst {
        0% { opacity: 0.96; transform: scale(1); filter: saturate(1); }
        35% { opacity: 0.9; transform: scale(1.06) rotate(-2deg); filter: grayscale(0.7) brightness(1.3); }
        100% { opacity: 0; transform: scale(0.72) translateY(10px); filter: grayscale(1) blur(2px); }
      }
      @keyframes sgKillPulse {
        0% { box-shadow: 0 0 0 0 rgba(251,191,36,0.85); }
        50% { box-shadow: 0 0 26px 6px rgba(251,191,36,0.65); }
        100% { box-shadow: 0 0 0 0 rgba(251,191,36,0); }
      }
      @keyframes sgTacticBanner {
        0% { opacity: 0; transform: translate(-50%, -44%) scale(0.84); }
        14% { opacity: 1; transform: translate(-50%, -50%) scale(1.03); }
        22% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        82% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -56%) scale(0.95); }
      }
      @keyframes sgTacticTargetFlash {
        0% { box-shadow: 0 0 0 0 rgba(56,189,248,0.9); }
        45% { box-shadow: 0 0 24px 6px rgba(56,189,248,0.8); }
        100% { box-shadow: 0 0 0 0 rgba(56,189,248,0); }
      }
      .anim-lunge-up { animation: sgLungeUp 0.44s cubic-bezier(0.22, 1, 0.36, 1); z-index: 20; }
      .anim-lunge-down { animation: sgLungeDown 0.44s cubic-bezier(0.22, 1, 0.36, 1); z-index: 20; }
      .anim-hit-shake { animation: sgHitShake 0.44s ease-out; }
      .anim-counter-hit { animation: sgCounterHit 0.48s ease-out; }
      .anim-death-ghost { animation: sgDeathBurst 0.62s ease-out forwards; pointer-events: none; }
      .anim-kill-pulse { animation: sgKillPulse 0.65s ease-out; }
      .anim-tactic-target { animation: sgTacticTargetFlash 0.7s ease-out; }
      .tactic-showcase-card {
        position: fixed;
        top: 48%;
        left: 50%;
        z-index: 70;
        pointer-events: none;
        animation: sgTacticBanner 1.45s cubic-bezier(0.22, 1, 0.36, 1) forwards;
      }
    `;
    document.head.appendChild(style);
  }

  function showTacticShowcase(evt) {
    ensureFxStyles();
    const viewIdx = getViewingPlayerIdx();
    const isMine = evt.owner === viewIdx;
    const c = evt.card;
    const f = FACTIONS[c.faction] || FACTIONS.NEU;
    let root = document.getElementById('tactic-banner-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'tactic-banner-root';
      document.body.appendChild(root);
    }
    const el = document.createElement('div');
    el.className = 'tactic-showcase-card w-[290px] sm:w-[340px] rounded-2xl border-2 p-4 shadow-2xl backdrop-blur-md ' +
      (isMine
        ? 'bg-gradient-to-b from-[#1a2438]/95 to-[#0f1524]/95 border-amber-400/90'
        : 'bg-gradient-to-b from-[#2b141c]/95 to-[#140d14]/95 border-rose-400/90');
    el.innerHTML = `
      <div class="flex items-center justify-between gap-2 mb-2">
        <span class="px-2 py-0.5 rounded-full text-[11px] font-extrabold ${isMine ? 'bg-amber-400 text-slate-950' : 'bg-rose-500 text-white'}">
          ${isMine ? '✨ 我方施放謀略' : '🔥 敵軍施放謀略'}（${evt.ownerName}）
        </span>
        <span class="px-2 py-0.5 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-400/40">${c.cost} 糧</span>
      </div>
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-slate-900/90 border border-slate-700 flex items-center justify-center text-2xl shrink-0 shadow-inner">${c.icon}</div>
        <div class="min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="font-serif-tc text-lg font-extrabold text-amber-50 truncate">${c.name}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${f.badgeBg}">${f.name}</span>
          </div>
          <p class="text-xs text-slate-200 mt-1 leading-relaxed">${c.text}</p>
        </div>
      </div>
    `;
    root.innerHTML = '';
    root.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 1500);
  }


  // --- Online 1v1 Multiplayer (PeerJS WebRTC, Host-Authoritative) ---
  const PEER_PREFIX = 'sanguo-mdtx-room-';
  let peerJsPromise = null;

  function ensurePeerJsLoaded() {
    if (global.Peer) return Promise.resolve(global.Peer);
    if (peerJsPromise) return peerJsPromise;
    peerJsPromise = new Promise((resolve, reject) => {
      const urls = [
        'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
        'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js'
      ];
      let idx = 0;
      function tryLoad() {
        if (idx >= urls.length) {
          peerJsPromise = null;
          reject(new Error('無法載入連線模組（請確認網路連線正常）'));
          return;
        }
        const s = document.createElement('script');
        s.src = urls[idx++];
        s.async = true;
        s.onload = () => global.Peer ? resolve(global.Peer) : tryLoad();
        s.onerror = () => tryLoad();
        document.head.appendChild(s);
      }
      tryLoad();
    });
    return peerJsPromise;
  }

  function cleanupOnlineSession() {
    try { if (UI.onlineConn) UI.onlineConn.close(); } catch (_) {}
    try { if (UI.onlinePeer) UI.onlinePeer.destroy(); } catch (_) {}
    UI.onlineConn = null;
    UI.onlinePeer = null;
    UI.onlineRole = null;
    UI.onlineRoomCode = '';
    UI.onlineStatus = 'IDLE';
    UI.onlineError = '';
    UI.onlineGuestFaction = null;
    UI.onlineGuestDeck = null;
  }

  function maskStateForGuest(G) {
    const clone = JSON.parse(JSON.stringify(G));
    // Hide Host (player 0) hand & both decks from Guest
    clone.players[0].hand = clone.players[0].hand.map((_, i) => ({ uid: -1000 - i, hidden: true }));
    clone.players[0].deck = new Array(clone.players[0].deck.length).fill(null);
    clone.players[1].deck = new Array(clone.players[1].deck.length).fill(null);
    return clone;
  }

  function syncOnlineStateAndRender() {
    if (UI.G && UI.G.mode === 'ONLINE' && UI.onlineRole === 'HOST' && UI.onlineConn && UI.onlineConn.open) {
      try {
        UI.onlineConn.send({ type: 'STATE', state: maskStateForGuest(UI.G) });
      } catch (err) {
        console.error('Online state sync failed:', err);
      }
    }
    render();
  }

  function sendGuestAction(action, payload) {
    if (!UI.onlineConn || !UI.onlineConn.open) {
      showToast('連線已中斷，無法傳送指令', 'error');
      return false;
    }
    UI.onlineConn.send({ type: 'ACTION', action, payload });
    return true;
  }

  function startOnlineHostMatch() {
    clearAiTimer();
    let first = 0;
    if (UI.firstChoice === 'RANDOM') first = Math.random() < 0.5 ? 0 : 1;
    else if (UI.firstChoice === 'P1') first = 1;

    UI.G = createGameState({
      mode: 'ONLINE',
      p0Faction: UI.p0Faction,
      p1Faction: UI.onlineGuestFaction || 'WEI',
      firstPlayer: first,
      p0Deck: getDeckForFaction(UI.p0Faction),
      p1Deck: UI.onlineGuestDeck || getDeckForFaction(UI.onlineGuestFaction || 'WEI')
    });
    UI.screen = 'GAME';
    UI.selectedHandUid = null;
    UI.selectedAttackerSlot = null;
    UI.mulliganSelected = new Set();
    UI.hotseatPrivacyFor = null;
    Sound.playTurn();
    syncOnlineStateAndRender();
  }

  function handleHostIncoming(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'HELLO') {
      UI.onlineGuestFaction = FACTION_LIST.includes(msg.faction) ? msg.faction : 'WEI';
      UI.onlineGuestDeck = Array.isArray(msg.deck) && validateDeck(UI.onlineGuestFaction, msg.deck).valid
        ? msg.deck
        : getDeckForFaction(UI.onlineGuestFaction);
      UI.onlineStatus = 'CONNECTED';
      showToast('好友已加入房間，對戰開始！', 'success');
      startOnlineHostMatch();
      return;
    }
    if (msg.type === 'REMATCH_REQ') {
      showToast('對手發起再戰一局！', 'success');
      startOnlineHostMatch();
      return;
    }
    if (msg.type === 'ACTION' && UI.G) {
      const G = UI.G;
      const p = msg.payload || {};
      if (msg.action === 'MULLIGAN' && G.phase === 'MULLIGAN' && G.mulliganActor === 1) {
        performMulligan(G, 1, Array.isArray(p.selectedUids) ? p.selectedUids : []);
        syncOnlineStateAndRender();
        return;
      }
      if (G.phase !== 'MAIN' || G.activePlayer !== 1) return;
      if (msg.action === 'PLAY_GENERAL') {
        if (playGeneral(G, 1, p.cardUid, p.slotIdx)) syncOnlineStateAndRender();
      } else if (msg.action === 'PLAY_TACTIC') {
        if (playTactic(G, 1, p.cardUid, p.targetSlot ?? null)) syncOnlineStateAndRender();
      } else if (msg.action === 'ATTACK') {
        if (executeAttack(G, 1, p.attackerSlot, p.targetType, p.targetSlot ?? null)) syncOnlineStateAndRender();
      } else if (msg.action === 'END_TURN') {
        endTurn(G);
        syncOnlineStateAndRender();
      }
    }
  }

  function handleGuestIncoming(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'STATE' && msg.state) {
      const prevPhase = UI.G ? UI.G.phase : null;
      const prevTurn = UI.G ? UI.G.turnNumber : 0;
      UI.G = msg.state;
      UI.screen = 'GAME';
      UI.onlineStatus = 'CONNECTED';
      if (prevPhase !== 'GAME' && UI.G.turnNumber !== prevTurn) {
        Sound.playTurn();
      }
      if (UI.G.phase === 'MAIN' && UI.G.activePlayer !== 1) {
        UI.selectedHandUid = null;
        UI.selectedAttackerSlot = null;
      }
      render();
    }
  }

  async function hostOnlineRoom() {
    cleanupOnlineSession();
    UI.onlineRole = 'HOST';
    UI.onlineStatus = 'LOADING';
    UI.onlineError = '';
    render();
    try {
      const Peer = await ensurePeerJsLoaded();
      const code = String(Math.floor(1000 + Math.random() * 9000));
      UI.onlineRoomCode = code;
      const peer = new Peer(PEER_PREFIX + code);
      UI.onlinePeer = peer;

      peer.on('open', () => {
        UI.onlineStatus = 'WAITING';
        render();
      });
      peer.on('connection', (conn) => {
        if (UI.onlineConn && UI.onlineConn.open) {
          conn.close();
          return;
        }
        UI.onlineConn = conn;
        conn.on('data', handleHostIncoming);
        conn.on('close', () => {
          showToast('好友已離開房間或連線中斷', 'error');
          UI.onlineStatus = 'WAITING';
          render();
        });
      });
      peer.on('error', (err) => {
        UI.onlineStatus = 'ERROR';
        UI.onlineError = '建立房間失敗：' + (err && err.type ? err.type : '連線異常，請重試');
        render();
      });
    } catch (err) {
      UI.onlineStatus = 'ERROR';
      UI.onlineError = err.message || '無法載入連線服務';
      render();
    }
  }

  async function joinOnlineRoom(rawCode) {
    const code = String(rawCode || '').replace(/[^0-9]/g, '').slice(0, 6);
    if (code.length < 4) {
      showToast('請輸入 4 位數字房號', 'error');
      return;
    }
    cleanupOnlineSession();
    UI.onlineRole = 'GUEST';
    UI.onlineRoomCode = code;
    UI.onlineInputCode = code;
    UI.onlineStatus = 'CONNECTING';
    UI.onlineError = '';
    render();
    try {
      const Peer = await ensurePeerJsLoaded();
      const peer = new Peer();
      UI.onlinePeer = peer;
      peer.on('open', () => {
        const conn = peer.connect(PEER_PREFIX + code, { reliable: true });
        UI.onlineConn = conn;
        conn.on('open', () => {
          conn.send({
            type: 'HELLO',
            faction: UI.p0Faction,
            deck: getDeckForFaction(UI.p0Faction)
          });
        });
        conn.on('data', handleGuestIncoming);
        conn.on('close', () => {
          showToast('與房主的連線已中斷', 'error');
          UI.onlineStatus = 'ERROR';
          UI.onlineError = '與房主的連線已中斷';
          render();
        });
        conn.on('error', () => {
          UI.onlineStatus = 'ERROR';
          UI.onlineError = '無法連接至該房號，請確認房號是否正確';
          render();
        });
      });
      peer.on('error', (err) => {
        UI.onlineStatus = 'ERROR';
        UI.onlineError = err && err.type === 'peer-unavailable'
          ? `找不到房號 ${code}，請確認房主已建立房間`
          : '連線發生錯誤，請重新嘗試';
        render();
      });
    } catch (err) {
      UI.onlineStatus = 'ERROR';
      UI.onlineError = err.message || '無法載入連線服務';
      render();
    }
  }

  function clearAiTimer() {
    if (UI.aiTimer) {
      clearTimeout(UI.aiTimer);
      UI.aiTimer = null;
    }
  }

  function scheduleAITurnIfNeeded() {
    clearAiTimer();
    const G = UI.G;
    if (!G) return;

    if (G.phase === 'MULLIGAN' && G.players[G.mulliganActor].isAI) {
      UI.aiTimer = setTimeout(() => {
        const swaps = aiChooseMulligan(G, G.mulliganActor);
        performMulligan(G, G.mulliganActor, swaps);
        render();
        scheduleAITurnIfNeeded();
      }, 550);
      return;
    }

    if (G.phase === 'MAIN' && G.players[G.activePlayer].isAI) {
      const delay = UI._nextAiDelay || 720;
      UI._nextAiDelay = 720;
      UI.aiTimer = setTimeout(() => {
        const acted = runAIStep(G);
        const hadTactic = Boolean(G.animEvents && G.animEvents.some(a => a.kind === 'tactic'));
        render();
        if (acted && G.phase === 'MAIN' && G.players[G.activePlayer].isAI) {
          UI._nextAiDelay = hadTactic ? 1550 : 820;
          scheduleAITurnIfNeeded();
        }
      }, delay);
    }
  }

  function startNewMatch() {
    clearAiTimer();
    let first = 0;
    if (UI.firstChoice === 'RANDOM') first = Math.random() < 0.5 ? 0 : 1;
    else if (UI.firstChoice === 'P1') first = 1;

    UI.G = createGameState({
      mode: UI.lobbyMode,
      p0Faction: UI.p0Faction,
      p1Faction: UI.p1Faction,
      firstPlayer: first
    });
    UI.screen = 'GAME';
    UI.selectedHandUid = null;
    UI.selectedAttackerSlot = null;
    UI.mulliganSelected = new Set();
    UI.hotseatPrivacyFor = UI.lobbyMode === 'HOTSEAT' ? first : null;
    Sound.playTurn();
    render();
    scheduleAITurnIfNeeded();
  }

  function getViewingPlayerIdx() {
    const G = UI.G;
    if (!G) return 0;
    if (G.mode === 'AI') return 0;
    if (G.mode === 'ONLINE') return UI.onlineRole === 'GUEST' ? 1 : 0;
    if (G.phase === 'MULLIGAN') return G.mulliganActor;
    return G.activePlayer;
  }

  function keywordBadgeHtml(kw) {
    if (kw === 'COMBO') return `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40">連擊</span>`;
    if (kw === 'KILL') return `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-400/40">斬殺</span>`;
    if (kw === 'ARMOR') return `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-400/40">護甲</span>`;
    if (kw === 'GUARD') return `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/25 text-indigo-200 border border-indigo-400/50">守護</span>`;
    if (kw === 'RUSH') return `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">突襲</span>`;
    if (kw === 'DEATHRATTLE') return `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-400/40">遺計</span>`;
    if (kw === 'SNIPE') return `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">狙擊</span>`;
    return '';
  }

  function openRulebookModal() {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" data-close-modal="1">
        <div class="bg-[#141923] gold-border rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden" onclick="event.stopPropagation()">
          <div class="px-5 py-4 border-b border-amber-500/25 flex items-center justify-between bg-[#1b2230]">
            <h2 class="font-serif-tc text-xl font-bold text-amber-300">《三國·謀定天下》完整遊戲規則手冊（v2.0）</h2>
            <button type="button" data-close-modal="1" class="text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800">✕</button>
          </div>
          <div class="p-5 overflow-y-auto space-y-4 text-sm text-slate-200 leading-relaxed">
            <section>
              <h3 class="font-bold text-amber-300 mb-1">一、遊戲概述與勝利條件</h3>
              <ul class="list-disc pl-5 space-y-1 text-slate-300">
                <li>雙方初始國力各 <b>30 點</b>，初始牌庫 <b>30 張</b>（同名最多 2 張；1 主陣營 + 最多 1 副陣營上限 10 張且限 ≤4 費 + 中立）。</li>
                <li>先手初始手牌 <b>3 張</b>，後手 <b>4 張</b>；開局前雙方皆可進行<b>起手調度（Mulligan）</b>。</li>
                <li>率先將敵方國力降至 <b>0 或以下</b>者勝；若雙方牌庫耗盡且同時無法行動，剩餘國力較高者勝。</li>
              </ul>
            </section>
            <section>
              <h3 class="font-bold text-amber-300 mb-1">二、五格戰場與🛡️相鄰守護機制</h3>
              <ul class="list-disc pl-5 space-y-1 text-slate-300">
                <li>手牌上限 <b>10 張</b>，超出上限直接進入墓地（爆牌）。</li>
                <li>每位玩家擁有 <b>5 個上陣位</b>：<b>1號位左翼、2號位左輔、3號位中軍、4號位右輔、5號位右翼</b>。所有位置平等，不再設有固定站位保護。</li>
                <li><b>相鄰守護機制：</b>僅帶有「<b>守護</b>」關鍵字的武將會保護與其相鄰（左一格與右一格）的非守護友軍免受敵方普通攻擊；狙擊與謀略牌不受此限。</li>
                <li>敵方前排 3 個上陣位全空時，武將方可直接攻擊敵方國力。</li>
              </ul>
            </section>
            <section>
              <h3 class="font-bold text-amber-300 mb-1">三、糧草與回合流程</h3>
              <ul class="list-disc pl-5 space-y-1 text-slate-300">
                <li>每回合開始時當前糧草上限 +1（上限 10）並充滿；後手第 1 回合額外獲得 0 費謀略【急行軍】（臨時 +1 糧草）。</li>
                <li><b>1. 抽牌階段：</b>抽 1 張牌（先手第 1 回合不抽牌），解除整備並重置護甲。</li>
                <li><b>2. 主要階段：</b>自由交替打出武將牌、謀略牌與發動攻擊。</li>
                <li><b>3. 結束階段：</b>清除未使用臨時糧草；未使用的普通糧草自動存入「<b>糧倉</b>」（上限 3 點，僅可用於打出謀略牌或觸發強化效果），並結算持續效果。</li>
                <li><b>4. 換手：</b>輪到對手回合。</li>
              </ul>
            </section>
            <section>
              <h3 class="font-bold text-amber-300 mb-1">四、武將戰鬥、陣營克制與關鍵字</h3>
              <ul class="list-disc pl-5 space-y-1 text-slate-300">
                <li><b>整備狀態：</b>武將剛上場無法攻擊，但會觸發「登場時」效果；下個己方回合解除整備。</li>
                <li><b>反擊傷害：</b>武將交戰時，防守方會同時造成等同攻擊力的反擊傷害。</li>
                <li><b>陣營克制（+1 傷害）：</b><span class="text-emerald-300 font-semibold">蜀</span> → <span class="text-purple-300 font-semibold">群</span> → <span class="text-blue-300 font-semibold">魏</span> → <span class="text-red-300 font-semibold">吳</span> → <span class="text-emerald-300 font-semibold">蜀</span>。</li>
                <li><b>斬殺：</b>擊殺敵方武將時觸發額外效果｜<b>連擊：</b>每回合可主動攻擊兩次｜<b>護甲：</b>抵擋等同數值傷害，每回合開始重置。</li>
              </ul>
            </section>
          </div>
          <div class="px-5 py-3 border-t border-slate-800 bg-[#11151e] flex justify-end">
            <button type="button" data-close-modal="1" class="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-sm">了解規則</button>
          </div>
        </div>
      </div>
    `;
  }

  function openGraveyardModal(pIdx) {
    const p = UI.G.players[pIdx];
    const root = document.getElementById('modal-root');
    const items = p.graveyard.length === 0
      ? `<p class="text-slate-400 text-sm py-8 text-center">墓地目前空無一物。</p>`
      : `<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          ${p.graveyard.slice().reverse().map(c => {
            const f = FACTIONS[c.faction];
            return `
              <div class="p-3 rounded-xl bg-slate-900/90 border border-slate-700/70 flex items-start gap-3">
                <div class="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-lg shrink-0">${c.icon}</div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="font-bold text-slate-100 text-sm">${c.name}</span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded border ${f.badgeBg}">${f.name}</span>
                    <span class="text-xs text-amber-300 ml-auto">${c.cost} 糧</span>
                  </div>
                  <p class="text-xs text-slate-400 mt-1">${c.text}</p>
                </div>
              </div>
            `;
          }).join('')}
        </div>`;
    root.innerHTML = `
      <div class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" data-close-modal="1">
        <div class="bg-[#141923] gold-border rounded-2xl max-w-xl w-full max-h-[80vh] flex flex-col shadow-2xl overflow-hidden" onclick="event.stopPropagation()">
          <div class="px-5 py-3.5 border-b border-amber-500/25 flex items-center justify-between bg-[#1b2230]">
            <h2 class="font-serif-tc text-lg font-bold text-amber-300">${p.name} 的墓地（${p.graveyard.length} 張）</h2>
            <button type="button" data-close-modal="1" class="text-slate-400 hover:text-white px-2 py-1 rounded">✕</button>
          </div>
          <div class="p-4 overflow-y-auto">${items}</div>
        </div>
      </div>
    `;
  }


  function openCompendiumModal() {
    const root = document.getElementById('modal-root');
    const fac = UI.compFaction || 'ALL';
    const typ = UI.compType || 'ALL';

    const allCards = Object.values(CARD_DB).filter(c => {
      if (fac !== 'ALL' && c.faction !== fac) return false;
      if (typ !== 'ALL' && c.type !== typ) return false;
      return true;
    }).sort((a, b) => {
      const fOrder = { SHU: 0, WEI: 1, WU: 2, QUN: 3, NEU: 4 };
      return (a.token ? 1 : 0) - (b.token ? 1 : 0)
        || (fOrder[a.faction] ?? 9) - (fOrder[b.faction] ?? 9)
        || a.cost - b.cost;
    });

    const facTabs = [
      { id: 'ALL', label: '全部陣營' },
      { id: 'SHU', label: '蜀' },
      { id: 'WEI', label: '魏' },
      { id: 'WU', label: '吳' },
      { id: 'QUN', label: '群' },
      { id: 'NEU', label: '中立' }
    ];
    const typeTabs = [
      { id: 'ALL', label: '全部類型' },
      { id: 'GENERAL', label: '⚔️ 武將' },
      { id: 'TACTIC', label: '📜 謀略' }
    ];

    root.innerHTML = `
      <div class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4" data-close-modal="1">
        <div class="bg-[#141923] gold-border rounded-2xl max-w-5xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden" onclick="event.stopPropagation()">
          <div class="px-5 py-3.5 border-b border-amber-500/25 flex flex-wrap items-center justify-between gap-2 bg-[#1b2230]">
            <div class="flex items-center gap-2.5">
              <h2 class="font-serif-tc text-lg sm:text-xl font-bold text-amber-300">📚 全卡牌圖鑑</h2>
              <span class="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-200 border border-amber-400/40">顯示 ${allCards.length} 張</span>
            </div>
            <button type="button" data-close-modal="1" class="text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800">✕</button>
          </div>

          <div class="px-5 py-3 bg-[#101520] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div class="flex flex-wrap gap-1.5">
              ${facTabs.map(t => `
                <button type="button" data-comp-faction="${t.id}" class="px-2.5 py-1 rounded-lg text-xs font-bold border transition ${fac === t.id ? 'bg-amber-500 text-slate-950 border-amber-300' : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'}">
                  ${t.label}
                </button>
              `).join('')}
            </div>
            <div class="flex gap-1.5">
              ${typeTabs.map(t => `
                <button type="button" data-comp-type="${t.id}" class="px-2.5 py-1 rounded-lg text-xs font-bold border transition ${typ === t.id ? 'bg-indigo-500 text-white border-indigo-300' : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'}">
                  ${t.label}
                </button>
              `).join('')}
            </div>
          </div>

          <div class="p-4 sm:p-5 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            ${allCards.map(c => {
              const f = FACTIONS[c.faction] || FACTIONS.NEU;
              return `
                <div class="p-3 rounded-xl bg-[#181f2d] border border-slate-700/80 flex flex-col justify-between gap-2">
                  <div>
                    <div class="flex items-center justify-between gap-2">
                      <div class="flex items-center gap-2 min-w-0">
                        <span class="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-base shrink-0">${c.icon}</span>
                        <div class="min-w-0">
                          <div class="flex items-center gap-1.5">
                            <span class="font-serif-tc font-bold text-sm text-amber-50 truncate">${c.name}</span>
                            ${c.token ? `<span class="text-[9px] px-1 py-0.5 rounded bg-slate-700 text-slate-300">衍生</span>` : ''}
                          </div>
                          <div class="flex items-center gap-1 mt-0.5">
                            <span class="text-[10px] px-1.5 py-0.5 rounded border ${f.badgeBg}">${f.name}</span>
                            <span class="text-[10px] text-slate-400">${c.type === 'GENERAL' ? '武將' : '謀略'}</span>
                          </div>
                        </div>
                      </div>
                      <span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black shrink-0">${c.cost} 糧</span>
                    </div>
                    <div class="flex flex-wrap items-center gap-1.5 mt-2">
                      ${c.type === 'GENERAL' ? `
                        <span class="text-[11px] font-extrabold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded">⚔️ ${c.atk}</span>
                        <span class="text-[11px] font-extrabold text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded">❤️ ${c.hp}</span>
                        ${c.armor ? `<span class="text-[11px] font-extrabold text-sky-300 bg-sky-500/15 px-1.5 py-0.5 rounded">🛡️ ${c.armor}</span>` : ''}
                      ` : ''}
                      ${(c.keywords || []).map(keywordBadgeHtml).join('')}
                    </div>
                    <p class="text-xs text-slate-200 mt-2 leading-relaxed">${c.text}</p>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function closeModal() {
    const root = document.getElementById('modal-root');
    if (root) root.innerHTML = '';
  }

  function renderLobby() {
    const renderFactionCards = (selected, targetKey) => FACTION_LIST.map(fid => {
      const f = FACTIONS[fid];
      const isSel = selected === fid;
      const deckCount = getDeckForFaction(fid).length;
      const isCustom = Boolean(customDecks[fid]);
      return `
        <button type="button" data-pick-faction="${targetKey}:${fid}"
          class="text-left p-3.5 rounded-xl border transition-all ${isSel
            ? 'bg-slate-800/95 border-amber-400 ring-2 ring-amber-400/35 shadow-lg'
            : 'bg-slate-900/75 border-slate-700/70 hover:border-slate-500'}">
          <div class="flex items-center justify-between gap-2">
            <span class="font-serif-tc font-bold text-base text-amber-100">${f.title}</span>
            <span class="text-[11px] px-2 py-0.5 rounded-full border ${f.badgeBg}">克 ${FACTIONS[f.counters].name}</span>
          </div>
          <p class="text-xs text-slate-400 mt-1.5 leading-relaxed">${f.desc}</p>
          <div class="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>${isCustom ? '✨ 自訂卡組' : '標準預組'} (${deckCount}張)</span>
            ${isSel ? '<span class="text-amber-300 font-semibold">✓ 已選擇</span>' : ''}
          </div>
        </button>
      `;
    }).join('');

    return `
      <div class="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
        <div class="w-full max-w-4xl bg-[#131822]/95 gold-border rounded-2xl shadow-2xl overflow-hidden">
          <div class="relative px-6 py-7 sm:py-9 text-center border-b border-amber-500/25 bg-gradient-to-b from-[#1e2433] to-[#131822]">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium mb-3">
              <span>完整規則 v2.0</span>
              <span>•</span>
              <span>1v1 策略卡牌對戰</span>
            </div>
            <h1 class="font-serif-tc text-3xl sm:text-5xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200">
              三國・謀定天下
            </h1>
            <p class="text-slate-300 text-sm sm:text-base mt-2 max-w-xl mx-auto">
              五格排陣相鄰守護，糧倉調度定乾坤。蜀、群、魏、吳雙陣營合縱連橫，運籌帷幄逐鹿中原。
            </p>
            <div class="mt-4 inline-flex flex-wrap items-center justify-center gap-1.5 text-xs bg-slate-950/70 px-3.5 py-1.5 rounded-full border border-slate-700/80">
              <span class="text-slate-400 mr-1">陣營克制 (+1傷):</span>
              <span class="text-emerald-300 font-bold">蜀</span><span class="text-amber-400">▶</span>
              <span class="text-purple-300 font-bold">群</span><span class="text-amber-400">▶</span>
              <span class="text-blue-300 font-bold">魏</span><span class="text-amber-400">▶</span>
              <span class="text-red-300 font-bold">吳</span><span class="text-amber-400">▶</span>
              <span class="text-emerald-300 font-bold">蜀</span>
            </div>
          </div>

          <div class="p-5 sm:p-6 space-y-6">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-amber-300/90 uppercase tracking-wider mb-2">對戰模式</label>
                <div class="grid grid-cols-3 gap-2">
                  <button type="button" data-set-mode="AI" class="py-2.5 px-2 rounded-xl border text-xs sm:text-sm font-semibold transition ${UI.lobbyMode === 'AI' ? 'bg-amber-500/20 border-amber-400 text-amber-200' : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'}">
                    🤖 單人 AI
                  </button>
                  <button type="button" data-set-mode="HOTSEAT" class="py-2.5 px-2 rounded-xl border text-xs sm:text-sm font-semibold transition ${UI.lobbyMode === 'HOTSEAT' ? 'bg-amber-500/20 border-amber-400 text-amber-200' : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'}">
                    ⚔️ 同屏 1v1
                  </button>
                  <button type="button" data-set-mode="ONLINE" class="py-2.5 px-2 rounded-xl border text-xs sm:text-sm font-semibold transition ${UI.lobbyMode === 'ONLINE' ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200' : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'}">
                    🌐 線上好友
                  </button>
                </div>
              </div>
              <div>
                <label class="block text-xs font-semibold text-amber-300/90 uppercase tracking-wider mb-2">先後手順序${UI.lobbyMode === 'ONLINE' ? '（由房主決定）' : ''}</label>
                <div class="grid grid-cols-3 gap-2">
                  <button type="button" data-set-first="RANDOM" class="py-2.5 px-2 rounded-xl border text-xs sm:text-sm font-semibold transition ${UI.firstChoice === 'RANDOM' ? 'bg-amber-500/20 border-amber-400 text-amber-200' : 'bg-slate-900 border-slate-700 text-slate-300'}">🎲 隨機</button>
                  <button type="button" data-set-first="P0" class="py-2.5 px-2 rounded-xl border text-xs sm:text-sm font-semibold transition ${UI.firstChoice === 'P0' ? 'bg-amber-500/20 border-amber-400 text-amber-200' : 'bg-slate-900 border-slate-700 text-slate-300'}">${UI.lobbyMode === 'AI' ? '我方先手' : UI.lobbyMode === 'ONLINE' ? '房主先手' : '玩家一先'}</button>
                  <button type="button" data-set-first="P1" class="py-2.5 px-2 rounded-xl border text-xs sm:text-sm font-semibold transition ${UI.firstChoice === 'P1' ? 'bg-amber-500/20 border-amber-400 text-amber-200' : 'bg-slate-900 border-slate-700 text-slate-300'}">${UI.lobbyMode === 'AI' ? 'AI 先手' : UI.lobbyMode === 'ONLINE' ? '客軍先手' : '玩家二先'}</button>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm font-bold text-amber-200">${UI.lobbyMode === 'HOTSEAT' ? '玩家一主陣營' : '我方出戰陣營'}</span>
                </div>
                <div class="grid grid-cols-2 gap-2.5">${renderFactionCards(UI.p0Faction, 'p0')}</div>
              </div>
              ${UI.lobbyMode === 'ONLINE' ? `
              <div class="flex flex-col justify-between p-4 rounded-xl bg-slate-900/80 border border-emerald-500/35 space-y-4">
                <div>
                  <div class="text-sm font-bold text-emerald-300 mb-1">🌐 好友房號連線（免伺服器）</div>
                  <p class="text-xs text-slate-400 leading-relaxed">先在左側選好你的出戰陣營，再選擇「建立房間」把房號或連結傳給好友，或輸入好友的房號直接加入。</p>
                </div>

                <div class="space-y-2.5">
                  <button type="button" data-action="online-host" class="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition">
                    🏯 建立房間（我是房主）
                  </button>
                  ${UI.onlineRole === 'HOST' && UI.onlineStatus === 'WAITING' ? `
                    <div class="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 space-y-2">
                      <div class="flex items-center justify-between">
                        <span class="text-xs text-emerald-200">房間已建立！等待好友加入…</span>
                        <span class="font-mono text-lg font-black tracking-widest text-amber-300">${UI.onlineRoomCode}</span>
                      </div>
                      <div class="flex gap-2">
                        <button type="button" data-action="copy-room-code" class="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-100 border border-slate-600">📋 複製房號</button>
                        <button type="button" data-action="copy-invite-link" class="flex-1 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-xs text-amber-200 border border-amber-400/50">🔗 複製邀請連結</button>
                      </div>
                    </div>
                  ` : ''}
                </div>

                <div class="pt-3 border-t border-slate-800 space-y-2">
                  <label class="block text-xs font-semibold text-slate-300">已有好友房號？直接加入：</label>
                  <div class="flex gap-2">
                    <input id="online-room-input" type="text" maxlength="6" inputmode="numeric" placeholder="輸入 4 位房號"
                      value="${UI.onlineInputCode}"
                      class="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-amber-200 font-mono text-sm tracking-widest focus:outline-none focus:border-emerald-400" />
                    <button type="button" data-action="online-join" class="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm">
                      加入
                    </button>
                  </div>
                </div>

                ${UI.onlineStatus === 'LOADING' || UI.onlineStatus === 'CONNECTING' ? `
                  <div class="text-xs text-amber-300 font-medium">⏳ ${UI.onlineStatus === 'LOADING' ? '正在載入連線模組並建立房間…' : `正在連線至房號 ${UI.onlineRoomCode}…`}</div>
                ` : ''}
                ${UI.onlineError ? `
                  <div class="text-xs text-rose-300 bg-rose-950/60 border border-rose-500/40 rounded-lg px-3 py-2">⚠️ ${UI.onlineError}</div>
                ` : ''}
              </div>
              ` : `
              <div>
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm font-bold text-rose-200">${UI.lobbyMode === 'AI' ? '敵軍 AI 主陣營' : '玩家二主陣營'}</span>
                </div>
                <div class="grid grid-cols-2 gap-2.5">${renderFactionCards(UI.p1Faction, 'p1')}</div>
              </div>
              `}
            </div>

            <div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <div class="flex flex-wrap gap-2">
                <button type="button" data-action="open-deckbuilder" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 text-sm font-semibold transition">
                  🃏 組牌工坊（30張）
                </button>
                <button type="button" data-action="open-compendium" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 text-sm font-semibold transition">
                  📚 卡牌圖鑑
                </button>
                <button type="button" data-action="open-rules" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 text-sm font-semibold transition">
                  📜 完整規則手冊
                </button>
                <button type="button" data-action="toggle-mute" class="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 text-sm font-semibold transition">
                  ${Sound.muted ? '🔇 靜音' : '🔊 音效'}
                </button>
              </div>
              ${UI.lobbyMode === 'ONLINE' ? `
                <span class="text-xs text-emerald-300/90 font-medium">🌐 請於右側建立或加入房間開始連線對戰</span>
              ` : `
                <button type="button" data-action="start-match" class="px-7 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-extrabold text-base shadow-lg gold-glow transition">
                  ⚔️ 鳴鼓開戰
                </button>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderDeckBuilder() {
    const fid = UI.dbFaction;
    const subFid = UI.dbSubFaction && UI.dbSubFaction !== fid ? UI.dbSubFaction : null;
    const counts = {};
    for (const id of UI.dbCards) counts[id] = (counts[id] || 0) + 1;
    const validation = validateDeck(fid, UI.dbCards, subFid);

    const pool = Object.values(CARD_DB)
      .filter(c => !c.token && (
        c.faction === fid ||
        c.faction === 'NEU' ||
        (subFid && c.faction === subFid && c.cost <= SUB_FACTION_MAX_COST)
      ))
      .sort((a, b) => {
        const rank = f => f === fid ? 0 : (f === subFid ? 1 : 2);
        return rank(a.faction) - rank(b.faction) || a.cost - b.cost;
      });

    return `
      <div class="flex-1 flex flex-col p-4 max-w-6xl w-full mx-auto gap-4">
        <div class="flex flex-wrap items-center justify-between gap-3 bg-[#151a25] gold-border rounded-xl px-4 py-3">
          <div class="flex items-center gap-3">
            <button type="button" data-action="back-lobby" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-200">← 返回大廳</button>
            <h2 class="font-serif-tc text-xl font-bold text-amber-300">組牌工坊</h2>
            <div class="flex gap-1.5">
              ${FACTION_LIST.map(f => `
                <button type="button" data-db-faction="${f}" class="px-3 py-1 rounded-lg text-xs font-bold border ${fid === f ? 'bg-amber-500 text-slate-950 border-amber-300' : 'bg-slate-900 text-slate-300 border-slate-700'}">
                  ${FACTIONS[f].name}
                </button>
              `).join('')}
            </div>
          </div>
          <div class="flex items-center gap-2.5">
            <span class="text-sm font-bold ${UI.dbCards.length === DECK_SIZE ? 'text-emerald-400' : 'text-amber-300'}">
              牌庫數量：${UI.dbCards.length} / ${DECK_SIZE}
            </span>
            <button type="button" data-action="db-reset" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-600">重置為預組</button>
            <button type="button" data-action="db-save" class="px-4 py-1.5 rounded-lg text-sm font-bold ${validation.valid ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950' : 'bg-slate-700 text-slate-400 cursor-not-allowed'}" ${validation.valid ? '' : 'disabled'}>
              💾 儲存卡組
            </button>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 bg-[#151a25]/70 border border-slate-800 rounded-xl px-4 py-2 text-xs">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-slate-400 font-semibold">副陣營（最多 ${MAX_SUB_FACTION_CARDS} 張，限 ≤${SUB_FACTION_MAX_COST} 費）：</span>
            <button type="button" data-db-subfaction="" class="px-2.5 py-1 rounded-lg border font-bold ${!subFid ? 'bg-slate-200 text-slate-950 border-white' : 'bg-slate-900 text-slate-400 border-slate-700'}">無</button>
            ${FACTION_LIST.filter(f => f !== fid).map(f => `
              <button type="button" data-db-subfaction="${f}" class="px-2.5 py-1 rounded-lg border font-bold ${subFid === f ? 'bg-indigo-500 text-white border-indigo-300' : 'bg-slate-900 text-slate-300 border-slate-700'}">
                ${FACTIONS[f].name}
              </button>
            `).join('')}
          </div>
          <span class="font-bold ${validation.subCount > MAX_SUB_FACTION_CARDS ? 'text-rose-400' : 'text-indigo-300'}">
            副陣營已選：${validation.subCount} / ${MAX_SUB_FACTION_CARDS}
          </span>
        </div>
        <div class="text-xs text-slate-400 px-1">
          構築規則：共 ${DECK_SIZE} 張卡牌，同名最多 ${MAX_COPIES} 張；可選主陣營（${FACTIONS[fid].title}）＋最多 1 個副陣營（≤${SUB_FACTION_MAX_COST} 費，上限 ${MAX_SUB_FACTION_CARDS} 張）＋中立卡牌。
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-6">
          ${pool.map(c => {
            const cnt = counts[c.id] || 0;
            const f = FACTIONS[c.faction];
            return `
              <div class="p-3 rounded-xl bg-[#151b26] border ${cnt > 0 ? 'border-amber-500/50' : 'border-slate-800'} flex flex-col justify-between gap-2">
                <div>
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-sm shrink-0">${c.icon}</span>
                      <span class="font-bold text-slate-100 truncate">${c.name}</span>
                      <span class="text-[10px] px-1.5 py-0.5 rounded border ${f.badgeBg}">${f.name}</span>
                    </div>
                    <span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold shrink-0">${c.cost} 糧</span>
                  </div>
                  <div class="flex items-center gap-2 mt-1.5 text-xs">
                    <span class="text-slate-400">${c.type === 'GENERAL' ? `⚔️${c.atk}  ❤️${c.hp}${c.armor ? `  🛡️${c.armor}` : ''}` : '📜 謀略牌'}</span>
                    <div class="flex gap-1">${(c.keywords || []).map(keywordBadgeHtml).join('')}</div>
                  </div>
                  <p class="text-xs text-slate-300 mt-1.5 leading-snug">${c.text}</p>
                </div>
                <div class="flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <span class="text-xs font-semibold ${cnt === MAX_COPIES ? 'text-amber-300' : 'text-slate-400'}">已攜帶：${cnt} / ${MAX_COPIES}</span>
                  <div class="flex items-center gap-1.5">
                    <button type="button" data-db-remove="${c.id}" class="w-7 h-7 rounded-lg bg-slate-800 hover:bg-rose-900/70 text-slate-200 font-bold disabled:opacity-30" ${cnt === 0 ? 'disabled' : ''}>−</button>
                    <button type="button" data-db-add="${c.id}" class="w-7 h-7 rounded-lg bg-slate-800 hover:bg-emerald-800/80 text-slate-200 font-bold disabled:opacity-30" ${cnt >= MAX_COPIES || UI.dbCards.length >= DECK_SIZE ? 'disabled' : ''}>+</button>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderBoardUnit(u, ownerIdx, slotIdx, isOpponentSide) {
    const G = UI.G;
    const viewIdx = getViewingPlayerIdx();
    const isMyTurn = G.phase === 'MAIN' && G.activePlayer === viewIdx && !G.players[viewIdx].isAI;
    const f = FACTIONS[u.faction];
    const atkVal = getUnitAtk(u);
    const maxAtks = getUnitMaxAttacks(u);
    const ready = !isOpponentSide && isMyTurn && canUnitAttack(u);
    const isSelectedAttacker = !isOpponentSide && UI.selectedAttackerSlot === slotIdx;

    let isValidTarget = false;
    let counterBonusHint = false;
    if (isMyTurn) {
      if (UI.selectedAttackerSlot !== null && isOpponentSide) {
        const valid = getValidAttackTargets(G, viewIdx, UI.selectedAttackerSlot);
        if (valid.slots.includes(slotIdx)) {
          isValidTarget = true;
          const atkUnit = G.players[viewIdx].board[UI.selectedAttackerSlot];
          if (atkUnit && isCountering(atkUnit.faction, u.faction)) counterBonusHint = true;
        }
      } else if (UI.selectedHandUid !== null) {
        const card = G.players[viewIdx].hand.find(c => c.uid === UI.selectedHandUid);
        if (card && card.type === 'TACTIC') {
          if (card.target === 'enemy_general' && isOpponentSide) isValidTarget = true;
          if (card.target === 'ally_general' && !isOpponentSide) isValidTarget = true;
        }
      }
    }

    const hasGuard = unitHasGuard(u);
    const anims = G.animEvents || [];
    const didAttack = anims.some(a => a.kind === 'attack' && a.attackerOwner === ownerIdx && a.attackerSlot === slotIdx);
    const hitEvt = anims.find(a => a.kind === 'attack' && a.targetType === 'UNIT' && a.targetOwner === ownerIdx && a.targetSlot === slotIdx);
    const didKillBonus = anims.some(a => a.kind === 'kill_bonus' && a.owner === ownerIdx && a.slot === slotIdx);
    const tacticHit = anims.some(a => a.kind === 'tactic' && (
      (a.card.target === 'enemy_general' && a.owner !== ownerIdx && a.targetSlot === slotIdx) ||
      (a.card.target === 'ally_general' && a.owner === ownerIdx && a.targetSlot === slotIdx)
    ));
    const animClasses = [
      didAttack ? (isOpponentSide ? 'anim-lunge-down' : 'anim-lunge-up') : '',
      hitEvt ? (hitEvt.countered ? 'anim-counter-hit' : 'anim-hit-shake') : '',
      didKillBonus ? 'anim-kill-pulse' : '',
      tacticHit ? 'anim-tactic-target' : ''
    ].filter(Boolean).join(' ');

    const stateClasses = isSelectedAttacker
      ? 'ring-2 ring-amber-400 shadow-lg scale-[1.02]'
      : isValidTarget
      ? 'target-valid'
      : ready
      ? 'attack-ready cursor-pointer'
      : hasGuard
      ? 'border-indigo-400/75 shadow-[0_0_14px_rgba(99,102,241,0.3)]'
      : 'border-slate-700/90';

    const effectsHtml = u.effects.map(e => {
      const cls = e.type === 'burn'
        ? 'bg-orange-950/90 text-orange-300 border-orange-500/50'
        : e.val < 0
        ? 'bg-indigo-950/90 text-indigo-300 border-indigo-500/50'
        : 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50';
      return `<span class="px-1 py-0.5 rounded text-[9px] border ${cls}">${e.label} ${e.turns}t</span>`;
    }).join('');

    return `
      <div data-unit-click="${ownerIdx}:${slotIdx}"
        class="relative w-full h-full min-h-[126px] sm:min-h-[138px] rounded-xl bg-gradient-to-b from-[#1e2536] to-[#121722] border p-2.5 flex flex-col justify-between transition select-none ${stateClasses} ${animClasses} ${u.isPrep ? 'opacity-85' : ''}">
        <div class="flex items-start justify-between gap-1">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="text-base leading-none">${u.icon}</span>
            <span class="font-serif-tc font-bold text-xs sm:text-sm text-amber-50 truncate">${u.name}</span>
          </div>
          <span class="text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${f.badgeBg}">${f.name}</span>
        </div>

        <div class="flex flex-wrap gap-1 my-1">
          ${u.isPrep ? `<span class="px-1.5 py-0.5 rounded text-[10px] bg-slate-700/80 text-slate-300">💤 整備中</span>` : ''}
          ${!u.isPrep && u.attacksUsed < maxAtks && !isOpponentSide ? `<span class="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">可攻擊${maxAtks > 1 ? ` (${maxAtks - u.attacksUsed}/${maxAtks})` : ''}</span>` : ''}
          ${!u.isPrep && u.attacksUsed >= maxAtks ? `<span class="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">已行動</span>` : ''}
          ${u.keywords.map(keywordBadgeHtml).join('')}
          ${effectsHtml}
        </div>

        <p class="text-[10px] text-slate-400 line-clamp-2 leading-tight">${u.text}</p>

        <div class="flex items-center justify-between pt-1.5 mt-1 border-t border-slate-700/70 text-xs font-extrabold">
          <span class="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">⚔️ ${atkVal}</span>
          <div class="flex items-center gap-1.5">
            ${u.armor > 0 ? `<span class="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300">🛡️ ${u.armor}</span>` : ''}
            <span class="px-1.5 py-0.5 rounded ${u.hp < u.maxHp ? 'bg-rose-500/25 text-rose-300' : 'bg-emerald-500/15 text-emerald-300'}">❤️ ${u.hp}/${u.maxHp}</span>
          </div>
        </div>

        ${counterBonusHint ? `<div class="absolute -top-2.5 right-2 px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black shadow">克制 +1傷!</div>` : ''}
        ${hasGuard ? `<div class="absolute -top-2.5 left-2 px-1.5 py-0.5 rounded-full bg-indigo-500 text-white text-[9px] font-black shadow">🛡️守護者</div>` : ''}
      </div>
    `;
  }

  function renderBoardRow(ownerIdx, isOpponentSide) {
    const G = UI.G;
    const viewIdx = getViewingPlayerIdx();
    const isMyTurn = G.phase === 'MAIN' && G.activePlayer === viewIdx && !G.players[viewIdx].isAI;
    const selectedCard = isMyTurn && UI.selectedHandUid !== null
      ? G.players[viewIdx].hand.find(c => c.uid === UI.selectedHandUid)
      : null;
    const isDeployingGeneral = Boolean(!isOpponentSide && selectedCard && selectedCard.type === 'GENERAL');

    return `
      <div class="grid grid-cols-5 gap-1.5 sm:gap-2.5 w-full">
        ${Array.from({ length: BOARD_SIZE }, (_, slotIdx) => {
          const u = G.players[ownerIdx].board[slotIdx];
          const slotKey = `unit-${ownerIdx}-${slotIdx}`;
          const vfx = G.vfxEvents.filter(v => v.targetKey === slotKey);
          const vfxHtml = vfx.map(v => `<div class="float-dmg text-sm sm:text-base ${v.colorClass}">${v.text}</div>`).join('');
          const deathEvt = (G.animEvents || []).find(a => a.kind === 'death' && a.owner === ownerIdx && a.slot === slotIdx);
          const deathGhostHtml = deathEvt ? `
            <div class="anim-death-ghost absolute inset-0 z-20 rounded-xl bg-rose-950/85 border-2 border-rose-500/80 flex flex-col items-center justify-center p-2">
              <span class="text-2xl">${deathEvt.icon}</span>
              <span class="font-serif-tc text-xs font-extrabold text-rose-200 mt-0.5">${deathEvt.name}</span>
              <span class="text-[11px] font-black text-rose-400 mt-0.5">💀 陣亡</span>
            </div>
          ` : '';

          if (u) {
            const guarded = isProtectedByAdjacentGuard(G.players[ownerIdx].board, slotIdx);
            const guardRing = guarded ? `<span class="absolute -top-2 right-1 z-10 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-900/95 text-indigo-200 border border-indigo-400/60 shadow">受守護</span>` : '';
            return `<div class="relative">${guardRing}${renderBoardUnit(u, ownerIdx, slotIdx, isOpponentSide)}${vfxHtml}</div>`;
          }
          return `
            <div data-empty-slot="${ownerIdx}:${slotIdx}"
              class="relative min-h-[120px] sm:min-h-[136px] rounded-xl border border-dashed border-slate-700/70 bg-slate-900/40 flex flex-col items-center justify-center p-1.5 text-center transition ${isDeployingGeneral ? 'slot-deployable' : ''}">
              <span class="text-[10px] sm:text-[11px] font-semibold text-slate-500">${SLOT_NAMES[slotIdx]}</span>
              ${isDeployingGeneral ? `<span class="mt-2 px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold">點擊上陣</span>` : ''}
              ${deathGhostHtml}
              ${vfxHtml}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderPlayerBar(pIdx, isOpponent) {
    const G = UI.G;
    const p = G.players[pIdx];
    const f = FACTIONS[p.faction];
    const viewIdx = getViewingPlayerIdx();
    const isMyTurn = G.phase === 'MAIN' && G.activePlayer === viewIdx && !G.players[viewIdx].isAI;

    let canHitThisHero = false;
    if (isOpponent && isMyTurn && UI.selectedAttackerSlot !== null) {
      const valid = getValidAttackTargets(G, viewIdx, UI.selectedAttackerSlot);
      canHitThisHero = valid.canHitHero;
    }

    const hpPct = Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100));
    const vfx = G.vfxEvents.filter(v => v.targetKey === `hero-${pIdx}`);
    const heroHit = (G.animEvents || []).some(a => a.kind === 'attack' && a.targetType === 'HERO' && a.targetOwner === pIdx);
    const vfxHtml = vfx.map(v => `<div class="float-dmg text-base ${v.colorClass}">${v.text}</div>`).join('');

    return `
      <div data-hero-click="${pIdx}"
        class="relative flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#141a26]/95 border ${canHitThisHero ? 'target-valid border-red-400' : G.activePlayer === pIdx ? 'border-amber-400/70 shadow-md' : 'border-slate-800'} transition">
        ${vfxHtml}
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center font-serif-tc font-black text-lg border ${f.badgeBg}">
            ${f.name}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="font-bold text-sm sm:text-base text-slate-100">${p.name}</span>
              <span class="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">${pIdx === G.firstPlayer ? '先手' : '後手'}</span>
              ${G.activePlayer === pIdx && G.phase === 'MAIN' ? `<span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 font-bold">行動中</span>` : ''}
              ${canHitThisHero ? `<span class="text-[11px] px-2 py-0.5 rounded-full bg-red-500 text-white font-bold">⚔️ 點擊直擊國力!</span>` : ''}
            </div>
            <div class="flex items-center gap-2 mt-1">
              <div class="w-28 sm:w-40 h-2.5 rounded-full bg-slate-800 overflow-hidden border border-slate-700">
                <div class="h-full transition-all duration-300 ${hpPct > 40 ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-red-700 to-rose-400'}" style="width:${hpPct}%"></div>
              </div>
              <span class="text-xs font-extrabold ${p.hp <= 10 ? 'text-rose-400' : 'text-emerald-300'}">國力 ${p.hp}/${p.maxHp}</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 sm:gap-3 text-xs">
          <div class="px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/35 text-amber-200 font-bold">
            🌾 糧草 ${p.food}/${p.maxFood}${p.tempFood > 0 ? ` <span class="text-yellow-300">(+${p.tempFood}臨)</span>` : ''}
          </div>
          <div class="px-2.5 py-1.5 rounded-lg bg-orange-500/15 border border-orange-500/35 text-orange-200 font-bold" title="糧倉：回合結束自動儲存未用完的普通糧草（上限 3），僅可用於謀略牌與強化效果">
            🏯 糧倉 ${p.reserveFood || 0}/${MAX_RESERVE_FOOD}
          </div>
          <div class="px-2.5 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700 text-slate-200">
            📚 牌庫 <b>${p.deck.length}</b>
          </div>
          <div class="px-2.5 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700 text-slate-200">
            🃏 手牌 <b>${p.hand.length}</b>/${MAX_HAND_SIZE}
          </div>
          <button type="button" data-open-graveyard="${pIdx}" class="px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 transition">
            🪦 墓地 <b>${p.graveyard.length}</b>
          </button>
        </div>
      </div>
    `;
  }

  function renderHand(viewIdx) {
    const G = UI.G;
    const p = G.players[viewIdx];
    const isMyTurn = G.phase === 'MAIN' && G.activePlayer === viewIdx && !p.isAI;

    if (p.hand.length === 0) {
      return `<div class="text-center text-xs text-slate-500 py-6">手牌已空</div>`;
    }

    return `
      <div class="flex gap-2 overflow-x-auto pb-2 pt-3 px-1 items-stretch">
        ${p.hand.map(c => {
          const playable = isMyTurn && canPlayCard(G, viewIdx, c);
          const selected = UI.selectedHandUid === c.uid;
          const f = FACTIONS[c.faction];
          return `
            <button type="button" data-hand-card="${c.uid}"
              class="hand-card text-left w-[142px] sm:w-[154px] shrink-0 rounded-xl p-2.5 border flex flex-col justify-between bg-gradient-to-b from-[#1e2433] to-[#121620] ${selected
                ? 'selected border-amber-400'
                : playable
                ? 'border-amber-500/60 shadow-md cursor-pointer'
                : 'border-slate-700/80 opacity-75'}">
              <div>
                <div class="flex items-center justify-between gap-1">
                  <span class="px-1.5 py-0.5 rounded-full text-[11px] font-black ${getTotalFood(p, c.type) >= c.cost ? 'bg-amber-400 text-slate-950' : 'bg-slate-700 text-rose-300'}">${c.cost}</span>
                  <span class="text-[10px] px-1.5 py-0.5 rounded border ${f.badgeBg}">${f.name}</span>
                </div>
                <div class="flex items-center gap-1.5 mt-1.5">
                  <span class="text-base">${c.icon}</span>
                  <span class="font-serif-tc font-bold text-sm text-amber-50 truncate">${c.name}</span>
                </div>
                <div class="flex flex-wrap gap-1 mt-1">
                  <span class="text-[10px] text-slate-400">${c.type === 'GENERAL' ? '武將' : '謀略'}</span>
                  ${c.keywords.map(keywordBadgeHtml).join('')}
                </div>
                <p class="text-[10px] text-slate-300 mt-1.5 leading-snug line-clamp-3">${c.text}</p>
              </div>
              <div class="mt-2 pt-1.5 border-t border-slate-700/70 flex items-center justify-between text-xs font-extrabold">
                ${c.type === 'GENERAL'
                  ? `<span class="text-amber-300">⚔️${c.baseAtk}</span><span class="text-sky-300">${c.baseArmor ? `🛡️${c.baseArmor}` : ''}</span><span class="text-emerald-300">❤️${c.baseHp}</span>`
                  : `<span class="text-amber-200/90 text-[11px] font-semibold">${c.target === 'none' ? '點擊施放' : c.target === 'enemy_general' ? '指定敵將' : '指定友將'}</span>`}
              </div>
            </button>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderMulliganOverlay() {
    const G = UI.G;
    const actor = G.mulliganActor;
    const p = G.players[actor];
    if (G.mode === 'ONLINE' && actor !== getViewingPlayerIdx()) {
      return `
        <div class="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-[#141923] gold-border rounded-2xl max-w-md w-full p-6 text-center shadow-2xl">
            <div class="text-3xl mb-2">⏳</div>
            <h2 class="font-serif-tc text-xl font-bold text-amber-300">等待對手完成起手調度…</h2>
            <p class="text-xs text-slate-300 mt-2">目前由 ${p.name} 選擇初始手牌，請稍候片刻。</p>
          </div>
        </div>
      `;
    }
    if (p.isAI) {
      return `
        <div class="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-[#151b26] gold-border rounded-2xl p-6 text-center max-w-sm w-full">
            <div class="text-3xl mb-2">🤖</div>
            <h2 class="font-serif-tc text-xl font-bold text-amber-300">${p.name} 正在進行起手調度…</h2>
            <p class="text-xs text-slate-400 mt-2">請稍候片刻</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="fixed inset-0 z-40 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-[#141a26] gold-border rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl">
          <div class="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div>
              <h2 class="font-serif-tc text-2xl font-bold text-amber-300">起手調度（Mulligan）— ${p.name}</h2>
              <p class="text-xs sm:text-sm text-slate-300 mt-0.5">
                你是<b>${actor === G.firstPlayer ? '先手（3 張手牌，第 1 回合不抽牌）' : '後手（4 張手牌，第 1 回合獲得《急行軍》）'}</b>。點擊任意手牌標記換牌，確認後洗回牌庫並重抽相同張數。
              </p>
            </div>
            <span class="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-bold">
              已選換牌：${UI.mulliganSelected.size} 張
            </span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5">
            ${p.hand.map(c => {
              const isSel = UI.mulliganSelected.has(c.uid);
              const f = FACTIONS[c.faction];
              return `
                <button type="button" data-mulligan-toggle="${c.uid}"
                  class="relative text-left p-3 rounded-xl border transition flex flex-col justify-between min-h-[155px] ${isSel
                    ? 'bg-rose-950/50 border-rose-400 ring-2 ring-rose-400/40'
                    : 'bg-[#1b2232] border-slate-700 hover:border-amber-400/60'}">
                  <div>
                    <div class="flex items-center justify-between">
                      <span class="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-xs font-black">${c.cost} 糧</span>
                      <span class="text-[10px] px-1.5 py-0.5 rounded border ${f.badgeBg}">${f.name}</span>
                    </div>
                    <div class="font-serif-tc font-bold text-base text-amber-50 mt-2">${c.icon} ${c.name}</div>
                    <p class="text-[11px] text-slate-300 mt-1.5 leading-snug">${c.text}</p>
                  </div>
                  <div class="mt-2 pt-1.5 border-t border-slate-700/70 flex justify-between text-xs font-bold">
                    ${c.type === 'GENERAL' ? `<span class="text-amber-300">⚔️${c.baseAtk}</span><span class="text-emerald-300">❤️${c.baseHp}${c.baseArmor ? ` 🛡️${c.baseArmor}` : ''}</span>` : `<span class="text-slate-400">謀略牌</span>`}
                  </div>
                  ${isSel ? `<div class="absolute inset-0 rounded-xl bg-rose-900/30 flex items-center justify-center"><span class="px-3 py-1 rounded-full bg-rose-600 text-white text-xs font-extrabold shadow-lg">🔄 更換此牌</span></div>` : ''}
                </button>
              `;
            }).join('')}
          </div>

          <div class="flex justify-end gap-3">
            <button type="button" data-action="confirm-mulligan" class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-extrabold text-sm shadow-lg">
              確認調度並繼續
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderHotseatCurtain() {
    const p = UI.G.players[UI.hotseatPrivacyFor];
    return `
      <div class="fixed inset-0 z-50 bg-[#0b0e14]/95 backdrop-blur-md flex items-center justify-center p-4">
        <div class="bg-[#151b26] gold-border rounded-2xl p-7 text-center max-w-md w-full shadow-2xl">
          <div class="text-4xl mb-3">🛡️</div>
          <h2 class="font-serif-tc text-2xl font-bold text-amber-300">請交給 ${p.name}</h2>
          <p class="text-sm text-slate-300 mt-2">陣營：${FACTIONS[p.faction].title}。確認對手已避開螢幕後，點擊下方按鈕繼續。</p>
          <button type="button" data-action="dismiss-curtain" class="mt-5 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm">
            我已就位，顯示手牌
          </button>
        </div>
      </div>
    `;
  }

  function renderGameOverOverlay() {
    const G = UI.G;
    const title = G.winner === 'DRAW' ? '雙方平局！' : `${G.players[G.winner].name} 獲勝！`;
    return `
      <div class="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-[#151b26] gold-border rounded-2xl p-7 text-center max-w-md w-full shadow-2xl gold-glow">
          <div class="text-5xl mb-3">🏆</div>
          <h2 class="font-serif-tc text-3xl font-black text-amber-300">${title}</h2>
          <p class="text-sm text-slate-200 mt-3 leading-relaxed">${G.winReason}</p>
          <div class="grid grid-cols-2 gap-3 mt-5 text-xs bg-slate-900/80 p-3 rounded-xl border border-slate-800">
            <div>
              <div class="text-slate-400">${G.players[0].name}</div>
              <div class="font-bold text-base text-emerald-300 mt-0.5">國力 ${G.players[0].hp}</div>
            </div>
            <div>
              <div class="text-slate-400">${G.players[1].name}</div>
              <div class="font-bold text-base text-rose-300 mt-0.5">國力 ${G.players[1].hp}</div>
            </div>
          </div>
          <div class="flex items-center justify-center gap-3 mt-6">
            <button type="button" data-action="rematch" class="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm">⚔️ 再戰一局</button>
            <button type="button" data-action="back-lobby" class="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm border border-slate-600">返回主選單</button>
          </div>
        </div>
      </div>
    `;
  }

  function getActionHintText() {
    const G = UI.G;
    const viewIdx = getViewingPlayerIdx();
    if (G.phase !== 'MAIN') return '';
    if (G.players[G.activePlayer].isAI) return '🤖 敵軍 AI 正在思考並執行行動…';

    if (UI.selectedHandUid !== null) {
      const card = G.players[viewIdx].hand.find(c => c.uid === UI.selectedHandUid);
      if (card) {
        if (card.type === 'GENERAL') return `已選武將【${card.name}】— 請點擊己方空置的上陣位部署（點擊取消可撤回）`;
        if (card.target === 'enemy_general') return `已選謀略【${card.name}】— 請點擊任意敵方存活武將（無視守護保護）`;
        if (card.target === 'ally_general') return `已選謀略【${card.name}】— 請點擊一名友方存活武將`;
        return `已選謀略【${card.name}】— 再次點擊此牌或按「確認施放」立即生效`;
      }
    }

    if (UI.selectedAttackerSlot !== null) {
      const u = G.players[viewIdx].board[UI.selectedAttackerSlot];
      const valid = getValidAttackTargets(G, viewIdx, UI.selectedAttackerSlot);
      if (valid.canHitHero) return `⚔️【${u.name}】準備出擊 — 敵方前排空虛，請點擊上方敵方國力條直接攻擊！`;
      if (G.players[1 - viewIdx].board.some(eu => unitHasGuard(eu)) && !u.keywords.includes('SNIPE')) return `⚔️【${u.name}】準備出擊 — 🛡️ 敵方守護武將正在保護相鄰友軍，請選擇合法攻擊目標！`;
      return `⚔️【${u.name}】準備出擊 — 請點擊任意敵方存活武將發動攻擊！`;
    }

    return '主要階段：點擊手牌部署武將或施放謀略，或點擊綠框武將發動攻擊。';
  }

  function renderGame() {
    const G = UI.G;
    const viewIdx = getViewingPlayerIdx();
    const oppIdx = 1 - viewIdx;
    const roundNum = Math.max(1, Math.ceil(G.turnNumber / 2));
    const isMyTurn = G.phase === 'MAIN' && G.activePlayer === viewIdx && !G.players[viewIdx].isAI;
    const selectedCard = isMyTurn && UI.selectedHandUid !== null
      ? G.players[viewIdx].hand.find(c => c.uid === UI.selectedHandUid)
      : null;

    return `
      <div class="flex-1 flex flex-col w-full">
        <header class="px-3 sm:px-4 py-2 bg-[#0d111a]/95 border-b border-amber-500/25 flex flex-wrap items-center justify-between gap-2 sticky top-0 z-30">
          <div class="flex items-center gap-2 sm:gap-3">
            <span class="font-serif-tc font-bold text-base sm:text-lg text-amber-300">三國·謀定天下</span>
            <span class="px-2 py-0.5 rounded bg-slate-800 text-xs text-slate-200 font-semibold">第 ${roundNum} 回合</span>
            ${G.mode === 'ONLINE' ? `<span class="px-2 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 text-xs font-bold">🌐 房號 ${UI.onlineRoomCode}（${UI.onlineRole === 'HOST' ? '房主' : '客軍'}）</span>` : ''}
            <span class="hidden md:inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300">
              克制(+1): <b class="text-emerald-300">蜀</b>▶<b class="text-purple-300">群</b>▶<b class="text-blue-300">魏</b>▶<b class="text-red-300">吳</b>▶<b class="text-emerald-300">蜀</b>
            </span>
          </div>
          <div class="flex items-center gap-1.5 sm:gap-2">
            <button type="button" data-action="toggle-log" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700">
              📜 戰報 (${G.log.length})
            </button>
            <button type="button" data-action="open-compendium" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700">
              📚 圖鑑
            </button>
            <button type="button" data-action="open-rules" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700">
              📖 規則
            </button>
            <button type="button" data-action="toggle-mute" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700">
              ${Sound.muted ? '🔇' : '🔊'}
            </button>
            <button type="button" data-action="back-lobby" class="px-2.5 py-1 rounded-lg bg-rose-950/70 hover:bg-rose-900 text-xs text-rose-200 border border-rose-700/60">
              退出
            </button>
          </div>
        </header>

        <div class="flex-1 flex flex-col lg:flex-row gap-3 p-2.5 sm:p-4">
          <div class="flex-1 flex flex-col gap-2.5 min-w-0">
            ${renderPlayerBar(oppIdx, true)}
            ${renderBoardRow(oppIdx, true)}

            <div class="px-3.5 py-2 rounded-xl bg-[#181f2e]/90 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2">
              <span class="text-xs sm:text-sm text-amber-100 font-medium">${getActionHintText()}</span>
              <div class="flex items-center gap-2 ml-auto">
                ${selectedCard && selectedCard.type === 'TACTIC' && selectedCard.target === 'none' ? `
                  <button type="button" data-action="cast-selected-tactic" class="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold">
                    ✨ 確認施放【${selectedCard.name}】
                  </button>
                ` : ''}
                ${(UI.selectedHandUid !== null || UI.selectedAttackerSlot !== null) ? `
                  <button type="button" data-action="cancel-selection" class="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs font-semibold">
                    取消選擇
                  </button>
                ` : ''}
                <button type="button" data-action="end-turn"
                  class="px-4 py-1.5 rounded-lg text-xs sm:text-sm font-extrabold transition ${isMyTurn
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'}"
                  ${isMyTurn ? '' : 'disabled'}>
                  結束回合 ⏭
                </button>
              </div>
            </div>

            ${renderBoardRow(viewIdx, false)}
            ${renderPlayerBar(viewIdx, false)}

            <div class="bg-[#111622]/90 border border-slate-800 rounded-xl px-2.5 py-1.5">
              ${renderHand(viewIdx)}
            </div>
          </div>

          ${UI.showLogDrawer ? `
            <aside class="w-full lg:w-72 shrink-0 bg-[#121722]/95 gold-border rounded-xl flex flex-col max-h-[360px] lg:max-h-[calc(100vh-88px)]">
              <div class="px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between">
                <span class="font-bold text-xs text-amber-300">📜 戰報記錄</span>
                <button type="button" data-action="toggle-log" class="text-slate-400 hover:text-white text-xs">收起 ✕</button>
              </div>
              <div class="p-3 overflow-y-auto space-y-1.5 text-xs text-slate-300 flex-1" id="battle-log-list">
                ${G.log.slice().reverse().map(line => `<div class="pb-1.5 border-b border-slate-800/70 leading-relaxed">${line}</div>`).join('')}
              </div>
            </aside>
          ` : ''}
        </div>
      </div>

      ${UI.hotseatPrivacyFor !== null ? renderHotseatCurtain() : ''}
      ${UI.hotseatPrivacyFor === null && G.phase === 'MULLIGAN' ? renderMulliganOverlay() : ''}
      ${G.phase === 'GAMEOVER' ? renderGameOverOverlay() : ''}
    `;
  }

  function render() {
    ensureFxStyles();
    const app = document.getElementById('app');
    if (!app) return;
    if (UI.screen === 'LOBBY') app.innerHTML = renderLobby();
    else if (UI.screen === 'DECKBUILDER') app.innerHTML = renderDeckBuilder();
    else if (UI.screen === 'GAME') {
      const tacticEvts = (UI.G && UI.G.animEvents) ? UI.G.animEvents.filter(a => a.kind === 'tactic') : [];
      app.innerHTML = renderGame();
      if (tacticEvts.length > 0) {
        showTacticShowcase(tacticEvts[tacticEvts.length - 1]);
      }
      if (UI.G && UI.G.vfxEvents.length > 0) {
        UI.G.vfxEvents = [];
      }
      if (UI.G && UI.G.animEvents && UI.G.animEvents.length > 0) {
        UI.G.animEvents = [];
      }
    }
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-close-modal]')) {
      closeModal();
      return;
    }

    const compFac = e.target.closest('[data-comp-faction]');
    if (compFac) {
      UI.compFaction = compFac.getAttribute('data-comp-faction');
      openCompendiumModal();
      return;
    }
    const compTyp = e.target.closest('[data-comp-type]');
    if (compTyp) {
      UI.compType = compTyp.getAttribute('data-comp-type');
      openCompendiumModal();
      return;
    }

    const modeBtn = e.target.closest('[data-set-mode]');
    if (modeBtn) {
      UI.lobbyMode = modeBtn.getAttribute('data-set-mode');
      render();
      return;
    }

    const firstBtn = e.target.closest('[data-set-first]');
    if (firstBtn) {
      UI.firstChoice = firstBtn.getAttribute('data-set-first');
      render();
      return;
    }

    const facBtn = e.target.closest('[data-pick-faction]');
    if (facBtn) {
      const [who, fid] = facBtn.getAttribute('data-pick-faction').split(':');
      if (who === 'p0') UI.p0Faction = fid;
      else UI.p1Faction = fid;
      render();
      return;
    }

    const dbFac = e.target.closest('[data-db-faction]');
    if (dbFac) {
      UI.dbFaction = dbFac.getAttribute('data-db-faction');
      UI.dbCards = getDeckForFaction(UI.dbFaction);
      UI.dbSubFaction = validateDeck(UI.dbFaction, UI.dbCards).subFaction;
      render();
      return;
    }
    const dbSub = e.target.closest('[data-db-subfaction]');
    if (dbSub) {
      const nextSub = dbSub.getAttribute('data-db-subfaction') || null;
      UI.dbSubFaction = nextSub;
      UI.dbCards = UI.dbCards.filter(id => {
        const c = CARD_DB[id];
        return c && (c.faction === UI.dbFaction || c.faction === 'NEU' || (nextSub && c.faction === nextSub && c.cost <= SUB_FACTION_MAX_COST));
      });
      render();
      return;
    }
    const dbAdd = e.target.closest('[data-db-add]');
    if (dbAdd) {
      const id = dbAdd.getAttribute('data-db-add');
      const cnt = UI.dbCards.filter(x => x === id).length;
      if (cnt < MAX_COPIES && UI.dbCards.length < DECK_SIZE) {
        UI.dbCards.push(id);
        render();
      }
      return;
    }
    const dbRem = e.target.closest('[data-db-remove]');
    if (dbRem) {
      const id = dbRem.getAttribute('data-db-remove');
      const idx = UI.dbCards.indexOf(id);
      if (idx !== -1) {
        UI.dbCards.splice(idx, 1);
        render();
      }
      return;
    }

    const graveBtn = e.target.closest('[data-open-graveyard]');
    if (graveBtn && UI.G) {
      openGraveyardModal(Number(graveBtn.getAttribute('data-open-graveyard')));
      return;
    }

    const mulBtn = e.target.closest('[data-mulligan-toggle]');
    if (mulBtn) {
      const uid = Number(mulBtn.getAttribute('data-mulligan-toggle'));
      if (UI.mulliganSelected.has(uid)) UI.mulliganSelected.delete(uid);
      else UI.mulliganSelected.add(uid);
      render();
      return;
    }

    const actBtn = e.target.closest('[data-action]');
    if (actBtn) {
      const action = actBtn.getAttribute('data-action');
      if (action === 'open-rules') { openRulebookModal(); return; }
      if (action === 'open-compendium') { openCompendiumModal(); return; }
      if (action === 'toggle-mute') { Sound.muted = !Sound.muted; render(); return; }
      if (action === 'open-deckbuilder') {
        UI.dbFaction = UI.p0Faction;
        UI.dbCards = getDeckForFaction(UI.dbFaction);
        UI.dbSubFaction = validateDeck(UI.dbFaction, UI.dbCards).subFaction;
        UI.screen = 'DECKBUILDER';
        render();
        return;
      }
      if (action === 'db-reset') {
        UI.dbCards = STARTER_DECKS[UI.dbFaction].slice();
        UI.dbSubFaction = null;
        showToast('已重置為該陣營標準 30 張預組卡組');
        render();
        return;
      }
      if (action === 'db-save') {
        const check = validateDeck(UI.dbFaction, UI.dbCards, UI.dbSubFaction);
        if (!check.valid) {
          showToast(check.errors[0], 'error');
          return;
        }
        saveCustomDeck(UI.dbFaction, UI.dbCards);
        showToast(`已儲存【${FACTIONS[UI.dbFaction].title}】自訂 30 張卡組！`, 'success');
        render();
        return;
      }
      if (action === 'online-host') { hostOnlineRoom(); return; }
      if (action === 'online-join') {
        const inp = document.getElementById('online-room-input');
        const val = inp ? inp.value : UI.onlineInputCode;
        joinOnlineRoom(val);
        return;
      }
      if (action === 'copy-room-code') {
        if (navigator.clipboard) navigator.clipboard.writeText(UI.onlineRoomCode).catch(() => {});
        showToast(`已複製房號：${UI.onlineRoomCode}`, 'success');
        return;
      }
      if (action === 'copy-invite-link') {
        const url = `${location.origin}${location.pathname}?room=${UI.onlineRoomCode}`;
        if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
        showToast('已複製好友邀請連結！直接傳給好友即可加入', 'success');
        return;
      }
      if (action === 'start-match') { startNewMatch(); return; }
      if (action === 'rematch') {
        if (UI.G && UI.G.mode === 'ONLINE') {
          if (UI.onlineRole === 'HOST') startOnlineHostMatch();
          else if (UI.onlineConn && UI.onlineConn.open) {
            UI.onlineConn.send({ type: 'REMATCH_REQ' });
            showToast('已向房主發送再戰請求…');
          }
          return;
        }
        startNewMatch();
        return;
      }
      if (action === 'back-lobby') {
        clearAiTimer();
        if (UI.G && UI.G.mode === 'ONLINE') cleanupOnlineSession();
        UI.screen = 'LOBBY';
        UI.G = null;
        render();
        return;
      }
      if (action === 'toggle-log') { UI.showLogDrawer = !UI.showLogDrawer; render(); return; }
      if (action === 'cancel-selection') {
        UI.selectedHandUid = null;
        UI.selectedAttackerSlot = null;
        render();
        return;
      }
      if (action === 'dismiss-curtain') {
        UI.hotseatPrivacyFor = null;
        render();
        return;
      }
      if (action === 'confirm-mulligan' && UI.G) {
        const selected = Array.from(UI.mulliganSelected);
        UI.mulliganSelected = new Set();
        if (UI.G.mode === 'ONLINE' && UI.onlineRole === 'GUEST') {
          sendGuestAction('MULLIGAN', { selectedUids: selected });
          return;
        }
        const actor = UI.G.mulliganActor;
        performMulligan(UI.G, actor, selected);
        if (UI.G.mode === 'HOTSEAT') {
          if (UI.G.phase === 'MULLIGAN') UI.hotseatPrivacyFor = UI.G.mulliganActor;
          else UI.hotseatPrivacyFor = UI.G.activePlayer;
        }
        syncOnlineStateAndRender();
        scheduleAITurnIfNeeded();
        return;
      }
      if (action === 'cast-selected-tactic' && UI.G) {
        const viewIdx = getViewingPlayerIdx();
        if (UI.selectedHandUid !== null) {
          const uid = UI.selectedHandUid;
          UI.selectedHandUid = null;
          if (UI.G.mode === 'ONLINE' && UI.onlineRole === 'GUEST') {
            sendGuestAction('PLAY_TACTIC', { cardUid: uid, targetSlot: null });
            return;
          }
          playTactic(UI.G, viewIdx, uid, null);
          syncOnlineStateAndRender();
        }
        return;
      }
      if (action === 'end-turn' && UI.G) {
        const viewIdx = getViewingPlayerIdx();
        if (UI.G.phase === 'MAIN' && UI.G.activePlayer === viewIdx && !UI.G.players[viewIdx].isAI) {
          UI.selectedHandUid = null;
          UI.selectedAttackerSlot = null;
          if (UI.G.mode === 'ONLINE' && UI.onlineRole === 'GUEST') {
            sendGuestAction('END_TURN', {});
            return;
          }
          endTurn(UI.G);
          if (UI.G.mode === 'HOTSEAT' && UI.G.phase === 'MAIN') {
            UI.hotseatPrivacyFor = UI.G.activePlayer;
          }
          syncOnlineStateAndRender();
          scheduleAITurnIfNeeded();
        }
        return;
      }
    }

    if (!UI.G || UI.G.phase !== 'MAIN') return;
    const G = UI.G;
    const viewIdx = getViewingPlayerIdx();
    if (G.activePlayer !== viewIdx || G.players[viewIdx].isAI) return;

    const handEl = e.target.closest('[data-hand-card]');
    if (handEl) {
      const uid = Number(handEl.getAttribute('data-hand-card'));
      const card = G.players[viewIdx].hand.find(c => c.uid === uid);
      if (!card) return;
      if (!canPlayCard(G, viewIdx, card)) {
        Sound.playError();
        if (getTotalFood(G.players[viewIdx], card.type) < card.cost) {
          showToast(`糧草不足（需要 ${card.cost}，目前 ${getTotalFood(G.players[viewIdx], card.type)}）`, 'error');
        } else if (card.type === 'GENERAL') {
          showToast('己方 5 個上陣位已滿，無法部署新武將', 'error');
        } else {
          showToast('目前場上無符合條件的合法目標', 'error');
        }
        return;
      }
      if (UI.selectedHandUid === uid && card.type === 'TACTIC' && card.target === 'none') {
        UI.selectedHandUid = null;
        if (G.mode === 'ONLINE' && UI.onlineRole === 'GUEST') {
          sendGuestAction('PLAY_TACTIC', { cardUid: uid, targetSlot: null });
          return;
        }
        playTactic(G, viewIdx, uid, null);
        syncOnlineStateAndRender();
        return;
      }
      UI.selectedAttackerSlot = null;
      UI.selectedHandUid = UI.selectedHandUid === uid ? null : uid;
      render();
      return;
    }

    const emptyEl = e.target.closest('[data-empty-slot]');
    if (emptyEl && UI.selectedHandUid !== null) {
      const [ownerStr, slotStr] = emptyEl.getAttribute('data-empty-slot').split(':');
      const owner = Number(ownerStr), slot = Number(slotStr);
      if (owner === viewIdx) {
        const card = G.players[viewIdx].hand.find(c => c.uid === UI.selectedHandUid);
        if (card && card.type === 'GENERAL') {
          if (G.mode === 'ONLINE' && UI.onlineRole === 'GUEST') {
            UI.selectedHandUid = null;
            sendGuestAction('PLAY_GENERAL', { cardUid: card.uid, slotIdx: slot });
            return;
          }
          if (playGeneral(G, viewIdx, card.uid, slot)) {
            UI.selectedHandUid = null;
            syncOnlineStateAndRender();
          }
        }
      }
      return;
    }

    const unitEl = e.target.closest('[data-unit-click]');
    if (unitEl) {
      const [ownerStr, slotStr] = unitEl.getAttribute('data-unit-click').split(':');
      const owner = Number(ownerStr), slot = Number(slotStr);

      if (UI.selectedHandUid !== null) {
        const card = G.players[viewIdx].hand.find(c => c.uid === UI.selectedHandUid);
        if (card && card.type === 'TACTIC') {
          if ((card.target === 'enemy_general' && owner !== viewIdx) || (card.target === 'ally_general' && owner === viewIdx)) {
            if (G.mode === 'ONLINE' && UI.onlineRole === 'GUEST') {
              UI.selectedHandUid = null;
              sendGuestAction('PLAY_TACTIC', { cardUid: card.uid, targetSlot: slot });
              return;
            }
            if (playTactic(G, viewIdx, card.uid, slot)) {
              UI.selectedHandUid = null;
              syncOnlineStateAndRender();
              return;
            }
          }
        }
      }

      if (UI.selectedAttackerSlot !== null && owner !== viewIdx) {
        const valid = getValidAttackTargets(G, viewIdx, UI.selectedAttackerSlot);
        if (valid.slots.includes(slot)) {
          const atkSlot = UI.selectedAttackerSlot;
          UI.selectedAttackerSlot = null;
          if (G.mode === 'ONLINE' && UI.onlineRole === 'GUEST') {
            sendGuestAction('ATTACK', { attackerSlot: atkSlot, targetType: 'UNIT', targetSlot: slot });
            return;
          }
          executeAttack(G, viewIdx, atkSlot, 'UNIT', slot);
          syncOnlineStateAndRender();
          return;
        } else if (isProtectedByAdjacentGuard(G.players[1 - viewIdx].board, slot)) {
          Sound.playError();
          showToast('🛡️ 相鄰守護原則：該敵方武將正受到相鄰「守護」武將保護，無法直接普通攻擊！', 'error');
          return;
        }
      }

      if (owner === viewIdx) {
        const u = G.players[viewIdx].board[slot];
        if (canUnitAttack(u)) {
          UI.selectedHandUid = null;
          UI.selectedAttackerSlot = UI.selectedAttackerSlot === slot ? null : slot;
          render();
        } else if (u && u.isPrep) {
          Sound.playError();
          showToast(`【${u.name}】正處於整備狀態，下個己方回合方可攻擊`, 'error');
        } else if (u) {
          Sound.playError();
          showToast(`【${u.name}】本回合攻擊次數已用盡`, 'error');
        }
      }
      return;
    }

    const heroEl = e.target.closest('[data-hero-click]');
    if (heroEl && UI.selectedAttackerSlot !== null) {
      const targetOwner = Number(heroEl.getAttribute('data-hero-click'));
      if (targetOwner !== viewIdx) {
        const valid = getValidAttackTargets(G, viewIdx, UI.selectedAttackerSlot);
        if (valid.canHitHero) {
          const atkSlot = UI.selectedAttackerSlot;
          UI.selectedAttackerSlot = null;
          if (G.mode === 'ONLINE' && UI.onlineRole === 'GUEST') {
            sendGuestAction('ATTACK', { attackerSlot: atkSlot, targetType: 'HERO', targetSlot: null });
            return;
          }
          executeAttack(G, viewIdx, atkSlot, 'HERO');
          syncOnlineStateAndRender();
        } else {
          Sound.playError();
          showToast('敵方前排仍有武將駐守，無法直接攻擊敵方國力！', 'error');
        }
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      if (UI.selectedHandUid !== null || UI.selectedAttackerSlot !== null) {
        UI.selectedHandUid = null;
        UI.selectedAttackerSlot = null;
        render();
      }
    }
  });

  global.addEventListener('load', () => {
    render();
  });
})(window);