(function (global) {
  'use strict';

  const {
    FACTIONS, FACTION_LIST, BOARD_SIZE, SLOT_NAMES, MAX_HAND_SIZE, MAX_FOOD_CAP, MAX_RESERVE_FOOD, MAX_SUB_FACTION_CARDS, SUB_FACTION_MAX_COST, DECK_SIZE, MAX_COPIES, getHandLimit,
    CARD_DB, STARTER_DECKS, RECOMMENDED_DECKS, buildRandomLegalDeck, customDecks, MAX_SAVED_DECK_SLOTS, savedDeckSlots, saveDeckToSlot, deleteDeckSlot, validateDeck,
    getDeckForFaction, saveCustomDeck, Sound,
    isUnitSilenced, getUnitAtk, getUnitMaxAttacks, unitHasGuard, unitHasSnipe, isProtectedByAdjacentGuard, canUnitAttack, canUseActiveSkill, createGameState,
    getTotalFood, performMulligan, getValidAttackTargets, canPlayCard,
    playGeneral, playTactic, activateUnitSkill, resolvePendingPrompt, executeAttack, endTurn,
    AI_DIFFICULTIES, setAIDifficulty, getAIDifficulty,
    aiChooseMulligan, runAIStep
  } = global.Sanguo;

  const UI = {
    screen: 'LOBBY',
    lobbyMode: 'AI',
    aiDifficulty: 'normal',
    p0Faction: 'SHU',
    p1Faction: 'WEI',
    firstChoice: 'RANDOM',
    G: null,
    selectedHandUid: null,
    selectedAttackerSlot: null,
    mulliganSelected: new Set(),
    promptSelected: new Set(),
    hotseatPrivacyFor: null,
    theme: (function () { try { return localStorage.getItem('sanguo_theme_v34') || 'dark'; } catch (_) { return 'dark'; } })(),
    showLogDrawer: false,
    showPlayedCol: true,
    aiTimer: null,
    selectedSavedSlot: null,
    selectedRecommendedFaction: null,
    dbFaction: 'SHU',
    dbSubFaction: null,
    dbCards: [],
    dbSlotIdx: 0,
    dbDeckName: '',
    compFaction: 'ALL',
    compType: 'ALL',
    guideTab: 'TUTORIAL',
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
      .anim-death-ghost { animation: sgDeathBurst 0.62s ease-out forwards; pointer-events: none; }
      .anim-kill-pulse { animation: sgKillPulse 0.65s ease-out; }
      .anim-tactic-target { animation: sgTacticTargetFlash 0.7s ease-out; }

      @keyframes sgFlameFlicker {
        0%, 100% { transform: scaleY(1) translateY(0); opacity: 0.85; }
        50% { transform: scaleY(1.18) translateY(-2px); opacity: 1; }
      }
      @keyframes sgPoisonBubble {
        0% { transform: translateY(6px) scale(0.7); opacity: 0; }
        50% { opacity: 0.9; }
        100% { transform: translateY(-16px) scale(1.15); opacity: 0; }
      }
      @keyframes sgSlashDraw {
        0% { opacity: 0; transform: scale(0.4) rotate(-25deg); }
        25% { opacity: 1; transform: scale(1.15) rotate(0deg); }
        100% { opacity: 0; transform: scale(1.3) rotate(6deg); }
      }
      @keyframes sgBurnBurst {
        0% { box-shadow: 0 0 0 0 rgba(249,115,22,0.95), inset 0 0 24px rgba(239,68,68,0.9); }
        50% { box-shadow: 0 0 28px 8px rgba(249,115,22,0.75), inset 0 0 32px rgba(251,146,60,0.8); }
        100% { box-shadow: 0 0 0 0 rgba(249,115,22,0); }
      }
      @keyframes sgShieldBreak {
        0% { box-shadow: 0 0 0 0 rgba(56,189,248,0.95); transform: scale(1.04); }
        50% { box-shadow: 0 0 24px 6px rgba(56,189,248,0.65); transform: scale(0.97); }
        100% { box-shadow: 0 0 0 0 rgba(56,189,248,0); transform: scale(1); }
      }
      @keyframes sgHealGlow {
        0% { box-shadow: 0 0 0 0 rgba(52,211,153,0.9); }
        50% { box-shadow: 0 0 24px 6px rgba(52,211,153,0.65); }
        100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); }
      }
      @keyframes sgSkillPop {
        0% { opacity: 0; transform: translate(-50%, -18px) scale(0.88); }
        15% { opacity: 1; transform: translate(-50%, 0) scale(1.02); }
        82% { opacity: 1; transform: translate(-50%, 0) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -12px) scale(0.96); }
      }
      .burn-aura-card { box-shadow: inset 0 -18px 24px -10px rgba(239,68,68,0.65), 0 0 12px rgba(249,115,22,0.45) !important; border-color: rgba(249,115,22,0.75) !important; }
      .poison-aura-card { box-shadow: inset 0 -18px 24px -10px rgba(168,85,247,0.55), 0 0 12px rgba(34,197,94,0.4) !important; border-color: rgba(74,222,128,0.65) !important; }
      .flame-overlay { animation: sgFlameFlicker 0.8s ease-in-out infinite; pointer-events: none; }
      .poison-overlay { animation: sgPoisonBubble 1.3s ease-in-out infinite; pointer-events: none; }
      .slash-fx-overlay { animation: sgSlashDraw 0.48s cubic-bezier(0.16, 1, 0.3, 1) forwards; pointer-events: none; }
      .anim-burn-burst { animation: sgBurnBurst 0.65s ease-out; }
      .anim-shield-break { animation: sgShieldBreak 0.55s ease-out; }
      .anim-heal-glow { animation: sgHealGlow 0.65s ease-out; }
      .skill-showcase-banner {
        position: fixed;
        top: 66px;
        left: 50%;
        z-index: 65;
        pointer-events: none;
        animation: sgSkillPop 1.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
      }
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

    if (!document.getElementById('sanguo-v34-theme')) {
      const tStyle = document.createElement('style');
      tStyle.id = 'sanguo-v34-theme';
      tStyle.textContent = `
        /* 僅讓內層 #app 與內層 .bg-battlefield 透明，絕不覆蓋 body 本身的水墨底圖 */
        body.theme-dark #app,
        body.theme-light #app,
        body.theme-dark #app .bg-battlefield,
        body.theme-light #app .bg-battlefield {
          background: transparent !important;
          background-image: none !important;
        }

        /* ===== 深墨夜戰模式（高優先權，同時涵蓋 body.bg-battlefield） ===== */
        body.theme-dark,
        body.theme-dark.bg-battlefield {
          background-color: #0b0f18 !important;
          background-image:
            linear-gradient(180deg, rgba(10, 14, 24, 0.28) 0%, rgba(10, 14, 24, 0.46) 100%),
            url('./assets/lobby_dark.jpg') !important;
          background-size: cover !important;
          background-position: center !important;
          background-attachment: fixed !important;
          color: #f1ede4 !important;
        }
        body.theme-dark #app .ink-surface {
          background-color: rgba(16, 21, 32, 0.90) !important;
          color: #f1ede4;
        }
        body.theme-dark #app [class*="bg-amber-500/20"] {
          background-color: rgba(180, 120, 20, 0.34) !important;
          color: #fef08a !important;
        }

        /* ===== 宣紙水墨模式（高優先權，同時涵蓋 body.bg-battlefield） ===== */
        body.theme-light,
        body.theme-light.bg-battlefield {
          background-color: #efe5d2 !important;
          background-image:
            linear-gradient(180deg, rgba(248, 241, 227, 0.22) 0%, rgba(238, 226, 204, 0.36) 100%),
            url('./assets/lobby_light.jpg') !important;
          background-size: cover !important;
          background-position: center !important;
          background-attachment: fixed !important;
          color: #1c222b !important;
        }

        .lobby-ink-hero {
          background-size: cover !important;
          background-position: center !important;
        }
        body.theme-dark .lobby-ink-hero {
          background-image:
            linear-gradient(180deg, rgba(13, 18, 30, 0.30) 0%, rgba(19, 24, 34, 0.72) 100%),
            url('./assets/lobby_dark.jpg') !important;
        }
        body.theme-light .lobby-ink-hero {
          background-image:
            linear-gradient(180deg, rgba(252, 247, 236, 0.40) 0%, rgba(246, 237, 219, 0.84) 100%),
            url('./assets/lobby_light.jpg') !important;
        }

        .battle-ink-bg {
          background-size: cover !important;
          background-position: center !important;
          border-radius: 1rem;
        }
        body.theme-dark .battle-ink-bg {
          background-image:
            linear-gradient(180deg, rgba(10, 14, 22, 0.14) 0%, rgba(10, 14, 22, 0.24) 100%),
            url('./assets/board_dark.jpg') !important;
        }
        body.theme-light .battle-ink-bg {
          background-image:
            linear-gradient(180deg, rgba(250, 244, 232, 0.14) 0%, rgba(242, 233, 214, 0.24) 100%),
            url('./assets/board_light.jpg') !important;
        }

        .ink-card-back {
          background-image: url('./assets/card_back.jpg') !important;
          background-size: cover !important;
          background-position: center !important;
          border: 1px solid rgba(212, 175, 55, 0.65);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45);
        }

        /* ===== 淺色宣紙主題高對比適配（僅作用於主畫面 #app > :not(.fixed)，讓起手調度與彈窗維持深墨高對比） ===== */
        body.theme-light #app > :not(.fixed) .ink-surface,
        body.theme-light #app > :not(.fixed) .ink-header {
          background-color: rgba(251, 246, 235, 0.93) !important;
          border-color: rgba(154, 118, 56, 0.48) !important;
          color: #1c222b !important;
        }
        body.theme-light #app > :not(.fixed) .ink-surface-soft,
        body.theme-light #app > :not(.fixed) [class*="bg-slate-900"],
        body.theme-light #app > :not(.fixed) [class*="bg-slate-950"],
        body.theme-light #app > :not(.fixed) [class*="bg-slate-800"],
        body.theme-light #app > :not(.fixed) [class*="bg-[#141a26]"],
        body.theme-light #app > :not(.fixed) [class*="bg-[#181f2e]"],
        body.theme-light #app > :not(.fixed) [class*="bg-[#111622]"],
        body.theme-light #app > :not(.fixed) [class*="bg-[#151a25]"],
        body.theme-light #app > :not(.fixed) [class*="bg-[#151b26]"] {
          background-color: rgba(246, 238, 222, 0.92) !important;
          border-color: rgba(154, 118, 56, 0.44) !important;
          color: #1c222b !important;
        }
        body.theme-light #app > :not(.fixed) .ink-card-unit,
        body.theme-light #app > :not(.fixed) .ink-card-hand {
          background: linear-gradient(180deg, rgba(254, 250, 241, 0.97) 0%, rgba(242, 232, 212, 0.97) 100%) !important;
          border-color: rgba(146, 108, 48, 0.62) !important;
          color: #1c222b !important;
          box-shadow: 0 3px 10px rgba(45, 32, 12, 0.14);
        }
        body.theme-light #app > :not(.fixed) .ink-title-text {
          color: #78350f !important;
          background: none !important;
          -webkit-text-fill-color: #78350f !important;
          text-shadow: 0 1px 10px rgba(255, 250, 238, 0.95);
        }
        body.theme-light #app > :not(.fixed) .text-slate-100,
        body.theme-light #app > :not(.fixed) .text-slate-200,
        body.theme-light #app > :not(.fixed) .text-amber-50,
        body.theme-light #app > :not(.fixed) .text-amber-100 {
          color: #1c222b !important;
        }
        body.theme-light #app > :not(.fixed) .text-slate-300,
        body.theme-light #app > :not(.fixed) .text-slate-400 {
          color: #475569 !important;
        }
        body.theme-light #app > :not(.fixed) .text-amber-200,
        body.theme-light #app > :not(.fixed) .text-amber-300,
        body.theme-light #app > :not(.fixed) .text-yellow-300 {
          color: #92400e !important;
        }
        body.theme-light #app > :not(.fixed) .text-emerald-200,
        body.theme-light #app > :not(.fixed) .text-emerald-300 {
          color: #065f46 !important;
        }
        body.theme-light #app > :not(.fixed) .text-sky-300,
        body.theme-light #app > :not(.fixed) .text-blue-300 {
          color: #075985 !important;
        }
        body.theme-light #app > :not(.fixed) .text-rose-200,
        body.theme-light #app > :not(.fixed) .text-rose-300,
        body.theme-light #app > :not(.fixed) .text-rose-400,
        body.theme-light #app > :not(.fixed) .text-red-300 {
          color: #9f1239 !important;
        }
        body.theme-light #app > :not(.fixed) .text-indigo-100,
        body.theme-light #app > :not(.fixed) .text-indigo-200,
        body.theme-light #app > :not(.fixed) .text-purple-200,
        body.theme-light #app > :not(.fixed) .text-purple-300 {
          color: #3730a3 !important;
        }
        /* 卡牌費用球（糧草不足時 bg-slate-700）：改為淺紅宣紙底配深朱砂紅字；夠糧時維持金底黑字 */
        body.theme-light #app > :not(.fixed) .bg-slate-700 {
          background-color: #f3e2d4 !important;
          color: #9f1239 !important;
          border: 1px solid rgba(159, 18, 57, 0.35);
        }
        body.theme-light #app > :not(.fixed) .bg-amber-400 {
          background-color: #f59e0b !important;
          color: #111827 !important;
        }
        /* 國力防線≤20、深色陣營徽章（蜀/魏/吳/群）與深色功能鈕一律強制白字高對比 */
        body.theme-light #app > :not(.fixed) [class*="bg-sky-950"],
        body.theme-light #app > :not(.fixed) [class*="bg-sky-900"],
        body.theme-light #app > :not(.fixed) [class*="bg-red-900"],
        body.theme-light #app > :not(.fixed) [class*="bg-blue-900"],
        body.theme-light #app > :not(.fixed) [class*="bg-emerald-900"],
        body.theme-light #app > :not(.fixed) [class*="bg-purple-900"],
        body.theme-light #app > :not(.fixed) [class*="bg-indigo-950"],
        body.theme-light #app > :not(.fixed) [class*="bg-indigo-900"],
        body.theme-light #app > :not(.fixed) [class*="bg-rose-950"],
        body.theme-light #app > :not(.fixed) [class*="bg-emerald-950"],
        body.theme-light #app > :not(.fixed) [class*="bg-indigo-500"],
        body.theme-light #app > :not(.fixed) [class*="bg-emerald-600"],
        body.theme-light #app > :not(.fixed) [class*="bg-rose-600"],
        body.theme-light #app > :not(.fixed) [class*="from-indigo-500"] {
          color: #ffffff !important;
        }
        body.theme-light #app > :not(.fixed) [class*="bg-amber-500/20"],
        body.theme-light #app > :not(.fixed) [class*="bg-amber-500/25"] {
          background-color: rgba(245, 158, 11, 0.28) !important;
          color: #78350f !important;
          border-color: #d97706 !important;
        }
      `;
      document.head.appendChild(tStyle);
    }
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
          <p class="text-xs text-slate-200 mt-1 leading-relaxed">${c.text}</p>${c.flavor ? `<p class="text-[10px] italic text-amber-300/80 mt-1">${c.flavor}</p>` : ''}
        </div>
      </div>
    `;
    root.innerHTML = '';
    root.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 1500);
  }

  function showSkillShowcase(evt) {
    ensureFxStyles();
    const viewIdx = getViewingPlayerIdx();
    const isMine = evt.owner === viewIdx;
    const f = FACTIONS[evt.faction] || FACTIONS.NEU;
    let root = document.getElementById('skill-banner-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'skill-banner-root';
      document.body.appendChild(root);
    }
    const el = document.createElement('div');
    el.className = 'skill-showcase-banner flex items-center gap-3 px-4 py-2.5 rounded-2xl border-2 shadow-2xl backdrop-blur-md max-w-[92vw] ' +
      (isMine
        ? 'bg-slate-900/95 border-amber-400/90 text-amber-50'
        : 'bg-rose-950/95 border-rose-400/90 text-rose-50');
    el.innerHTML = `
      <span class="text-2xl shrink-0">${evt.icon || '✨'}</span>
      <div class="min-w-0">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="font-serif-tc font-black text-sm text-amber-300">${evt.unitName}・【${evt.skillName}】</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded border ${f.badgeBg}">${f.name}</span>
        </div>
        <div class="text-xs text-slate-200 mt-0.5">${evt.desc}</div>
      </div>
    `;
    root.innerHTML = '';
    root.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 1450);
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
      if (msg.action === 'RESOLVE_PROMPT' && G.pendingPrompt && G.pendingPrompt.owner === 1) {
        if (resolvePendingPrompt(G, 1, p.response)) syncOnlineStateAndRender();
        return;
      }
      if (G.phase !== 'MAIN' || G.activePlayer !== 1) return;
      if (msg.action === 'PLAY_GENERAL') {
        if (playGeneral(G, 1, p.cardUid, p.slotIdx)) syncOnlineStateAndRender();
      } else if (msg.action === 'PLAY_TACTIC') {
        if (playTactic(G, 1, p.cardUid, p.targetSlot ?? null)) syncOnlineStateAndRender();
      } else if (msg.action === 'ATTACK') {
        if (executeAttack(G, 1, p.attackerSlot, p.targetType, p.targetSlot ?? null)) syncOnlineStateAndRender();
      } else if (msg.action === 'ACTIVATE_SKILL') {
        if (activateUnitSkill(G, 1, p.slotIdx)) syncOnlineStateAndRender();
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
      // 若場上有需要人類玩家回應的彈窗（例如敵方賈詡【亂武】），暫停 AI 排程等待玩家回應
      if (G.pendingPrompt && !G.players[G.pendingPrompt.owner].isAI) return;

      const delay = UI._nextAiDelay || 620;
      UI._nextAiDelay = 620;
      if (UI._aiTurnTracker !== G.turnNumber) {
        UI._aiTurnTracker = G.turnNumber;
        UI._aiStepsThisTurn = 0;
      }
      UI.aiTimer = setTimeout(() => {
        UI.aiTimer = null;
        if (!UI.G || UI.G !== G || G.phase !== 'MAIN' || !G.players[G.activePlayer].isAI) return;
        if (G.pendingPrompt && !G.players[G.pendingPrompt.owner].isAI) return;

        UI._aiStepsThisTurn = (UI._aiStepsThisTurn || 0) + 1;
        let acted = false;
        try {
          if (UI._aiStepsThisTurn > 22) {
            if (G.pendingPrompt && G.players[G.pendingPrompt.owner].isAI) G.pendingPrompt = null;
            endTurn(G);
            acted = false;
          } else {
            acted = runAIStep(G);
          }
        } catch (err) {
          console.error('[AI Step Error]', err);
          if (G.pendingPrompt && G.players[G.pendingPrompt.owner].isAI) G.pendingPrompt = null;
          endTurn(G);
          acted = false;
        }

        // 防卡死保底：若 AI 步驟回傳未行動、沒有待人類回應的彈窗、卻仍停在 AI 回合，強制結束 AI 回合把控制權交還玩家
        if (!acted && G.phase === 'MAIN' && G.players[G.activePlayer].isAI && !(G.pendingPrompt && !G.players[G.pendingPrompt.owner].isAI)) {
          if (G.pendingPrompt && G.players[G.pendingPrompt.owner].isAI) G.pendingPrompt = null;
          endTurn(G);
        }

        const hadTactic = Boolean(G.animEvents && G.animEvents.some(a => a.kind === 'tactic'));
        render();
        if (G.phase === 'MAIN' && G.players[G.activePlayer].isAI && !(G.pendingPrompt && !G.players[G.pendingPrompt.owner].isAI)) {
          UI._nextAiDelay = hadTactic ? 1350 : 680;
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

    setAIDifficulty(UI.aiDifficulty);
    const p0Slot = UI.selectedSavedSlot !== null ? savedDeckSlots[UI.selectedSavedSlot] : null;
    const p0Rec = UI.selectedRecommendedFaction && RECOMMENDED_DECKS[UI.selectedRecommendedFaction];
    let p0CustomDeck;
    if (p0Slot && p0Slot.faction === UI.p0Faction) {
      p0CustomDeck = p0Slot.cards.slice();
    } else if (p0Rec && p0Rec.faction === UI.p0Faction) {
      p0CustomDeck = p0Rec.cards.slice();
    } else {
      p0CustomDeck = getDeckForFaction(UI.p0Faction);
    }
    const p1Deck = UI.lobbyMode === 'AI' ? buildRandomLegalDeck(UI.p1Faction) : getDeckForFaction(UI.p1Faction);
    UI.G = createGameState({
      mode: UI.lobbyMode,
      p0Faction: UI.p0Faction,
      p1Faction: UI.p1Faction,
      firstPlayer: first,
      p0Deck: p0CustomDeck,
      p1Deck,
      aiDifficulty: UI.aiDifficulty
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
    if (G.pendingPrompt && typeof G.pendingPrompt.owner === 'number') return G.pendingPrompt.owner;
    return G.activePlayer;
  }

  function keywordBadgeHtml(kw) {
    if (kw === 'COMBO') return `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40">連擊</span>`;
    if (kw === 'KILL') return `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-400/40">斬殺</span>`;
    if (kw === 'ARMOR') return `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-400/40">護甲</span>`;
    if (kw === 'GUARD') return `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/25 text-indigo-200 border border-indigo-400/50">護衛</span>`;
    if (kw === 'PIERCE') return `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-500/25 text-orange-200 border border-orange-400/50">破甲</span>`;
    if (kw === 'SHROUD') return `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-fuchsia-500/25 text-fuchsia-200 border border-fuchsia-400/50">帷幕</span>`;
    if (kw === 'RUSH') return `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">突襲</span>`;
    if (kw === 'DEATHRATTLE') return `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-400/40">遺計</span>`;
    if (kw === 'SNIPE') return `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">狙擊</span>`;
    return '';
  }

  // ==========================================
  // v3.4 更新：基本遊戲教學、FAQ 與規則手冊視窗
  // ==========================================
  function openGuideFaqModal(tab) {
    if (tab) UI.guideTab = tab;
    const isTut = UI.guideTab === 'TUTORIAL';
    const root = document.getElementById('modal-root');

    const tutorialHtml = `
      <div class="space-y-4">
        <div class="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-100 leading-relaxed">
          🎯 <b>遊戲目標：</b>把對手的「<b>國力</b>」（初始 30 點）降到 0 以下即獲勝！每一回合運用糧草部署武將、施放謀略、安排五格站位，拿下天下。
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80">
            <div class="text-amber-300 font-bold text-sm mb-1">1️⃣ 起手、糧草與糧倉</div>
            <ul class="list-disc pl-4 space-y-1 text-xs text-slate-300 leading-relaxed">
              <li>先手拿 3 張手牌（首回合不抽牌）；後手拿 4 張且第 1 回合正常抽 1 張牌。</li>
              <li>起手調度建議留下 <b>1～3 費武將</b>，確保前期能穩定鋪場。</li>
              <li>第 1～5 回合每回合糧草 +1，第 6 回合起每 2 回合 +1，<b>上限為 8 糧</b>。</li>
              <li>回合結束沒花完的普通糧草會自動存入「<b>糧倉</b>」（上限 3 點，李嚴在場上限 +1），供謀略牌與主動技使用。</li>
            </ul>
          </div>

          <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80">
            <div class="text-amber-300 font-bold text-sm mb-1">2️⃣ 五格排陣與「相鄰護衛」</div>
            <ul class="list-disc pl-4 space-y-1 text-xs text-slate-300 leading-relaxed">
              <li>戰場分為 <b>1～5 號位</b>，沒有固定前排，但帶「<b>護衛</b>」的武將會保護左右相鄰一格的非護衛友軍。</li>
              <li>把高攻脆皮武將（如黃忠、呂布、貂蟬）放在護衛旁邊，能大幅提升存活率。</li>
              <li><b>2 號位、4 號位</b>可同時掩護左右兩格，也能觸發【聲東擊西】抽牌加成。</li>
            </ul>
          </div>

          <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80">
            <div class="text-amber-300 font-bold text-sm mb-1">3️⃣ 精簡卡面、出牌與紀錄</div>
            <ul class="list-disc pl-4 space-y-1 text-xs text-slate-300 leading-relaxed">
              <li><b>查看完整技能：</b>對戰中卡面僅顯示核心數值與關鍵字；點擊卡片上的 <b>ⓘ</b>、直接點敵方非目標武將，或選中己方牌後按「<b>📖 查看完整說明</b>」即可開窗看完整描述。</li>
              <li><b>部署與攻擊：</b>點手牌武將 → 點己方空格上陣；點綠框武將 → 點敵將或敵方空場國力條攻擊；點帶「✨主動」武將可於中間列發動主動技。</li>
              <li><b>出牌紀錄與風格：</b>右側「<b>🗂️ 雙方已打出卡牌</b>」可隨時追蹤雙方出牌並點擊檢視；頂部可切換「🌙 深墨夜戰／☀️ 宣紙水墨」風格。</li>
            </ul>
          </div>

          <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80">
            <div class="text-amber-300 font-bold text-sm mb-1">4️⃣ 國力防線、手牌上限與組牌</div>
            <ul class="list-disc pl-4 space-y-1 text-xs text-slate-300 leading-relaxed">
              <li><b>🛡️ 國力防線補償（v3.4）：</b>當己方國力<b>首次跌至 ≤ 20</b> 時，下一個己方回合開始時將額外抽 1 張牌並獲得 <b>+1 點臨時糧草</b>（每場限觸發 1 次）。</li>
              <li>動態手牌上限隨國力遞減：<b>21～30 上限 8 張</b>、<b>11～20 上限 6 張</b>、<b>1～10 上限 4 張</b>。</li>
              <li>支援 <b>4 組自訂卡組存檔</b> 與 <b>4 套官方推薦卡組</b>；單人 AI 每場都會為敵軍隨機構築合法 30 張雙勢力牌組。</li>
            </ul>
          </div>
        </div>
      </div>
    `;

    const faqHtml = `
      <div class="space-y-3 text-xs sm:text-sm">
        <div class="p-4 rounded-xl bg-amber-500/10 border border-amber-500/35 space-y-2.5">
          <div class="font-bold text-amber-300 text-sm">📚 全 9 大關鍵字詳細說明與實戰舉例</div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-200 leading-relaxed">
            <div class="p-2.5 rounded-lg bg-slate-900/85 border border-slate-700/80">
              <div class="mb-1">${keywordBadgeHtml('GUARD')} <b class="text-indigo-200">保護左右相鄰友軍</b></div>
              保護與自身左右相鄰（各 1 格）的非護衛友軍免受敵方普通攻擊。<br/>
              <span class="text-slate-400">例：<b>曹仁</b>站 3 號位時，敵方普通攻擊不能打 2 號位或 4 號位友軍，必須先擊破曹仁。</span>
            </div>
            <div class="p-2.5 rounded-lg bg-slate-900/85 border border-slate-700/80">
              <div class="mb-1">${keywordBadgeHtml('ARMOR')} <b class="text-sky-200">抵銷普通攻擊傷害</b></div>
              每次受到<b>普通攻擊</b>時先扣除護甲值，且己方回合開始會重置；<b>謀略、技能與灼燒無視護甲</b>。<br/>
              <span class="text-slate-400">例：<b>于禁</b>有 2 點護甲，受到 3 攻普攻只扣 1 點血；但吃 3 傷【鐵騎突襲】會直接扣 3 血。</span>
            </div>
            <div class="p-2.5 rounded-lg bg-slate-900/85 border border-slate-700/80">
              <div class="mb-1">${keywordBadgeHtml('PIERCE')} <b class="text-orange-200">普攻無視護甲</b></div>
              發動普通攻擊時完全無視目標護甲，直接扣除生命值。<br/>
              <span class="text-slate-400">例：<b>關羽</b>（5 攻破甲）攻擊帶 2 護甲的曹仁，仍直接造成全額 5 點傷害。</span>
            </div>
            <div class="p-2.5 rounded-lg bg-slate-900/85 border border-slate-700/80">
              <div class="mb-1">${keywordBadgeHtml('RUSH')} <b class="text-emerald-200">登場即可攻擊</b></div>
              部署上場當回合不進入「整備中」，可立刻攻擊敵方武將（敵方空場時亦可直擊國力）。<br/>
              <span class="text-slate-400">例：<b>張飛</b>、<b>馬超</b>上場當回合即可立即出手解場（註：鄧艾登場當回合不可直擊國力）。</span>
            </div>
            <div class="p-2.5 rounded-lg bg-slate-900/85 border border-slate-700/80">
              <div class="mb-1">${keywordBadgeHtml('COMBO')} <b class="text-amber-200">每回合可攻擊兩次</b></div>
              解除整備後，單一己方回合內最多可主動發動 2 次普通攻擊。<br/>
              <span class="text-slate-400">例：<b>趙雲</b>、<b>孫策</b>可以先擊破敵方護衛，再立刻發動第二次攻擊直擊敵方主將或國力。</span>
            </div>
            <div class="p-2.5 rounded-lg bg-slate-900/85 border border-slate-700/80">
              <div class="mb-1">${keywordBadgeHtml('KILL')} <b class="text-rose-200">擊殺敵將觸發獎勵</b></div>
              無論主動攻擊或防守反擊，只要擊殺敵方武將便會觸發專屬效果。<br/>
              <span class="text-slate-400">例：<b>關羽</b>擊殺敵將後抽 1 牌並打敵國力 1 傷；<b>呂布</b>斬殺後本回合可額外再攻 1 次並打敵國力 2 傷。</span>
            </div>
            <div class="p-2.5 rounded-lg bg-slate-900/85 border border-slate-700/80">
              <div class="mb-1">${keywordBadgeHtml('DEATHRATTLE')} <b class="text-purple-200">陣亡時觸發效果</b></div>
              武將生命值歸零陣亡進入墓地時自動發動（若先被沉默則不會觸發）。<br/>
              <span class="text-slate-400">例：<b>郭嘉</b>陣亡時抽 1～2 張牌；<b>張角</b>陣亡時對敵全體武將造成 1 點傷害。</span>
            </div>
            <div class="p-2.5 rounded-lg bg-slate-900/85 border border-slate-700/80">
              <div class="mb-1">${keywordBadgeHtml('SNIPE')} <b class="text-cyan-200">普攻無視護衛保護</b></div>
              普通攻擊可繞過敵方相鄰護衛，直接瞄準任意一名存活敵方武將。<br/>
              <span class="text-slate-400">例：<b>黃忠</b>可直接越過王平狙擊後排的諸葛亮，且打受護衛保護目標額外 +2 傷並無視護甲。</span>
            </div>
            <div class="p-2.5 rounded-lg bg-slate-900/85 border border-slate-700/80 sm:col-span-2">
              <div class="mb-1">${keywordBadgeHtml('SHROUD')} <b class="text-fuchsia-200">無法成為指向性謀略目標</b></div>
              不能被任何「指定單一武將」的謀略牌選為目標（但仍會受到全體謀略牌、普通攻擊與武將技能影響）。<br/>
              <span class="text-slate-400">例：<b>諸葛亮</b>、<b>陸遜</b>、<b>曹操</b>、<b>賈詡</b>不能被【出師北伐】或【驅虎吞狼】指定，但仍會吃到【火燒赤壁】的全體傷害。</span>
            </div>
          </div>
        </div>
        <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80">
          <div class="font-bold text-amber-300">Q1：什麼是 v3.4 新增的「國力防線補償」？會重複觸發嗎？</div>
          <p class="text-slate-300 mt-1 leading-relaxed">當任一方國力<b>首次跌至 ≤ 20</b> 時會立即標記觸發，並在該玩家<b>下一個己方回合開始時</b>額外抽 1 張牌且獲得 +1 點臨時糧草，用來避免前期略處下風就一路被滾雪球。每名玩家每場對局僅觸發 1 次，即使之後回復國力高於 20 再跌落也不會重複觸發。</p>
        </div>

        <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80">
          <div class="font-bold text-amber-300">Q2：對戰中卡面變精簡了，要怎麼看卡牌的完整技能與狀態？</div>
          <p class="text-slate-300 mt-1 leading-relaxed">為了讓五格戰場與水墨背景更清爽，對戰中的手牌與場上武將預設只顯示費用、名稱、陣營、攻／血／甲與關鍵字標籤。你可以點擊任何卡牌右上角的 <b>ⓘ</b> 按鈕、在未指定攻擊時直接點擊敵方武將、選中己方卡牌後按中間列的「<b>📖 查看完整說明</b>」，或點擊右側「<b>🗂️ 雙方已打出卡牌</b>」紀錄中的任一張牌來查看完整說明與當前 Buff／Debuff。</p>
        </div>

        <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80">
          <div class="font-bold text-amber-300">Q3：v3.4 對賈詡、陸遜、周瑜、司馬懿與董卓做了哪些改動？</div>
          <ul class="list-disc pl-4 mt-1 space-y-1 text-slate-300 leading-relaxed">
            <li><b>賈詡（4費 2/4/0 帷幕）：</b>【完殺】改為登場指定一名敵將清除其所有正向增益（攻／甲／護衛增益）；新增主動技【亂武】（1糧，每場限1次），迫使敵方二選一棄 1 張手牌，或承受全體 1 傷且 -1 攻（1大回合）；若敵方無手牌則改為敵全體 2 傷。</li>
            <li><b>陸遜（6費 3/5/1 帷幕）：</b>新增【謙遜】帷幕；【連營】改為登場指定敵將造 2 傷並灼燒（2回合），火勢向左右相鄰敵將蔓延（各受 1 傷並灼燒 2 回合）；【度勢】回合結束時若敵方有 ≥ 2 名灼燒武將，對所有灼燒敵將造 1 傷並打敵方國力 2 傷。</li>
            <li><b>周瑜（5費 3/4/1）：</b>【英姿】登場敵全體 1 傷並灼燒（2回合），場上有「小喬」額外抽 1 張牌；新增主動技【火計】（1糧，每回合限1次），指定敵將若已灼燒則造 2 傷且本回合 -1 攻，未灼燒則施灼燒（2回合）並抽 1 張牌。</li>
            <li><b>司馬懿／董卓：</b>司馬懿身材調整為 <b>3/4/1</b>；董卓身材調整為 <b>4/6/1</b>。</li>
          </ul>
        </div>

        <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80">
          <div class="font-bold text-amber-300">Q4：為什麼剛上場的武將不能攻擊？【鄧艾】明明有突襲，為什麼登場回合不能打敵方國力？</div>
          <p class="text-slate-300 mt-1 leading-relaxed">一般武將剛上場會進入「整備中」，需等到下一個己方回合才能攻擊；帶有「突襲」的武將可立刻攻擊敵方武將（若敵方空場則可直擊國力）。為平衡節奏，<b>鄧艾登場當回合無法攻擊敵方國力</b>，需等到下一回合起才能無視敵陣直擊國力。</p>
        </div>

        <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80">
          <div class="font-bold text-amber-300">Q5：什麼是「1 大回合」？糧倉為什麼不能用來出武將？</div>
          <p class="text-slate-300 mt-1 leading-relaxed">標示「1 大回合（或本回合與下個敵方回合）」的效果涵蓋<b>己方當前整個回合 + 對手下一個完整回合</b>；標示「本回合」則於己方回合結束解除。回合結束未花完的普通糧草會存入糧倉（上限 3 點），<b>僅供謀略牌與主動技使用</b>。</p>
        </div>

        <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80">
          <div class="font-bold text-amber-300">Q6：敵軍 AI 的卡組是固定的嗎？宗師 AI 會偷看我的手牌嗎？</div>
          <p class="text-slate-300 mt-1 leading-relaxed">v3.4 起，單人 AI 對戰每次開局都會自動為敵軍陣營<b>隨機構築一副合法的 30 張雙勢力牌組</b>，無需與玩家卡組相同，每局對戰都有新鮮變化。<b>宗師 AI 推演時會清空你的手牌資料</b>，只依場上可見資訊決策，絕不作弊偷看。</p>
        </div>

        <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80">
          <div class="font-bold text-amber-300">Q7：牌庫抽乾了、其中一方完全沒武將了怎麼判勝負？</div>
          <p class="text-slate-300 mt-1 leading-relaxed">當一方<b>牌庫為 0 且場上與手牌均無武將牌</b>，而另一方場上或手牌仍有武將時，直接判定有武將方獲勝；若雙方都無牌庫且無武將，則待可用謀略牌打完後比較剩餘國力分勝負。</p>
        </div>

        <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80">
          <div class="font-bold text-amber-300">Q8：要怎麼跟朋友線上 1v1 對戰？</div>
          <p class="text-slate-300 mt-1 leading-relaxed">在主選單將對戰模式切換為「🌐 線上好友」，選好出戰陣營後按「建立房間」，把 4 位數房號或邀請連結傳給好友，好友輸入房號（或直接點連結）即可透過 P2P 免伺服器直接開戰。</p>
        </div>
      </div>
    `;

    root.innerHTML = `
      <div class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" data-close-backdrop="1">
        <div class="bg-[#141923] gold-border rounded-2xl max-w-3xl w-full max-h-[86vh] flex flex-col shadow-2xl overflow-hidden">
          <div class="px-5 py-3.5 border-b border-amber-500/25 flex items-center justify-between bg-[#1b2230]">
            <div class="flex items-center gap-2">
              <h2 class="font-serif-tc text-xl font-bold text-amber-300">🎓 基本遊戲教學與 FAQ</h2>
              <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-200 border border-amber-400/30">v3.4</span>
            </div>
            <button type="button" data-close-modal="1" class="text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800">✕</button>
          </div>
          <div class="px-5 py-2.5 bg-[#101520] border-b border-slate-800 flex gap-2">
            <button type="button" data-guide-tab="TUTORIAL" class="px-4 py-1.5 rounded-lg text-xs font-bold border transition ${isTut ? 'bg-amber-500 text-slate-950 border-amber-300' : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'}">
              📖 基本遊戲教學
            </button>
            <button type="button" data-guide-tab="FAQ" class="px-4 py-1.5 rounded-lg text-xs font-bold border transition ${!isTut ? 'bg-indigo-500 text-white border-indigo-300' : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'}">
              ❓ 常見問題 FAQ
            </button>
          </div>
          <div class="p-5 overflow-y-auto">${isTut ? tutorialHtml : faqHtml}</div>
          <div class="px-5 py-3 border-t border-slate-800 bg-[#11151e] flex justify-end">
            <button type="button" data-close-modal="1" class="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-sm">開始征戰</button>
          </div>
        </div>
      </div>
    `;
  }

  function openRulebookModal() {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" data-close-backdrop="1">
        <div class="bg-[#141923] gold-border rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
          <div class="px-5 py-4 border-b border-amber-500/25 flex items-center justify-between bg-[#1b2230]">
            <h2 class="font-serif-tc text-xl font-bold text-amber-300">《三國·謀定天下》完整遊戲規則手冊（v3.4）</h2>
            <button type="button" data-close-modal="1" class="text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800">✕</button>
          </div>
          <div class="p-5 overflow-y-auto space-y-4 text-sm text-slate-200 leading-relaxed">
            <section>
              <h3 class="font-bold text-amber-300 mb-1">一、遊戲概述、牌組構築與勝利條件</h3>
              <ul class="list-disc pl-5 space-y-1 text-slate-300">
                <li>雙方初始國力各 <b>30 點</b>，構築卡池共 <b>104 張</b>（74 名武將＋30 張謀略），每副卡組 <b>30 張</b>（同名最多 2 張；1 主陣營 + 最多 1 副陣營上限 10 張且限 ≤4 費 + 中立）。</li>
                <li>支援 <b>4 組自訂卡組槽位</b> 與 <b>4 套官方推薦卡組</b> 一鍵套用；單人 AI 模式每次開局皆為敵軍隨機構築合法 30 張雙勢力牌組。</li>
                <li>先手初始手牌 <b>3 張</b>（首回合不抽牌），後手 <b>4 張</b>（首回合正常抽 1 張）；開局前雙方皆可進行<b>起手調度（Mulligan）</b>。</li>
                <li>率先將敵方國力降至 <b>0 或以下</b>者勝；殘局時若一方牌庫歸零且場上與手牌均無武將，而另一方仍有武將，直接判有武將方勝。</li>
              </ul>
            </section>
            <section>
              <h3 class="font-bold text-amber-300 mb-1">二、五格戰場與🛡️相鄰護衛機制</h3>
              <ul class="list-disc pl-5 space-y-1 text-slate-300">
                <li>每位玩家擁有 <b>5 個上陣位</b>：<b>1號位左翼、2號位左輔、3號位中軍、4號位右輔、5號位右翼</b>。</li>
                <li><b>相鄰護衛：</b>僅帶有「<b>護衛</b>」的武將會保護與其相鄰（左一格與右一格）的非護衛友軍免受敵方普通攻擊；狙擊與謀略牌不受此限。</li>
                <li>敵方 5 格全空時，已就緒的武將可直接攻擊敵方國力（鄧艾登場當回合除外）。</li>
              </ul>
            </section>
            <section>
              <h3 class="font-bold text-amber-300 mb-1">三、糧草、糧倉、國力防線與大回合制</h3>
              <ul class="list-disc pl-5 space-y-1 text-slate-300">
                <li>第 1～5 回合每回合糧草上限 +1，第 6 回合起改為每 2 回合 +1（<b>封頂 8 點</b>）並充滿；<b>僅普通攻擊傷害可由護甲抵銷</b>（謀略、技能與灼燒皆無視護甲）。</li>
                <li><b>🛡️ 國力防線補償（v3.4 新增）：</b>當己方國力<b>首次跌至 ≤ 20</b> 時，於<b>下一個己方回合開始時</b>額外抽 1 張牌並獲得 <b>+1 點臨時糧草</b>（每名玩家每場限觸發 1 次）。</li>
                <li><b>大回合持續時間：</b>所有標示「1 大回合」的增益與減益涵蓋己方本回合與下一個敵方回合，於敵方回合結束時解除。</li>
                <li><b>結束階段：</b>手牌若超過動態上限（21～30 國力上限 8 張、11～20 上限 6 張、1～10 上限 4 張）需先自選棄牌；未用完普通糧草存入「<b>糧倉</b>」（上限 3 點，李嚴在場上限 4 點，供謀略與主動技使用）。</li>
              </ul>
            </section>
            <section>
              <h3 class="font-bold text-amber-300 mb-1">四、關鍵字與 v3.4 介面操作</h3>
              <ul class="list-disc pl-5 space-y-1 text-slate-300">
                <li><b>破甲：</b>普通攻擊無視護甲｜<b>護衛：</b>保護相鄰左右友軍免受普攻｜<b>突襲：</b>登場即行動，敵空場可直擊國力｜<b>狙擊：</b>普通攻擊無視護衛｜<b>帷幕：</b>不受謀略牌指定｜<b>斬殺／連擊／遺計</b>。</li>
                <li><b>精簡卡面與詳情檢視：</b>對戰中卡面僅顯示核心數值，點擊 <b>ⓘ</b>、敵方非目標武將、行動列「📖 查看完整說明」或右側「🗂️ 雙方已打出卡牌」紀錄皆可開窗瀏覽完整描述。</li>
                <li><b>水墨雙風格切換：</b>大廳與對戰頂部皆可一鍵切換「🌙 深墨夜戰」與「☀️ 宣紙水墨」視覺主題。</li>
              </ul>
            </section>
            <section>
              <h3 class="font-bold text-amber-300 mb-1">五、v3.4 武將改動速查</h3>
              <ul class="list-disc pl-5 space-y-1 text-slate-300">
                <li><b>賈詡（4費 2/4/0 帷幕）：</b>登場【完殺】清除指定敵將所有正向增益；主動【亂武】（1糧，限1次）迫使敵方棄 1 牌或全體 1 傷且 -1 攻（無手牌則敵全體 2 傷）。</li>
                <li><b>陸遜（6費 3/5/1 帷幕）：</b>【謙遜】帷幕；登場【連營】指定敵將 2 傷灼燒並向左右相鄰蔓延 1 傷灼燒；回合結束【度勢】敵方 ≥ 2 灼燒武將時，灼燒敵將各 1 傷且敵國力 -2。</li>
                <li><b>周瑜（5費 3/4/1）：</b>登場【英姿】敵全體 1 傷灼燒（小喬在場抽 1）；主動【火計】（1糧，每回合限1次）已灼燒敵將造 2 傷且本回合 -1 攻，未灼燒則施灼燒並抽 1 牌。</li>
                <li><b>司馬懿（5費 3/4/1）｜董卓（5費 4/6/1）：</b>數值平衡微調，技能維持不變。</li>
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
      <div class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" data-close-backdrop="1">
        <div class="bg-[#141923] gold-border rounded-2xl max-w-xl w-full max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
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
      <div class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4" data-close-backdrop="1">
        <div class="bg-[#141923] gold-border rounded-2xl max-w-5xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
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
                <button type="button" data-comp-faction="${t.id}" class="px-2.5 py-1 rounded-lg text-xs font-bold border transition ${fac === t.id ? 'bg-amber-500 text-slate-950 border-amber-300' : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'}">${t.label}</button>
              `).join('')}
            </div>
            <div class="flex gap-1.5">
              ${typeTabs.map(t => `
                <button type="button" data-comp-type="${t.id}" class="px-2.5 py-1 rounded-lg text-xs font-bold border transition ${typ === t.id ? 'bg-indigo-500 text-white border-indigo-300' : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'}">${t.label}</button>
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
                    <p class="text-xs text-slate-200 mt-2 leading-relaxed">${c.text}</p>${c.type === 'TACTIC' && c.flavor ? `<p class="text-[11px] italic text-amber-300/75 mt-1">${c.flavor}</p>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function openCardDetailModal(cardOrUnit, ownerLabel = '') {
    if (!cardOrUnit) return;
    const def = CARD_DB[cardOrUnit.id] || cardOrUnit;
    const f = FACTIONS[def.faction || cardOrUnit.faction] || FACTIONS.NEU;
    const isUnit = typeof cardOrUnit.hp === 'number' && typeof cardOrUnit.maxHp === 'number';
    const atkVal = isUnit && UI.G ? getUnitAtk(cardOrUnit, UI.G) : (def.atk || cardOrUnit.baseAtk || 0);
    const hpText = isUnit ? `${cardOrUnit.hp}/${cardOrUnit.maxHp}` : `${def.hp || cardOrUnit.baseHp || 0}`;
    const armorVal = isUnit ? cardOrUnit.armor : (def.armor || cardOrUnit.baseArmor || 0);
    const kws = (isUnit ? cardOrUnit.keywords : (def.keywords || cardOrUnit.keywords || [])) || [];
    const effectsHtml = isUnit && cardOrUnit.effects && cardOrUnit.effects.length > 0
      ? `<div class="pt-2 border-t border-slate-800"><div class="text-[11px] font-bold text-amber-300 mb-1">目前狀態效果</div><div class="flex flex-wrap gap-1.5">${cardOrUnit.effects.map(e => `<span class="px-2 py-0.5 rounded text-[11px] bg-slate-800 border border-slate-600 text-slate-200">${e.label || e.type} (${e.turns || Math.ceil((e.halfTurns || 1)/2)}回合)</span>`).join('')}</div></div>`
      : '';
    const m = document.getElementById('modal-root');
    if (!m) return;
    m.innerHTML = `
      <div class="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4" data-close-backdrop="1">
        <div class="bg-[#141925] gold-border rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-3.5">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-11 h-11 rounded-xl bg-slate-800 border border-amber-500/40 flex items-center justify-center text-2xl shrink-0">${def.icon || cardOrUnit.icon || '🃏'}</div>
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="font-serif-tc text-xl font-black text-amber-100">${def.name || cardOrUnit.name}</h3>
                  <span class="text-[11px] px-2 py-0.5 rounded-full border ${f.badgeBg}">${f.name}陣營</span>
                  <span class="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-xs font-black">${def.cost} 糧</span>
                </div>
                <div class="text-xs text-slate-400 mt-0.5">${def.type === 'GENERAL' ? '武將牌' : '謀略牌'}${def.skillName ? ` • 【${def.skillName}】` : ''}${ownerLabel ? ` • ${ownerLabel}` : ''}</div>
              </div>
            </div>
            <button type="button" data-close-modal="1" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs">✕</button>
          </div>

          ${def.type === 'GENERAL' ? `
            <div class="grid grid-cols-3 gap-2 text-center">
              <div class="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30"><div class="text-[10px] text-amber-200/80">攻擊力</div><div class="text-base font-black text-amber-300">⚔️ ${atkVal}</div></div>
              <div class="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30"><div class="text-[10px] text-emerald-200/80">生命值</div><div class="text-base font-black text-emerald-300">❤️ ${hpText}</div></div>
              <div class="p-2 rounded-xl bg-sky-500/10 border border-sky-500/30"><div class="text-[10px] text-sky-200/80">護甲</div><div class="text-base font-black text-sky-300">🛡️ ${armorVal}</div></div>
            </div>
          ` : ''}

          ${kws.length > 0 ? `<div class="flex flex-wrap gap-1.5">${kws.map(keywordBadgeHtml).join('')}</div>` : ''}

          <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-sm text-slate-100 leading-relaxed">
            ${def.text || cardOrUnit.text || ''}
          </div>
          ${def.flavor ? `<p class="text-xs italic text-amber-300/80 px-1">${def.flavor}</p>` : ''}
          ${effectsHtml}
          <div class="pt-2 border-t border-slate-800 flex justify-end">
            <button type="button" data-close-modal="1" class="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-600">關閉</button>
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
            <span class="text-[11px] px-2 py-0.5 rounded-full border ${f.badgeBg}">${f.name}陣營</span>
          </div>
          <p class="text-xs text-slate-400 mt-1.5 leading-relaxed">${f.desc}</p>
          <div class="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>${isCustom ? '✨ 自訂卡組' : '標準預組'} (${deckCount}張)</span>
            ${isSel ? '<span class="text-amber-300 font-semibold">✓ 已選擇</span>' : ''}
          </div>
        </button>
      `;
    }).join('');

    const curDiff = AI_DIFFICULTIES[UI.aiDifficulty] || AI_DIFFICULTIES.normal;

    return `
      <div class="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
        <div class="w-full max-w-4xl bg-[#131822]/92 ink-surface gold-border rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xs">
          <div class="relative px-6 py-7 sm:py-9 text-center border-b border-amber-500/25 lobby-ink-hero">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium mb-3">
              <span>完整規則 v3.4</span>
              <span>•</span>
              <span>1v1 策略卡牌對戰</span>
            </div>
            <h1 class="font-serif-tc ink-title-text text-3xl sm:text-5xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200">
              三國・謀定天下
            </h1>
            <p class="text-slate-300 text-sm sm:text-base mt-2 max-w-xl mx-auto">
              五格排陣相鄰護衛，糧倉調度定乾坤。蜀、魏、吳、群雙陣營合縱連橫，運籌帷幄逐鹿中原。
            </p>
            <div class="mt-4 inline-flex flex-wrap items-center justify-center gap-2 text-xs bg-slate-950/70 px-3.5 py-1.5 rounded-full border border-slate-700/80">
              <span class="text-red-300 font-bold">蜀</span>
              <span class="text-blue-300 font-bold">魏</span>
              <span class="text-emerald-300 font-bold">吳</span>
              <span class="text-purple-300 font-bold">群</span>
              <span class="text-slate-300">• 104張卡池 • 4組自訂卡組 • 國力防線補償</span>
            </div>
          </div>

          <div class="p-5 sm:p-6 space-y-5">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-amber-300/90 uppercase tracking-wider mb-2">對戰模式</label>
                <div class="grid grid-cols-3 gap-2">
                  <button type="button" data-set-mode="AI" class="py-2.5 px-2 rounded-xl border text-xs sm:text-sm font-semibold transition ${UI.lobbyMode === 'AI' ? 'bg-amber-500/20 border-amber-400 text-amber-200' : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'}">🤖 單人 AI</button>
                  <button type="button" data-set-mode="HOTSEAT" class="py-2.5 px-2 rounded-xl border text-xs sm:text-sm font-semibold transition ${UI.lobbyMode === 'HOTSEAT' ? 'bg-amber-500/20 border-amber-400 text-amber-200' : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'}">⚔️ 同屏 1v1</button>
                  <button type="button" data-set-mode="ONLINE" class="py-2.5 px-2 rounded-xl border text-xs sm:text-sm font-semibold transition ${UI.lobbyMode === 'ONLINE' ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200' : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'}">🌐 線上好友</button>
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

            ${UI.lobbyMode === 'AI' ? `
              <div class="p-3.5 rounded-xl bg-slate-900/70 border border-slate-700/80 space-y-2.5">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <span class="text-xs font-semibold text-amber-300/90 uppercase tracking-wider">🧠 AI 難度等級</span>
                  <span class="text-xs text-slate-300">${curDiff.desc}</span>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  ${Object.values(AI_DIFFICULTIES).map(d => `
                    <button type="button" data-set-ai-diff="${d.id}"
                      class="py-2 px-2.5 rounded-xl border text-xs font-bold transition ${UI.aiDifficulty === d.id
                        ? 'bg-indigo-500/25 border-indigo-400 text-indigo-100 ring-1 ring-indigo-400/50'
                        : 'bg-slate-950/70 border-slate-700 text-slate-300 hover:border-slate-500'}">
                      ${d.name}
                    </button>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm font-bold text-amber-200">${UI.lobbyMode === 'HOTSEAT' ? '玩家一主陣營' : '我方出戰陣營'}</span>
                  ${UI.selectedSavedSlot !== null && savedDeckSlots[UI.selectedSavedSlot] ? `<span class="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">已套用：${savedDeckSlots[UI.selectedSavedSlot].name}</span>` : UI.selectedRecommendedFaction && RECOMMENDED_DECKS[UI.selectedRecommendedFaction] ? `<span class="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40">⭐ 推薦：${RECOMMENDED_DECKS[UI.selectedRecommendedFaction].name}</span>` : ''}
                </div>
                <div class="grid grid-cols-2 gap-2.5">${renderFactionCards(UI.p0Faction, 'p0')}</div>
                <div class="mt-3 p-2.5 rounded-xl bg-slate-900/75 ink-surface-soft border border-slate-800 space-y-2">
                  <div class="text-[11px] font-semibold text-amber-300/90">⭐ 官方推薦卡組（一鍵套用出戰）</div>
                  <div class="grid grid-cols-2 gap-1.5">
                    ${FACTION_LIST.map(fid => {
                      const rec = RECOMMENDED_DECKS[fid];
                      const rf = FACTIONS[fid];
                      const active = UI.selectedRecommendedFaction === fid && UI.selectedSavedSlot === null;
                      return `<button type="button" data-lobby-select-rec="${fid}" class="p-2 rounded-lg border text-left transition ${active ? 'bg-amber-500/20 border-amber-400 ring-1 ring-amber-400/50' : 'bg-slate-950/75 border-slate-700 hover:border-amber-400/60'}"><div class="flex items-center justify-between gap-1"><span class="text-[10px] px-1.5 rounded border ${rf.badgeBg}">${rf.name}+${FACTIONS[rec.subFaction].name}</span>${active ? '<span class="text-[10px] text-amber-300 font-bold">✓</span>' : ''}</div><div class="text-[11px] font-bold text-amber-100 truncate mt-1">${rec.name}</div></button>`;
                    }).join('')}
                  </div>
                </div>
                <div class="mt-2.5 p-2.5 rounded-xl bg-slate-900/75 ink-surface-soft border border-slate-800 space-y-1.5">
                  <div class="text-[11px] font-semibold text-amber-300/90">💾 我的已儲存卡組（最多 ${MAX_SAVED_DECK_SLOTS} 組）</div>
                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    ${savedDeckSlots.map((slot, idx) => {
                      const active = UI.selectedSavedSlot === idx && slot;
                      if (!slot) {
                        return `<button type="button" data-action="open-deckbuilder-slot" data-slot-idx="${idx}" class="p-2 rounded-lg border border-dashed border-slate-700 bg-slate-950/50 hover:border-amber-400/50 text-left transition"><div class="text-[10px] text-slate-500">槽位 ${idx + 1}</div><div class="text-[11px] text-slate-400 mt-0.5">+ 前往組牌</div></button>`;
                      }
                      const sf = FACTIONS[slot.faction];
                      return `<button type="button" data-lobby-select-slot="${idx}" class="p-2 rounded-lg border text-left transition ${active ? 'bg-emerald-950/70 border-emerald-400 ring-1 ring-emerald-400/40' : 'bg-slate-950/80 border-slate-700 hover:border-amber-400/60'}"><div class="flex items-center justify-between gap-1"><span class="text-[10px] px-1 rounded border ${sf.badgeBg}">${sf.name}</span><span class="text-[10px] text-slate-400">槽${idx + 1}</span></div><div class="text-[11px] font-bold text-amber-100 truncate mt-1">${slot.name}</div></button>`;
                    }).join('')}
                  </div>
                </div>
              </div>
              ${UI.lobbyMode === 'ONLINE' ? `
                <div class="flex flex-col justify-between p-4 rounded-xl bg-slate-900/80 border border-emerald-500/35 space-y-4">
                  <div>
                    <div class="text-sm font-bold text-emerald-300 mb-1">🌐 好友房號連線（免伺服器）</div>
                    <p class="text-xs text-slate-400 leading-relaxed">先在左側選好你的出戰陣營，再選擇「建立房間」把房號或連結傳給好友，或輸入好友的房號直接加入。</p>
                  </div>
                  <div class="space-y-2.5">
                    <button type="button" data-action="online-host" class="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition">🏯 建立房間（我是房主）</button>
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
                      <input id="online-room-input" type="text" maxlength="6" inputmode="numeric" placeholder="輸入 4 位房號" value="${UI.onlineInputCode}" class="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-amber-200 font-mono text-sm tracking-widest focus:outline-none focus:border-emerald-400" />
                      <button type="button" data-action="online-join" class="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm">加入</button>
                    </div>
                  </div>
                  ${UI.onlineStatus === 'LOADING' || UI.onlineStatus === 'CONNECTING' ? `<div class="text-xs text-amber-300 font-medium">⏳ ${UI.onlineStatus === 'LOADING' ? '正在載入連線模組並建立房間…' : `正在連線至房號 ${UI.onlineRoomCode}…`}</div>` : ''}
                  ${UI.onlineError ? `<div class="text-xs text-rose-300 bg-rose-950/60 border border-rose-500/40 rounded-lg px-3 py-2">⚠️ ${UI.onlineError}</div>` : ''}
                </div>
              ` : `
                <div>
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-sm font-bold text-rose-200">${UI.lobbyMode === 'AI' ? `敵軍 AI 主陣營（${curDiff.name}）` : '玩家二主陣營'}</span>${UI.lobbyMode === 'AI' ? `<span class="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-400/40">🎲 每次隨機合法牌組</span>` : ''}
                  </div>
                  <div class="grid grid-cols-2 gap-2.5">${renderFactionCards(UI.p1Faction, 'p1')}</div>
                </div>
              `}
            </div>

            <div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <div class="flex flex-wrap gap-2">
                <button type="button" data-action="open-guide" class="px-3.5 py-2.5 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/50 text-indigo-100 text-sm font-semibold transition">🎓 教學與 FAQ</button>
                <button type="button" data-action="open-deckbuilder" class="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 text-sm font-semibold transition">🃏 組牌工坊</button>
                <button type="button" data-action="open-compendium" class="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 text-sm font-semibold transition">📚 卡牌圖鑑</button>
                <button type="button" data-action="open-rules" class="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 text-sm font-semibold transition">📜 規則手冊</button>
                <button type="button" data-action="toggle-theme" class="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-amber-500/50 text-amber-200 text-sm font-semibold transition">${UI.theme === 'dark' ? '🌙 深墨夜戰' : '☀️ 宣紙水墨'}</button>
                <button type="button" data-action="toggle-mute" class="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 text-sm font-semibold transition">${Sound.muted ? '🔇 靜音' : '🔊 音效'}</button>
              </div>
              ${UI.lobbyMode === 'ONLINE' ? `
                <span class="text-xs text-emerald-300/90 font-medium">🌐 請於右側建立或加入房間開始連線對戰</span>
              ` : `
                <button type="button" data-action="start-match" class="px-7 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-extrabold text-base shadow-lg gold-glow transition">⚔️ 鳴鼓開戰</button>
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

    // 右側卡組概括清單（依費用排序，只顯示費用、名稱、國家與張數）
    const deckSummaryItems = Object.entries(counts)
      .map(([id, cnt]) => ({ card: CARD_DB[id], cnt }))
      .filter(x => x.card)
      .sort((a, b) => a.card.cost - b.card.cost || a.card.name.localeCompare(b.card.name, 'zh-Hant'));
    const curSlotObj = savedDeckSlots[UI.dbSlotIdx];
    const displayDeckName = UI.dbDeckName || (curSlotObj ? curSlotObj.name : `${FACTIONS[fid].name}自訂 ${UI.dbSlotIdx + 1}`);

    return `
      <div class="flex-1 flex flex-col p-4 max-w-7xl w-full mx-auto gap-4">
        <div class="flex flex-wrap items-center justify-between gap-3 bg-[#151a25] gold-border rounded-xl px-4 py-3">
          <div class="flex items-center gap-3 flex-wrap">
            <button type="button" data-action="back-lobby" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-200">← 返回大廳</button>
            <h2 class="font-serif-tc text-xl font-bold text-amber-300">組牌工坊</h2>
            <div class="flex gap-1.5">
              ${FACTION_LIST.map(f => `
                <button type="button" data-db-faction="${f}" class="px-3 py-1 rounded-lg text-xs font-bold border ${fid === f ? 'bg-amber-500 text-slate-950 border-amber-300' : 'bg-slate-900 text-slate-300 border-slate-700'}">${FACTIONS[f].name}</button>
              `).join('')}
            </div>
          </div>
          <div class="flex items-center gap-2.5 flex-wrap">
            <span class="text-sm font-bold ${UI.dbCards.length === DECK_SIZE ? 'text-emerald-400' : 'text-amber-300'}">牌庫數量：${UI.dbCards.length} / ${DECK_SIZE}</span>
            <button type="button" data-action="db-load-rec" class="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-xs text-amber-200 border border-amber-400/60 font-bold">⭐ 套用推薦牌組</button>
            <button type="button" data-action="db-reset" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-600">重置為預組</button>
            <button type="button" data-action="db-clear" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-xs text-slate-200 border border-slate-600">清空</button>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 bg-[#151a25]/70 border border-slate-800 rounded-xl px-4 py-2 text-xs">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-slate-400 font-semibold">副陣營（最多 ${MAX_SUB_FACTION_CARDS} 張，限 ≤${SUB_FACTION_MAX_COST} 費）：</span>
            <button type="button" data-db-subfaction="" class="px-2.5 py-1 rounded-lg border font-bold ${!subFid ? 'bg-slate-200 text-slate-950 border-white' : 'bg-slate-900 text-slate-400 border-slate-700'}">無</button>
            ${FACTION_LIST.filter(f => f !== fid).map(f => `
              <button type="button" data-db-subfaction="${f}" class="px-2.5 py-1 rounded-lg border font-bold ${subFid === f ? 'bg-indigo-500 text-white border-indigo-300' : 'bg-slate-900 text-slate-300 border-slate-700'}">${FACTIONS[f].name}</button>
            `).join('')}
          </div>
          <span class="font-bold ${validation.subCount > MAX_SUB_FACTION_CARDS ? 'text-rose-400' : 'text-indigo-300'}">副陣營已選：${validation.subCount} / ${MAX_SUB_FACTION_CARDS}</span>
        </div>

        <div class="flex flex-col lg:flex-row gap-4 items-start pb-6">
          <div class="flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 w-full">
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
                      <span class="text-slate-400">${c.type === 'GENERAL' ? `⚔️${c.atk} ❤️${c.hp}${c.armor ? ` 🛡️${c.armor}` : ''}` : '📜 謀略牌'}</span>
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

          <aside class="w-full lg:w-80 shrink-0 lg:sticky lg:top-4 space-y-3">
            <div class="bg-[#141a26] gold-border rounded-xl p-3.5 space-y-2.5">
              <div class="flex items-center justify-between">
                <h3 class="font-serif-tc text-sm font-bold text-amber-300">💾 已儲存卡組（3 槽位）</h3>
                <span class="text-[10px] text-slate-400">點擊切換／載入</span>
              </div>
              <div class="space-y-1.5">
                ${savedDeckSlots.map((slot, idx) => {
                  const isSelected = UI.dbSlotIdx === idx;
                  const sf = slot ? FACTIONS[slot.faction] : null;
                  return `
                    <div class="p-2 rounded-lg border transition flex items-center justify-between gap-2 ${isSelected ? 'bg-indigo-950/60 border-indigo-400' : 'bg-slate-900/80 border-slate-700/80'}">
                      <button type="button" data-db-select-slot="${idx}" class="flex-1 text-left min-w-0">
                        <div class="flex items-center gap-1.5">
                          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">槽 ${idx + 1}</span>
                          ${slot ? `<span class="text-[10px] px-1.5 py-0.5 rounded border ${sf.badgeBg}">${sf.name}${slot.subFaction ? '+' + FACTIONS[slot.subFaction].name : ''}</span>` : ''}
                          <span class="text-xs font-bold text-amber-100 truncate">${slot ? slot.name : '空槽位'}</span>
                        </div>
                      </button>
                      ${slot ? `<button type="button" data-db-delete-slot="${idx}" class="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-rose-900/80 text-slate-400 hover:text-rose-200" title="刪除槽位">✕</button>` : ''}
                    </div>
                  `;
                }).join('')}
              </div>
              <div class="pt-2 border-t border-slate-800 space-y-2">
                <input id="db-deck-name-input" type="text" maxlength="20" placeholder="輸入卡組名稱（如：蜀漢快攻）" value="${displayDeckName}"
                  class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-amber-100 focus:outline-none focus:border-amber-400" />
                <button type="button" data-action="db-save-slot" class="w-full py-2 rounded-lg text-xs font-extrabold transition ${validation.valid ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950' : 'bg-slate-700 text-slate-400 cursor-not-allowed'}" ${validation.valid ? '' : 'disabled'}>
                  💾 儲存至槽位 ${UI.dbSlotIdx + 1}（${UI.dbCards.length}/${DECK_SIZE}）
                </button>
              </div>
            </div>

            <div class="bg-[#141a26] border border-slate-700/80 rounded-xl p-3.5 flex flex-col max-h-[58vh]">
              <div class="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 class="font-serif-tc text-sm font-bold text-amber-200">📋 目前卡組概括</h3>
                <span class="text-xs font-bold ${UI.dbCards.length === DECK_SIZE ? 'text-emerald-400' : 'text-amber-300'}">${UI.dbCards.length} / ${DECK_SIZE}</span>
              </div>
              <div class="overflow-y-auto mt-2 space-y-1 pr-1 flex-1">
                ${deckSummaryItems.length === 0
                  ? `<div class="text-xs text-slate-500 text-center py-6">尚未加入任何卡牌</div>`
                  : deckSummaryItems.map(({ card, cnt }) => {
                      const f = FACTIONS[card.faction] || FACTIONS.NEU;
                      return `
                        <button type="button" data-db-remove="${card.id}" title="點擊移出 1 張"
                          class="w-full px-2 py-1.5 rounded-lg bg-slate-900/90 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-500/40 flex items-center justify-between gap-2 text-xs transition">
                          <div class="flex items-center gap-1.5 min-w-0">
                            <span class="w-5 h-5 rounded-full bg-amber-400 text-slate-950 text-[11px] font-black flex items-center justify-center shrink-0">${card.cost}</span>
                            <span class="text-slate-100 font-semibold truncate">${card.name}</span>
                          </div>
                          <div class="flex items-center gap-1.5 shrink-0">
                            <span class="text-[10px] px-1.5 py-0.5 rounded border ${f.badgeBg}">${f.name}</span>
                            ${cnt > 1 ? `<span class="text-[11px] font-extrabold text-amber-300">×${cnt}</span>` : ''}
                          </div>
                        </button>
                      `;
                    }).join('')}
              </div>
            </div>
          </aside>
        </div>
      </div>
    `;
  }

  function renderBoardUnit(u, ownerIdx, slotIdx, isOpponentSide) {
    const G = UI.G;
    const viewIdx = getViewingPlayerIdx();
    const isMyTurn = G.phase === 'MAIN' && G.activePlayer === viewIdx && !G.players[viewIdx].isAI;
    const f = FACTIONS[u.faction];
    const atkVal = getUnitAtk(u, G);
    const maxAtks = getUnitMaxAttacks(u);
    const ready = !isOpponentSide && isMyTurn && canUnitAttack(u, G);
    const isSelectedAttacker = !isOpponentSide && UI.selectedAttackerSlot === slotIdx;

    let isValidTarget = false;
    if (isMyTurn) {
      if (UI.selectedAttackerSlot !== null && isOpponentSide) {
        const valid = getValidAttackTargets(G, viewIdx, UI.selectedAttackerSlot);
        if (valid.slots.includes(slotIdx)) isValidTarget = true;
      } else if (UI.selectedHandUid !== null) {
        const card = G.players[viewIdx].hand.find(c => c.uid === UI.selectedHandUid);
        if (card && card.type === 'TACTIC') {
          if (card.target === 'enemy_general' && isOpponentSide) isValidTarget = true;
          if (card.target === 'enemy_adjacent_pair' && isOpponentSide) {
            const ob = G.players[ownerIdx].board;
            if ((slotIdx > 0 && ob[slotIdx - 1]) || (slotIdx < BOARD_SIZE - 1 && ob[slotIdx + 1])) isValidTarget = true;
          }
          if (card.target === 'ally_general' && !isOpponentSide) isValidTarget = true;
        }
      }
    }

    const hasGuard = unitHasGuard(u);
    const silencedNow = isUnitSilenced(u);
    const anims = G.animEvents || [];
    const didAttack = anims.some(a => a.kind === 'attack' && a.attackerOwner === ownerIdx && a.attackerSlot === slotIdx);
    const hitEvt = anims.find(a => a.kind === 'attack' && a.targetType === 'UNIT' && a.targetOwner === ownerIdx && a.targetSlot === slotIdx);
    const didKillBonus = anims.some(a => a.kind === 'kill_bonus' && a.owner === ownerIdx && a.slot === slotIdx);
    const tacticHit = anims.some(a => a.kind === 'tactic' && (
      (a.card.target === 'enemy_general' && a.owner !== ownerIdx && a.targetSlot === slotIdx) ||
      (a.card.target === 'ally_general' && a.owner === ownerIdx && a.targetSlot === slotIdx)
    ));
    const fxBurn = anims.some(a => a.kind === 'fx' && a.fxType === 'burn' && a.owner === ownerIdx && a.slot === slotIdx);
    const fxShieldBreak = anims.some(a => a.kind === 'fx' && (a.fxType === 'shield_break' || a.fxType === 'pierce') && a.owner === ownerIdx && a.slot === slotIdx);
    const fxHeal = anims.some(a => a.kind === 'fx' && (a.fxType === 'heal' || a.fxType === 'buff') && a.owner === ownerIdx && a.slot === slotIdx);
    const isBurning = u.effects.some(e => e.type === 'burn');
    const isPoisoned = u.effects.some(e => e.type === 'poison');
    const animClasses = [
      didAttack ? (isOpponentSide ? 'anim-lunge-down' : 'anim-lunge-up') : '',
      hitEvt ? 'anim-hit-shake' : '',
      didKillBonus ? 'anim-kill-pulse' : '',
      tacticHit ? 'anim-tactic-target' : '',
      fxBurn ? 'anim-burn-burst' : '',
      fxShieldBreak ? 'anim-shield-break' : '',
      fxHeal ? 'anim-heal-glow' : '',
      isBurning ? 'burn-aura-card' : '',
      isPoisoned ? 'poison-aura-card' : ''
    ].filter(Boolean).join(' ');
    const canActive = isMyTurn && !isOpponentSide && canUseActiveSkill(G, ownerIdx, slotIdx);

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
        : (e.val < 0 || e.type === 'temp_silence' || e.type === 'no_active')
        ? 'bg-indigo-950/90 text-indigo-300 border-indigo-500/50'
        : 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50';
      return `<span class="px-1 py-0.5 rounded text-[9px] border ${cls}">${e.label} ${e.turns}t</span>`;
    }).join('');

    return `
      <div data-unit-click="${ownerIdx}:${slotIdx}"
        class="ink-card-unit relative w-full h-full min-h-[112px] sm:min-h-[122px] rounded-xl bg-gradient-to-b from-[#1e2536]/95 to-[#121722]/95 border p-2.5 flex flex-col justify-between transition select-none ${stateClasses} ${animClasses} ${u.isPrep ? 'opacity-85' : ''}">
        <div class="flex items-start justify-between gap-1">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="text-base leading-none">${u.icon}</span>
            <span class="font-serif-tc font-bold text-xs sm:text-sm text-amber-50 truncate">${u.name}</span>
          </div>
          <div class="flex items-center gap-1 shrink-0"><button type="button" data-inspect-unit="${ownerIdx}:${slotIdx}" title="查看完整說明" class="w-5 h-5 rounded-full bg-slate-800/90 hover:bg-amber-500 hover:text-slate-950 text-amber-200 text-[10px] font-bold flex items-center justify-center border border-amber-500/40">ⓘ</button><span class="text-[10px] px-1.5 py-0.5 rounded border ${f.badgeBg}">${f.name}</span></div>
        </div>

        <div class="flex flex-wrap gap-1 my-1">
          ${u.isPrep ? `<span class="px-1.5 py-0.5 rounded text-[10px] bg-slate-700/80 text-slate-300">💤 整備中</span>` : ''}
          ${!u.isPrep && u.attacksUsed < maxAtks && !isOpponentSide ? `<span class="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">可攻擊${maxAtks > 1 ? ` (${maxAtks - u.attacksUsed}/${maxAtks})` : ''}</span>` : ''}
          ${!u.isPrep && u.attacksUsed >= maxAtks ? `<span class="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">已行動</span>` : ''}
          ${silencedNow ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-600">🔇已沉默</span>` : ''}
          ${u.frozenNextTurn ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-950 text-sky-300 border border-sky-500/50">🕊️緩兵</span>` : ''}
          ${canActive ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/25 text-amber-200 border border-amber-400/60">✨主動</span>` : ''}
          ${u.id === 'wei_simayi' && !silencedNow && !(u.activeUsesTotal > 0) ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-950/90 text-purple-200 border border-purple-400/60">🐺權謀 ${u.quanmou || 0}/3</span>` : ''}
          ${u.keywords.map(keywordBadgeHtml).join('')}
          ${effectsHtml}
        </div>

        <!-- v3.4: 對戰中精簡卡面，點擊 ⓘ 或長按／點選檢視完整技能說明 -->

        <div class="flex items-center justify-between pt-1.5 mt-1 border-t border-slate-700/70 text-xs font-extrabold">
          <span class="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">⚔️ ${atkVal}</span>
          <div class="flex items-center gap-1.5">
            ${u.armor > 0 ? `<span class="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300">🛡️ ${u.armor}</span>` : ''}
            <span class="px-1.5 py-0.5 rounded ${u.hp < u.maxHp ? 'bg-rose-500/25 text-rose-300' : 'bg-emerald-500/15 text-emerald-300'}">❤️ ${u.hp}/${u.maxHp}</span>
          </div>
        </div>

        ${hasGuard ? `<div class="absolute -top-2.5 left-2 px-1.5 py-0.5 rounded-full bg-indigo-500 text-white text-[9px] font-black shadow">🛡️護衛</div>` : ''}
        ${isBurning ? `<svg class="flame-overlay absolute bottom-0 left-0 w-full h-8 opacity-80" viewBox="0 0 120 32" preserveAspectRatio="none"><defs><linearGradient id="fg-${u.uid}" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="#dc2626" stop-opacity="0.85"/><stop offset="60%" stop-color="#f97316" stop-opacity="0.55"/><stop offset="100%" stop-color="#fde047" stop-opacity="0"/></linearGradient></defs><path d="M0,32 Q12,10 24,26 Q38,4 52,24 Q68,2 82,25 Q96,8 108,24 Q115,14 120,32 Z" fill="url(#fg-${u.uid})"/></svg>` : ''}
        ${isPoisoned ? `<div class="poison-overlay absolute bottom-1 right-2 text-xs">🫧☠️</div>` : ''}
        ${hitEvt ? `<svg class="slash-fx-overlay absolute inset-0 w-full h-full z-20" viewBox="0 0 100 100"><path d="${hitEvt.slashDir === 2 ? 'M85,15 Q50,48 15,85' : 'M15,15 Q50,48 85,85'}" stroke="${hitEvt.pierce ? '#fbbf24' : '#f43f5e'}" stroke-width="7" stroke-linecap="round" fill="none"/><path d="${hitEvt.slashDir === 2 ? 'M85,15 Q50,48 15,85' : 'M15,15 Q50,48 85,85'}" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg>` : ''}
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
            const guardRing = guarded ? `<span class="absolute -top-2 right-1 z-10 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-900/95 text-indigo-200 border border-indigo-400/60 shadow">受護衛</span>` : '';
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
    const vfxHtml = vfx.map(v => `<div class="float-dmg text-base ${v.colorClass}">${v.text}</div>`).join('');

    return `
      <div data-hero-click="${pIdx}"
        class="relative flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#141a26]/95 border ${canHitThisHero ? 'target-valid border-red-400' : G.activePlayer === pIdx ? 'border-amber-400/70 shadow-md' : 'border-slate-800'} transition">
        ${vfxHtml}
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center font-serif-tc font-black text-lg border ${f.badgeBg}">${f.name}</div>
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
              <span class="text-xs font-extrabold ${p.hp <= 10 ? 'text-rose-400' : 'text-emerald-300'}">國力 ${p.hp}/${p.maxHp}</span>${p.defenseLinePending ? `<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/25 text-amber-200 border border-amber-400/60 font-bold">🛡️下回防線+1牌+1糧</span>` : p.defenseLineTriggered ? `<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700">🛡️防線已觸發</span>` : `<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-950/70 text-sky-300 border border-sky-500/40" title="國力首次跌至≤20，下回合額外抽1牌+1臨時糧">🛡️防線≤20</span>`}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 sm:gap-3 text-xs">
          <div class="px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/35 text-amber-200 font-bold">
            🌾 糧草 ${p.food}/${p.maxFood}${p.tempFood > 0 ? ` <span class="text-yellow-300">(+${p.tempFood}臨)</span>` : ''}
          </div>
          <div class="px-2.5 py-1.5 rounded-lg bg-orange-500/15 border border-orange-500/35 text-orange-200 font-bold" title="糧倉：回合結束自動儲存未用完的普通糧草（上限 3），僅可用於謀略牌與主動技">
            🏯 糧倉 ${p.reserveFood || 0}/${p.board.some(u => u && u.id === 'shu_liyan' && !isUnitSilenced(u)) ? MAX_RESERVE_FOOD + 1 : MAX_RESERVE_FOOD}
          </div>
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700 text-slate-200"><span class="ink-card-back inline-block w-4 h-5 rounded-xs shrink-0"></span><span>牌庫 <b>${p.deck.length}</b></span></div>${isOpponent && p.hand.length > 0 ? `<div class="hidden sm:flex items-center -space-x-1.5 px-1" title="敵方手牌（${p.hand.length}張）">${Array.from({ length: Math.min(6, p.hand.length) }).map(() => `<span class="ink-card-back inline-block w-4 h-6 rounded-xs"></span>`).join('')}</div>` : ''}
          <div class="px-2.5 py-1.5 rounded-lg border ${p.hand.length > getHandLimit(p.hp) ? 'bg-rose-950/90 border-rose-500 text-rose-200 animate-pulse' : 'bg-slate-800/90 border-slate-700 text-slate-200'}" title="手牌上限隨國力遞減：21-30國力=8張、11-20=6張、1-10=4張">
            🃏 手牌 <b>${p.hand.length}</b>/${getHandLimit(p.hp)}
          </div>
          <button type="button" data-open-graveyard="${pIdx}" class="px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 transition">🪨 墓地 <b>${p.graveyard.length}</b></button>
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
            <div data-hand-card="${c.uid}" role="button" tabindex="0"
              class="hand-card ink-card-hand text-left w-[124px] sm:w-[136px] shrink-0 rounded-xl p-2.5 border flex flex-col justify-between bg-gradient-to-b from-[#1e2433]/95 to-[#121620]/95 ${selected
                ? 'selected border-amber-400'
                : playable
                ? 'border-amber-500/60 shadow-md cursor-pointer'
                : 'border-slate-700/80 opacity-80 cursor-pointer'}">
              <div>
                <div class="flex items-center justify-between gap-1">
                  <span class="px-1.5 py-0.5 rounded-full text-[11px] font-black ${getTotalFood(p, c.type) >= c.cost ? 'bg-amber-400 text-slate-950' : 'bg-slate-700 text-rose-300'}">${c.cost}</span>
                  <div class="flex items-center gap-1">
                    <button type="button" data-inspect-hand="${c.uid}" title="點擊查看完整說明" class="w-5 h-5 rounded-full bg-slate-800/90 hover:bg-amber-500 hover:text-slate-950 text-amber-200 text-[10px] font-bold flex items-center justify-center border border-amber-500/40">ⓘ</button>
                    <span class="text-[10px] px-1.5 py-0.5 rounded border ${f.badgeBg}">${f.name}</span>
                  </div>
                </div>
                <div class="flex items-center gap-1.5 mt-1.5">
                  <span class="text-lg">${c.icon}</span>
                  <span class="font-serif-tc font-bold text-sm text-amber-50 truncate">${c.name}</span>
                </div>
                <div class="flex flex-wrap gap-1 mt-1.5">
                  <span class="text-[10px] px-1 rounded bg-slate-800/80 text-slate-300">${c.type === 'GENERAL' ? '武將' : '謀略'}</span>
                  ${c.keywords.map(keywordBadgeHtml).join('')}
                </div>
              </div>
              <div class="mt-2.5 pt-1.5 border-t border-slate-700/70 flex items-center justify-between text-xs font-extrabold">
                ${c.type === 'GENERAL'
                  ? `<span class="text-amber-300">⚔️${c.baseAtk}</span><span class="text-sky-300">${c.baseArmor ? `🛡️${c.baseArmor}` : ''}</span><span class="text-emerald-300">❤️${c.baseHp}</span>`
                  : `<span class="text-amber-200/90 text-[11px] font-semibold">${c.target === 'none' ? '點擊施放' : c.target === 'enemy_general' ? '指定敵將' : c.target === 'enemy_adjacent_pair' ? '指定相鄰敵將' : '指定友將'}</span>`}
              </div>
            </div>
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
            <span class="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-bold">已選換牌：${UI.mulliganSelected.size} 張</span>
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
            <button type="button" data-action="confirm-mulligan" class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-extrabold text-sm shadow-lg">確認調度並繼續</button>
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
          <button type="button" data-action="dismiss-curtain" class="mt-5 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm">我已就位，顯示手牌</button>
        </div>
      </div>
    `;
  }

  function renderPendingPromptOverlay() {
    const G = UI.G;
    if (!G || !G.pendingPrompt) return '';
    const pr = G.pendingPrompt;
    const viewIdx = getViewingPlayerIdx();

    if (pr.owner !== viewIdx) {
      return `
        <div class="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div class="bg-[#141923] gold-border rounded-2xl max-w-sm w-full p-5 text-center shadow-2xl">
            <div class="text-2xl mb-2">⏳</div>
            <h3 class="font-serif-tc text-lg font-bold text-amber-300">等待對手做出決策…</h3>
            <p class="text-xs text-slate-300 mt-1">對手正在結算技能或整理手牌。</p>
          </div>
        </div>
      `;
    }

    const p = G.players[viewIdx];
    const enemy = G.players[1 - viewIdx];

    // v3.4 新增：賈詡【亂武】二選一（棄1牌 或 全體1傷且-1攻）
    if (pr.kind === 'JIAXU_LUANWU') {
      return `
        <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-[#141923] gold-border rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col p-5 shadow-2xl gap-4 overflow-hidden">
            <div class="flex items-center gap-2.5">
              <span class="text-2xl">${pr.sourceIcon || '☠️'}</span>
              <div>
                <h3 class="font-serif-tc text-xl font-bold text-purple-300">${pr.sourceName}・【${pr.skillName}】</h3>
                <p class="text-xs text-slate-300 mt-0.5">${pr.desc}</p>
              </div>
            </div>
            <div class="space-y-2 overflow-y-auto py-1">
              <div class="text-xs font-bold text-amber-200">選項一：點選棄置 1 張手牌（免受全體傷害）</div>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                ${p.hand.map(c => {
                  const f = FACTIONS[c.faction] || FACTIONS.NEU;
                  return `
                    <button type="button" data-luanwu-discard="${c.uid}" class="text-left p-2.5 rounded-xl bg-[#1b2232] hover:bg-rose-950/60 border border-slate-700 hover:border-rose-400 transition">
                      <div class="flex justify-between items-center"><span class="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[11px] font-black">${c.cost}</span><span class="text-[10px] px-1.5 py-0.5 rounded border ${f.badgeBg}">${f.name}</span></div>
                      <div class="font-serif-tc font-bold text-sm text-amber-50 mt-1">${c.icon} ${c.name}</div>
                    </button>
                  `;
                }).join('')}
              </div>
            </div>
            <div class="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
              <span class="text-xs text-slate-400">或保留手牌，承受己方全體 1 傷與 -1 攻（1大回合）</span>
              <button type="button" data-action="luanwu-take-aoe" class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold shrink-0">💥 承受全體 1 傷與 -1 攻</button>
            </div>
          </div>
        </div>
      `;
    }

    // v3.1 新增：司馬懿【鷹視】檢視敵方手牌
    if (pr.kind === 'REVEAL_ENEMY_HAND') {
      const cards = pr.cards || [];
      return `
        <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-[#141923] gold-border rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col p-5 shadow-2xl gap-4 overflow-hidden">
            <div class="flex items-center gap-2.5">
              <span class="text-2xl">${pr.sourceIcon || '🐺'}</span>
              <div>
                <h3 class="font-serif-tc text-xl font-bold text-amber-300">${pr.sourceName}・【${pr.skillName}】</h3>
                <p class="text-xs text-slate-300 mt-0.5">${pr.desc}</p>
              </div>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 overflow-y-auto py-1">
              ${cards.map(c => {
                const f = FACTIONS[c.faction] || FACTIONS.NEU;
                return `
                  <div class="p-2.5 rounded-xl bg-[#1b2232] border border-slate-700">
                    <div class="flex justify-between items-center">
                      <span class="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[11px] font-black">${c.cost}</span>
                      <span class="text-[10px] px-1.5 py-0.5 rounded border ${f.badgeBg}">${f.name}</span>
                    </div>
                    <div class="font-serif-tc font-bold text-sm text-amber-50 mt-1.5">${c.icon} ${c.name}</div>
                    <div class="text-[10px] text-slate-400 mt-0.5">${c.type === 'GENERAL' ? `武將 ⚔️${c.baseAtk} ❤️${c.baseHp}` : '📜 謀略牌'}</div>
                    <p class="text-[10px] text-slate-300 mt-1 line-clamp-3">${c.text}</p>
                  </div>
                `;
              }).join('')}
            </div>
            <div class="flex justify-end pt-2 border-t border-slate-800">
              <button type="button" data-action="prompt-reveal-ok" class="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold">確認關閉</button>
            </div>
          </div>
        </div>
      `;
    }

    // v3.1 新增：張郃【料敵】查看並自選敵方 1 張手牌
    if (pr.kind === 'PICK_ENEMY_HAND') {
      const cards = pr.cards || [];
      return `
        <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-[#141923] gold-border rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col p-5 shadow-2xl gap-4 overflow-hidden">
            <div class="flex items-center gap-2.5">
              <span class="text-2xl">${pr.sourceIcon || '🎯'}</span>
              <div>
                <h3 class="font-serif-tc text-xl font-bold text-amber-300">${pr.sourceName}・【${pr.skillName}】</h3>
                <p class="text-xs text-slate-300 mt-0.5">${pr.desc}</p>
              </div>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 overflow-y-auto py-1">
              ${cards.map(c => {
                const f = FACTIONS[c.faction] || FACTIONS.NEU;
                return `
                  <button type="button" data-prompt-enemy-card="${c.uid}" class="text-left p-2.5 rounded-xl bg-[#1b2232] hover:bg-rose-950/60 border border-amber-500/40 hover:border-rose-400 transition">
                    <div class="flex justify-between items-center">
                      <span class="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[11px] font-black">${c.cost}</span>
                      <span class="text-[10px] px-1.5 py-0.5 rounded border ${f.badgeBg}">${f.name}</span>
                    </div>
                    <div class="font-serif-tc font-bold text-sm text-amber-50 mt-1.5">${c.icon} ${c.name}</div>
                    <div class="text-[10px] text-amber-300 mt-0.5">${c.type === 'TACTIC' ? '謀略：下回費 +1' : `武將：下回 -1/-1`}</div>
                    <p class="text-[10px] text-slate-300 mt-1 line-clamp-2">${c.text}</p>
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      `;
    }

    if (pr.kind === 'CHOICE') {
      return `
        <div class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-[#141923] gold-border rounded-2xl max-w-xl w-full p-5 shadow-2xl space-y-4">
            <div class="flex items-center gap-2.5">
              <span class="text-2xl">${pr.sourceIcon || '✨'}</span>
              <div>
                <h3 class="font-serif-tc text-xl font-bold text-amber-300">${pr.sourceName}・【${pr.skillName}】</h3>
                <p class="text-xs text-slate-300">請選擇一項效果立即發動：</p>
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-${pr.options.length === 3 ? '3' : '2'} gap-3">
              ${pr.options.map(opt => `
                <button type="button" data-prompt-choice="${opt.id}" class="text-left p-4 rounded-xl bg-[#1b2335] hover:bg-[#24304a] border border-amber-500/40 hover:border-amber-400 transition shadow-lg">
                  <div class="font-bold text-sm text-amber-200">${opt.label}</div>
                  <p class="text-xs text-slate-300 mt-1.5 leading-relaxed">${opt.desc}</p>
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }

    if (pr.kind === 'TARGET_ALLY') {
      const allies = p.board.map((u, s) => ({ u, s })).filter(x => x.u !== null);
      return `
        <div class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-[#141923] gold-border rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4">
            <div class="flex items-center gap-2.5">
              <span class="text-2xl">${pr.sourceIcon || '✨'}</span>
              <div>
                <h3 class="font-serif-tc text-xl font-bold text-amber-300">${pr.sourceName}・【${pr.skillName}】</h3>
                <p class="text-xs text-slate-300">${pr.desc}</p>
              </div>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              ${allies.map(({ u, s }) => `
                <button type="button" data-prompt-target="${s}" class="text-left p-3 rounded-xl bg-[#1b2335] hover:bg-emerald-950/60 border border-emerald-500/40 hover:border-emerald-400 transition">
                  <div class="text-[10px] text-slate-400 mb-1">${SLOT_NAMES[s]}</div>
                  <div class="font-serif-tc font-bold text-sm text-amber-50">${u.icon} ${u.name}</div>
                  <div class="flex gap-2 mt-1.5 text-xs font-extrabold">
                    <span class="text-amber-300">⚔️${getUnitAtk(u, G)}</span>
                    <span class="text-emerald-300">❤️${u.hp}/${u.maxHp}</span>
                    ${u.armor ? `<span class="text-sky-300">🛡️${u.armor}</span>` : ''}
                  </div>
                  <p class="text-[10px] text-slate-300 mt-1 line-clamp-2">${u.text}</p>
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }

    if (pr.kind === 'GUYONG_DISCARD' || pr.kind === 'ZHANGZHAO_DISCARD') {
      const isGuyong = pr.kind === 'GUYONG_DISCARD';
      return `
        <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-[#141923] gold-border rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col p-5 shadow-2xl gap-4 overflow-hidden">
            <div>
              <h3 class="font-serif-tc text-xl font-bold text-amber-300">${pr.sourceIcon || '📜'} ${pr.sourceName}・【${pr.skillName}】</h3>
              <p class="text-xs text-slate-300 mt-1">
                ${isGuyong
                  ? '選擇 1 張手牌棄置（消耗 1 糧）：往糧倉存入 1 點糧草並抽 1 張牌；若棄置謀略牌，改為抽 2 張牌。'
                  : '登場效果：可選擇 1 張手牌棄置並重抽 1 張牌（觸發固政回血存糧），或點擊跳過。'}
              </p>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 overflow-y-auto py-1">
              ${p.hand.map(c => {
                const f = FACTIONS[c.faction] || FACTIONS.NEU;
                return `
                  <button type="button" data-prompt-single-card="${c.uid}" class="text-left p-2.5 rounded-xl border bg-[#1b2232] border-slate-700 hover:border-amber-400 hover:bg-amber-950/30 transition">
                    <div class="flex justify-between items-center">
                      <span class="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[11px] font-black">${c.cost}</span>
                      <span class="text-[10px] px-1.5 py-0.5 rounded border ${f.badgeBg}">${f.name}</span>
                    </div>
                    <div class="font-serif-tc font-bold text-sm text-amber-50 mt-1.5">${c.icon} ${c.name}</div>
                    <div class="text-[10px] text-amber-300/80 mt-0.5">${c.type === 'TACTIC' ? (isGuyong ? '謀略（棄置抽2）' : '謀略') : '武將'}</div>
                    <p class="text-[10px] text-slate-300 mt-1 line-clamp-2">${c.text}</p>
                  </button>
                `;
              }).join('')}
            </div>
            <div class="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button type="button" data-action="prompt-cancel" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold">${isGuyong ? '取消' : '跳過不棄'}</button>
            </div>
          </div>
        </div>
      `;
    }

    if (pr.kind === 'TARGET_ENEMY') {
      const enemies = enemy.board.map((u, s) => ({ u, s })).filter(x => x.u !== null);
      return `
        <div class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-[#141923] gold-border rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4">
            <div class="flex items-center gap-2.5">
              <span class="text-2xl">${pr.sourceIcon || '🎯'}</span>
              <div>
                <h3 class="font-serif-tc text-xl font-bold text-amber-300">${pr.sourceName}・【${pr.skillName}】</h3>
                <p class="text-xs text-slate-300">${pr.desc}</p>
              </div>
            </div>
            ${enemies.length === 0 ? `
              <div class="p-4 rounded-xl bg-slate-900/80 border border-slate-700 text-center text-xs text-slate-300">
                敵方場上目前沒有任何可指定的武將。
              </div>
              <div class="flex justify-end">
                <button type="button" data-action="prompt-cancel-target" class="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold">關閉返回</button>
              </div>
            ` : `
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                ${enemies.map(({ u, s }) => `
                  <button type="button" data-prompt-target="${s}" class="text-left p-3 rounded-xl bg-[#1b2335] hover:bg-rose-950/60 border border-rose-500/40 hover:border-rose-400 transition">
                    <div class="text-[10px] text-slate-400 mb-1">${SLOT_NAMES[s]}</div>
                    <div class="font-serif-tc font-bold text-sm text-amber-50">${u.icon} ${u.name}</div>
                    <div class="flex gap-2 mt-1.5 text-xs font-extrabold">
                      <span class="text-amber-300">⚔️${getUnitAtk(u, G)}</span>
                      <span class="text-emerald-300">❤️${u.hp}/${u.maxHp}</span>
                      ${u.armor ? `<span class="text-sky-300">🛡️${u.armor}</span>` : ''}
                    </div>
                    <p class="text-[10px] text-slate-300 mt-1 line-clamp-2">${u.text}</p>
                  </button>
                `).join('')}
              </div>
              ${pr.context && pr.context.cost ? `
                <div class="flex justify-end pt-2 border-t border-slate-800">
                  <button type="button" data-action="prompt-cancel-target" class="px-4 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs font-semibold">取消發動</button>
                </div>
              ` : ''}
            `}
          </div>
        </div>
      `;
    }

    if (pr.kind === 'ZHIHENG' || pr.kind === 'DISCARD') {
      const isZhiheng = pr.kind === 'ZHIHENG';
      const selCount = UI.promptSelected.size;
      const zhihengCost = 0;
      const canConfirm = isZhiheng
        ? (selCount >= 1 && selCount <= pr.maxDiscard && getTotalFood(p, 'TACTIC') >= zhihengCost)
        : (selCount === pr.count);
      return `
        <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-[#141923] gold-border rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col p-5 shadow-2xl gap-4 overflow-hidden">
            <div>
              <h3 class="font-serif-tc text-xl font-bold text-amber-300">
                ${isZhiheng ? `👑 孫權・【制衡】（已選 ${selCount} / ${pr.maxDiscard} 張）` : `🃏 手牌超過上限（需棄置 ${pr.count} 張，已選 ${selCount} 張）`}
              </h3>
              <p class="text-xs text-slate-300 mt-1">
                ${isZhiheng ? `選擇 1～${pr.maxDiscard} 張手牌棄置並重抽等量新牌（0 糧免費；棄置 ≥ 2 張額外多抽 1 牌並存入 1 點糧倉）。` : pr.reason}
              </p>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 overflow-y-auto py-1">
              ${p.hand.map(c => {
                const isSel = UI.promptSelected.has(c.uid);
                const f = FACTIONS[c.faction] || FACTIONS.NEU;
                return `
                  <button type="button" data-prompt-card="${c.uid}" class="text-left p-2.5 rounded-xl border transition ${isSel ? 'bg-rose-950/60 border-rose-400 ring-2 ring-rose-400/40' : 'bg-[#1b2232] border-slate-700 hover:border-amber-400/60'}">
                    <div class="flex justify-between items-center">
                      <span class="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[11px] font-black">${c.cost}</span>
                      <span class="text-[10px] px-1.5 py-0.5 rounded border ${f.badgeBg}">${f.name}</span>
                    </div>
                    <div class="font-serif-tc font-bold text-sm text-amber-50 mt-1.5">${c.icon} ${c.name}</div>
                    <p class="text-[10px] text-slate-300 mt-1 line-clamp-2">${c.text}</p>
                    ${isSel ? `<div class="mt-1.5 text-[11px] font-bold text-rose-300">✓ 選擇棄置</div>` : ''}
                  </button>
                `;
              }).join('')}
            </div>
            <div class="flex justify-end gap-2 pt-2 border-t border-slate-800">
              ${isZhiheng ? `<button type="button" data-action="prompt-cancel" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold">取消</button>` : ''}
              <button type="button" data-action="prompt-confirm" class="px-5 py-2 rounded-xl text-xs font-extrabold ${canConfirm ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' : 'bg-slate-700 text-slate-400 cursor-not-allowed'}" ${canConfirm ? '' : 'disabled'}>
                ${isZhiheng ? `確認制衡（免費）` : `確認棄置並結束回合`}
              </button>
            </div>
          </div>
        </div>
      `;
    }
    return '';
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
        if (card.target === 'enemy_general') return `已選謀略【${card.name}】— 請點擊任意敵方存活武將（無視護衛保護）`;
        if (card.target === 'enemy_adjacent_pair') return `已選謀略【${card.name}】— 請點擊一對相鄰敵方武將中的任一位`;
        if (card.target === 'ally_general') return `已選謀略【${card.name}】— 請點擊一名友方存活武將`;
        return `已選謀略【${card.name}】— 再次點擊此牌或按「確認施放」立即生效`;
      }
    }

    if (UI.selectedAttackerSlot !== null) {
      const u = G.players[viewIdx].board[UI.selectedAttackerSlot];
      const valid = getValidAttackTargets(G, viewIdx, UI.selectedAttackerSlot);
      if (valid.canHitHero) return `⚔️【${u.name}】準備出擊 — 敵方前排空虛，請點擊上方敵方國力條直接攻擊！`;
      if (G.players[1 - viewIdx].board.some(eu => unitHasGuard(eu)) && !unitHasSnipe(u)) return `⚔️【${u.name}】準備出擊 — 🛡️ 敵方護衛武將正在保護相鄰友軍，請選擇合法攻擊目標！`;
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
    const diffCfg = AI_DIFFICULTIES[getAIDifficulty(G, 1)] || AI_DIFFICULTIES.normal;

    return `
      <div class="flex-1 flex flex-col w-full">
        <header class="ink-header px-3 sm:px-4 py-2 bg-[#0d111a]/92 border-b border-amber-500/25 flex flex-wrap items-center justify-between gap-2 sticky top-0 z-30 backdrop-blur-xs">
          <div class="flex items-center gap-2 sm:gap-3">
            <span class="font-serif-tc font-bold text-base sm:text-lg text-amber-300">三國·謀定天下</span>
            <span class="px-2 py-0.5 rounded bg-slate-800 text-xs text-slate-200 font-semibold">第 ${roundNum} 大回合</span>
            ${G.mode === 'AI' ? `<span class="px-2 py-0.5 rounded bg-indigo-950/90 text-indigo-200 border border-indigo-500/40 text-xs font-bold">🧠 ${diffCfg.name}</span>` : ''}
            ${G.mode === 'ONLINE' ? `<span class="px-2 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 text-xs font-bold">🌐 房號 ${UI.onlineRoomCode}（${UI.onlineRole === 'HOST' ? '房主' : '客軍'}）</span>` : ''}
            <span class="hidden md:inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300">
              v3.4 • 糧草上限 ${MAX_FOOD_CAP} + 糧倉 ${MAX_RESERVE_FOOD} • 防線≤20
            </span>
          </div>
          <div class="flex items-center gap-1.5 sm:gap-2">
            <button type="button" data-action="open-guide" class="px-2.5 py-1 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-xs text-indigo-100 border border-indigo-500/50">🎓 教學/FAQ</button>
            <button type="button" data-action="toggle-played-col" class="px-2.5 py-1 rounded-lg ${UI.showPlayedCol ? 'bg-amber-500/20 border-amber-400/60 text-amber-200' : 'bg-slate-800 border-slate-700 text-slate-200'} hover:bg-slate-700 text-xs border">🗂️ 出牌紀錄</button>
            <button type="button" data-action="toggle-theme" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-amber-200 border border-amber-500/40">${UI.theme === 'dark' ? '🌙 深墨' : '☀️ 宣紙'}</button>
            <button type="button" data-action="toggle-log" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700">📜 戰報 (${G.log.length})</button>
            <button type="button" data-action="open-compendium" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700">📚 圖鑑</button>
            <button type="button" data-action="open-rules" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700">📖 規則</button>
            <button type="button" data-action="toggle-mute" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700">${Sound.muted ? '🔇' : '🔊'}</button>
            <button type="button" data-action="back-lobby" class="px-2.5 py-1 rounded-lg bg-rose-950/70 hover:bg-rose-900 text-xs text-rose-200 border border-rose-700/60">退出</button>
          </div>
        </header>

        <div class="flex-1 flex flex-col lg:flex-row gap-3 p-2.5 sm:p-4">
          <div class="flex-1 flex flex-col gap-2.5 min-w-0 battle-ink-bg p-2 sm:p-3 border border-amber-500/20 shadow-xl">
            ${renderPlayerBar(oppIdx, true)}
            ${renderBoardRow(oppIdx, true)}

            <div class="px-3.5 py-2 rounded-xl bg-[#181f2e]/90 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2">
              <span class="text-xs sm:text-sm text-amber-100 font-medium">${getActionHintText()}</span>
              <div class="flex items-center gap-2 ml-auto">
                ${selectedCard && selectedCard.type === 'TACTIC' && selectedCard.target === 'none' ? `
                  <button type="button" data-action="cast-selected-tactic" class="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold">✨ 確認施放【${selectedCard.name}】</button>
                ` : ''}
                ${isMyTurn && UI.selectedAttackerSlot !== null && canUseActiveSkill(G, viewIdx, UI.selectedAttackerSlot) ? (() => {
                  const su = G.players[viewIdx].board[UI.selectedAttackerSlot];
                  const usesNote = su.activeSkill.maxUses ? ` 剩${su.activeSkill.maxUses - (su.activeUsesTotal || 0)}次` : '';
                  return `
                    <button type="button" data-action="trigger-active-skill" class="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white text-xs font-extrabold shadow">
                      ✨ 發動【${su.activeSkill.name}】${su.activeSkill.cost > 0 ? `(${su.activeSkill.cost}糧${usesNote})` : `(免費${usesNote})`}
                    </button>
                  `;
                })() : ''}
                ${(UI.selectedHandUid !== null || UI.selectedAttackerSlot !== null) ? `
                  <button type="button" data-action="inspect-selected" class="px-3 py-1.5 rounded-lg bg-sky-900/80 hover:bg-sky-800 text-sky-100 border border-sky-500/40 text-xs font-semibold">📖 查看完整說明</button>
                  <button type="button" data-action="cancel-selection" class="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs font-semibold">取消選擇</button>
                ` : ''}
                <button type="button" data-action="end-turn"
                  class="px-4 py-1.5 rounded-lg text-xs sm:text-sm font-extrabold transition ${isMyTurn
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'}"
                  ${isMyTurn ? '' : 'disabled'}>結束回合 ⏭</button>
              </div>
            </div>

            ${renderBoardRow(viewIdx, false)}
            ${renderPlayerBar(viewIdx, false)}

            <div class="bg-[#111622]/90 border border-slate-800 rounded-xl px-2.5 py-1.5">
              ${renderHand(viewIdx)}
            </div>
          </div>

          ${UI.showPlayedCol ? (() => {
            const renderHistList = (list, emptyText) => {
              if (!list || list.length === 0) return `<div class="text-[11px] text-slate-500 py-2 text-center">${emptyText}</div>`;
              return list.slice().reverse().map(item => {
                const rf = FACTIONS[item.faction] || FACTIONS.NEU;
                return `
                  <button type="button" data-inspect-card-id="${item.id}" class="w-full text-left px-2 py-1.5 rounded-lg bg-slate-900/75 hover:bg-slate-800 border border-slate-800 hover:border-amber-400/50 flex items-center justify-between gap-1.5 transition">
                    <div class="flex items-center gap-1.5 min-w-0">
                      <span class="text-[10px] px-1 rounded bg-slate-800 text-slate-400 shrink-0">R${item.round}</span>
                      <span class="text-xs shrink-0">${item.icon || '🃏'}</span>
                      <span class="text-xs font-bold text-amber-100 truncate">${item.name}</span>
                    </div>
                    <div class="flex items-center gap-1 shrink-0">
                      <span class="text-[10px] px-1 rounded border ${rf.badgeBg}">${rf.name}</span>
                      <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">${item.cost}</span>
                    </div>
                  </button>
                `;
              }).join('');
            };
            const oppHist = G.players[oppIdx].playedHistory || [];
            const myHist = G.players[viewIdx].playedHistory || [];
            return `
              <aside class="w-full lg:w-64 xl:w-72 shrink-0 bg-[#121722]/92 ink-surface gold-border rounded-xl flex flex-col max-h-[380px] lg:max-h-[calc(100vh-88px)] backdrop-blur-xs">
                <div class="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                  <span class="font-bold text-xs text-amber-300">🗂️ 雙方已打出卡牌</span>
                  <button type="button" data-action="toggle-played-col" class="text-slate-400 hover:text-white text-xs">收起 ✕</button>
                </div>
                <div class="flex-1 overflow-y-auto p-2.5 space-y-3">
                  <div>
                    <div class="text-[11px] font-bold text-rose-300 mb-1.5 flex items-center justify-between">
                      <span>敵方（${G.players[oppIdx].name}）</span>
                      <span class="text-[10px] text-slate-400">共 ${oppHist.length} 張</span>
                    </div>
                    <div class="space-y-1">${renderHistList(oppHist, '尚未打出卡牌')}</div>
                  </div>
                  <div class="pt-2 border-t border-slate-800">
                    <div class="text-[11px] font-bold text-emerald-300 mb-1.5 flex items-center justify-between">
                      <span>我方（${G.players[viewIdx].name}）</span>
                      <span class="text-[10px] text-slate-400">共 ${myHist.length} 張</span>
                    </div>
                    <div class="space-y-1">${renderHistList(myHist, '尚未打出卡牌')}</div>
                  </div>
                </div>
              </aside>
            `;
          })() : ''}

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
      ${G.pendingPrompt ? renderPendingPromptOverlay() : ''}
      ${G.phase === 'GAMEOVER' ? renderGameOverOverlay() : ''}
    `;
  }

  function render() {
    ensureFxStyles();
    if (document.body) {
      document.body.classList.toggle('theme-dark', UI.theme !== 'light');
      document.body.classList.toggle('theme-light', UI.theme === 'light');
    }
    const app = document.getElementById('app');
    if (!app) return;
    if (UI.screen === 'LOBBY') app.innerHTML = renderLobby();
    else if (UI.screen === 'DECKBUILDER') app.innerHTML = renderDeckBuilder();
    else if (UI.screen === 'GAME') {
      const tacticEvts = (UI.G && UI.G.animEvents) ? UI.G.animEvents.filter(a => a.kind === 'tactic') : [];
      const skillEvts = (UI.G && UI.G.animEvents) ? UI.G.animEvents.filter(a => a.kind === 'skill') : [];
      app.innerHTML = renderGame();
      if (tacticEvts.length > 0) showTacticShowcase(tacticEvts[tacticEvts.length - 1]);
      if (skillEvts.length > 0) showSkillShowcase(skillEvts[skillEvts.length - 1]);
      if (UI.G && UI.G.vfxEvents.length > 0) UI.G.vfxEvents = [];
      if (UI.G && UI.G.animEvents && UI.G.animEvents.length > 0) UI.G.animEvents = [];

      // 自動喚醒保底：若目前輪到 AI（調度或行動階段）、無待人類回應的彈窗、且沒有排程計時器，立刻自動續排 AI 行動
      if (UI.G && !UI.aiTimer) {
        const g = UI.G;
        const aiNeedsMulligan = g.phase === 'MULLIGAN' && g.players[g.mulliganActor] && g.players[g.mulliganActor].isAI;
        const aiNeedsMain = g.phase === 'MAIN' && g.players[g.activePlayer] && g.players[g.activePlayer].isAI && !(g.pendingPrompt && !g.players[g.pendingPrompt.owner].isAI);
        if (aiNeedsMulligan || aiNeedsMain) {
          scheduleAITurnIfNeeded();
        }
      }
    }
  }

  document.addEventListener('click', (e) => {
    if (e.target.hasAttribute('data-close-backdrop') || e.target.closest('[data-close-modal]')) {
      closeModal();
      return;
    }

    const guideTabBtn = e.target.closest('[data-guide-tab]');
    if (guideTabBtn) {
      openGuideFaqModal(guideTabBtn.getAttribute('data-guide-tab'));
      return;
    }

    const diffBtn = e.target.closest('[data-set-ai-diff]');
    if (diffBtn) {
      UI.aiDifficulty = diffBtn.getAttribute('data-set-ai-diff');
      setAIDifficulty(UI.aiDifficulty);
      render();
      return;
    }

    const prEnemyCard = e.target.closest('[data-prompt-enemy-card]');
    if (prEnemyCard && UI.G && UI.G.pendingPrompt) {
      const cardUid = Number(prEnemyCard.getAttribute('data-prompt-enemy-card'));
      if (UI.G.mode === 'ONLINE' && UI.onlineRole === 'GUEST') {
        sendGuestAction('RESOLVE_PROMPT', { response: { cardUid } });
        return;
      }
      resolvePendingPrompt(UI.G, getViewingPlayerIdx(), { cardUid });
      syncOnlineStateAndRender();
      scheduleAITurnIfNeeded();
      return;
    }

    const prChoice = e.target.closest('[data-prompt-choice]');
    if (prChoice && UI.G && UI.G.pendingPrompt) {
      const choiceId = prChoice.getAttribute('data-prompt-choice');
      if (UI.G.mode === 'ONLINE' && UI.onlineRole === 'GUEST') {
        sendGuestAction('RESOLVE_PROMPT', { response: { choiceId } });
        return;
      }
      resolvePendingPrompt(UI.G, getViewingPlayerIdx(), { choiceId });
      syncOnlineStateAndRender();
      scheduleAITurnIfNeeded();
      return;
    }
    const inspUnit = e.target.closest('[data-inspect-unit]');
    if (inspUnit && UI.G) {
      e.stopPropagation();
      const [oIdx, sIdx] = inspUnit.getAttribute('data-inspect-unit').split(':').map(Number);
      const u = UI.G.players[oIdx] && UI.G.players[oIdx].board[sIdx];
      if (u) openCardDetailModal(u, UI.G.players[oIdx].name);
      return;
    }
    const inspHand = e.target.closest('[data-inspect-hand]');
    if (inspHand && UI.G) {
      e.stopPropagation();
      const uid = Number(inspHand.getAttribute('data-inspect-hand'));
      const viewIdx = getViewingPlayerIdx();
      const c = UI.G.players[viewIdx] && UI.G.players[viewIdx].hand.find(x => x.uid === uid);
      if (c) openCardDetailModal(c, '手牌');
      return;
    }
    const inspCardId = e.target.closest('[data-inspect-card-id]');
    if (inspCardId) {
      const cid = inspCardId.getAttribute('data-inspect-card-id');
      if (CARD_DB[cid]) openCardDetailModal(CARD_DB[cid], '已打出紀錄');
      return;
    }
    const luanwuDisc = e.target.closest('[data-luanwu-discard]');
    if (luanwuDisc && UI.G && UI.G.pendingPrompt && UI.G.pendingPrompt.kind === 'JIAXU_LUANWU') {
      const cardUid = Number(luanwuDisc.getAttribute('data-luanwu-discard'));
      if (UI.G.mode === 'ONLINE' && UI.onlineRole === 'GUEST') {
        sendGuestAction('RESOLVE_PROMPT', { response: { mode: 'DISCARD', cardUid } });
        return;
      }
      resolvePendingPrompt(UI.G, UI.G.pendingPrompt.owner, { mode: 'DISCARD', cardUid });
      syncOnlineStateAndRender();
      scheduleAITurnIfNeeded();
      return;
    }
    const lobbyRecBtn = e.target.closest('[data-lobby-select-rec]');
    if (lobbyRecBtn) {
      const fid = lobbyRecBtn.getAttribute('data-lobby-select-rec');
      if (RECOMMENDED_DECKS[fid]) {
        if (UI.selectedRecommendedFaction === fid && UI.selectedSavedSlot === null) {
          UI.selectedRecommendedFaction = null;
        } else {
          UI.selectedRecommendedFaction = fid;
          UI.selectedSavedSlot = null;
          UI.p0Faction = fid;
          showToast(`已選用推薦牌組：${RECOMMENDED_DECKS[fid].name}`, 'success');
        }
        render();
      }
      return;
    }

    const prSingleCard = e.target.closest('[data-prompt-single-card]');
    if (prSingleCard && UI.G && UI.G.pendingPrompt) {
      const cardUid = Number(prSingleCard.getAttribute('data-prompt-single-card'));
      if (UI.G.mode === 'ONLINE' && UI.onlineRole === 'GUEST') {
        sendGuestAction('RESOLVE_PROMPT', { response: { cardUid } });
        return;
      }
      resolvePendingPrompt(UI.G, getViewingPlayerIdx(), { cardUid });
      syncOnlineStateAndRender();
      scheduleAITurnIfNeeded();
      return;
    }
    const prTarget = e.target.closest('[data-prompt-target]');
    if (prTarget && UI.G && UI.G.pendingPrompt) {
      const slot = Number(prTarget.getAttribute('data-prompt-target'));
      if (UI.G.mode === 'ONLINE' && UI.onlineRole === 'GUEST') {
        sendGuestAction('RESOLVE_PROMPT', { response: { slot } });
        return;
      }
      resolvePendingPrompt(UI.G, getViewingPlayerIdx(), { slot });
      syncOnlineStateAndRender();
      scheduleAITurnIfNeeded();
      return;
    }
    const prCard = e.target.closest('[data-prompt-card]');
    if (prCard && UI.G && UI.G.pendingPrompt) {
      const uid = Number(prCard.getAttribute('data-prompt-card'));
      const maxPick = UI.G.pendingPrompt.kind === 'ZHIHENG' ? UI.G.pendingPrompt.maxDiscard : UI.G.pendingPrompt.count;
      if (UI.promptSelected.has(uid)) UI.promptSelected.delete(uid);
      else if (UI.promptSelected.size < maxPick) UI.promptSelected.add(uid);
      render();
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

    const lobbySlotBtn = e.target.closest('[data-lobby-select-slot]');
    if (lobbySlotBtn) {
      const idx = Number(lobbySlotBtn.getAttribute('data-lobby-select-slot'));
      const slot = savedDeckSlots[idx];
      if (slot) {
        if (UI.selectedSavedSlot === idx) {
          UI.selectedSavedSlot = null;
        } else {
          UI.selectedSavedSlot = idx;
          UI.selectedRecommendedFaction = null;
          UI.p0Faction = slot.faction;
        }
        render();
      }
      return;
    }

    const dbSelectSlot = e.target.closest('[data-db-select-slot]');
    if (dbSelectSlot) {
      const idx = Number(dbSelectSlot.getAttribute('data-db-select-slot'));
      UI.dbSlotIdx = idx;
      const slot = savedDeckSlots[idx];
      if (slot) {
        UI.dbFaction = slot.faction;
        UI.dbSubFaction = slot.subFaction || null;
        UI.dbCards = slot.cards.slice();
        UI.dbDeckName = slot.name;
      } else {
        UI.dbDeckName = `${FACTIONS[UI.dbFaction].name}自訂 ${idx + 1}`;
      }
      render();
      return;
    }

    const dbDelSlot = e.target.closest('[data-db-delete-slot]');
    if (dbDelSlot) {
      const idx = Number(dbDelSlot.getAttribute('data-db-delete-slot'));
      deleteDeckSlot(idx);
      if (UI.selectedSavedSlot === idx) UI.selectedSavedSlot = null;
      showToast(`已刪除槽位 ${idx + 1} 的儲存卡組`);
      render();
      return;
    }

    const facBtn = e.target.closest('[data-pick-faction]');
    if (facBtn) {
      const [who, fid] = facBtn.getAttribute('data-pick-faction').split(':');
      if (who === 'p0') {
        UI.p0Faction = fid;
        if (UI.selectedRecommendedFaction && UI.selectedRecommendedFaction !== fid) UI.selectedRecommendedFaction = null;
        if (UI.selectedSavedSlot !== null && savedDeckSlots[UI.selectedSavedSlot] && savedDeckSlots[UI.selectedSavedSlot].faction !== fid) {
          UI.selectedSavedSlot = null;
        }
      } else UI.p1Faction = fid;
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
    if (graveBtn && UI.G && UI.selectedAttackerSlot === null) {
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
      if (action === 'open-guide') { openGuideFaqModal(); return; }
      if (action === 'open-rules') { openRulebookModal(); return; }
      if (action === 'open-compendium') { openCompendiumModal(); return; }
      if (action === 'toggle-mute') { Sound.muted = !Sound.muted; render(); return; }
      if (action === 'toggle-theme') {
        UI.theme = UI.theme === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem('sanguo_theme_v34', UI.theme); } catch (_) {}
        render();
        return;
      }
      if (action === 'toggle-played-col') { UI.showPlayedCol = !UI.showPlayedCol; render(); return; }
      if (action === 'inspect-selected' && UI.G) {
        const vIdx = getViewingPlayerIdx();
        if (UI.selectedHandUid !== null) {
          const c = UI.G.players[vIdx] && UI.G.players[vIdx].hand.find(x => x.uid === UI.selectedHandUid);
          if (c) openCardDetailModal(c, '手牌');
        } else if (UI.selectedAttackerSlot !== null) {
          const u = UI.G.players[vIdx] && UI.G.players[vIdx].board[UI.selectedAttackerSlot];
          if (u) openCardDetailModal(u, UI.G.players[vIdx].name);
        }
        return;
      }
      if (action === 'db-load-rec') {
        const rec = RECOMMENDED_DECKS[UI.dbFaction];
        if (rec) {
          UI.dbCards = rec.cards.slice();
          UI.dbSubFaction = rec.subFaction || null;
          UI.dbDeckName = rec.name;
          showToast(`已載入推薦牌組：${rec.name}`, 'success');
          render();
        }
        return;
      }
      if (action === 'prompt-cancel-target' && UI.G && UI.G.pendingPrompt && UI.G.pendingPrompt.kind === 'TARGET_ENEMY') {
        if (UI.G.mode === 'ONLINE' && UI.onlineRole === 'GUEST') {
          sendGuestAction('RESOLVE_PROMPT', { response: { cancel: true } });
          return;
        }
        resolvePendingPrompt(UI.G, UI.G.pendingPrompt.owner, { cancel: true });
        syncOnlineStateAndRender();
        return;
      }
      if (action === 'luanwu-take-aoe' && UI.G && UI.G.pendingPrompt && UI.G.pendingPrompt.kind === 'JIAXU_LUANWU') {
        if (UI.G.mode === 'ONLINE' && UI.onlineRole === 'GUEST') {
          sendGuestAction('RESOLVE_PROMPT', { response: { mode: 'AOE' } });
          return;
        }
        resolvePendingPrompt(UI.G, UI.G.pendingPrompt.owner, { mode: 'AOE' });
        syncOnlineStateAndRender();
        scheduleAITurnIfNeeded();
        return;
      }
      if (action === 'open-deckbuilder') {
        UI.dbFaction = UI.p0Faction;
        UI.dbCards = getDeckForFaction(UI.dbFaction);
        UI.dbSubFaction = validateDeck(UI.dbFaction, UI.dbCards).subFaction;
        UI.screen = 'DECKBUILDER';
        render();
        return;
      }
      if (action === 'open-deckbuilder-slot') {
        const idx = Number(actBtn.getAttribute('data-slot-idx')) || 0;
        UI.dbSlotIdx = idx;
        UI.dbFaction = UI.p0Faction;
        UI.dbCards = getDeckForFaction(UI.dbFaction);
        UI.dbSubFaction = validateDeck(UI.dbFaction, UI.dbCards).subFaction;
        UI.dbDeckName = `${FACTIONS[UI.dbFaction].name}自訂 ${idx + 1}`;
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
      if (action === 'db-clear') {
        UI.dbCards = [];
        showToast('已清空目前編輯中的卡組');
        render();
        return;
      }
      if (action === 'db-save-slot' || action === 'db-save') {
        const check = validateDeck(UI.dbFaction, UI.dbCards, UI.dbSubFaction);
        if (!check.valid) {
          showToast(check.errors[0], 'error');
          return;
        }
        const nameInp = document.getElementById('db-deck-name-input');
        const deckName = (nameInp && nameInp.value.trim()) || `${FACTIONS[UI.dbFaction].name}自訂 ${UI.dbSlotIdx + 1}`;
        UI.dbDeckName = deckName;
        saveDeckToSlot(UI.dbSlotIdx, deckName, UI.dbFaction, UI.dbCards, UI.dbSubFaction);
        UI.selectedSavedSlot = UI.dbSlotIdx;
        UI.p0Faction = UI.dbFaction;
        showToast(`已儲存【${deckName}】至槽位 ${UI.dbSlotIdx + 1} 並設為出戰卡組！`, 'success');
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
      if (action === 'prompt-reveal-ok' && UI.G && UI.G.pendingPrompt) {
        if (UI.G.mode === 'ONLINE' && UI.onlineRole === 'GUEST') {
          sendGuestAction('RESOLVE_PROMPT', { response: {} });
          return;
        }
        resolvePendingPrompt(UI.G, getViewingPlayerIdx(), {});
        syncOnlineStateAndRender();
        return;
      }
      if (action === 'prompt-cancel' && UI.G && UI.G.pendingPrompt) {
        UI.promptSelected = new Set();
        const isSingle = UI.G.pendingPrompt.kind === 'GUYONG_DISCARD' || UI.G.pendingPrompt.kind === 'ZHANGZHAO_DISCARD';
        const resp = isSingle ? { cardUid: null } : { selectedUids: [] };
        if (UI.G.mode === 'ONLINE' && UI.onlineRole === 'GUEST') {
          sendGuestAction('RESOLVE_PROMPT', { response: resp });
          return;
        }
        resolvePendingPrompt(UI.G, getViewingPlayerIdx(), resp);
        syncOnlineStateAndRender();
        scheduleAITurnIfNeeded();
        return;
      }
      if (action === 'prompt-confirm' && UI.G && UI.G.pendingPrompt) {
        const selectedUids = Array.from(UI.promptSelected);
        UI.promptSelected = new Set();
        if (UI.G.mode === 'ONLINE' && UI.onlineRole === 'GUEST') {
          sendGuestAction('RESOLVE_PROMPT', { response: { selectedUids } });
          return;
        }
        resolvePendingPrompt(UI.G, getViewingPlayerIdx(), { selectedUids });
        syncOnlineStateAndRender();
        scheduleAITurnIfNeeded();
        return;
      }
      if (action === 'trigger-active-skill' && UI.G && UI.selectedAttackerSlot !== null) {
        const slotIdx = UI.selectedAttackerSlot;
        UI.selectedAttackerSlot = null;
        UI.promptSelected = new Set();
        if (UI.G.mode === 'ONLINE' && UI.onlineRole === 'GUEST') {
          sendGuestAction('ACTIVATE_SKILL', { slotIdx });
          return;
        }
        activateUnitSkill(UI.G, getViewingPlayerIdx(), slotIdx);
        syncOnlineStateAndRender();
        return;
      }
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
          let resolvedTarget = null;
          if ((card.target === 'enemy_general' && owner !== viewIdx) || (card.target === 'ally_general' && owner === viewIdx)) {
            resolvedTarget = slot;
          } else if (card.target === 'enemy_adjacent_pair' && owner !== viewIdx) {
            const eb = G.players[owner].board;
            if (slot < BOARD_SIZE - 1 && eb[slot] && eb[slot + 1]) resolvedTarget = slot;
            else if (slot > 0 && eb[slot - 1] && eb[slot]) resolvedTarget = slot - 1;
          }
          if (resolvedTarget !== null) {
            if (G.mode === 'ONLINE' && UI.onlineRole === 'GUEST') {
              UI.selectedHandUid = null;
              sendGuestAction('PLAY_TACTIC', { cardUid: card.uid, targetSlot: resolvedTarget });
              return;
            }
            if (playTactic(G, viewIdx, card.uid, resolvedTarget)) {
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
          showToast('🛡️ 相鄰護衛原則：該敵方武將正受到相鄰「護衛」武將保護，無法直接普通攻擊！', 'error');
          return;
        }
      }

      if (owner !== viewIdx && UI.selectedAttackerSlot === null && UI.selectedHandUid === null) {
        const eu = G.players[owner] && G.players[owner].board[slot];
        if (eu) { openCardDetailModal(eu, G.players[owner].name); return; }
      }
      if (owner === viewIdx) {
        const u = G.players[viewIdx].board[slot];
        if (canUnitAttack(u, G) || canUseActiveSkill(G, viewIdx, slot)) {
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
          showToast('無法直接攻擊敵方國力（敵方前排仍有武將，或鄧艾於登場回合無法直擊國力）！', 'error');
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

  // 支援網址 ?room=XXXX 自動預填房號並切至線上好友模式
  try {
    const params = new URLSearchParams(location.search);
    const room = params.get('room');
    if (room) {
      UI.lobbyMode = 'ONLINE';
      UI.onlineInputCode = room.replace(/[^0-9]/g, '').slice(0, 6);
    }
  } catch (_) {}

  render();
})(window);