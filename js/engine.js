(function (global) {
  'use strict';

  const {
    FACTIONS, BOARD_SIZE, SLOT_NAMES, MAX_HAND_SIZE, MAX_FOOD_CAP, MAX_RESERVE_FOOD, INITIAL_HP,
    getHandLimit, CARD_DB, getDeckForFaction, Sound
  } = global.Sanguo;

  let nextUid = 1;

  function playSound(G, fnName) {
    if (!G || !G.silent) {
      if (Sound && typeof Sound[fnName] === 'function') Sound[fnName]();
    }
  }

  function createCardInstance(cardId) {
    const def = CARD_DB[cardId];
    return {
      uid: nextUid++,
      id: def.id,
      name: def.name,
      type: def.type,
      faction: def.faction,
      cost: def.cost,
      baseAtk: def.atk || 0,
      baseHp: def.hp || 0,
      baseArmor: def.armor || 0,
      keywords: (def.keywords || []).slice(),
      target: def.target || 'none',
      icon: def.icon,
      skillName: def.skillName || '',
      activeSkill: def.activeSkill ? Object.assign({}, def.activeSkill) : null,
      text: def.text,
      flavor: def.flavor || '',
      token: Boolean(def.token)
    };
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function createUnitFromCard(card, ownerIdx, slotIdx, playedOnTurn = 0) {
    return {
      uid: card.uid,
      id: card.id,
      name: card.name,
      faction: card.faction,
      cost: card.cost,
      icon: card.icon,
      skillName: card.skillName || '',
      activeSkill: card.activeSkill ? Object.assign({}, card.activeSkill) : null,
      text: card.text,
      keywords: card.keywords.slice(),
      owner: ownerIdx,
      slot: slotIdx,
      atk: card.baseAtk,
      hp: card.baseHp,
      maxHp: card.baseHp,
      baseArmor: card.baseArmor,
      armor: card.baseArmor,
      isPrep: !card.keywords.includes('RUSH'),
      playedOnTurn,
      frozenNextTurn: false,
      attacksUsed: 0,
      activeUsedThisTurn: false,
      activeUsesTotal: 0,
      ganglieUsedThisTurn: false,
      silenced: false,
      effects: []
    };
  }

  function isUnitSilenced(unit) {
    if (!unit) return true;
    return Boolean(unit.silenced || unit.effects.some(e => e.type === 'temp_silence'));
  }

  // v3.4: 賈詡【完殺】改為登場指定驅散正向增益，移除舊版在場光環封鎖（保留函式介面以相容外部呼叫）
  function isWanshaBlocking() {
    return false;
  }

  function isWanshaActive(G) {
    return isWanshaBlocking(G, 0) || isWanshaBlocking(G, 1);
  }

  function getUnitAtk(unit, G = null) {
    if (!unit) return 0;
    const blockBuffs = G ? isWanshaBlocking(G, unit.owner) : false;
    let total = unit.atk;
    for (const eff of unit.effects) {
      if (eff.type === 'atk_buff') {
        if (eff.val > 0 && blockBuffs) continue;
        total += eff.val;
      }
    }
    return Math.max(0, total);
  }

  function getUnitMaxAttacks(unit) {
    if (!unit || isUnitSilenced(unit)) return 1;
    return (unit.keywords.includes('COMBO') || unit.effects.some(e => e.type === 'combo_buff')) ? 2 : 1;
  }

  function unitHasShroud(unit) {
    if (!unit || isUnitSilenced(unit)) return false;
    return unit.keywords.includes('SHROUD') || unit.effects.some(e => e.type === 'shroud_buff');
  }

  function getReserveFoodCap(G, pIdx) {
    const p = G.players[pIdx];
    const hasLiyan = p.board.some(u => u && u.id === 'shu_liyan' && !isUnitSilenced(u));
    return MAX_RESERVE_FOOD + (hasLiyan ? 1 : 0);
  }

  function getEffectiveCardCost(G, pIdx, card) {
    let cost = card.cost;
    const p = G.players[pIdx];
    if (card.type === 'TACTIC' && !p.tacticPlayedThisTurn) {
      const hasMasu = p.board.some(u => u && u.id === 'shu_masu' && !isUnitSilenced(u));
      if (hasMasu && cost > 1) cost = Math.max(1, cost - 1);
    }
    return cost;
  }

  function triggerGuzhengOnDiscard(G, pIdx) {
    const p = G.players[pIdx];
    for (let s = 0; s < BOARD_SIZE; s++) {
      const u = p.board[s];
      if (u && u.id === 'wu_zhangzhao' && !isUnitSilenced(u) && !u.guzhengUsedThisTurn) {
        u.guzhengUsedThisTurn = true;
        healHero(G, pIdx, 1, '【張昭·固政】');
        addReserveFood(G, pIdx, 1, '【張昭·固政】');
        break;
      }
    }
  }

  function triggerCaocaoWeiwu(G, pIdx) {
    const p = G.players[pIdx];
    const enemyIdx = 1 - pIdx;
    const enemy = G.players[enemyIdx];
    for (let s = 0; s < BOARD_SIZE; s++) {
      const u = p.board[s];
      if (u && u.id === 'wei_caocao' && !isUnitSilenced(u) && (u.weiwuCountThisTurn || 0) < 2) {
        u.weiwuCountThisTurn = (u.weiwuCountThisTurn || 0) + 1;
        let bestS = -1, bestA = -1;
        for (let k = 0; k < BOARD_SIZE; k++) {
          if (enemy.board[k] && getUnitAtk(enemy.board[k], G) > bestA) { bestA = getUnitAtk(enemy.board[k], G); bestS = k; }
        }
        if (bestS !== -1) {
          dealDamageToUnit(G, enemyIdx, bestS, 1, '【曹操·魏武】');
        } else {
          dealDamageToHero(G, enemyIdx, 1, '【曹操·魏武】');
        }
      }
    }
  }

  function triggerSimayiFanshi(G, actorIdx) {
    const oppIdx = 1 - actorIdx;
    const opp = G.players[oppIdx];
    for (let s = 0; s < BOARD_SIZE; s++) {
      const u = opp.board[s];
      if (u && u.id === 'wei_simayi' && !isUnitSilenced(u) && (u.activeUsesTotal || 0) === 0) {
        u.quanmou = Math.min(3, (u.quanmou || 0) + 1);
        dealDamageToHero(G, actorIdx, 1, '【司馬懿·反噬】');
      }
    }
  }

  function triggerJianyingOnCardPlay(G, pIdx) {
    const p = G.players[pIdx];
    p.cardsPlayedThisTurn = (p.cardsPlayedThisTurn || 0) + 1;
    for (let s = 0; s < BOARD_SIZE; s++) {
      const u = p.board[s];
      if (u && u.id === 'qun_jushou' && !isUnitSilenced(u)) {
        if (p.cardsPlayedThisTurn === 2) {
          drawCard(G, pIdx, '沮授·漸營');
          p.tempFood += 1;
        } else if (p.cardsPlayedThisTurn === 3) {
          for (let k = 0; k < BOARD_SIZE; k++) {
            if (p.board[k]) buffUnitStats(G, pIdx, k, 0, 1, '【沮授·漸營】');
          }
        }
      }
    }
  }

  function unitHasGuard(unit) {
    if (!unit || isUnitSilenced(unit)) return false;
    return unit.keywords.includes('GUARD') || unit.effects.some(e => e.type === 'guard_buff');
  }

  function unitHasSnipe(unit) {
    if (!unit || isUnitSilenced(unit)) return false;
    return unit.keywords.includes('SNIPE') || unit.effects.some(e => e.type === 'snipe_buff');
  }

  function isProtectedByAdjacentGuard(board, slotIdx) {
    const unit = board[slotIdx];
    if (!unit || unitHasGuard(unit)) return false;
    const left = slotIdx > 0 ? board[slotIdx - 1] : null;
    const right = slotIdx < BOARD_SIZE - 1 ? board[slotIdx + 1] : null;
    return Boolean((left && unitHasGuard(left)) || (right && unitHasGuard(right)));
  }

  function canUnitAttack(unit, G = null) {
    return Boolean(unit && !unit.isPrep && unit.attacksUsed < getUnitMaxAttacks(unit) && getUnitAtk(unit, G) > 0);
  }

  function canUseActiveSkill(G, pIdx, slotIdx) {
    if (!G || G.phase !== 'MAIN' || G.activePlayer !== pIdx || G.pendingPrompt) return false;
    const p = G.players[pIdx];
    const enemy = G.players[1 - pIdx];
    const u = p.board[slotIdx];
    if (!u || isUnitSilenced(u) || !u.activeSkill || u.activeUsedThisTurn) return false;
    if (u.effects.some(e => e.type === 'no_active')) return false;
    if (u.activeSkill.maxUses && (u.activeUsesTotal || 0) >= u.activeSkill.maxUses) return false;
    if (u.id === 'wu_sunquan') {
      return p.hand.length > 0;
    }
    if (u.id === 'wei_simayi') {
      if ((u.quanmou || 0) < 2) return false;
    }
    if (u.id === 'wu_zhouyu') {
      if (!enemy.board.some(eu => eu !== null)) return false;
    }
    if (u.id === 'qun_zhangjiao') {
      if (!enemy.board.some(eu => eu !== null)) return false;
      const hasTurban = p.board.some(au => au && au.id === 'qun_yellow_turban');
      if (hasTurban) return getTotalFood(p, 'TACTIC') >= 1;
      return p.reserveFood >= 1 && (p.food + p.tempFood + (p.reserveFood - 1)) >= 1;
    }
    if (u.id === 'shu_liushan') {
      if (u.attacksUsed > 0) return false;
      return p.board.some(au => au !== null);
    }
    if (u.id === 'wu_guyong') {
      if (p.hand.length === 0) return false;
    }
    return getTotalFood(p, 'TACTIC') >= u.activeSkill.cost;
  }

  function createGameState({ mode = 'AI', p0Faction = 'SHU', p1Faction = 'WEI', firstPlayer = 0, p0Deck = null, p1Deck = null, aiDifficulty = null }) {
    const d0 = shuffle((p0Deck || getDeckForFaction(p0Faction)).map(createCardInstance));
    const d1 = shuffle((p1Deck || getDeckForFaction(p1Faction)).map(createCardInstance));

    const players = [
      {
        idx: 0,
        name: mode === 'AI' ? '我方主公' : mode === 'ONLINE' ? '房主（玩家一）' : '玩家一',
        isAI: false,
        faction: p0Faction,
        hp: INITIAL_HP,
        maxHp: INITIAL_HP,
        maxFood: 0,
        food: 0,
        tempFood: 0,
        reserveFood: 0,
        nextTurnFoodPenalty: 0,
        deck: d0,
        hand: [],
        graveyard: [],
        board: Array(BOARD_SIZE).fill(null),
        mulliganDone: false,
        turnsTaken: 0,
        defenseLineTriggered: false,
        defenseLinePending: false,
        playedHistory: []
      },
      {
        idx: 1,
        name: mode === 'AI' ? '敵軍 AI' : mode === 'ONLINE' ? '客軍（玩家二）' : '玩家二',
        isAI: mode === 'AI',
        faction: p1Faction,
        hp: INITIAL_HP,
        maxHp: INITIAL_HP,
        maxFood: 0,
        food: 0,
        tempFood: 0,
        reserveFood: 0,
        nextTurnFoodPenalty: 0,
        deck: d1,
        hand: [],
        graveyard: [],
        board: Array(BOARD_SIZE).fill(null),
        mulliganDone: false,
        turnsTaken: 0,
        defenseLineTriggered: false,
        defenseLinePending: false,
        playedHistory: []
      }
    ];

    const secondPlayer = 1 - firstPlayer;
    for (let i = 0; i < 3; i++) players[firstPlayer].hand.push(players[firstPlayer].deck.pop());
    for (let i = 0; i < 4; i++) players[secondPlayer].hand.push(players[secondPlayer].deck.pop());

    return {
      mode,
      aiDifficulty,
      silent: false,
      firstPlayer,
      secondPlayer,
      activePlayer: firstPlayer,
      turnNumber: 0,
      phase: 'MULLIGAN',
      mulliganActor: firstPlayer,
      players,
      winner: null,
      winReason: '',
      log: [
        `【開局】${players[firstPlayer].name}（${FACTIONS[players[firstPlayer].faction].title}）取得先手（初始 3 張）；${players[secondPlayer].name}（${FACTIONS[players[secondPlayer].faction].title}）為後手（初始 4 張）。`
      ],
      consecutiveNoActionEmptyDeckTurns: 0,
      actedThisTurn: false,
      firstGeneralPlayed: false,
      zhoutaiBquUsed: [0, 0],
      lingtongSizhanUsed: [false, false],
      pendingPrompt: null,
      vfxEvents: [],
      animEvents: []
    };
  }

  function addLog(G, msg) {
    if (G.silent) return;
    G.log.push(msg);
    if (G.log.length > 250) G.log.shift();
  }

  function pushVfx(G, targetKey, text, colorClass) {
    if (G.silent) return;
    G.vfxEvents.push({ targetKey, text, colorClass, id: nextUid++ });
  }

  function pushAnim(G, evt) {
    if (G.silent) return;
    G.animEvents.push(Object.assign({ id: nextUid++ }, evt));
  }

  function pushSkillAnim(G, ownerIdx, unit, skillName, desc, fxType = 'skill') {
    if (G.silent) return;
    pushAnim(G, {
      kind: 'skill',
      owner: ownerIdx,
      ownerName: G.players[ownerIdx].name,
      unitName: unit.name,
      icon: unit.icon,
      faction: unit.faction,
      slot: unit.slot,
      skillName,
      desc,
      fxType
    });
  }

  function getTotalFood(p, cardType = 'GENERAL') {
    if (cardType === 'TACTIC') {
      return p.food + p.tempFood + (p.reserveFood || 0);
    }
    return p.food + p.tempFood;
  }

  function spendFood(p, cost, cardType = 'GENERAL') {
    let rem = cost;
    const usedTemp = Math.min(p.tempFood, rem);
    p.tempFood -= usedTemp;
    rem -= usedTemp;
    if (rem > 0 && cardType === 'TACTIC' && p.reserveFood > 0) {
      const usedRes = Math.min(p.reserveFood, rem);
      p.reserveFood -= usedRes;
      rem -= usedRes;
    }
    if (rem > 0) {
      p.food -= rem;
    }
  }

  function addReserveFood(G, pIdx, amt, sourceLabel = '') {
    if (amt <= 0) return 0;
    const p = G.players[pIdx];
    const cap = getReserveFoodCap(G, pIdx);
    const before = p.reserveFood;
    p.reserveFood = Math.min(cap, p.reserveFood + amt);
    const gained = p.reserveFood - before;
    if (gained > 0) {
      pushVfx(G, `hero-${pIdx}`, `+${gained} 糧倉`, 'text-amber-300');
      addLog(G, `${sourceLabel}${p.name} 糧倉存入 ${gained} 點糧草（目前 ${p.reserveFood}/${MAX_RESERVE_FOOD}）。`);
    }
    return gained;
  }

  function buffUnitStats(G, ownerIdx, slotIdx, atkDelta, hpDelta, sourceLabel = '') {
    const u = G.players[ownerIdx].board[slotIdx];
    if (!u) return false;
    if (isWanshaBlocking(G, ownerIdx) && (atkDelta > 0 || hpDelta > 0)) {
      addLog(G, `☠️【賈詡·完殺】生效，阻止了對【${u.name}】的增益效果！`);
      pushVfx(G, `unit-${ownerIdx}-${slotIdx}`, '完殺無效', 'text-purple-300');
      return false;
    }
    u.atk = Math.max(0, u.atk + atkDelta);
    u.maxHp = Math.max(1, u.maxHp + hpDelta);
    u.hp = Math.max(1, u.hp + hpDelta);
    pushVfx(G, `unit-${ownerIdx}-${slotIdx}`, `${atkDelta >= 0 ? '+' : ''}${atkDelta}/${hpDelta >= 0 ? '+' : ''}${hpDelta}`, 'text-emerald-300');
    pushAnim(G, { kind: 'fx', fxType: 'buff', owner: ownerIdx, slot: slotIdx });
    if (sourceLabel) addLog(G, `${sourceLabel}使【${u.name}】獲得 ${atkDelta >= 0 ? '+' : ''}${atkDelta}/${hpDelta >= 0 ? '+' : ''}${hpDelta}。`);
    return true;
  }

  function applyEffect(G, ownerIdx, slotIdx, eff) {
    const u = G.players[ownerIdx].board[slotIdx];
    if (!u) return false;
    const isPositiveBuff =
      (eff.type === 'atk_buff' && eff.val > 0) ||
      eff.type === 'armor_buff' ||
      eff.type === 'guard_buff' ||
      eff.type === 'snipe_buff' ||
      eff.type === 'combo_buff' ||
      eff.type === 'shroud_buff' ||
      eff.type === 'pierce_buff';
    if (isWanshaBlocking(G, ownerIdx) && isPositiveBuff) {
      addLog(G, `☠️【賈詡·完殺】生效，阻止了對【${u.name}】的增益狀態！`);
      pushVfx(G, `unit-${ownerIdx}-${slotIdx}`, '完殺無效', 'text-purple-300');
      return false;
    }
    // 統一處理大回合制：非 DoT 狀態支援 halfTurns（1大回合 = 2半回合）
    const normalized = Object.assign({}, eff);
    if (normalized.type !== 'burn' && normalized.type !== 'poison') {
      if (typeof normalized.halfTurns !== 'number') {
        normalized.halfTurns = (normalized.turns || 1) * 2;
      }
      normalized.turns = Math.max(1, Math.ceil(normalized.halfTurns / 2));
    }
    u.effects.push(normalized);
    if (normalized.type === 'armor_buff') u.armor += normalized.val;
    if (normalized.type === 'burn') pushAnim(G, { kind: 'fx', fxType: 'burn', owner: ownerIdx, slot: slotIdx });
    if (normalized.type === 'poison') pushAnim(G, { kind: 'fx', fxType: 'poison', owner: ownerIdx, slot: slotIdx });
    if (normalized.type === 'atk_buff' && normalized.val < 0 && !normalized._noWeiwu) {
      triggerCaocaoWeiwu(G, 1 - ownerIdx);
    }
    return true;
  }

  function silenceUnit(G, targetOwner, targetSlot, sourceLabel = '') {
    const u = G.players[targetOwner].board[targetSlot];
    if (!u) return;
    u.silenced = true;
    u.keywords = [];
    u.activeSkill = null;
    u.baseArmor = 0;
    u.armor = 0;
    u.effects = u.effects.filter(e => e.type === 'burn' || e.type === 'poison' || (e.type === 'atk_buff' && e.val < 0));
    pushVfx(G, `unit-${targetOwner}-${targetSlot}`, '🔇失去技能', 'text-slate-300');
    pushAnim(G, { kind: 'fx', fxType: 'silence', owner: targetOwner, slot: targetSlot });
    addLog(G, `${sourceLabel}使【${u.name}】失去所有技能與關鍵字！`);
  }

  function drawCard(G, pIdx, reason = '') {
    const p = G.players[pIdx];
    if (p.deck.length === 0) {
      addLog(G, `${p.name} 試圖抽牌${reason ? '（' + reason + '）' : ''}，但牌庫已耗盡！`);
      return null;
    }
    const card = p.deck.pop();
    if (p.hand.length >= 12) {
      p.graveyard.push(card);
      addLog(G, `【爆牌】${p.name} 手牌過滿，抽到的【${card.name}】直接進入墓地！`);
      return null;
    }
    p.hand.push(card);
    addLog(G, `${p.name} 抽了 1 張牌${reason ? '（' + reason + '）' : ''}。`);
    return card;
  }

  function addCardToHand(G, pIdx, cardInstance) {
    const p = G.players[pIdx];
    if (p.hand.length >= 12) {
      p.graveyard.push(cardInstance);
      return false;
    }
    p.hand.push(cardInstance);
    return true;
  }

  function discardRandomCard(G, pIdx, sourceLabel = '') {
    const p = G.players[pIdx];
    if (p.hand.length === 0) return null;
    const idx = Math.floor(Math.random() * p.hand.length);
    const [card] = p.hand.splice(idx, 1);
    p.graveyard.push(card);
    pushVfx(G, `hero-${pIdx}`, `棄【${card.name}】`, 'text-rose-300');
    addLog(G, `${sourceLabel}${p.name} 隨機棄置了【${card.name}】！`);
    triggerGuzhengOnDiscard(G, pIdx);
    return card;
  }

  function performMulligan(G, pIdx, selectedUids) {
    const p = G.players[pIdx];
    if (p.mulliganDone) return;
    const swapSet = new Set(selectedUids);
    const toKeep = [];
    const toSwap = [];
    for (const c of p.hand) {
      if (swapSet.has(c.uid)) toSwap.push(c);
      else toKeep.push(c);
    }
    if (toSwap.length > 0) {
      p.deck.push(...toSwap);
      p.deck = shuffle(p.deck);
      for (let i = 0; i < toSwap.length; i++) {
        toKeep.push(p.deck.pop());
      }
      p.hand = toKeep;
      addLog(G, `${p.name} 完成了起手調度，更換了 ${toSwap.length} 張手牌。`);
    } else {
      addLog(G, `${p.name} 保留了全部初始手牌。`);
    }
    p.mulliganDone = true;

    if (!G.players[1 - pIdx].mulliganDone) {
      G.mulliganActor = 1 - pIdx;
    } else {
      G.phase = 'MAIN';
      startTurn(G, G.firstPlayer);
    }
  }

  function startTurn(G, pIdx) {
    if (G.phase === 'GAMEOVER') return;
    G.activePlayer = pIdx;
    G.turnNumber += 1;
    G.actedThisTurn = false;
    G.pendingPrompt = null;
    const p = G.players[pIdx];
    p.turnsTaken += 1;
    p.cardsPlayedThisTurn = 0;
    p.tacticPlayedThisTurn = false;

    // v3.1 food curve: T1-T5 +1 each turn; T6+ +1 every 2 turns (T7, T9, T11), cap 8
    const shouldGrow = p.turnsTaken <= 5 || (p.turnsTaken % 2 === 1);
    if (shouldGrow && p.maxFood < MAX_FOOD_CAP) {
      p.maxFood = Math.min(MAX_FOOD_CAP, p.maxFood + 1);
    }
    const penalty = p.nextTurnFoodPenalty || 0;
    p.nextTurnFoodPenalty = 0;
    p.food = Math.max(0, p.maxFood - penalty);
    p.tempFood = 0;
    if (penalty > 0) {
      pushVfx(G, `hero-${pIdx}`, `-${penalty} 本回糧草`, 'text-rose-300');
      addLog(G, `🧱【堅壁清野】生效！${p.name} 本回合糧草收入 -${penalty}（實得 ${p.food}/${p.maxFood}）。`);
    }

    // 重置雙方場上「每回合限一次」狀態（如夏侯惇剛烈）
    for (let owner = 0; owner < 2; owner++) {
      for (let s = 0; s < BOARD_SIZE; s++) {
        const u = G.players[owner].board[s];
        if (u) {
          u.ganglieUsedThisTurn = false;
          u.longyinUsedThisTurn = false;
          u.lubuExtraUsedThisTurn = false;
          u.guzhengUsedThisTurn = false;
          u.weiwuCountThisTurn = 0;
        }
      }
    }

    const wanshaBlocked = isWanshaBlocking(G, pIdx);
    for (let s = 0; s < BOARD_SIZE; s++) {
      const u = p.board[s];
      if (!u) continue;
      if (u.frozenNextTurn) {
        u.isPrep = true;
        u.frozenNextTurn = false;
        addLog(G, `🕊️【緩兵】${p.name} 的【${u.name}】本回合無法攻擊！`);
      } else {
        u.isPrep = false;
      }
      u.attacksUsed = 0;
      u.activeUsedThisTurn = false;
      let bonusArmor = 0;
      if (!wanshaBlocked) {
        for (const eff of u.effects) {
          if (eff.type === 'armor_buff') bonusArmor += eff.val;
        }
      }
      u.armor = u.baseArmor + bonusArmor;
    }

    const roundNum = Math.ceil(G.turnNumber / 2);
    const handCap = getHandLimit(p.hp);
    addLog(G, `——— 第 ${roundNum} 大回合｜${p.name} 回合開始（糧草 ${p.food}/${p.maxFood}｜糧倉 ${p.reserveFood}/${MAX_RESERVE_FOOD}｜手牌上限 ${handCap}） ———`);

    if (pIdx === G.firstPlayer && p.turnsTaken === 1) {
      addLog(G, `【先手規則】${p.name} 第一回合不抽牌。`);
    } else {
      drawCard(G, pIdx, '抽牌階段');
    }

    // v3.4: 國力防線補償（國力首次跌至 ≤20 後，於下個己方回合開始時額外抽 1 張牌並獲得 +1 臨時糧草）
    if (p.defenseLinePending) {
      p.defenseLinePending = false;
      p.tempFood += 1;
      drawCard(G, pIdx, '國力防線補償');
      pushVfx(G, `hero-${pIdx}`, '🛡️防線+1牌+1糧', 'text-amber-300');
      addLog(G, `🛡️【國力防線補償】${p.name} 觸發防線支援，額外抽 1 張牌並獲得 +1 臨時糧草！`);
    }

    // v3.2: 取消後手急行軍，保留後手多 1 張初始手牌 + 第 1 回合正常抽牌

    checkVictory(G);
  }

  function getValidAttackTargets(G, attackerOwner, attackerSlot) {
    const attacker = G.players[attackerOwner].board[attackerSlot];
    if (!canUnitAttack(attacker, G)) return { slots: [], canHitHero: false };

    const enemyIdx = 1 - attackerOwner;
    const enemy = G.players[enemyIdx];
    const hasSnipe = unitHasSnipe(attacker);
    const isDengaiDeployTurn = attacker.id === 'wei_dengai' && attacker.playedOnTurn === G.turnNumber;
    const canBypassToHero = !isUnitSilenced(attacker) && attacker.id === 'wei_dengai' && !isDengaiDeployTurn;

    const aliveSlots = [];
    const targetableSlots = [];
    for (let s = 0; s < BOARD_SIZE; s++) {
      if (!enemy.board[s]) continue;
      aliveSlots.push(s);
      if (hasSnipe || !isProtectedByAdjacentGuard(enemy.board, s)) {
        targetableSlots.push(s);
      }
    }
    if (aliveSlots.length > 0) {
      return {
        slots: targetableSlots.length > 0 ? targetableSlots : aliveSlots,
        canHitHero: canBypassToHero
      };
    }
    // v3.1: 鄧艾登場回合無法攻擊敵方國力
    return { slots: [], canHitHero: !isDengaiDeployTurn };
  }

  function getValidTacticTargets(G, ownerIdx, card) {
    const enemyIdx = 1 - ownerIdx;
    if (card.target === 'enemy_general') {
      const slots = [];
      for (let s = 0; s < BOARD_SIZE; s++) {
        const eu = G.players[enemyIdx].board[s];
        if (!eu) continue;
        if (unitHasShroud(eu)) continue;
        slots.push(s);
      }
      return { type: 'enemy_general', slots };
    }
    if (card.target === 'enemy_adjacent_pair') {
      const slots = [];
      for (let s = 0; s < BOARD_SIZE - 1; s++) {
        const left = G.players[enemyIdx].board[s];
        const right = G.players[enemyIdx].board[s + 1];
        if (!left || !right) continue;
        if ((!isUnitSilenced(left) && left.keywords.includes('SHROUD')) ||
            (!isUnitSilenced(right) && right.keywords.includes('SHROUD'))) continue;
        slots.push(s); // 代表 (s, s+1) 這一對相鄰敵將
      }
      return { type: 'enemy_adjacent_pair', slots };
    }
    if (card.target === 'ally_general') {
      const slots = [];
      for (let s = 0; s < BOARD_SIZE; s++) {
        const au = G.players[ownerIdx].board[s];
        if (!au) continue;
        if (unitHasShroud(au)) continue;
        slots.push(s);
      }
      return { type: 'ally_general', slots };
    }
    return { type: 'none', slots: [] };
  }

  function canPlayCard(G, pIdx, card) {
    if (G.phase !== 'MAIN' || G.activePlayer !== pIdx || G.pendingPrompt) return false;
    const p = G.players[pIdx];
    if (getTotalFood(p, card.type) < getEffectiveCardCost(G, pIdx, card)) return false;
    if (card.type === 'GENERAL') {
      return p.board.some(s => s === null);
    }
    if (card.type === 'TACTIC') {
      const t = getValidTacticTargets(G, pIdx, card);
      if (t.type !== 'none' && t.slots.length === 0) return false;
      return true;
    }
    return false;
  }

  function dealDamageToUnit(G, targetOwner, targetSlot, baseDmg, sourceLabel = '', opts = {}) {
    const unit = G.players[targetOwner].board[targetSlot];
    if (!unit || baseDmg <= 0) return { actualHpLoss: 0, killed: false, totalDmg: 0, shieldBroken: false };

    // v3.2: 只有普通攻擊傷害才能以護甲抵銷（謀略／技能／灼燒皆無視護甲）
    const isNormalAttack = Boolean(opts.isNormalAttack);
    const ignoreArmor = Boolean(opts.ignoreArmor) || !isNormalAttack;
    let totalDmg = baseDmg;

    // v3.3 諸葛瑾【緩釋】：在場時，我方其他武將受到的謀略牌與技能傷害 -1（最低 1）
    if (!isNormalAttack && !opts.isDot && totalDmg > 1) {
      const hasHuanshi = G.players[targetOwner].board.some((u, idx) => u && idx !== targetSlot && u.id === 'wu_zhugejin' && !isUnitSilenced(u));
      if (hasHuanshi) totalDmg = Math.max(1, totalDmg - 1);
    }

    // v3.3 小喬【天香】：受到普通攻擊傷害時，傷害 -1（最低 0），對敵最高攻施加灼燒（2回合），場上有周瑜抽 1 牌
    let xiaoqiaoTriggered = false;
    if (isNormalAttack && unit.id === 'wu_xiaoqiao' && !isUnitSilenced(unit) && totalDmg > 0) {
      totalDmg = Math.max(0, totalDmg - 1);
      xiaoqiaoTriggered = true;
    }
    const armorBefore = unit.armor;
    const blocked = ignoreArmor ? 0 : Math.min(unit.armor, totalDmg);
    unit.armor -= blocked;
    const shieldBroken = armorBefore > 0 && unit.armor === 0 && !ignoreArmor;
    const hpLoss = totalDmg - blocked;
    unit.hp -= hpLoss;

    // v3.2 周泰【不屈】：生命值不會低於 1（每場遊戲最多觸發 2 次）
    const bquCount = Number(G.zhoutaiBquUsed[targetOwner]) || 0;
    if (unit.id === 'wu_zhoutai' && !isUnitSilenced(unit) && unit.hp <= 0 && bquCount < 2) {
      G.zhoutaiBquUsed[targetOwner] = bquCount + 1;
      unit.hp = 1;
      pushSkillAnim(G, targetOwner, unit, '不屈', `以死相護，生命值鎖定於 1！（${bquCount + 1}/2）`, 'unyielding');
      pushVfx(G, `unit-${targetOwner}-${targetSlot}`, `🔥不屈 ${bquCount + 1}/2`, 'text-amber-300');
      addLog(G, `🔥 觸發【周泰·不屈】（第 ${bquCount + 1}/2 次）！周泰免於陣亡，生命值鎖定為 1！`);
    }

    // v3.1 凌統【死戰】：首次受到致命傷害時，保留 1 點生命並獲得 +1 攻擊力（每場遊戲一次）
    if (unit.id === 'wu_lingtong' && !isUnitSilenced(unit) && unit.hp <= 0 && !G.lingtongSizhanUsed[targetOwner]) {
      G.lingtongSizhanUsed[targetOwner] = true;
      unit.hp = 1;
      if (!isWanshaBlocking(G, targetOwner)) {
        unit.atk += 1;
      }
      pushSkillAnim(G, targetOwner, unit, '死戰', '絕境死戰！保留 1 點生命並獲得 +1 攻擊力！', 'unyielding');
      pushVfx(G, `unit-${targetOwner}-${targetSlot}`, '🌊死戰 1HP +1攻', 'text-amber-300');
      addLog(G, `🌊 觸發【凌統·死戰】！凌統保留 1 點生命並獲得 +1 攻擊力（目前 ${unit.atk}）！`);
    }

    const key = `unit-${targetOwner}-${targetSlot}`;
    if (ignoreArmor && armorBefore > 0) {
      pushVfx(G, key, `-${hpLoss} (破甲!)`, 'text-amber-300');
      pushAnim(G, { kind: 'fx', fxType: 'pierce', owner: targetOwner, slot: targetSlot });
    } else if (blocked > 0 && hpLoss === 0) {
      pushVfx(G, key, `🛡️格擋 ${blocked}`, 'text-sky-300');
      pushAnim(G, { kind: 'fx', fxType: 'shield', owner: targetOwner, slot: targetSlot });
    } else if (blocked > 0) {
      pushVfx(G, key, `-${hpLoss} (🛡️-${blocked})`, 'text-rose-400');
      if (shieldBroken) pushAnim(G, { kind: 'fx', fxType: 'shield_break', owner: targetOwner, slot: targetSlot });
    } else {
      pushVfx(G, key, `-${hpLoss}`, 'text-rose-400');
    }

    const armorNote = ignoreArmor && armorBefore > 0 ? '（破甲無視護甲）' : (blocked > 0 ? `，護甲抵擋 ${blocked}` : '');
    addLog(G, `${sourceLabel}對 ${G.players[targetOwner].name} 的【${unit.name}】造成 ${totalDmg} 點傷害${armorNote}（剩餘生命 ${Math.max(0, unit.hp)}）。`);

    // 典韋【惡來】：每次受到傷害時，攻擊力 +1
    if (unit.id === 'wei_dianwei' && !isUnitSilenced(unit) && hpLoss > 0 && unit.hp > 0) {
      if (!isWanshaBlocking(G, targetOwner)) {
        unit.atk += 1;
        pushSkillAnim(G, targetOwner, unit, '惡來', '受創激怒，攻擊力 +1！', 'buff');
        pushVfx(G, key, '+1攻(惡來)', 'text-amber-300');
        addLog(G, `🔱【典韋·惡來】受到傷害，攻擊力永久 +1（目前 ${unit.atk}）！`);
      }
    }

    // v3.1 夏侯惇【剛烈】：每當受到傷害後，本回合攻擊力 +2（每回合限 1 次）
    if (unit.id === 'wei_xiahoudun' && !isUnitSilenced(unit) && hpLoss > 0 && unit.hp > 0 && !unit.ganglieUsedThisTurn) {
      unit.ganglieUsedThisTurn = true;
      if (applyEffect(G, targetOwner, targetSlot, { type: 'atk_buff', val: 2, halfTurns: 1, label: '剛烈+2攻' })) {
        pushSkillAnim(G, targetOwner, unit, '剛烈', '受創不屈，本回合攻擊力 +2！', 'buff');
        pushVfx(G, key, '+2攻(剛烈)', 'text-amber-300');
        addLog(G, `👁️【夏侯惇·剛烈】受到傷害，本回合攻擊力 +2！`);
      }
    }

    if (xiaoqiaoTriggered) {
      const oppIdx = 1 - targetOwner;
      const opp = G.players[oppIdx];
      let bestS = -1, bestA = -1;
      for (let s = 0; s < BOARD_SIZE; s++) {
        if (opp.board[s] && getUnitAtk(opp.board[s], G) > bestA) { bestA = getUnitAtk(opp.board[s], G); bestS = s; }
      }
      if (bestS !== -1) applyEffect(G, oppIdx, bestS, { type: 'burn', val: 1, turns: 2, label: '灼燒' });
      if (G.players[targetOwner].board.some(u => u && u.id === 'wu_zhouyu' && !isUnitSilenced(u))) {
        drawCard(G, targetOwner, '小喬·天香');
      }
    }

    // v3.3 于禁【節潰】：生命值 ≤ 2 時，永久失去護甲且攻擊力 -1（最低為 0）
    if (unit.id === 'wei_yujin' && !isUnitSilenced(unit) && !unit.jiekuiTriggered && unit.hp > 0 && unit.hp <= 1) {
      unit.jiekuiTriggered = true;
      unit.baseArmor = 0;
      unit.armor = 0;
      unit.atk = Math.max(0, unit.atk - 1);
    }

    return { actualHpLoss: hpLoss, killed: unit.hp <= 0, totalDmg, shieldBroken };
  }

  function dealDamageToHero(G, targetOwner, dmg, sourceLabel = '') {
    if (dmg <= 0) return;
    const p = G.players[targetOwner];
    p.hp -= dmg;
    pushVfx(G, `hero-${targetOwner}`, `-${dmg} 國力`, 'text-red-400');
    addLog(G, `${sourceLabel}對 ${p.name} 國力造成 ${dmg} 點傷害（剩餘國力 ${p.hp}）。`);
    if (p.hp > 0 && p.hp <= 20 && !p.defenseLineTriggered) {
      p.defenseLineTriggered = true;
      p.defenseLinePending = true;
      pushVfx(G, `hero-${targetOwner}`, '🛡️觸發國力防線', 'text-amber-300');
      addLog(G, `🛡️【國力防線】${p.name} 國力首次跌至 ≤20，下個己方回合開始時將額外抽 1 張牌並獲得 +1 臨時糧草！`);
    }
  }

  function healHero(G, targetOwner, amt, sourceLabel = '') {
    if (amt <= 0) return;
    const p = G.players[targetOwner];
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + amt);
    const healed = p.hp - before;
    if (healed > 0) {
      pushVfx(G, `hero-${targetOwner}`, `+${healed} 國力`, 'text-emerald-400');
      addLog(G, `${sourceLabel}使 ${p.name} 回復 ${healed} 點國力（目前 ${p.hp}）。`);
    }
  }

  function healUnit(G, targetOwner, targetSlot, amt, sourceLabel = '') {
    const u = G.players[targetOwner].board[targetSlot];
    if (!u || amt <= 0) return;
    const before = u.hp;
    u.hp = Math.min(u.maxHp, u.hp + amt);
    const healed = u.hp - before;
    if (healed > 0) {
      pushVfx(G, `unit-${targetOwner}-${targetSlot}`, `+${healed}❤️`, 'text-emerald-400');
      pushAnim(G, { kind: 'fx', fxType: 'heal', owner: targetOwner, slot: targetSlot });
      addLog(G, `${sourceLabel}使【${u.name}】回復 ${healed} 點生命。`);
    }
  }

  function triggerDeathrattle(G, unit, ownerIdx) {
    if (!unit || isUnitSilenced(unit) || !unit.keywords.includes('DEATHRATTLE')) return;
    const enemyIdx = 1 - ownerIdx;
    const p = G.players[ownerIdx];
    const enemy = G.players[enemyIdx];
    addLog(G, `🕯️ 觸發【${unit.name}】遺計效果！`);
    switch (unit.id) {
      case 'wei_guojia': {
        // v3.1: 陣亡抽 1 張牌；若我方手牌少於敵方改為抽 2 張牌（移除存糧倉）
        const drawN = p.hand.length < enemy.hand.length ? 2 : 1;
        pushSkillAnim(G, ownerIdx, unit, '遺計', `陣亡抽 ${drawN} 張牌！`, 'skill');
        for (let i = 0; i < drawN; i++) drawCard(G, ownerIdx, '郭嘉·遺計');
        break;
      }
      case 'qun_zhangjiao':
        pushSkillAnim(G, ownerIdx, unit, '黃天遺計', '對敵方全體武將造成 1 點傷害！', 'burn');
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (enemy.board[s]) {
            dealDamageToUnit(G, enemyIdx, s, 1, '【張角·遺計】');
          }
        }
        break;
      case 'wei_lidian':
        addReserveFood(G, ownerIdx, 1, '【李典·恂恂】');
        for (const adj of [unit.slot - 1, unit.slot + 1]) {
          if (adj >= 0 && adj < BOARD_SIZE && p.board[adj]) {
            applyEffect(G, ownerIdx, adj, { type: 'atk_buff', val: 1, halfTurns: 2, label: '+1攻' });
            applyEffect(G, ownerIdx, adj, { type: 'armor_buff', val: 1, halfTurns: 2, label: '+1甲' });
          }
        }
        break;
      case 'shu_menghuo':
        if (p.hp >= 18 && p.board[unit.slot] === null) {
          const rebornCard = createCardInstance('shu_menghuo');
          const reborn = createUnitFromCard(rebornCard, ownerIdx, unit.slot, G.turnNumber);
          reborn.atk = 2;
          reborn.hp = 3;
          reborn.maxHp = 3;
          reborn.armor = 0;
          reborn.baseArmor = 0;
          reborn.keywords = [];
          p.board[unit.slot] = reborn;
        }
        break;
      case 'qun_tianfeng':
        if (p.hand.length === 0) {
          drawCard(G, ownerIdx, '田豐·死諫');
          drawCard(G, ownerIdx, '田豐·死諫');
          let bestS = -1, bestA = -1;
          for (let s = 0; s < BOARD_SIZE; s++) {
            if (enemy.board[s] && getUnitAtk(enemy.board[s], G) > bestA) { bestA = getUnitAtk(enemy.board[s], G); bestS = s; }
          }
          if (bestS !== -1) dealDamageToUnit(G, enemyIdx, bestS, 2, '【田豐·死諫】');
        } else {
          drawCard(G, ownerIdx, '田豐·死諫');
        }
        break;
    }
  }

  function cleanupDeadUnits(G, depth = 0) {
    const deadList = [];
    for (let pIdx = 0; pIdx < 2; pIdx++) {
      const p = G.players[pIdx];
      for (let s = 0; s < BOARD_SIZE; s++) {
        const u = p.board[s];
        if (u && u.hp <= 0) {
          p.board[s] = null;
          p.graveyard.push(createCardInstance(u.id));
          deadList.push({ owner: pIdx, slot: s, unit: u });
          pushAnim(G, { kind: 'death', owner: pIdx, slot: s, name: u.name, icon: u.icon, faction: u.faction });
          addLog(G, `💀 ${p.name} 的【${u.name}】（${SLOT_NAMES[s]}）陣亡，進入墓地！`);
        }
      }
    }
    if (deadList.length > 0 && depth < 5) {
      for (const d of deadList) {
        triggerDeathrattle(G, d.unit, d.owner);
      }
      const chained = cleanupDeadUnits(G, depth + 1);
      deadList.push(...chained);
    }
    return deadList;
  }

  function triggerKillBonus(G, killer, killerOwner) {
    if (!killer || isUnitSilenced(killer) || !killer.keywords.includes('KILL')) return;
    const enemyIdx = 1 - killerOwner;
    pushAnim(G, { kind: 'kill_bonus', owner: killerOwner, slot: killer.slot, name: killer.name });
    addLog(G, `⚡ 觸發【${killer.name}】斬殺效果！`);
    playSound(G, 'playKill');
    switch (killer.id) {
      case 'shu_guanyu':
        // v3.1: 斬殺抽 1 張牌，並對敵方國力造成 1 點傷害
        pushSkillAnim(G, killerOwner, killer, '武聖', '斬殺抽 1 張牌，並打敵方國力 1 點傷害！', 'slash');
        drawCard(G, killerOwner, '關羽·武聖');
        dealDamageToHero(G, enemyIdx, 1, '【關羽·武聖】');
        break;
      case 'wu_sunce':
        if (killer.hp > 0) {
          pushSkillAnim(G, killerOwner, killer, '激昂', '斬殺自身獲得 +1/+1！', 'buff');
          buffUnitStats(G, killerOwner, killer.slot, 1, 1, '【孫策·激昂】');
        }
        break;
      case 'qun_huaxiong':
        if (killer.hp > 0) {
          pushSkillAnim(G, killerOwner, killer, '耀武', '斬殺自身獲得 +2/+1！', 'buff');
          buffUnitStats(G, killerOwner, killer.slot, 2, 1, '【華雄·耀武】');
        }
        break;
      case 'shu_huangzhong':
        drawCard(G, killerOwner, '黃忠·烈弓');
        break;
      case 'qun_lubu':
        dealDamageToHero(G, enemyIdx, 2, '【呂布·無雙】');
        if (killer.hp > 0 && !killer.lubuExtraUsedThisTurn) {
          killer.lubuExtraUsedThisTurn = true;
          killer.attacksUsed = Math.max(0, killer.attacksUsed - 1);
        }
        break;
    }
  }

  function triggerOnPlay(G, ownerIdx, slotIdx, unit) {
    const enemyIdx = 1 - ownerIdx;
    const p = G.players[ownerIdx];
    const enemy = G.players[enemyIdx];
    const hasEnemyUnits = enemy.board.some(u => u !== null);

    switch (unit.id) {
      case 'shu_liaohua': {
        const hasAdj = (slotIdx > 0 && p.board[slotIdx - 1]) || (slotIdx < BOARD_SIZE - 1 && p.board[slotIdx + 1]);
        if (hasAdj) {
          pushSkillAnim(G, ownerIdx, unit, '先鋒', '相鄰已有友軍，自身 +1 攻擊力！', 'buff');
          buffUnitStats(G, ownerIdx, slotIdx, 1, 0, '【廖化·先鋒】');
        }
        break;
      }
      case 'shu_fazheng': {
        if (p.hand.length < enemy.hand.length) {
          drawCard(G, ownerIdx, '法正·奇謀');
          drawCard(G, ownerIdx, '法正·奇謀');
          let bestS = -1, bestA = -1;
          for (let s = 0; s < BOARD_SIZE; s++) {
            if (enemy.board[s] && getUnitAtk(enemy.board[s], G) > bestA) { bestA = getUnitAtk(enemy.board[s], G); bestS = s; }
          }
          if (bestS !== -1) applyEffect(G, enemyIdx, bestS, { type: 'atk_buff', val: -2, halfTurns: 2, label: '-2攻' });
        } else {
          drawCard(G, ownerIdx, '法正·奇謀');
          G.pendingPrompt = {
            kind: 'TARGET_ALLY',
            owner: ownerIdx,
            sourceName: unit.name,
            sourceIcon: unit.icon,
            skillName: '奇謀',
            desc: '選擇一名友方武將本回合獲得狙擊：',
            context: { type: 'FAZHENG_SNIPE', sourceSlot: slotIdx }
          };
        }
        break;
      }
      case 'shu_zhangfei': {
        let bestGuard = -1, bestGuardHp = -1;
        let bestAtkSlot = -1, bestAtk = -1;
        for (let s = 0; s < BOARD_SIZE; s++) {
          const eu = enemy.board[s];
          if (!eu) continue;
          if (unitHasGuard(eu) && eu.hp > bestGuardHp) { bestGuardHp = eu.hp; bestGuard = s; }
          if (getUnitAtk(eu, G) > bestAtk) { bestAtk = getUnitAtk(eu, G); bestAtkSlot = s; }
        }
        if (bestGuard !== -1) {
          pushSkillAnim(G, ownerIdx, unit, '咆哮', '震懾敵方護衛，造成 3 點傷害！', 'slash');
          dealDamageToUnit(G, enemyIdx, bestGuard, 3, '【張飛·咆哮】');
        } else if (bestAtkSlot !== -1) {
          pushSkillAnim(G, ownerIdx, unit, '咆哮', '怒喝敵軍，造成 2 點傷害！', 'slash');
          dealDamageToUnit(G, enemyIdx, bestAtkSlot, 2, '【張飛·咆哮】');
        }
        break;
      }
      case 'shu_jiangwei': {
        const hasZgl = p.board.some(u => u && u.id === 'shu_zhugeliang');
        if (hasZgl) {
          pushSkillAnim(G, ownerIdx, unit, '繼志', '諸葛亮在場，獲得 +2/+2 與護衛！', 'buff');
          buffUnitStats(G, ownerIdx, slotIdx, 2, 2, '【姜維·繼志】');
          if (!unit.keywords.includes('GUARD')) unit.keywords.push('GUARD');
        }
        break;
      }
      case 'shu_zhugeliang': {
        for (let i = 0; i < 2; i++) {
          const drawn = drawCard(G, ownerIdx, '諸葛亮·觀星');
          if (drawn && drawn.type === 'TACTIC' && drawn.cost > 1) {
            drawn.cost -= 1;
            drawn.tempCostMod = (drawn.tempCostMod || 0) - 1;
            drawn.debuffExpiresAfterTurn = p.turnsTaken + 2;
          }
        }
        break;
      }
      case 'wei_xuhuang': {
        let bestSlot = -1, bestAtk = -1;
        for (let s = 0; s < BOARD_SIZE; s++) {
          const eu = enemy.board[s];
          if (eu && getUnitAtk(eu, G) > bestAtk) { bestAtk = getUnitAtk(eu, G); bestSlot = s; }
        }
        pushSkillAnim(G, ownerIdx, unit, '斷糧', '削弱敵最高攻 -1 攻（2大回合），並扣除敵方 1 點糧倉！', 'skill');
        if (bestSlot !== -1) {
          applyEffect(G, enemyIdx, bestSlot, { type: 'atk_buff', val: -1, halfTurns: 4, label: '-1攻' });
          addLog(G, `【徐晃·斷糧】使敵方【${enemy.board[bestSlot].name}】攻擊力 -1（2大回合）。`);
        }
        if (enemy.reserveFood > 0) {
          enemy.reserveFood -= 1;
          pushVfx(G, `hero-${enemyIdx}`, '-1 糧倉', 'text-rose-300');
          addLog(G, `【徐晃·斷糧】摧毀了 ${enemy.name} 1 點糧倉！`);
        }
        break;
      }
      case 'wei_zhangliao':
        if (hasEnemyUnits) {
          G.pendingPrompt = {
            kind: 'TARGET_ENEMY',
            owner: ownerIdx,
            sourceName: unit.name,
            sourceIcon: unit.icon,
            skillName: '止啼',
            desc: '請選擇一名敵方武將，使其失去所有技能：',
            context: { type: 'SILENCE', sourceSlot: slotIdx }
          };
        }
        break;
      case 'wei_zhanghe': {
        // v3.2: 查看敵方最高費手牌，謀略+1費(2大回合)／武將-1/-1(2大回合)
        if (enemy.hand.length > 0) {
          let maxIdx = 0;
          for (let i = 1; i < enemy.hand.length; i++) {
            if (enemy.hand[i].cost > enemy.hand[maxIdx].cost) maxIdx = i;
          }
          const targetCard = enemy.hand[maxIdx];
          const expiresAfter = enemy.turnsTaken + 2;
          if (targetCard.type === 'TACTIC') {
            targetCard.cost += 1;
            targetCard.tempCostMod = (targetCard.tempCostMod || 0) + 1;
            targetCard.debuffExpiresAfterTurn = expiresAfter;
            pushSkillAnim(G, ownerIdx, unit, '料敵', `洞悉敵最高費手牌【${targetCard.name}】，費用 +1（2大回合）！`, 'skill');
            addLog(G, `🎯【張郃·料敵】查看敵方最高費手牌【${targetCard.name}】，使其費用 +1（2大回合）！`);
          } else {
            const atkDrop = Math.min(1, targetCard.baseAtk);
            const hpDrop = targetCard.baseHp > 1 ? 1 : 0;
            targetCard.baseAtk -= atkDrop;
            targetCard.baseHp -= hpDrop;
            targetCard.tempAtkDrop = (targetCard.tempAtkDrop || 0) + atkDrop;
            targetCard.tempHpDrop = (targetCard.tempHpDrop || 0) + hpDrop;
            targetCard.debuffExpiresAfterTurn = expiresAfter;
            pushSkillAnim(G, ownerIdx, unit, '料敵', `洞悉敵最高費手牌【${targetCard.name}】，-1/-1（2大回合）！`, 'skill');
            addLog(G, `🎯【張郃·料敵】查看敵方最高費手牌【${targetCard.name}】，使其 -1/-1（2大回合）！`);
          }
        }
        break;
      }
      case 'wei_xunyou':
        G.pendingPrompt = {
          kind: 'CHOICE',
          owner: ownerIdx,
          sourceName: unit.name,
          sourceIcon: unit.icon,
          skillName: '奇策',
          options: [
            { id: 'xunyou_draw', label: '📜 抽 2 張牌', desc: '立即從牌庫抽 2 張牌' },
            { id: 'xunyou_dmg', label: '🔥 造成 3 點傷害', desc: hasEnemyUnits ? '指定一名敵方武將造成 3 點傷害' : '敵方無武將，改對敵方國力造成 2 傷' },
            { id: 'xunyou_buff', label: '⚔️ 全友軍 +1/+1', desc: '使我方所有在場武將獲得 +1/+1' }
          ],
          context: { sourceSlot: slotIdx }
        };
        break;
      case 'wei_xuchu':
        G.pendingPrompt = {
          kind: 'CHOICE',
          owner: ownerIdx,
          sourceName: unit.name,
          sourceIcon: unit.icon,
          skillName: '裸衣',
          options: [
            { id: 'xuchu_yes', label: '🐯 發動【裸衣】', desc: '自身失去 2 點生命，獲得 +2 攻擊力（變為 7/3）' },
            { id: 'xuchu_no', label: '🛡️ 保持常態', desc: '維持原本 5/5 身材' }
          ],
          context: { sourceSlot: slotIdx }
        };
        break;
      case 'wei_simayi': {
        addReserveFood(G, ownerIdx, 1, '【司馬懿·隱忍】');
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (enemy.board[s]) {
            applyEffect(G, enemyIdx, s, { type: 'atk_buff', val: -1, halfTurns: 2, label: '隱忍-1攻' });
          }
        }
        break;
      }
      case 'wei_caocao':
        G.pendingPrompt = {
          kind: 'CHOICE',
          owner: ownerIdx,
          sourceName: unit.name,
          sourceIcon: unit.icon,
          skillName: '奸雄',
          options: [
            { id: 'caocao_atk', label: '⚔️ 橫掃千軍', desc: '所有友方武將本回合獲得 +2 攻擊力' },
            { id: 'caocao_draw', label: '📜 運籌帷幄', desc: '抽 2 張牌並往糧倉存入 1 點糧草' }
          ],
          context: { sourceSlot: slotIdx }
        };
        break;
      case 'wu_ganning':
        pushSkillAnim(G, ownerIdx, unit, '劫營', '突襲敵營，敵方隨機棄 1 張手牌！', 'skill');
        discardRandomCard(G, enemyIdx, '【甘寧·劫營】');
        break;
      case 'wu_taishici':
        if (hasEnemyUnits) {
          G.pendingPrompt = {
            kind: 'TARGET_ENEMY',
            owner: ownerIdx,
            sourceName: unit.name,
            sourceIcon: unit.icon,
            skillName: '神射',
            desc: '請選擇一名敵方武將造成 2 點傷害（無反擊；擊殺自身 +1/+1）：',
            context: { type: 'SHENSHE', sourceSlot: slotIdx }
          };
        }
        break;
      case 'wu_zhugejin':
        if (hasEnemyUnits) {
          G.pendingPrompt = {
            kind: 'TARGET_ENEMY',
            owner: ownerIdx,
            sourceName: unit.name,
            sourceIcon: unit.icon,
            skillName: '緩兵',
            desc: '請選擇一名敵方武將，使其下回合無法攻擊：',
            context: { type: 'FREEZE', sourceSlot: slotIdx }
          };
        }
        break;
      case 'wu_lumeng':
        if (hasEnemyUnits) {
          G.pendingPrompt = {
            kind: 'TARGET_ENEMY',
            owner: ownerIdx,
            sourceName: unit.name,
            sourceIcon: unit.icon,
            skillName: '攻心',
            desc: '請選擇一名敵方武將，使其技能在之後 2 大回合無效且攻擊力 -1（2大回合）：',
            context: { type: 'LUMENG_GONGXIN', sourceSlot: slotIdx }
          };
        }
        break;
      case 'wu_zhouyu': {
        const hasXiaoqiao = p.board.some(au => au && au.id === 'wu_xiaoqiao' && !isUnitSilenced(au));
        pushSkillAnim(G, ownerIdx, unit, '英姿', hasXiaoqiao ? '敵全體 1 傷並灼燒（2回合），小喬在場額外抽 1 張牌！' : '敵全體 1 傷並灼燒（2回合）！', 'burn');
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (enemy.board[s]) {
            dealDamageToUnit(G, enemyIdx, s, 1, '【周瑜·英姿】');
            if (enemy.board[s] && enemy.board[s].hp > 0) {
              applyEffect(G, enemyIdx, s, { type: 'burn', val: 1, turns: 2, label: '灼燒' });
            }
          }
        }
        if (hasXiaoqiao) {
          drawCard(G, ownerIdx, '周瑜·英姿');
        }
        break;
      }
      case 'wu_luxun':
        if (enemy.board.some(eu => eu !== null)) {
          G.pendingPrompt = {
            kind: 'TARGET_ENEMY',
            owner: ownerIdx,
            sourceName: unit.name,
            sourceIcon: unit.icon,
            skillName: '連營',
            desc: '指定一名敵方武將造成 2 傷並灼燒（2回合），火勢向左右相鄰敵將蔓延（各受 1 傷並灼燒 2 回合）：',
            context: { type: 'LUXUN_LIANYING', sourceSlot: slotIdx }
          };
        }
        break;
      case 'qun_yanliang': {
        const partnerSlot = p.board.findIndex(u => u && u.id === 'qun_wenchou');
        if (partnerSlot !== -1) {
          pushSkillAnim(G, ownerIdx, unit, '雙雄', '文醜在場！顏良與文醜各獲得 +1/+1！', 'buff');
          buffUnitStats(G, ownerIdx, slotIdx, 1, 1, '【顏良·雙雄】');
          buffUnitStats(G, ownerIdx, partnerSlot, 1, 1, '【顏良·雙雄】');
        }
        break;
      }
      case 'qun_wenchou': {
        const partnerSlot = p.board.findIndex(u => u && u.id === 'qun_yanliang');
        if (partnerSlot !== -1) {
          pushSkillAnim(G, ownerIdx, unit, '雙雄', '顏良在場！顏良與文醜各獲得 +1/+1！', 'buff');
          buffUnitStats(G, ownerIdx, slotIdx, 1, 1, '【文醜·雙雄】');
          buffUnitStats(G, ownerIdx, partnerSlot, 1, 1, '【文醜·雙雄】');
        }
        break;
      }
      case 'qun_xiliang':
        if (p.reserveFood >= 1) {
          p.reserveFood -= 1;
          pushSkillAnim(G, ownerIdx, unit, '奔襲', '消耗 1 點糧倉，獲得 +1/+1！', 'buff');
          buffUnitStats(G, ownerIdx, slotIdx, 1, 1, '【西涼鐵騎·奔襲】');
        }
        break;
      case 'qun_jiaxu':
        if (enemy.board.some(eu => eu !== null)) {
          G.pendingPrompt = {
            kind: 'TARGET_ENEMY',
            owner: ownerIdx,
            sourceName: unit.name,
            sourceIcon: unit.icon,
            skillName: '完殺',
            desc: '指定一名敵方武將，清除其所有正向增益（攻／甲／護衛增益）：',
            context: { type: 'JIAXU_WANSHA', sourceSlot: slotIdx }
          };
        }
        break;
      case 'qun_zhangjiao': {
        const emptySlot = p.board.findIndex(u => u === null);
        if (emptySlot !== -1) {
          const tokenCard = createCardInstance('qun_yellow_turban');
          const tokenUnit = createUnitFromCard(tokenCard, ownerIdx, emptySlot, G.turnNumber);
          p.board[emptySlot] = tokenUnit;
          pushSkillAnim(G, ownerIdx, unit, '黃天', `於 ${SLOT_NAMES[emptySlot]} 召喚 1 名【黃巾力士】！`, 'skill');
          addLog(G, `【張角·黃天】於 ${SLOT_NAMES[emptySlot]} 召喚了 1 名【黃巾力士】！`);
        }
        break;
      }
      case 'qun_yuanshu':
        // v3.2: 登場隨機棄 1 張手牌，自身 +2/+2 與護衛
        pushSkillAnim(G, ownerIdx, unit, '稱帝', '登基稱帝！棄 1 張手牌，自身獲得 +2/+2 與護衛！', 'buff');
        discardRandomCard(G, ownerIdx, '【袁術·稱帝】');
        buffUnitStats(G, ownerIdx, slotIdx, 2, 2, '【袁術·稱帝】');
        if (!unit.keywords.includes('GUARD')) unit.keywords.push('GUARD');
        break;
      case 'qun_yuanshao':
        pushSkillAnim(G, ownerIdx, unit, '亂擊', '敵全體 1 傷，全友軍 +1 攻（2大回合）！', 'slash');
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (enemy.board[s]) dealDamageToUnit(G, enemyIdx, s, 1, '【袁紹·亂擊】');
          if (p.board[s]) applyEffect(G, ownerIdx, s, { type: 'atk_buff', val: 1, halfTurns: 4, label: '+1攻' });
        }
        break;
      case 'qun_dongzhuo':
        pushSkillAnim(G, ownerIdx, unit, '暴政', '入主洛陽，己方國力 -2！', 'skill');
        dealDamageToHero(G, ownerIdx, 2, '【董卓·暴政】');
        break;
      case 'neu_gongbing':
        pushSkillAnim(G, ownerIdx, unit, '齊射', '對敵方國力造成 1 點傷害！', 'slash');
        dealDamageToHero(G, enemyIdx, 1, '【強弩手·齊射】');
        break;
      case 'wei_xiahouyuan': {
        const enemyCount = enemy.board.filter(u => u !== null).length;
        const allyCount = p.board.filter(u => u !== null).length;
        if (enemyCount >= allyCount) {
          applyEffect(G, ownerIdx, slotIdx, { type: 'atk_buff', val: 1, halfTurns: 1, label: '+1攻' });
          applyEffect(G, ownerIdx, slotIdx, { type: 'combo_buff', val: 1, halfTurns: 1, label: '連擊' });
        }
        break;
      }
      case 'shu_liubei': {
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (p.board[s]) buffUnitStats(G, ownerIdx, s, 1, 1, '【劉備·昭烈】');
        }
        if (p.board.some(u => u && (u.id === 'shu_guanyu' || u.id === 'shu_zhangfei'))) {
          healHero(G, ownerIdx, 2, '【劉備·昭烈】');
          drawCard(G, ownerIdx, '劉備·昭烈');
        }
        break;
      }
      case 'shu_masu': {
        if (enemy.hand.length > 0) {
          const sample = shuffle(enemy.hand).slice(0, Math.min(2, enemy.hand.length));
          if (sample.some(c => c.type === 'TACTIC')) {
            drawCard(G, ownerIdx, '馬謖·心戰');
            let bestS = -1, bestA = -1;
            for (let s = 0; s < BOARD_SIZE; s++) {
              if (enemy.board[s] && getUnitAtk(enemy.board[s], G) > bestA) { bestA = getUnitAtk(enemy.board[s], G); bestS = s; }
            }
            if (bestS !== -1) dealDamageToUnit(G, enemyIdx, bestS, 1, '【馬謖·心戰】');
          }
        }
        break;
      }
      case 'shu_liyan':
        addReserveFood(G, ownerIdx, 2, '【李嚴·督糧】');
        break;
      case 'wu_xusheng':
        if (p.hand.length >= 4) {
          applyEffect(G, ownerIdx, slotIdx, { type: 'armor_buff', val: 2, halfTurns: 4, label: '+2甲' });
          applyEffect(G, ownerIdx, slotIdx, { type: 'shroud_buff', val: 1, halfTurns: 2, label: '帷幕' });
        }
        if (hasEnemyUnits) {
          G.pendingPrompt = {
            kind: 'TARGET_ENEMY',
            owner: ownerIdx,
            sourceName: unit.name,
            sourceIcon: unit.icon,
            skillName: '破軍',
            desc: '清除指定敵方武將護甲並凍結（若為護衛額外造成2傷）：',
            context: { type: 'XUSHENG_POJUN', sourceSlot: slotIdx }
          };
        }
        break;
      case 'wu_zhangzhao':
        if (p.board.some(u => u && u.id === 'wu_zhanghong')) {
          drawCard(G, ownerIdx, '張昭·固政');
        }
        if (p.hand.length > 0) {
          G.pendingPrompt = {
            kind: 'ZHANGZHAO_DISCARD',
            owner: ownerIdx,
            sourceName: unit.name,
            sourceIcon: unit.icon,
            skillName: '固政',
            slotIdx
          };
        }
        break;
      case 'qun_gaoshun':
        if (p.board.some(u => u && u.id === 'qun_lubu')) {
          unit.isPrep = false;
          if (!unit.keywords.includes('RUSH')) unit.keywords.push('RUSH');
        }
        break;
      case 'neu_chengong':
        if (p.reserveFood >= 1) {
          p.reserveFood -= 1;
          pushSkillAnim(G, ownerIdx, unit, '明策', '消耗 1 點糧倉，抽 1 張牌！', 'skill');
          drawCard(G, ownerIdx, '陳宮·明策');
        } else {
          pushSkillAnim(G, ownerIdx, unit, '明策', '往己方糧倉存入 1 點糧草！', 'skill');
          addReserveFood(G, ownerIdx, 1, '【陳宮·明策】');
        }
        break;
    }
    cleanupDeadUnits(G);
    checkVictory(G);
  }

  function activateUnitSkill(G, pIdx, slotIdx) {
    if (!canUseActiveSkill(G, pIdx, slotIdx)) return false;
    const p = G.players[pIdx];
    const enemyIdx = 1 - pIdx;
    const enemy = G.players[enemyIdx];
    const u = p.board[slotIdx];

    if (u.id === 'wu_sunquan') {
      G.pendingPrompt = {
        kind: 'ZHIHENG',
        owner: pIdx,
        sourceName: u.name,
        sourceIcon: u.icon,
        skillName: '制衡',
        maxDiscard: Math.min(3, p.hand.length),
        slotIdx
      };
      return true;
    }

    if (u.id === 'shu_zhugeliang') {
      G.pendingPrompt = {
        kind: 'CHOICE',
        owner: pIdx,
        sourceName: u.name,
        sourceIcon: u.icon,
        skillName: '錦囊',
        options: [
          { id: 'zgl_armor', label: '🛡️ 八陣護軍', desc: '消耗 1 糧，所有友方武將 +1 臨時護甲（1大回合）' },
          { id: 'zgl_draw', label: '📜 運籌屯糧', desc: '消耗 1 糧，抽 1 張牌並存入 1 點糧倉' }
        ],
        context: { sourceSlot: slotIdx, cost: 1 }
      };
      return true;
    }

    if (u.id === 'neu_huatuo') {
      G.pendingPrompt = {
        kind: 'CHOICE',
        owner: pIdx,
        sourceName: u.name,
        sourceIcon: u.icon,
        skillName: '青囊',
        options: [
          { id: 'huatuo_hero', label: '💚 國力回春', desc: '消耗 1 糧，回復己方國力 2 點' },
          { id: 'huatuo_units', label: '🌿 妙手仁心', desc: '消耗 1 糧，所有友方武將回復 2 點生命（不超過上限）' }
        ],
        context: { sourceSlot: slotIdx, cost: 1 }
      };
      return true;
    }

    if (u.id === 'qun_zhangjiao') {
      if (!enemy.board.some(eu => eu !== null)) return false;
      G.pendingPrompt = {
        kind: 'TARGET_ENEMY',
        owner: pIdx,
        sourceName: u.name,
        sourceIcon: u.icon,
        skillName: '雷擊',
        desc: '獻祭 1 名黃巾力士（或耗 1 糧倉），對指定敵將造成 3 傷並回自身 1 血：',
        context: { type: 'ZHANGJIAO_LEIJI', sourceSlot: slotIdx, cost: 1 }
      };
      return true;
    }

    if (u.id === 'shu_liushan') {
      G.pendingPrompt = {
        kind: 'TARGET_ALLY',
        owner: pIdx,
        sourceName: u.name,
        sourceIcon: u.icon,
        skillName: '放權',
        desc: '選擇一名友方武將本回合 +1 攻（若為諸葛亮或姜維額外抽 1 張牌）：',
        context: { type: 'LIUSHAN_FANGQUAN', sourceSlot: slotIdx }
      };
      return true;
    }

    if (u.id === 'wu_guyong') {
      G.pendingPrompt = {
        kind: 'GUYONG_DISCARD',
        owner: pIdx,
        sourceName: u.name,
        sourceIcon: u.icon,
        skillName: '慎行',
        slotIdx
      };
      return true;
    }

    if (u.id === 'wu_zhouyu') {
      if (!enemy.board.some(eu => eu !== null)) return false;
      G.pendingPrompt = {
        kind: 'TARGET_ENEMY',
        owner: pIdx,
        sourceName: u.name,
        sourceIcon: u.icon,
        skillName: '火計',
        desc: '指定一名敵將：若已灼燒，造成 2 傷並本回合 -1 攻；若未灼燒，施加灼燒（2回合）並抽 1 張牌：',
        context: { type: 'ZHOUYU_HUOJI', sourceSlot: slotIdx, cost: 1 }
      };
      return true;
    }

    if (u.id === 'qun_jiaxu') {
      spendFood(p, 1, 'TACTIC');
      u.activeUsedThisTurn = true;
      u.activeUsesTotal = (u.activeUsesTotal || 0) + 1;
      G.actedThisTurn = true;
      playSound(G, 'playTactic');
      triggerSimayiFanshi(G, pIdx);

      if (enemy.hand.length === 0) {
        pushSkillAnim(G, pIdx, u, '亂武', '敵方無手牌！對敵全體造成 2 點傷害！', 'poison');
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (enemy.board[s]) dealDamageToUnit(G, enemyIdx, s, 2, '【賈詡·亂武】');
        }
        cleanupDeadUnits(G);
        checkVictory(G);
        return true;
      }

      if (enemy.isAI) {
        const enemyUnits = enemy.board.filter(Boolean);
        const wouldKill = enemyUnits.some(eu => eu.hp <= 1);
        if (enemyUnits.length >= 2 || wouldKill) {
          // AI chooses to discard its least valuable hand card (highest cost or non-playable)
          const sorted = enemy.hand.slice().sort((a, b) => b.cost - a.cost);
          const pick = sorted[0];
          const idx = enemy.hand.findIndex(c => c.uid === pick.uid);
          if (idx !== -1) {
            const [removed] = enemy.hand.splice(idx, 1);
            enemy.graveyard.push(removed);
            triggerGuzhengOnDiscard(G, enemyIdx);
            pushSkillAnim(G, pIdx, u, '亂武', `敵方被迫棄置【${removed.name}】！`, 'poison');
            addLog(G, `☠️【賈詡·亂武】${enemy.name} 選擇棄置 1 張手牌【${removed.name}】。`);
          }
        } else {
          pushSkillAnim(G, pIdx, u, '亂武', '敵方選擇承受全體 1 傷且 -1 攻（1大回合）！', 'poison');
          for (let s = 0; s < BOARD_SIZE; s++) {
            if (enemy.board[s]) {
              dealDamageToUnit(G, enemyIdx, s, 1, '【賈詡·亂武】');
              if (enemy.board[s] && enemy.board[s].hp > 0) {
                applyEffect(G, enemyIdx, s, { type: 'atk_buff', val: -1, halfTurns: 2, label: '-1攻' });
              }
            }
          }
          addLog(G, `☠️【賈詡·亂武】${enemy.name} 選擇保留手牌，敵全體受 1 傷且 -1 攻（1大回合）！`);
        }
        cleanupDeadUnits(G);
        checkVictory(G);
        return true;
      }

      G.pendingPrompt = {
        kind: 'JIAXU_LUANWU',
        owner: enemyIdx,
        sourceName: u.name,
        sourceIcon: u.icon,
        skillName: '亂武',
        desc: '敵方【賈詡】發動【亂武】！請二選一：點選棄置 1 張手牌，或承受己方全體武將 1 傷且 -1 攻（1大回合）。',
        context: { attackerOwner: pIdx, sourceSlot: slotIdx }
      };
      return true;
    }



    // Direct active skills (no modal needed)
    spendFood(p, u.activeSkill.cost, 'TACTIC');
    u.activeUsedThisTurn = true;
    u.activeUsesTotal = (u.activeUsesTotal || 0) + 1;
    G.actedThisTurn = true;
    playSound(G, 'playTactic');

    switch (u.id) {
      case 'shu_zhaoyun':
        // v3.1: 持續本回合與下個敵方回合（halfTurns: 2）
        pushSkillAnim(G, pIdx, u, '龍膽', '本回合與下個敵方回合獲得 +1 攻擊力與 +1 臨時護甲！', 'buff');
        applyEffect(G, pIdx, slotIdx, { type: 'atk_buff', val: 1, halfTurns: 2, label: '+1攻' });
        applyEffect(G, pIdx, slotIdx, { type: 'armor_buff', val: 1, halfTurns: 2, label: '+1甲' });
        break;
      case 'wei_caoren':
        // v3.2: 1糧，取消自降 1 攻，自己與相鄰友軍 +1 臨時護甲（1大回合）
        pushSkillAnim(G, pIdx, u, '據守', '自己與相鄰友軍 +1 臨時護甲（1大回合）！', 'shield');
        for (let s = Math.max(0, slotIdx - 1); s <= Math.min(BOARD_SIZE - 1, slotIdx + 1); s++) {
          if (p.board[s]) {
            applyEffect(G, pIdx, s, { type: 'armor_buff', val: 1, halfTurns: 2, label: '+1甲' });
            pushVfx(G, `unit-${pIdx}-${s}`, '+1🛡️', 'text-sky-300');
          }
        }
        addLog(G, `🏰【曹仁·據守】消耗 1 糧，自身 -1 攻，自己及相鄰友軍獲得 +1 臨時護甲（1大回合）！`);
        break;
      case 'qun_diaochan': {
        let bestSlot = -1, bestAtk = -1;
        for (let s = 0; s < BOARD_SIZE; s++) {
          const eu = enemy.board[s];
          if (eu && getUnitAtk(eu, G) > bestAtk) { bestAtk = getUnitAtk(eu, G); bestSlot = s; }
        }
        const rem = Math.max(0, 2 - u.activeUsesTotal);
        pushSkillAnim(G, pIdx, u, '離間', bestSlot !== -1 ? `使敵方【${enemy.board[bestSlot].name}】-2 攻擊力（剩餘 ${rem} 次）！` : '敵方無武將。', 'skill');
        if (bestSlot !== -1) {
          applyEffect(G, enemyIdx, bestSlot, { type: 'atk_buff', val: -2, halfTurns: 2, label: '-2攻' });
          pushVfx(G, `unit-${enemyIdx}-${bestSlot}`, '-2攻', 'text-indigo-300');
          addLog(G, `🌸【貂蟬·離間】使敵方【${enemy.board[bestSlot].name}】攻擊力 -2（1大回合，剩餘 ${rem}/2 次）！`);
        }
        break;
      }
      case 'wu_huanggai':
        pushSkillAnim(G, pIdx, u, '苦肉', '自損 2 點國力，抽 1 張牌並獲得 +1 臨時糧草！', 'burn');
        dealDamageToHero(G, pIdx, 2, '【黃蓋·苦肉】');
        drawCard(G, pIdx, '黃蓋·苦肉');
        p.tempFood += 1;
        pushVfx(G, `hero-${pIdx}`, '+1 臨糧', 'text-amber-300');
        break;
      case 'wei_guojia': {
        const drawn = drawCard(G, pIdx, '郭嘉·奇佐');
        if (drawn && drawn.type === 'TACTIC' && drawn.cost > 1) {
          drawn.cost -= 1;
          drawn.tempCostMod = (drawn.tempCostMod || 0) - 1;
          drawn.debuffExpiresAfterTurn = p.turnsTaken;
        }
        break;
      }
      case 'shu_liyan':
        if (p.reserveFood >= 1) {
          p.reserveFood -= 1;
          p.tempFood += 2;
        } else {
          addReserveFood(G, pIdx, 1, '【李嚴·督糧】');
        }
        break;
      case 'wei_simayi': {
        const stacks = u.quanmou || 0;
        u.quanmou = 0;
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (enemy.board[s]) dealDamageToUnit(G, enemyIdx, s, stacks, '【司馬懿·反噬】');
        }
        buffUnitStats(G, pIdx, slotIdx, 2, 2, '【司馬懿·反噬】');
        break;
      }
    }

    triggerSimayiFanshi(G, pIdx);
    cleanupDeadUnits(G);
    checkVictory(G);
    return true;
  }

  function resolvePendingPrompt(G, pIdx, response) {
    const prompt = G.pendingPrompt;
    if (!prompt || prompt.owner !== pIdx) return false;
    const p = G.players[pIdx];
    const enemyIdx = 1 - pIdx;
    const enemy = G.players[enemyIdx];

    if (prompt.kind === 'REVEAL_ENEMY_HAND') {
      G.pendingPrompt = null;
      return true;
    }

    if (prompt.kind === 'PICK_ENEMY_HAND') {
      const cardUid = response && response.cardUid;
      const targetCard = enemy.hand.find(c => c.uid === cardUid) || enemy.hand[0];
      G.pendingPrompt = null;
      if (!targetCard) return true;
      const srcUnit = p.board[prompt.context.sourceSlot] || { name: prompt.sourceName, icon: prompt.sourceIcon, faction: p.faction, slot: prompt.context.sourceSlot };
      const expiresAfter = enemy.turnsTaken + 1;
      if (targetCard.type === 'TACTIC') {
        targetCard.cost += 1;
        targetCard.tempCostMod = (targetCard.tempCostMod || 0) + 1;
        targetCard.debuffExpiresAfterTurn = expiresAfter;
        pushSkillAnim(G, pIdx, srcUnit, '料敵', `洞悉【${targetCard.name}】（謀略），下回合費用 +1！`, 'skill');
        addLog(G, `🎯【張郃·料敵】選中敵方手牌【${targetCard.name}】，使其下回合費用 +1（變為 ${targetCard.cost} 糧）！`);
      } else {
        const atkDrop = Math.min(1, targetCard.baseAtk);
        const hpDrop = targetCard.baseHp > 1 ? 1 : 0;
        targetCard.baseAtk -= atkDrop;
        targetCard.baseHp -= hpDrop;
        targetCard.tempAtkDrop = (targetCard.tempAtkDrop || 0) + atkDrop;
        targetCard.tempHpDrop = (targetCard.tempHpDrop || 0) + hpDrop;
        targetCard.debuffExpiresAfterTurn = expiresAfter;
        pushSkillAnim(G, pIdx, srcUnit, '料敵', `洞悉【${targetCard.name}】（武將），下回合 -1/-1！`, 'skill');
        addLog(G, `🎯【張郃·料敵】選中敵方手牌【${targetCard.name}】，使其下回合變為 ${targetCard.baseAtk}/${targetCard.baseHp}！`);
      }
      return true;
    }

    if (prompt.kind === 'DISCARD') {
      const uids = Array.isArray(response && response.selectedUids) ? response.selectedUids : [];
      if (uids.length < prompt.count) return false;
      const toDrop = new Set(uids.slice(0, prompt.count));
      const kept = [];
      for (const c of p.hand) {
        if (toDrop.has(c.uid)) {
          p.graveyard.push(c);
          addLog(G, `【手牌上限】${p.name} 棄置了【${c.name}】。`);
        } else {
          kept.push(c);
        }
      }
      p.hand = kept;
      triggerGuzhengOnDiscard(G, pIdx);
      G.pendingPrompt = null;
      if (prompt.afterEndTurn) {
        finishEndTurn(G);
      }
      return true;
    }

    if (prompt.kind === 'ZHIHENG') {
      const uids = Array.isArray(response && response.selectedUids) ? response.selectedUids : [];
      if (uids.length === 0) {
        G.pendingPrompt = null;
        return true;
      }
      const x = Math.min(3, uids.length);
      const u = p.board[prompt.slotIdx];
      if (!u) { G.pendingPrompt = null; return false; }

      u.activeUsedThisTurn = true;
      u.activeUsesTotal = (u.activeUsesTotal || 0) + 1;
      G.actedThisTurn = true;
      const dropSet = new Set(uids.slice(0, x));
      const kept = [];
      let dropped = 0;
      for (const c of p.hand) {
        if (dropSet.has(c.uid)) { p.graveyard.push(c); dropped++; }
        else kept.push(c);
      }
      p.hand = kept;
      if (dropped > 0) triggerGuzhengOnDiscard(G, pIdx);
      for (let i = 0; i < dropped; i++) drawCard(G, pIdx, '孫權·制衡');
      if (dropped >= 2) {
        drawCard(G, pIdx, '孫權·制衡額外');
        addReserveFood(G, pIdx, 1, '【孫權·制衡】');
      }
      triggerSimayiFanshi(G, pIdx);
      G.pendingPrompt = null;
      checkVictory(G);
      return true;
    }

    if (prompt.kind === 'GUYONG_DISCARD') {
      const cardUid = response && response.cardUid;
      const idx = p.hand.findIndex(c => c.uid === cardUid);
      const u = p.board[prompt.slotIdx];
      if (idx === -1 || !u || getTotalFood(p, 'TACTIC') < 1) {
        G.pendingPrompt = null;
        return false;
      }
      spendFood(p, 1, 'TACTIC');
      u.activeUsedThisTurn = true;
      u.activeUsesTotal = (u.activeUsesTotal || 0) + 1;
      G.actedThisTurn = true;
      const [dropped] = p.hand.splice(idx, 1);
      p.graveyard.push(dropped);
      triggerGuzhengOnDiscard(G, pIdx);
      addReserveFood(G, pIdx, 1, '【顧雍·慎行】');
      drawCard(G, pIdx, '顧雍·慎行');
      if (dropped.type === 'TACTIC') drawCard(G, pIdx, '顧雍·慎行');
      triggerSimayiFanshi(G, pIdx);
      G.pendingPrompt = null;
      checkVictory(G);
      return true;
    }

    if (prompt.kind === 'ZHANGZHAO_DISCARD') {
      const cardUid = response && response.cardUid;
      G.pendingPrompt = null;
      if (!cardUid) return true;
      const idx = p.hand.findIndex(c => c.uid === cardUid);
      if (idx === -1) return true;
      const [dropped] = p.hand.splice(idx, 1);
      p.graveyard.push(dropped);
      triggerGuzhengOnDiscard(G, pIdx);
      drawCard(G, pIdx, '張昭·固政');
      return true;
    }

    if (prompt.kind === 'JIAXU_LUANWU') {
      const mode = response && response.mode;
      G.pendingPrompt = null;
      if (mode === 'DISCARD') {
        const uid = response.cardUid;
        const idx = p.hand.findIndex(c => c.uid === uid);
        if (idx === -1) return false;
        const [removed] = p.hand.splice(idx, 1);
        p.graveyard.push(removed);
        triggerGuzhengOnDiscard(G, pIdx);
        addLog(G, `☠️【賈詡·亂武】${p.name} 選擇棄置手牌【${removed.name}】。`);
      } else {
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (p.board[s]) {
            dealDamageToUnit(G, pIdx, s, 1, '【賈詡·亂武】');
            if (p.board[s] && p.board[s].hp > 0) {
              applyEffect(G, pIdx, s, { type: 'atk_buff', val: -1, halfTurns: 2, label: '-1攻' });
            }
          }
        }
        addLog(G, `☠️【賈詡·亂武】${p.name} 選擇保留手牌，全體武將受 1 傷且 -1 攻（1大回合）！`);
      }
      cleanupDeadUnits(G);
      checkVictory(G);
      return true;
    }

    if (prompt.kind === 'TARGET_ALLY') {
      const slot = response && typeof response.slot === 'number' ? response.slot : -1;
      const au = p.board[slot];
      if (!au) return false;
      const srcUnit = p.board[prompt.context.sourceSlot];
      G.pendingPrompt = null;
      if (prompt.context.type === 'FAZHENG_SNIPE') {
        applyEffect(G, pIdx, slot, { type: 'snipe_buff', val: 1, halfTurns: 1, label: '狙擊' });
      } else if (prompt.context.type === 'LIUSHAN_FANGQUAN') {
        if (srcUnit) {
          srcUnit.activeUsedThisTurn = true;
          srcUnit.activeUsesTotal = (srcUnit.activeUsesTotal || 0) + 1;
          srcUnit.attacksUsed = 99;
        }
        G.actedThisTurn = true;
        p.tempFood += 1;
        applyEffect(G, pIdx, slot, { type: 'atk_buff', val: 1, halfTurns: 1, label: '+1攻' });
        if (au.id === 'shu_zhugeliang' || au.id === 'shu_jiangwei') {
          drawCard(G, pIdx, '劉禪·放權');
        }
        triggerSimayiFanshi(G, pIdx);
        checkVictory(G);
      }
      return true;
    }

    if (prompt.kind === 'TARGET_ENEMY') {
      if (response && response.cancel && (!enemy.board.some(eu => eu !== null) || prompt.context.cost)) {
        G.pendingPrompt = null;
        return true;
      }
      const slot = response && typeof response.slot === 'number' ? response.slot : -1;
      const eu = enemy.board[slot];
      if (!eu) return false;
      const srcUnit = p.board[prompt.context.sourceSlot] || { name: prompt.sourceName, icon: prompt.sourceIcon, faction: p.faction, slot: prompt.context.sourceSlot };

      if (prompt.context.cost) {
        if (prompt.context.type === 'ZHANGJIAO_LEIJI') {
          const turbanSlot = p.board.findIndex(au => au && au.id === 'qun_yellow_turban');
          if (turbanSlot !== -1) {
            if (getTotalFood(p, 'TACTIC') < prompt.context.cost) return false;
            p.board[turbanSlot] = null;
            p.graveyard.push(createCardInstance('qun_yellow_turban'));
            spendFood(p, prompt.context.cost, 'TACTIC');
          } else {
            if (p.reserveFood < 1 || (p.food + p.tempFood + (p.reserveFood - 1)) < prompt.context.cost) return false;
            p.reserveFood -= 1;
            spendFood(p, prompt.context.cost, 'TACTIC');
          }
        } else {
          if (getTotalFood(p, 'TACTIC') < prompt.context.cost) return false;
          spendFood(p, prompt.context.cost, 'TACTIC');
        }
        if (p.board[prompt.context.sourceSlot]) {
          p.board[prompt.context.sourceSlot].activeUsedThisTurn = true;
          p.board[prompt.context.sourceSlot].activeUsesTotal = (p.board[prompt.context.sourceSlot].activeUsesTotal || 0) + 1;
        }
        G.actedThisTurn = true;
        playSound(G, 'playTactic');
        triggerSimayiFanshi(G, pIdx);
      }

      G.pendingPrompt = null;

      if (prompt.context.type === 'SILENCE') {
        pushSkillAnim(G, pIdx, srcUnit, prompt.skillName, `使【${eu.name}】失去所有技能！`, 'silence');
        silenceUnit(G, enemyIdx, slot, `【${srcUnit.name}·${prompt.skillName}】`);
      } else if (prompt.context.type === 'LUMENG_GONGXIN') {
        // v3.2: 技能之後 2 大回合無效 + 攻擊力 -1（2大回合）
        pushSkillAnim(G, pIdx, srcUnit, '攻心', `使【${eu.name}】2 大回合內技能無效且攻擊力 -1！`, 'silence');
        applyEffect(G, enemyIdx, slot, { type: 'temp_silence', val: 1, halfTurns: 4, label: '技能無效' });
        applyEffect(G, enemyIdx, slot, { type: 'atk_buff', val: -1, halfTurns: 4, label: '-1攻' });
        pushVfx(G, `unit-${enemyIdx}-${slot}`, '🔇技無效 -1攻', 'text-indigo-300');
        addLog(G, `⛵【呂蒙·攻心】使【${eu.name}】技能 2 大回合無效且攻擊力 -1！`);
      } else if (prompt.context.type === 'SIMAYI_LANGGU') {
        // v3.1: 指定敵將 -1 攻且下回合無法用主動技（1大回合）
        pushSkillAnim(G, pIdx, srcUnit, '狼顧', `震懾【${eu.name}】！攻擊力 -1 且下回合無法使用主動技！`, 'skill');
        applyEffect(G, enemyIdx, slot, { type: 'atk_buff', val: -1, halfTurns: 2, label: '-1攻' });
        applyEffect(G, enemyIdx, slot, { type: 'no_active', val: 1, halfTurns: 2, label: '禁主動' });
        pushVfx(G, `unit-${enemyIdx}-${slot}`, '-1攻 禁主動', 'text-indigo-300');
        addLog(G, `🐺【司馬懿·狼顧】使【${eu.name}】攻擊力 -1 且下回合無法使用主動技（1大回合）！`);
      } else if (prompt.context.type === 'SHENSHE') {
        pushSkillAnim(G, pIdx, srcUnit, '神射', `遠射【${eu.name}】造成 2 點傷害（無反擊）！`, 'slash');
        const res = dealDamageToUnit(G, enemyIdx, slot, 2, '【太史慈·神射】');
        cleanupDeadUnits(G);
        if (res.killed && p.board[prompt.context.sourceSlot]) {
          buffUnitStats(G, pIdx, prompt.context.sourceSlot, 1, 1, '【太史慈·神射擊殺】');
        }
      } else if (prompt.context.type === 'FREEZE') {
        eu.frozenNextTurn = true;
        pushSkillAnim(G, pIdx, srcUnit, '緩兵', `牽制【${eu.name}】，使其下回合無法攻擊！`, 'skill');
        pushVfx(G, `unit-${enemyIdx}-${slot}`, '🕊️緩兵', 'text-sky-300');
        addLog(G, `🕊️【諸葛瑾·緩兵】使敵方【${eu.name}】下回合無法攻擊！`);
      } else if (prompt.context.type === 'XUNYOU_DMG') {
        pushSkillAnim(G, pIdx, srcUnit, '奇策', `對【${eu.name}】造成 3 點傷害！`, 'burn');
        dealDamageToUnit(G, enemyIdx, slot, 3, '【荀攸·奇策】');
      } else if (prompt.context.type === 'XUSHENG_POJUN') {
        const wasGuard = unitHasGuard(eu);
        eu.armor = 0;
        eu.frozenNextTurn = true;
        if (wasGuard) {
          dealDamageToUnit(G, enemyIdx, slot, 2, '【徐盛·破軍】');
        }
      } else if (prompt.context.type === 'ZHANGJIAO_LEIJI') {
        pushSkillAnim(G, pIdx, srcUnit, '雷擊', `天雷轟擊【${eu.name}】造成 3 點傷害並回復自身 1 血！`, 'burn');
        dealDamageToUnit(G, enemyIdx, slot, 3, '【張角·雷擊】');
        if (p.board[prompt.context.sourceSlot]) {
          healUnit(G, pIdx, prompt.context.sourceSlot, 1, '【張角·雷擊】');
        }
      } else if (prompt.context.type === 'JIAXU_WANSHA') {
        const baseDef = CARD_DB[eu.id];
        eu.effects = eu.effects.filter(eff => !(
          (eff.type === 'atk_buff' && eff.val > 0) ||
          (eff.type === 'armor_buff' && eff.val > 0) ||
          eff.type === 'guard_buff'
        ));
        if (baseDef && typeof baseDef.atk === 'number' && eu.atk > baseDef.atk) {
          eu.atk = baseDef.atk;
        }
        if (baseDef && !(baseDef.keywords || []).includes('GUARD')) {
          eu.keywords = eu.keywords.filter(kw => kw !== 'GUARD');
        }
        eu.armor = Math.min(eu.armor, eu.baseArmor);
        pushSkillAnim(G, pIdx, srcUnit, '完殺', `清除敵方【${eu.name}】所有正向增益！`, 'poison');
        pushVfx(G, `unit-${enemyIdx}-${slot}`, '☠️驅散增益', 'text-purple-300');
        addLog(G, `☠️【賈詡·完殺】清除了敵方【${eu.name}】的所有正向增益（攻／甲／護衛增益）！`);
      } else if (prompt.context.type === 'LUXUN_LIANYING') {
        pushSkillAnim(G, pIdx, srcUnit, '連營', `火燒【${eu.name}】2傷並向左右相鄰蔓延！`, 'burn');
        dealDamageToUnit(G, enemyIdx, slot, 2, '【陸遜·連營】');
        if (enemy.board[slot] && enemy.board[slot].hp > 0) {
          applyEffect(G, enemyIdx, slot, { type: 'burn', val: 1, turns: 2, label: '灼燒' });
        }
        for (const adj of [slot - 1, slot + 1]) {
          if (adj >= 0 && adj < BOARD_SIZE && enemy.board[adj]) {
            dealDamageToUnit(G, enemyIdx, adj, 1, '【陸遜·連營蔓延】');
            if (enemy.board[adj] && enemy.board[adj].hp > 0) {
              applyEffect(G, enemyIdx, adj, { type: 'burn', val: 1, turns: 2, label: '灼燒' });
            }
          }
        }
      } else if (prompt.context.type === 'ZHOUYU_HUOJI') {
        const hasBurn = eu.effects.some(e => e.type === 'burn');
        if (hasBurn) {
          pushSkillAnim(G, pIdx, srcUnit, '火計', `引爆【${eu.name}】灼燒！造成 2 傷並本回合 -1 攻！`, 'burn');
          dealDamageToUnit(G, enemyIdx, slot, 2, '【周瑜·火計】');
          if (enemy.board[slot] && enemy.board[slot].hp > 0) {
            applyEffect(G, enemyIdx, slot, { type: 'atk_buff', val: -1, halfTurns: 1, label: '-1攻' });
          }
        } else {
          pushSkillAnim(G, pIdx, srcUnit, '火計', `對【${eu.name}】施加灼燒（2回合）並抽 1 張牌！`, 'burn');
          applyEffect(G, enemyIdx, slot, { type: 'burn', val: 1, turns: 2, label: '灼燒' });
          drawCard(G, pIdx, '周瑜·火計');
        }
      }
      cleanupDeadUnits(G);
      checkVictory(G);
      return true;
    }

    if (prompt.kind === 'CHOICE') {
      const choiceId = response && response.choiceId;
      const srcSlot = prompt.context.sourceSlot;
      const u = p.board[srcSlot];
      G.pendingPrompt = null;
      if (!u) return false;

      if (prompt.context.cost) {
        if (getTotalFood(p, 'TACTIC') < prompt.context.cost) return false;
        spendFood(p, prompt.context.cost, 'TACTIC');
        u.activeUsedThisTurn = true;
        u.activeUsesTotal = (u.activeUsesTotal || 0) + 1;
        G.actedThisTurn = true;
        playSound(G, 'playTactic');
        triggerSimayiFanshi(G, pIdx);
      }

      switch (choiceId) {
        case 'caocao_atk':
          for (let s = 0; s < BOARD_SIZE; s++) {
            if (p.board[s]) {
              applyEffect(G, pIdx, s, { type: 'atk_buff', val: 2, halfTurns: 1, label: '+2攻' });
            }
          }
          break;
        case 'caocao_draw':
          pushSkillAnim(G, pIdx, u, '奸雄', '運籌帷幄！抽 2 張牌並存入 1 點糧倉！', 'skill');
          drawCard(G, pIdx, '曹操·奸雄');
          drawCard(G, pIdx, '曹操·奸雄');
          addReserveFood(G, pIdx, 1, '【曹操·奸雄】');
          break;
        case 'xuchu_yes':
          pushSkillAnim(G, pIdx, u, '裸衣', '自損 2 生命，獲得 +2 攻擊力！', 'buff');
          u.hp = Math.max(1, u.hp - 2);
          buffUnitStats(G, pIdx, srcSlot, 2, 0, '【許褚·裸衣】');
          break;
        case 'xuchu_no':
          addLog(G, `【許褚】選擇保留生命，未發動裸衣。`);
          break;
        case 'xunyou_draw':
          pushSkillAnim(G, pIdx, u, '奇策', '抽 2 張牌！', 'skill');
          drawCard(G, pIdx, '荀攸·奇策');
          drawCard(G, pIdx, '荀攸·奇策');
          break;
        case 'xunyou_dmg':
          if (enemy.board.some(eu => eu !== null)) {
            G.pendingPrompt = {
              kind: 'TARGET_ENEMY',
              owner: pIdx,
              sourceName: u.name,
              sourceIcon: u.icon,
              skillName: '奇策',
              desc: '請選擇一名敵方武將造成 3 點傷害：',
              context: { type: 'XUNYOU_DMG', sourceSlot: srcSlot }
            };
          } else {
            pushSkillAnim(G, pIdx, u, '奇策', '對敵方國力造成 2 點傷害！', 'burn');
            dealDamageToHero(G, enemyIdx, 2, '【荀攸·奇策】');
          }
          break;
        case 'xunyou_buff':
          pushSkillAnim(G, pIdx, u, '奇策', '所有友方武將獲得 +1/+1！', 'buff');
          for (let s = 0; s < BOARD_SIZE; s++) {
            if (p.board[s]) buffUnitStats(G, pIdx, s, 1, 1, '【荀攸·奇策】');
          }
          break;
        case 'zgl_armor':
          for (let s = 0; s < BOARD_SIZE; s++) {
            const au = p.board[s];
            if (au) {
              au.effects = au.effects.filter(e => e.type !== 'burn' && e.type !== 'poison' && e.type !== 'no_active' && e.type !== 'temp_silence' && !(e.type === 'atk_buff' && e.val < 0));
              au.frozenNextTurn = false;
              applyEffect(G, pIdx, s, { type: 'armor_buff', val: 1, halfTurns: 2, label: '+1甲' });
            }
          }
          break;
        case 'zgl_draw':
          addReserveFood(G, pIdx, 2, '【諸葛亮·八陣】');
          break;
        case 'huatuo_hero':
          // v3.1: 回復國力改為 +2
          pushSkillAnim(G, pIdx, u, '青囊', '國力回春！回復己方國力 2 點！', 'heal');
          healHero(G, pIdx, 2, '【華佗·青囊】');
          break;
        case 'huatuo_units':
          pushSkillAnim(G, pIdx, u, '青囊', '妙手仁心！所有友方武將回復 2 點生命（不超過上限）！', 'heal');
          for (let s = 0; s < BOARD_SIZE; s++) {
            if (p.board[s]) healUnit(G, pIdx, s, 2, '【華佗·青囊】');
          }
          break;
      }
      cleanupDeadUnits(G);
      checkVictory(G);
      return true;
    }
    return false;
  }

  function playGeneral(G, pIdx, cardUid, slotIdx) {
    const p = G.players[pIdx];
    if (G.phase !== 'MAIN' || G.activePlayer !== pIdx || G.pendingPrompt) return false;
    if (slotIdx < 0 || slotIdx >= BOARD_SIZE || p.board[slotIdx] !== null) return false;
    const handIdx = p.hand.findIndex(c => c.uid === cardUid);
    if (handIdx === -1) return false;
    const card = p.hand[handIdx];
    if (card.type !== 'GENERAL' || getTotalFood(p, 'GENERAL') < card.cost) return false;

    G.firstGeneralPlayed = true;

    spendFood(p, card.cost, 'GENERAL');
    p.hand.splice(handIdx, 1);
    const unit = createUnitFromCard(card, pIdx, slotIdx, G.turnNumber);
    p.board[slotIdx] = unit;
    G.actedThisTurn = true;
    playSound(G, 'playDeploy');

    if (Array.isArray(p.playedHistory)) {
      p.playedHistory.push({ id: card.id, name: card.name, faction: card.faction, type: 'GENERAL', cost: card.cost, icon: card.icon, round: Math.max(1, Math.ceil(G.turnNumber / 2)), turn: G.turnNumber });
    }
    addLog(G, `${p.name} 消耗 ${card.cost} 糧草，將【${unit.name}】部署於 ${SLOT_NAMES[slotIdx]}（${unit.isPrep ? '整備中' : '突襲就緒'}）。`);
    triggerOnPlay(G, pIdx, slotIdx, unit);
    triggerJianyingOnCardPlay(G, pIdx);
    return true;
  }

  function playTactic(G, pIdx, cardUid, targetSlot = null) {
    const p = G.players[pIdx];
    const enemyIdx = 1 - pIdx;
    const enemy = G.players[enemyIdx];
    if (G.phase !== 'MAIN' || G.activePlayer !== pIdx || G.pendingPrompt) return false;
    const handIdx = p.hand.findIndex(c => c.uid === cardUid);
    if (handIdx === -1) return false;
    const card = p.hand[handIdx];
    const effCost = getEffectiveCardCost(G, pIdx, card);
    if (card.type !== 'TACTIC' || getTotalFood(p, 'TACTIC') < effCost) return false;

    if (card.target === 'enemy_general') {
      const eu = targetSlot !== null ? enemy.board[targetSlot] : null;
      if (!eu || (unitHasShroud(eu))) return false;
    } else if (card.target === 'enemy_adjacent_pair') {
      const left = (targetSlot !== null && targetSlot >= 0 && targetSlot < BOARD_SIZE - 1) ? enemy.board[targetSlot] : null;
      const right = left ? enemy.board[targetSlot + 1] : null;
      if (!left || !right) return false;
      if ((!isUnitSilenced(left) && left.keywords.includes('SHROUD')) ||
          (!isUnitSilenced(right) && right.keywords.includes('SHROUD'))) return false;
    } else if (card.target === 'ally_general') {
      const au = targetSlot !== null ? p.board[targetSlot] : null;
      if (!au || (unitHasShroud(au))) return false;
    }

    spendFood(p, effCost, 'TACTIC');
    p.tacticPlayedThisTurn = true;
    p.hand.splice(handIdx, 1);
    G.actedThisTurn = true;
    playSound(G, 'playTactic');
    pushAnim(G, {
      kind: 'tactic',
      owner: pIdx,
      ownerName: p.name,
      targetSlot,
      card: { id: card.id, name: card.name, faction: card.faction, cost: card.cost, icon: card.icon, text: card.text, flavor: card.flavor || '', target: card.target }
    });
    if (Array.isArray(p.playedHistory)) {
      p.playedHistory.push({ id: card.id, name: card.name, faction: card.faction, type: 'TACTIC', cost: effCost, icon: card.icon, round: Math.max(1, Math.ceil(G.turnNumber / 2)), turn: G.turnNumber });
    }
    addLog(G, `${p.name} 消耗 ${effCost} 糧草打出謀略【${card.name}】！`);

    // 張紘【文采】：每當我方打出謀略牌時，張紘獲得 +1/+1
    for (let s = 0; s < BOARD_SIZE; s++) {
      const u = p.board[s];
      if (u && u.id === 'wu_zhanghong' && !isUnitSilenced(u)) {
        pushSkillAnim(G, pIdx, u, '文采', '感應謀略，獲得 +1/+1！', 'buff');
        buffUnitStats(G, pIdx, s, 1, 1, '【張紘·文采】');
      }
    }

    switch (card.id) {
      case 'rapid_march':
        p.tempFood += 1;
        pushVfx(G, `hero-${pIdx}`, '+1 臨時糧草', 'text-amber-300');
        break;
      case 'shu_guagu': {
        const au = p.board[targetSlot];
        if (au) {
          const isNeg = ef => ef.type === 'burn' || ef.type === 'poison' || ef.type === 'temp_silence' || ef.type === 'no_active' || (ef.type === 'atk_buff' && ef.val < 0);
          const hadNeg = au.frozenNextTurn || au.effects.some(isNeg);
          if (hadNeg) {
            au.frozenNextTurn = false;
            au.effects = au.effects.filter(ef => !isNeg(ef));
            pushVfx(G, `unit-${pIdx}-${targetSlot}`, '🩺淨化減益', 'text-emerald-300');
            addLog(G, `🩺【刮骨療毒】移除了【${au.name}】的所有負面減益！`);
          } else {
            healUnit(G, pIdx, targetSlot, 2, '【刮骨療毒】');
          }
        }
        break;
      }
      case 'shu_muniuliuma':
        addReserveFood(G, pIdx, 2, '【木牛流馬】');
        drawCard(G, pIdx, '木牛流馬');
        break;
      case 'shu_taoyuan':
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (p.board[s]) buffUnitStats(G, pIdx, s, 1, 1);
        }
        break;
      case 'shu_kongcheng':
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (p.board[s]) {
            applyEffect(G, pIdx, s, { type: 'armor_buff', val: 2, halfTurns: 4, label: '+2甲' });
            pushVfx(G, `unit-${pIdx}-${s}`, '+2🛡️', 'text-sky-300');
          }
        }
        drawCard(G, pIdx, '空城計');
        break;
      case 'shu_jushui': {
        // v3.1 新增：據水斷橋
        const au = p.board[targetSlot];
        if (au) {
          applyEffect(G, pIdx, targetSlot, { type: 'guard_buff', val: 1, halfTurns: 2, label: '護衛' });
          applyEffect(G, pIdx, targetSlot, { type: 'armor_buff', val: 2, halfTurns: 2, label: '+2甲' });
          pushVfx(G, `unit-${pIdx}-${targetSlot}`, '🛡️護衛 +2甲', 'text-sky-300');
          if (au.id === 'shu_zhangfei') {
            let bestSlot = -1, bestAtk = -1;
            for (let s = 0; s < BOARD_SIZE; s++) {
              const eu = enemy.board[s];
              if (eu && getUnitAtk(eu, G) > bestAtk) { bestAtk = getUnitAtk(eu, G); bestSlot = s; }
            }
            if (bestSlot !== -1) {
              dealDamageToUnit(G, enemyIdx, bestSlot, 1, '【據水斷橋·張飛】');
            }
          }
        }
        break;
      }
      case 'shu_beifa': {
        const res = dealDamageToUnit(G, enemyIdx, targetSlot, 4, '【出師北伐】');
        cleanupDeadUnits(G);
        if (res.killed) drawCard(G, pIdx, '出師北伐擊殺獎勵');
        break;
      }
      case 'wei_wangmei': {
        const au = p.board[targetSlot];
        if (au) {
          const hasRush = !isUnitSilenced(au) && au.keywords.includes('RUSH');
          const bonus = hasRush ? 2 : 1;
          applyEffect(G, pIdx, targetSlot, { type: 'atk_buff', val: bonus, halfTurns: 1, label: `+${bonus}攻` });
          pushVfx(G, `unit-${pIdx}-${targetSlot}`, `+${bonus}攻`, 'text-amber-300');
        }
        break;
      }
      case 'wei_xietianzi': {
        dealDamageToHero(G, pIdx, 1, '【挾天子令諸侯】');
        drawCard(G, pIdx, '挾天子令諸侯');
        let bestSlot = -1, bestAtk = -1;
        for (let s = 0; s < BOARD_SIZE; s++) {
          const eu = enemy.board[s];
          if (eu && getUnitAtk(eu, G) > bestAtk) { bestAtk = getUnitAtk(eu, G); bestSlot = s; }
        }
        if (bestSlot !== -1) {
          const drop = bestAtk >= 4 ? -2 : -1;
          applyEffect(G, enemyIdx, bestSlot, { type: 'atk_buff', val: drop, halfTurns: 4, label: `${drop}攻` });
          pushVfx(G, `unit-${enemyIdx}-${bestSlot}`, `${drop}攻`, 'text-indigo-300');
        }
        break;
      }
      case 'wei_duanliang': {
        const stolen = Math.min(2, enemy.reserveFood);
        if (stolen > 0) {
          enemy.reserveFood -= stolen;
          p.tempFood += stolen;
          pushVfx(G, `hero-${pIdx}`, `+${stolen} 臨糧`, 'text-amber-300');
          addLog(G, `【斷糧奇兵】從 ${enemy.name} 糧倉掠奪了 ${stolen} 點糧草！`);
        } else {
          drawCard(G, pIdx, '斷糧奇兵');
        }
        let bestSlot = -1, bestAtk = -1;
        for (let s = 0; s < BOARD_SIZE; s++) {
          const eu = enemy.board[s];
          if (eu && getUnitAtk(eu, G) > bestAtk) { bestAtk = getUnitAtk(eu, G); bestSlot = s; }
        }
        if (bestSlot !== -1) {
          applyEffect(G, enemyIdx, bestSlot, { type: 'atk_buff', val: -1, halfTurns: 4, label: '-1攻' });
        }
        break;
      }
      case 'wei_jianbi':
        // v3.1 新增：堅壁清野
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (p.board[s]) {
            applyEffect(G, pIdx, s, { type: 'armor_buff', val: 1, halfTurns: 2, label: '+1甲' });
            pushVfx(G, `unit-${pIdx}-${s}`, '+1🛡️', 'text-sky-300');
          }
        }
        enemy.nextTurnFoodPenalty = (enemy.nextTurnFoodPenalty || 0) + 1;
        pushVfx(G, `hero-${enemyIdx}`, '下回糧-1', 'text-rose-300');
        addLog(G, `🧱【堅壁清野】所有友軍獲得 +1 臨時護甲，並使 ${enemy.name} 下回合糧草收入 -1！`);
        break;
      case 'wei_quhu': {
        const res = dealDamageToUnit(G, enemyIdx, targetSlot, 3, '【驅虎吞狼】');
        const eu = enemy.board[targetSlot];
        if (eu && eu.hp > 0) applyEffect(G, enemyIdx, targetSlot, { type: 'atk_buff', val: -1, halfTurns: 4, label: '-1攻' });
        if (res.killed) addReserveFood(G, pIdx, 1, '【驅虎吞狼擊殺】');
        break;
      }
      case 'wei_guandu': {
        enemy.maxFood = Math.max(1, enemy.maxFood - 1);
        p.tempFood += 1;
        pushVfx(G, `hero-${enemyIdx}`, '-1 糧草上限', 'text-rose-400');
        pushVfx(G, `hero-${pIdx}`, '+1 臨時糧草', 'text-amber-300');
        let bestSlot = -1, bestAtk = -1;
        for (let s = 0; s < BOARD_SIZE; s++) {
          const eu = enemy.board[s];
          if (eu && getUnitAtk(eu, G) > bestAtk) { bestAtk = getUnitAtk(eu, G); bestSlot = s; }
        }
        if (bestSlot !== -1) dealDamageToUnit(G, enemyIdx, bestSlot, 2, '【奇襲烏巢】');
        addLog(G, `🔥【奇襲烏巢】焚毀敵軍輜重！${enemy.name} 糧草上限 -1（目前 ${enemy.maxFood}），${p.name} 獲得 +1 臨時糧草！`);
        break;
      }
      case 'wu_kurouji': {
        const res = dealDamageToUnit(G, pIdx, targetSlot, 1, '【苦肉計】');
        const au = p.board[targetSlot];
        if (!res.killed && au && au.hp > 0) {
          drawCard(G, pIdx, '苦肉計');
          applyEffect(G, pIdx, targetSlot, { type: 'atk_buff', val: 1, halfTurns: 1, label: '+1攻' });
        }
        break;
      }
      case 'wu_shensu': {
        const au = p.board[targetSlot];
        if (au) {
          au.isPrep = false;
          if (targetSlot !== 2) {
            applyEffect(G, pIdx, targetSlot, { type: 'atk_buff', val: 1, halfTurns: 1, label: '+1攻' });
            pushVfx(G, `unit-${pIdx}-${targetSlot}`, '神速 +1攻', 'text-emerald-300');
          } else {
            pushVfx(G, `unit-${pIdx}-${targetSlot}`, '神速就緒', 'text-emerald-300');
          }
          addLog(G, `【兵貴神速】使【${au.name}】立即解除整備！`);
        }
        break;
      }
      case 'wu_lianhuan': {
        dealDamageToUnit(G, enemyIdx, targetSlot, 2, '【連環計】');
        const eu = enemy.board[targetSlot];
        if (eu && eu.hp > 0) applyEffect(G, enemyIdx, targetSlot, { type: 'burn', val: 1, turns: 3, label: '灼燒' });
        drawCard(G, pIdx, '連環計');
        break;
      }
      case 'wu_dongfeng': {
        // v3.1 新增：東風助火
        const eu = enemy.board[targetSlot];
        if (eu) {
          const burnEffs = eu.effects.filter(e => e.type === 'burn');
          if (burnEffs.length > 0) {
            dealDamageToUnit(G, enemyIdx, targetSlot, 3, '【東風助火】');
            if (eu.hp > 0) {
              for (const b of burnEffs) b.turns = Math.max(b.turns, 2);
              addLog(G, `🌬️【東風助火】火勢再起，刷新【${eu.name}】的灼燒時間！`);
            }
          } else {
            dealDamageToUnit(G, enemyIdx, targetSlot, 1, '【東風助火】');
            if (eu.hp > 0) applyEffect(G, enemyIdx, targetSlot, { type: 'burn', val: 1, turns: 1, label: '灼燒' });
          }
        }
        break;
      }
      case 'wu_huogong':
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (enemy.board[s]) {
            dealDamageToUnit(G, enemyIdx, s, 2, '【火燒赤壁】');
            if (enemy.board[s] && enemy.board[s].hp > 0) {
              applyEffect(G, enemyIdx, s, { type: 'burn', val: 1, turns: 2, label: '灼燒' });
            }
          }
        }
        break;
      case 'wu_jiangdong':
        dealDamageToHero(G, enemyIdx, 3, '【江東水師】');
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (p.board[s]) applyEffect(G, pIdx, s, { type: 'atk_buff', val: 1, halfTurns: 4, label: '+1攻' });
        }
        break;
      case 'qun_ertao': {
        const left = enemy.board[targetSlot];
        const right = enemy.board[targetSlot + 1];
        if (left && right) {
          const sameAtk = getUnitAtk(left, G) === getUnitAtk(right, G);
          applyEffect(G, enemyIdx, targetSlot, { type: 'atk_buff', val: -1, halfTurns: 2, label: '-1攻' });
          applyEffect(G, enemyIdx, targetSlot + 1, { type: 'atk_buff', val: -1, halfTurns: 2, label: '-1攻' });
          if (sameAtk) drawCard(G, pIdx, '二桃殺三士');
        }
        break;
      }
      case 'qun_manli':
        dealDamageToUnit(G, enemyIdx, targetSlot, 3, '【鐵騎突襲】');
        break;
      case 'qun_wushuang': {
        const au = p.board[targetSlot];
        if (au) {
          applyEffect(G, pIdx, targetSlot, { type: 'atk_buff', val: 3, halfTurns: 2, label: '+3攻' });
          applyEffect(G, pIdx, targetSlot, { type: 'armor_buff', val: 1, halfTurns: 2, label: '+1甲' });
          pushVfx(G, `unit-${pIdx}-${targetSlot}`, '+3攻 +1🛡️', 'text-amber-300');
        }
        break;
      }
      case 'qun_meirenji': {
        // v3.1 新增：美人計
        const eu = enemy.board[targetSlot];
        if (eu) {
          let maxAtk = -1;
          for (let s = 0; s < BOARD_SIZE; s++) {
            if (enemy.board[s]) maxAtk = Math.max(maxAtk, getUnitAtk(enemy.board[s], G));
          }
          const isHighest = getUnitAtk(eu, G) >= maxAtk;
          const drop = isHighest ? -3 : -2;
          applyEffect(G, enemyIdx, targetSlot, { type: 'atk_buff', val: drop, halfTurns: 4, label: `${drop}攻` });
          pushVfx(G, `unit-${enemyIdx}-${targetSlot}`, `${drop}攻`, 'text-indigo-300');
          addLog(G, `🌺【美人計】使【${eu.name}】攻擊力 ${drop}（2大回合）！`);
        }
        break;
      }
      case 'qun_huoshao':
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (enemy.board[s]) dealDamageToUnit(G, enemyIdx, s, 2, '【焚城掠地】');
        }
        dealDamageToHero(G, enemyIdx, 2, '【焚城掠地】');
        break;
      case 'neu_tuntian':
        // v3.1: 回復國力改為 +1
        drawCard(G, pIdx, '屯田積糧');
        healHero(G, pIdx, 1, '【屯田積糧】');
        break;
      case 'neu_huanwei': {
        const moving = p.board[targetSlot];
        if (moving) {
          const dest = targetSlot === 2 ? 1 : 2;
          const other = p.board[dest];
          p.board[dest] = moving;
          p.board[targetSlot] = other;
          moving.slot = dest;
          if (other) other.slot = targetSlot;
          applyEffect(G, pIdx, dest, { type: 'armor_buff', val: 2, halfTurns: 2, label: '+2甲' });
          applyEffect(G, pIdx, dest, { type: 'guard_buff', val: 1, halfTurns: 2, label: '護衛' });
          pushVfx(G, `unit-${pIdx}-${dest}`, '+2🛡️ 護衛', 'text-sky-300');
          addLog(G, `【移形換位】將【${moving.name}】調至 ${SLOT_NAMES[dest]}，獲得 +2 臨時護甲與護衛（1大回合）！`);
        }
        break;
      }
      case 'neu_anfuminxin':
        healHero(G, pIdx, 4, '【安撫民心】');
        break;
      case 'neu_guwu':
        buffUnitStats(G, pIdx, targetSlot, 2, 2, '【擂鼓助威】');
        break;
      case 'neu_pojia': {
        const eu = enemy.board[targetSlot];
        if (eu) {
          if (eu.armor > 0) {
            addLog(G, `【破甲強弩】粉碎了【${eu.name}】的 ${eu.armor} 點護甲！`);
            eu.armor = 0;
            pushAnim(G, { kind: 'fx', fxType: 'shield_break', owner: enemyIdx, slot: targetSlot });
          }
          dealDamageToUnit(G, enemyIdx, targetSlot, 2, '【破甲強弩】');
        }
        break;
      }
      case 'neu_shengdong': {
        // v3.1 新增：聲東擊西
        const au = p.board[targetSlot];
        if (au) {
          applyEffect(G, pIdx, targetSlot, { type: 'snipe_buff', val: 1, halfTurns: 1, label: '狙擊' });
          pushVfx(G, `unit-${pIdx}-${targetSlot}`, '🎯狙擊', 'text-cyan-300');
          if (targetSlot === 1 || targetSlot === 3) {
            drawCard(G, pIdx, '聲東擊西');
          }
        }
        break;
      }
      case 'neu_jianyu':
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (enemy.board[s]) dealDamageToUnit(G, enemyIdx, s, 1, '【萬箭齊發】');
        }
        drawCard(G, pIdx, '萬箭齊發');
        break;
    }

    p.graveyard.push(card);
    triggerCaocaoWeiwu(G, pIdx);
    triggerSimayiFanshi(G, pIdx);
    triggerJianyingOnCardPlay(G, pIdx);
    cleanupDeadUnits(G);
    checkVictory(G);
    return true;
  }

  function executeAttack(G, pIdx, attackerSlot, targetType, targetSlot = null) {
    if (G.phase !== 'MAIN' || G.activePlayer !== pIdx || G.pendingPrompt) return false;
    const p = G.players[pIdx];
    const enemyIdx = 1 - pIdx;
    const enemy = G.players[enemyIdx];
    const attacker = p.board[attackerSlot];
    if (!canUnitAttack(attacker, G)) return false;

    const valid = getValidAttackTargets(G, pIdx, attackerSlot);
    if (targetType === 'HERO') {
      if (!valid.canHitHero) return false;
      // v3.3 劉備【激將】：相鄰友軍發動攻擊時，本回合攻擊力 +1
      const hasAdjLiubeiH = (attackerSlot > 0 && p.board[attackerSlot - 1] && p.board[attackerSlot - 1].id === 'shu_liubei' && !isUnitSilenced(p.board[attackerSlot - 1]))
        || (attackerSlot < BOARD_SIZE - 1 && p.board[attackerSlot + 1] && p.board[attackerSlot + 1].id === 'shu_liubei' && !isUnitSilenced(p.board[attackerSlot + 1]));
      if (hasAdjLiubeiH) applyEffect(G, pIdx, attackerSlot, { type: 'atk_buff', val: 1, halfTurns: 1, label: '激將+1攻' });

      let dmg = getUnitAtk(attacker, G);
      if (attacker.id === 'qun_gaoshun' && !isUnitSilenced(attacker)) dmg += 1;
      if (attacker.id === 'shu_jiangwei' && !isUnitSilenced(attacker) && enemy.hp <= 15) {
        dmg += 2;
        pushSkillAnim(G, pIdx, attacker, '九伐', '敵方國力 ≤ 15，額外造成 2 點傷害！', 'slash');
      }
      if (attacker.id === 'wei_dengai' && !isUnitSilenced(attacker) && enemy.board.some(u => u !== null)) {
        pushSkillAnim(G, pIdx, attacker, '急襲', '偷渡陰平，無視敵陣直擊國力！', 'slash');
      }
      attacker.attacksUsed += 1;
      G.actedThisTurn = true;
      playSound(G, 'playAttack');
      pushAnim(G, { kind: 'attack', attackerOwner: pIdx, attackerSlot, targetType: 'HERO', targetOwner: enemyIdx, targetSlot: null, slashDir: attacker.attacksUsed });
      dealDamageToHero(G, enemyIdx, dmg, `【${attacker.name}】直擊`);
      if (attacker.id === 'shu_weiyan' && !isUnitSilenced(attacker) && dmg > 0 && attacker.hp > 0) {
        healUnit(G, pIdx, attackerSlot, 1, '【魏延·狂骨】');
      }
      // v3.3 關平【龍吟】：相鄰友軍發動普通攻擊後
      for (const adj of [attackerSlot - 1, attackerSlot + 1]) {
        const gp = adj >= 0 && adj < BOARD_SIZE ? p.board[adj] : null;
        if (gp && gp.id === 'shu_guanping' && !isUnitSilenced(gp) && !gp.longyinUsedThisTurn) {
          gp.longyinUsedThisTurn = true;
          if (attacker.id === 'shu_guanyu') drawCard(G, pIdx, '關平·龍吟');
          else if (attacker.hp > 0) applyEffect(G, pIdx, attackerSlot, { type: 'atk_buff', val: 1, halfTurns: 1, label: '龍吟+1攻' });
        }
      }
      checkVictory(G);
      return true;
    }

    if (targetType === 'UNIT') {
      if (!valid.slots.includes(targetSlot)) return false;
      const defender = enemy.board[targetSlot];
      if (!defender) return false;

      // v3.1 樂進【驍果】：攻擊生命值不低於自身的敵將 +1 攻；若目標為護衛改為 +2 攻
      if (attacker.id === 'wei_yuejin' && !isUnitSilenced(attacker)) {
        if (unitHasGuard(defender)) {
          applyEffect(G, pIdx, attackerSlot, { type: 'atk_buff', val: 2, halfTurns: 1, label: '驍果+2攻' });
          pushSkillAnim(G, pIdx, attacker, '驍果', '直搗護衛敵將，本回合 +2 攻擊力！', 'buff');
        } else if (defender.hp >= attacker.hp) {
          applyEffect(G, pIdx, attackerSlot, { type: 'atk_buff', val: 1, halfTurns: 1, label: '驍果+1攻' });
          pushSkillAnim(G, pIdx, attacker, '驍果', '以弱克強，本回合 +1 攻擊力！', 'buff');
        }
      }

      // v3.3 劉備【激將】
      const hasAdjLiubeiU = (attackerSlot > 0 && p.board[attackerSlot - 1] && p.board[attackerSlot - 1].id === 'shu_liubei' && !isUnitSilenced(p.board[attackerSlot - 1]))
        || (attackerSlot < BOARD_SIZE - 1 && p.board[attackerSlot + 1] && p.board[attackerSlot + 1].id === 'shu_liubei' && !isUnitSilenced(p.board[attackerSlot + 1]));
      if (hasAdjLiubeiU) applyEffect(G, pIdx, attackerSlot, { type: 'atk_buff', val: 1, halfTurns: 1, label: '激將+1攻' });

      // v3.3 丁奉【短兵】：攻擊擁有護甲或護衛的敵將時，本回合 +2 攻並破甲
      let extraPierce = false;
      if (attacker.id === 'wu_dingfeng' && !isUnitSilenced(attacker) && (defender.armor > 0 || unitHasGuard(defender))) {
        applyEffect(G, pIdx, attackerSlot, { type: 'atk_buff', val: 2, halfTurns: 1, label: '短兵+2攻' });
        extraPierce = true;
      }

      let atkDmg = getUnitAtk(attacker, G);
      const defDmg = getUnitAtk(defender, G);
      let hasPierce = (!isUnitSilenced(attacker) && (attacker.keywords.includes('PIERCE') || attacker.effects.some(e => e.type === 'pierce_buff'))) || extraPierce;

      // v3.3 黃忠【烈弓】：攻擊受相鄰護衛保護的敵將時，傷害 +2 且無視護甲
      if (attacker.id === 'shu_huangzhong' && !isUnitSilenced(attacker) && isProtectedByAdjacentGuard(enemy.board, targetSlot)) {
        atkDmg += 2;
        hasPierce = true;
      }

      // v3.3 高順【陷陣】：攻擊護衛武將傷害 +1
      if (attacker.id === 'qun_gaoshun' && !isUnitSilenced(attacker) && unitHasGuard(defender)) {
        atkDmg += 1;
      }

      if (defender.id === 'wei_zhangliao' && !isUnitSilenced(defender)) {
        atkDmg = Math.max(0, atkDmg - 1);
        pushSkillAnim(G, enemyIdx, defender, '威震', '震懾來犯敵將，本次攻擊力 -1！', 'shield');
        addLog(G, `⚡【張遼·威震】使【${attacker.name}】本次攻擊力 -1（變為 ${atkDmg}）！`);
      }

      if (defender.id === 'shu_wangping' && !isUnitSilenced(defender) && atkDmg <= 2) {
        atkDmg = Math.max(0, atkDmg - 1);
        pushSkillAnim(G, enemyIdx, defender, '無當', '無當飛軍堅守，抵消 1 點傷害！', 'shield');
      }

      // v3.1 馬超與馬騰【鐵騎】：攻擊護衛武將時，傷害 +1
      if ((attacker.id === 'qun_mateng' || attacker.id === 'shu_machao') && !isUnitSilenced(attacker) && unitHasGuard(defender)) {
        atkDmg += 1;
        pushSkillAnim(G, pIdx, attacker, '鐵騎', '衝破護衛陣線，傷害 +1！', 'slash');
      }

      attacker.attacksUsed += 1;
      G.actedThisTurn = true;
      playSound(G, 'playAttack');
      addLog(G, `⚔️ ${p.name} 的【${attacker.name}】攻擊 ${enemy.name} 的【${defender.name}】！`);
      pushAnim(G, { kind: 'attack', attackerOwner: pIdx, attackerSlot, targetType: 'UNIT', targetOwner: enemyIdx, targetSlot, pierce: hasPierce, slashDir: attacker.attacksUsed });

      if (defender.id === 'qun_zhangren' && !isUnitSilenced(defender) && defDmg >= attacker.hp) {
        pushSkillAnim(G, enemyIdx, defender, '伏擊', '先發制人！反殺來敵且自身不受傷害！', 'slash');
        addLog(G, `🏹【張任·伏擊】反殺【${attacker.name}】且自身不受傷害！`);
        const defRes = dealDamageToUnit(G, pIdx, attackerSlot, defDmg, `【${defender.name}·伏擊】`, { ignoreArmor: true });
        cleanupDeadUnits(G);
        if (defRes.killed) triggerKillBonus(G, defender, enemyIdx);
        cleanupDeadUnits(G);
        checkVictory(G);
        return true;
      }

      const atkRes = dealDamageToUnit(G, enemyIdx, targetSlot, atkDmg, `【${attacker.name}】攻擊`, { isNormalAttack: true, ignoreArmor: hasPierce });
      const defRes = defDmg > 0
        ? dealDamageToUnit(G, pIdx, attackerSlot, defDmg, `【${defender.name}】反擊`, { isNormalAttack: true })
        : { actualHpLoss: 0, killed: false, totalDmg: 0 };

      // v3.1 魏延【狂骨】：造成傷害後（含防守反擊）回復自身 1 點生命
      if (attacker.id === 'shu_weiyan' && !isUnitSilenced(attacker) && atkRes.actualHpLoss > 0 && attacker.hp > 0) {
        healUnit(G, pIdx, attackerSlot, 1, '【魏延·狂骨】');
      }
      if (defender.id === 'shu_weiyan' && !isUnitSilenced(defender) && defRes.actualHpLoss > 0 && defender.hp > 0) {
        healUnit(G, enemyIdx, targetSlot, 1, '【魏延·狂骨】');
      }

      // v3.3 紀靈【雙刃】：主動攻擊敵將時，對相鄰敵將造 1 傷；主目標陣亡對敵國力造 1 傷
      if (attacker.id === 'qun_jiling' && !isUnitSilenced(attacker)) {
        for (const adj of [targetSlot - 1, targetSlot + 1]) {
          if (adj >= 0 && adj < BOARD_SIZE && enemy.board[adj]) {
            dealDamageToUnit(G, enemyIdx, adj, 1, '【紀靈·雙刃】');
          }
        }
        if (atkRes.killed) dealDamageToHero(G, enemyIdx, 1, '【紀靈·雙刃】');
      }

      // v3.3 關平【龍吟】
      for (const adj of [attackerSlot - 1, attackerSlot + 1]) {
        const gp = adj >= 0 && adj < BOARD_SIZE ? p.board[adj] : null;
        if (gp && gp.id === 'shu_guanping' && !isUnitSilenced(gp) && !gp.longyinUsedThisTurn) {
          gp.longyinUsedThisTurn = true;
          if (attacker.id === 'shu_guanyu') drawCard(G, pIdx, '關平·龍吟');
          else if (attacker.hp > 0) applyEffect(G, pIdx, attackerSlot, { type: 'atk_buff', val: 1, halfTurns: 1, label: '龍吟+1攻' });
        }
      }

      cleanupDeadUnits(G);
      if (atkRes.killed) triggerKillBonus(G, attacker, pIdx);
      if (defRes.killed) triggerKillBonus(G, defender, enemyIdx);
      cleanupDeadUnits(G);
      checkVictory(G);
      return true;
    }
    return false;
  }

  function hasAnyLegalAction(G, pIdx) {
    const p = G.players[pIdx];
    for (const c of p.hand) {
      if (canPlayCard(G, pIdx, c)) return true;
    }
    for (let s = 0; s < BOARD_SIZE; s++) {
      if (canUnitAttack(p.board[s], G) || canUseActiveSkill(G, pIdx, s)) return true;
    }
    return false;
  }

  function endTurn(G) {
    if (G.phase !== 'MAIN' || G.pendingPrompt) return false;
    const pIdx = G.activePlayer;
    const p = G.players[pIdx];
    const handLimit = getHandLimit(p.hp);

    if (p.hand.length > handLimit) {
      const needDrop = p.hand.length - handLimit;
      G.pendingPrompt = {
        kind: 'DISCARD',
        owner: pIdx,
        count: needDrop,
        reason: `目前國力 ${p.hp}（手牌上限 ${handLimit} 張），請選擇棄置 ${needDrop} 張手牌後結束回合`,
        afterEndTurn: true
      };
      return false;
    }
    finishEndTurn(G);
    return true;
  }

  function finishEndTurn(G) {
    const pIdx = G.activePlayer;
    const p = G.players[pIdx];
    const enemyIdx = 1 - pIdx;
    const enemy = G.players[enemyIdx];

    if (p.deck.length === 0 && enemy.deck.length === 0 && !G.actedThisTurn && !hasAnyLegalAction(G, pIdx)) {
      G.consecutiveNoActionEmptyDeckTurns += 1;
    } else {
      G.consecutiveNoActionEmptyDeckTurns = 0;
    }

    if (p.tempFood > 0) {
      addLog(G, `【結束階段】清除 ${p.name} 未使用的 ${p.tempFood} 點臨時糧草。`);
      p.tempFood = 0;
    }
    if (p.food > 0) {
      const space = getReserveFoodCap(G, pIdx) - p.reserveFood;
      const stored = Math.min(space, p.food);
      if (stored > 0) {
        p.reserveFood += stored;
        addLog(G, `【屯糧】${p.name} 將剩餘 ${stored} 點糧草存入糧倉（目前 ${p.reserveFood}/${MAX_RESERVE_FOOD}）。`);
      }
      p.food = 0;
    }

    // 還原張郃【料敵】在本回合到期的敵手牌臨時減益
    for (const c of p.hand) {
      if (c.debuffExpiresAfterTurn && p.turnsTaken >= c.debuffExpiresAfterTurn) {
        if (c.tempCostMod) { c.cost = Math.max(0, c.cost - c.tempCostMod); c.tempCostMod = 0; }
        if (c.tempAtkDrop) { c.baseAtk += c.tempAtkDrop; c.tempAtkDrop = 0; }
        if (c.tempHpDrop) { c.baseHp += c.tempHpDrop; c.tempHpDrop = 0; }
        c.debuffExpiresAfterTurn = null;
      }
    }

    // 當前玩家回合結束被動效果
    for (let s = 0; s < BOARD_SIZE; s++) {
      const u = p.board[s];
      if (!u || isUnitSilenced(u)) continue;
      if (u.id === 'wu_luxun') {
        const burningSlots = [];
        for (let k = 0; k < BOARD_SIZE; k++) {
          const eu = enemy.board[k];
          if (eu && eu.effects.some(e => e.type === 'burn')) burningSlots.push(k);
        }
        if (burningSlots.length >= 2) {
          pushSkillAnim(G, pIdx, u, '度勢', `敵方有 ${burningSlots.length} 名灼燒武將！所有灼燒敵將受 1 傷，並對敵國力造 2 傷！`, 'burn');
          for (const k of burningSlots) {
            if (enemy.board[k]) dealDamageToUnit(G, enemyIdx, k, 1, '【陸遜·度勢】');
          }
          dealDamageToHero(G, enemyIdx, 2, '【陸遜·度勢】');
        }
      } else if (u.id === 'qun_diaochan') {
        // v3.1: 閉月國力改為 +1
        healHero(G, pIdx, 1, '【貂蟬·閉月】');
        if (s > 0 && p.board[s - 1]) healUnit(G, pIdx, s - 1, 1, '【貂蟬·閉月】');
        if (s < BOARD_SIZE - 1 && p.board[s + 1]) healUnit(G, pIdx, s + 1, 1, '【貂蟬·閉月】');
      } else if (u.id === 'qun_yuanshu') {
        pushSkillAnim(G, pIdx, u, '眾叛', '眾叛親離！回合結束己方國力 -2！', 'burn');
        dealDamageToHero(G, pIdx, 2, '【袁術·眾叛】');
      } else if (u.id === 'wei_zhonghui') {
        if (p.reserveFood >= 2) {
          p.reserveFood -= 2;
          buffUnitStats(G, pIdx, s, 2, 2, '【鍾會·自立】');
          if (!u.keywords.includes('PIERCE')) u.keywords.push('PIERCE');
          drawCard(G, pIdx, '鍾會·自立');
        }
      } else if (u.id === 'wu_sunquan') {
        if (p.hand.length >= enemy.hand.length) {
          healHero(G, pIdx, 2, '【孫權·坐斷東南】');
          for (const adj of [s - 1, s + 1]) {
            if (adj >= 0 && adj < BOARD_SIZE && p.board[adj]) {
              applyEffect(G, pIdx, adj, { type: 'atk_buff', val: 1, halfTurns: 2, label: '+1攻' });
            }
          }
        }
        if (p.hand.length >= 6) {
          dealDamageToHero(G, enemyIdx, 2, '【孫權·坐斷東南】');
        }
      } else if (u.id === 'shu_liyan') {
        if (p.reserveFood === 0) {
          dealDamageToHero(G, pIdx, 1, '【李嚴·督糧】');
        }
      }
    }

    // 灼燒與中毒：僅在持有單位的己方回合結束時結算傷害與回合數
    for (let s = 0; s < BOARD_SIZE; s++) {
      const u = p.board[s];
      if (!u) continue;
      const keep = [];
      for (const eff of u.effects) {
        if (eff.type === 'burn' || eff.type === 'poison') {
          pushAnim(G, { kind: 'fx', fxType: eff.type, owner: pIdx, slot: s });
          dealDamageToUnit(G, pIdx, s, eff.val, `【${eff.label}持續】`, { isDot: true });
          eff.turns -= 1;
          if (eff.turns > 0) keep.push(eff);
        } else {
          keep.push(eff);
        }
      }
      u.effects = keep;
    }

    // v3.1 大回合制：雙方場上所有非 DoT 狀態每次回合結束皆扣 1 半回合
    for (let owner = 0; owner < 2; owner++) {
      for (let s = 0; s < BOARD_SIZE; s++) {
        const u = G.players[owner].board[s];
        if (!u) continue;
        const remaining = [];
        for (const eff of u.effects) {
          if (eff.type === 'burn' || eff.type === 'poison') {
            remaining.push(eff);
            continue;
          }
          eff.halfTurns = (typeof eff.halfTurns === 'number' ? eff.halfTurns : (eff.turns || 1) * 2) - 1;
          if (eff.halfTurns > 0) {
            eff.turns = Math.ceil(eff.halfTurns / 2);
            remaining.push(eff);
          } else if (eff.type === 'armor_buff') {
            u.armor = Math.max(0, u.armor - eff.val);
          }
        }
        u.effects = remaining;
      }
    }

    cleanupDeadUnits(G);
    if (checkVictory(G)) return;

    playSound(G, 'playTurn');
    startTurn(G, enemyIdx);
  }

  function hasGeneralAvailable(p) {
    return p.board.some(u => u !== null) || p.hand.some(c => c.type === 'GENERAL');
  }

  function hasPlayableTacticInEndgame(G, pIdx) {
    const p = G.players[pIdx];
    const maxBudget = p.maxFood + (p.reserveFood || 0);
    for (const c of p.hand) {
      if (c.type !== 'TACTIC') continue;
      if (c.cost > maxBudget) continue;
      const t = getValidTacticTargets(G, pIdx, c);
      if (t.type === 'none' || t.slots.length > 0) return true;
    }
    return false;
  }

  function checkVictory(G) {
    if (G.phase === 'GAMEOVER') return true;
    const p0 = G.players[0];
    const p1 = G.players[1];

    if (p0.hp <= 0 && p1.hp <= 0) {
      G.phase = 'GAMEOVER';
      G.winner = 'DRAW';
      G.winReason = '雙方國力同時歸零，平局！';
      addLog(G, `🏆 ${G.winReason}`);
      playSound(G, 'playVictory');
      return true;
    }
    if (p1.hp <= 0) {
      G.phase = 'GAMEOVER';
      G.winner = 0;
      G.winReason = `${p1.name} 國力降至 ${p1.hp}，${p0.name} 獲得勝利！`;
      addLog(G, `🏆 ${G.winReason}`);
      playSound(G, 'playVictory');
      return true;
    }
    if (p0.hp <= 0) {
      G.phase = 'GAMEOVER';
      G.winner = 1;
      G.winReason = `${p0.name} 國力降至 ${p0.hp}，${p1.name} 獲得勝利！`;
      addLog(G, `🏆 ${G.winReason}`);
      playSound(G, 'playVictory');
      return true;
    }

    // v3.1 殘局判勝規則：
    // 1) 若一方牌庫歸零且場上與手牌皆無武將牌，而另一方仍有武將（場上或手牌），直接判有武將方勝
    const p0HasGen = hasGeneralAvailable(p0);
    const p1HasGen = hasGeneralAvailable(p1);

    if (p0.deck.length === 0 && !p0HasGen && p1HasGen) {
      G.phase = 'GAMEOVER';
      G.winner = 1;
      G.winReason = `${p0.name} 牌庫耗盡且無任何武將可用，${p1.name} 憑藉存續兵力直接獲勝！`;
      addLog(G, `🏆 ${G.winReason}`);
      playSound(G, 'playVictory');
      return true;
    }
    if (p1.deck.length === 0 && !p1HasGen && p0HasGen) {
      G.phase = 'GAMEOVER';
      G.winner = 0;
      G.winReason = `${p1.name} 牌庫耗盡且無任何武將可用，${p0.name} 憑藉存續兵力直接獲勝！`;
      addLog(G, `🏆 ${G.winReason}`);
      playSound(G, 'playVictory');
      return true;
    }

    // 2) 若雙方皆無牌庫且皆無武將，須待可用謀略牌耗盡（或連續無法行動）後比較剩餘國力
    if (p0.deck.length === 0 && p1.deck.length === 0 && !p0HasGen && !p1HasGen) {
      const anyTacticLeft = hasPlayableTacticInEndgame(G, 0) || hasPlayableTacticInEndgame(G, 1);
      if (!anyTacticLeft || G.consecutiveNoActionEmptyDeckTurns >= 2) {
        G.phase = 'GAMEOVER';
        if (p0.hp > p1.hp) {
          G.winner = 0;
          G.winReason = `雙方皆無武將與可用謀略，${p0.name} 以較高國力（${p0.hp} vs ${p1.hp}）獲勝！`;
        } else if (p1.hp > p0.hp) {
          G.winner = 1;
          G.winReason = `雙方皆無武將與可用謀略，${p1.name} 以較高國力（${p1.hp} vs ${p0.hp}）獲勝！`;
        } else {
          G.winner = 'DRAW';
          G.winReason = `雙方皆無武將與可用謀略，國力相同（${p0.hp} vs ${p1.hp}），平局！`;
        }
        addLog(G, `🏆 ${G.winReason}`);
        playSound(G, 'playVictory');
        return true;
      }
    }
    return false;
  }

  Object.assign(global.Sanguo, {
    isUnitSilenced,
    isWanshaBlocking,
    isWanshaActive,
    getUnitAtk,
    getUnitMaxAttacks,
    unitHasGuard,
    unitHasSnipe,
    isProtectedByAdjacentGuard,
    canUnitAttack,
    canUseActiveSkill,
    createGameState,
    getTotalFood,
    drawCard,
    performMulligan,
    startTurn,
    getValidAttackTargets,
    getValidTacticTargets,
    canPlayCard,
    playGeneral,
    playTactic,
    activateUnitSkill,
    resolvePendingPrompt,
    executeAttack,
    endTurn
  });

  global.__SANGUO_ENGINE__ = global.Sanguo;
})(window);