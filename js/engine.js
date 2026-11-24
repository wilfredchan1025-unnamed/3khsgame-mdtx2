(function (global) {
  'use strict';

  const {
    FACTIONS, BOARD_SIZE, SLOT_NAMES, MAX_HAND_SIZE, MAX_FOOD_CAP, MAX_RESERVE_FOOD, INITIAL_HP,
    getHandLimit, CARD_DB, getDeckForFaction, Sound
  } = global.Sanguo;

  let nextUid = 1;

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

  function createUnitFromCard(card, ownerIdx, slotIdx) {
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
      frozenNextTurn: false,
      attacksUsed: 0,
      activeUsedThisTurn: false,
      silenced: false,
      effects: []
    };
  }

  function isWanshaActive(G) {
    if (!G || !G.players) return false;
    for (let p = 0; p < 2; p++) {
      for (let s = 0; s < BOARD_SIZE; s++) {
        const u = G.players[p].board[s];
        if (u && u.id === 'qun_jiaxu' && !u.silenced && u.hp > 0) return true;
      }
    }
    return false;
  }

  function getUnitAtk(unit, G = null) {
    if (!unit) return 0;
    const blockBuffs = G ? isWanshaActive(G) : false;
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
    if (!unit || unit.silenced) return 1;
    return unit.keywords.includes('COMBO') ? 2 : 1;
  }

  function unitHasGuard(unit) {
    if (!unit || unit.silenced) return false;
    return unit.keywords.includes('GUARD') || unit.effects.some(e => e.type === 'guard_buff');
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
    const u = p.board[slotIdx];
    if (!u || u.silenced || !u.activeSkill || u.activeUsedThisTurn) return false;
    if (u.id === 'wu_sunquan') {
      return p.hand.length > 0;
    }
    return getTotalFood(p, 'TACTIC') >= u.activeSkill.cost;
  }

  function createGameState({ mode = 'AI', p0Faction = 'SHU', p1Faction = 'WEI', firstPlayer = 0, p0Deck = null, p1Deck = null }) {
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
        deck: d0,
        hand: [],
        graveyard: [],
        board: Array(BOARD_SIZE).fill(null),
        mulliganDone: false,
        turnsTaken: 0
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
        deck: d1,
        hand: [],
        graveyard: [],
        board: Array(BOARD_SIZE).fill(null),
        mulliganDone: false,
        turnsTaken: 0
      }
    ];

    const secondPlayer = 1 - firstPlayer;
    for (let i = 0; i < 3; i++) players[firstPlayer].hand.push(players[firstPlayer].deck.pop());
    for (let i = 0; i < 4; i++) players[secondPlayer].hand.push(players[secondPlayer].deck.pop());

    return {
      mode,
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
      zhoutaiBquUsed: [false, false],
      pendingPrompt: null,
      vfxEvents: [],
      animEvents: []
    };
  }

  function addLog(G, msg) {
    G.log.push(msg);
    if (G.log.length > 250) G.log.shift();
  }

  function pushVfx(G, targetKey, text, colorClass) {
    G.vfxEvents.push({ targetKey, text, colorClass, id: nextUid++ });
  }

  function pushAnim(G, evt) {
    G.animEvents.push(Object.assign({ id: nextUid++ }, evt));
  }

  function pushSkillAnim(G, ownerIdx, unit, skillName, desc, fxType = 'skill') {
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
    const before = p.reserveFood;
    p.reserveFood = Math.min(MAX_RESERVE_FOOD, p.reserveFood + amt);
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
    if (isWanshaActive(G) && (atkDelta > 0 || hpDelta > 0)) {
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
    if (isWanshaActive(G) && ((eff.type === 'atk_buff' && eff.val > 0) || eff.type === 'armor_buff' || eff.type === 'guard_buff')) {
      addLog(G, `☠️【賈詡·完殺】生效，阻止了對【${u.name}】的增益狀態！`);
      pushVfx(G, `unit-${ownerIdx}-${slotIdx}`, '完殺無效', 'text-purple-300');
      return false;
    }
    u.effects.push(eff);
    if (eff.type === 'armor_buff') u.armor += eff.val;
    if (eff.type === 'burn') pushAnim(G, { kind: 'fx', fxType: 'burn', owner: ownerIdx, slot: slotIdx });
    if (eff.type === 'poison') pushAnim(G, { kind: 'fx', fxType: 'poison', owner: ownerIdx, slot: slotIdx });
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
    // Allow temporarily exceeding dynamic hand limit during turn; player chooses discards at end of turn
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

    // v3.0 food curve: T1-T5 +1 each turn; T6+ +1 every 2 turns (T7, T9...), cap 7
    const shouldGrow = p.turnsTaken <= 5 || (p.turnsTaken % 2 === 1);
    if (shouldGrow && p.maxFood < MAX_FOOD_CAP) {
      p.maxFood = Math.min(MAX_FOOD_CAP, p.maxFood + 1);
    }
    p.food = p.maxFood;
    p.tempFood = 0;

    const wansha = isWanshaActive(G);
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
      if (!wansha) {
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

    if (pIdx === G.secondPlayer && p.turnsTaken === 1) {
      const rm = createCardInstance('rapid_march');
      addCardToHand(G, pIdx, rm);
      addLog(G, `【後手補償】${p.name} 獲得專屬 0 費謀略牌【急行軍】！`);
    }

    checkVictory(G);
  }

  function getValidAttackTargets(G, attackerOwner, attackerSlot) {
    const attacker = G.players[attackerOwner].board[attackerSlot];
    if (!canUnitAttack(attacker, G)) return { slots: [], canHitHero: false };

    const enemyIdx = 1 - attackerOwner;
    const enemy = G.players[enemyIdx];
    const hasSnipe = !attacker.silenced && attacker.keywords.includes('SNIPE');
    const canBypassToHero = !attacker.silenced && attacker.id === 'wei_dengai';
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
    // v3.0: When enemy board is empty, ANY ready unit (including Rush / 兵貴神速) can hit Hero!
    return { slots: [], canHitHero: true };
  }

  function getValidTacticTargets(G, ownerIdx, card) {
    const enemyIdx = 1 - ownerIdx;
    if (card.target === 'enemy_general') {
      const slots = [];
      for (let s = 0; s < BOARD_SIZE; s++) {
        const eu = G.players[enemyIdx].board[s];
        if (!eu) continue;
        // 賈詡【帷幕】不能成為謀略牌目標
        if (!eu.silenced && eu.keywords.includes('SHROUD')) continue;
        slots.push(s);
      }
      return { type: 'enemy_general', slots };
    }
    if (card.target === 'ally_general') {
      const slots = [];
      for (let s = 0; s < BOARD_SIZE; s++) {
        const au = G.players[ownerIdx].board[s];
        if (!au) continue;
        if (!au.silenced && au.keywords.includes('SHROUD')) continue;
        slots.push(s);
      }
      return { type: 'ally_general', slots };
    }
    return { type: 'none', slots: [] };
  }

  function canPlayCard(G, pIdx, card) {
    if (G.phase !== 'MAIN' || G.activePlayer !== pIdx || G.pendingPrompt) return false;
    const p = G.players[pIdx];
    if (getTotalFood(p, card.type) < card.cost) return false;
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

    const ignoreArmor = Boolean(opts.ignoreArmor);
    const totalDmg = baseDmg;
    const armorBefore = unit.armor;
    const blocked = ignoreArmor ? 0 : Math.min(unit.armor, totalDmg);
    unit.armor -= blocked;
    const shieldBroken = armorBefore > 0 && unit.armor === 0 && !ignoreArmor;
    const hpLoss = totalDmg - blocked;
    unit.hp -= hpLoss;

    // 周泰【不屈】：生命值不會低於 1（每場遊戲一次）
    if (unit.id === 'wu_zhoutai' && !unit.silenced && unit.hp <= 0 && !G.zhoutaiBquUsed[targetOwner]) {
      G.zhoutaiBquUsed[targetOwner] = true;
      unit.hp = 1;
      pushSkillAnim(G, targetOwner, unit, '不屈', '以死相護，生命值鎖定於 1！', 'unyielding');
      pushVfx(G, `unit-${targetOwner}-${targetSlot}`, '🔥不屈 1HP!', 'text-amber-300');
      addLog(G, `🔥 觸發【周泰·不屈】！周泰免於陣亡，生命值鎖定為 1！`);
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
    if (unit.id === 'wei_dianwei' && !unit.silenced && hpLoss > 0 && unit.hp > 0) {
      if (!isWanshaActive(G)) {
        unit.atk += 1;
        pushSkillAnim(G, targetOwner, unit, '惡來', '受創激怒，攻擊力 +1！', 'buff');
        pushVfx(G, key, '+1攻(惡來)', 'text-amber-300');
        addLog(G, `🔱【典韋·惡來】受到傷害，攻擊力永久 +1（目前 ${unit.atk}）！`);
      }
    }

    return { actualHpLoss: hpLoss, killed: unit.hp <= 0, totalDmg, shieldBroken };
  }

  function dealDamageToHero(G, targetOwner, dmg, sourceLabel = '') {
    if (dmg <= 0) return;
    const p = G.players[targetOwner];
    p.hp -= dmg;
    pushVfx(G, `hero-${targetOwner}`, `-${dmg} 國力`, 'text-red-400');
    addLog(G, `${sourceLabel}對 ${p.name} 國力造成 ${dmg} 點傷害（剩餘國力 ${p.hp}）。`);
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
    if (!unit || unit.silenced || !unit.keywords.includes('DEATHRATTLE')) return;
    const enemyIdx = 1 - ownerIdx;
    const enemy = G.players[enemyIdx];
    addLog(G, `🕯️ 觸發【${unit.name}】遺計效果！`);
    switch (unit.id) {
      case 'wei_guojia':
        pushSkillAnim(G, ownerIdx, unit, '遺計', '陣亡抽 2 張牌，並存入 1 點糧倉！', 'skill');
        drawCard(G, ownerIdx, '郭嘉·遺計');
        drawCard(G, ownerIdx, '郭嘉·遺計');
        addReserveFood(G, ownerIdx, 1, '【郭嘉·遺計】');
        break;
      case 'qun_zhangjiao':
        pushSkillAnim(G, ownerIdx, unit, '黃天遺計', '對敵方全體武將造成 1 點傷害！', 'burn');
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (enemy.board[s]) {
            dealDamageToUnit(G, enemyIdx, s, 1, '【張角·遺計】');
          }
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
    if (!killer || killer.silenced || !killer.keywords.includes('KILL')) return;
    const enemyIdx = 1 - killerOwner;
    pushAnim(G, { kind: 'kill_bonus', owner: killerOwner, slot: killer.slot, name: killer.name });
    addLog(G, `⚡ 觸發【${killer.name}】斬殺效果！`);
    Sound.playKill();
    switch (killer.id) {
      case 'shu_weiyan':
        pushSkillAnim(G, killerOwner, killer, '狂骨', '斬殺回復己方國力 2 點！', 'heal');
        healHero(G, killerOwner, 2, '【魏延·狂骨】');
        break;
      case 'shu_guanyu':
        pushSkillAnim(G, killerOwner, killer, '武聖', '斬殺抽 1 張牌，並打敵方國力 2 點傷害！', 'slash');
        drawCard(G, killerOwner, '關羽·武聖');
        dealDamageToHero(G, enemyIdx, 2, '【關羽·武聖】');
        break;
      case 'wei_xiahoudun':
        if (killer.hp > 0) {
          pushSkillAnim(G, killerOwner, killer, '剛烈', '斬殺自身回復 2 點生命！', 'heal');
          healUnit(G, killerOwner, killer.slot, 2, '【夏侯惇·剛烈】');
        }
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
      case 'qun_lubu':
        pushSkillAnim(G, killerOwner, killer, '無雙', '斬殺對敵方國力造成 3 點傷害！', 'slash');
        dealDamageToHero(G, enemyIdx, 3, '【呂布·無雙】');
        break;
    }
  }

  function triggerOnPlay(G, ownerIdx, slotIdx, unit, wasFirstGeneral) {
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
        const drawN = p.hand.length < enemy.hand.length ? 2 : 1;
        pushSkillAnim(G, ownerIdx, unit, '奇謀', `手牌${drawN === 2 ? '少於敵方，抽 2 張牌' : '抽 1 張牌'}！`, 'skill');
        for (let i = 0; i < drawN; i++) drawCard(G, ownerIdx, '法正·奇謀');
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
      case 'shu_machao':
        pushSkillAnim(G, ownerIdx, unit, '鐵騎', '登場本回合獲得 +1 攻擊力！', 'buff');
        applyEffect(G, ownerIdx, slotIdx, { type: 'atk_buff', val: 1, turns: 1, label: '+1攻' });
        break;
      case 'shu_jiangwei': {
        const hasZgl = p.board.some(u => u && u.id === 'shu_zhugeliang');
        if (hasZgl) {
          pushSkillAnim(G, ownerIdx, unit, '繼志', '諸葛亮在場，獲得 +2/+2 與護衛！', 'buff');
          buffUnitStats(G, ownerIdx, slotIdx, 2, 2, '【姜維·繼志】');
          if (!unit.keywords.includes('GUARD')) unit.keywords.push('GUARD');
        }
        break;
      }
      case 'shu_zhugeliang':
        pushSkillAnim(G, ownerIdx, unit, '錦囊', '登場抽 2 張牌！', 'skill');
        drawCard(G, ownerIdx, '諸葛亮·錦囊');
        drawCard(G, ownerIdx, '諸葛亮·錦囊');
        break;
      case 'wei_xuhuang': {
        let bestSlot = -1, bestAtk = -1;
        for (let s = 0; s < BOARD_SIZE; s++) {
          const eu = enemy.board[s];
          if (eu && getUnitAtk(eu, G) > bestAtk) { bestAtk = getUnitAtk(eu, G); bestSlot = s; }
        }
        pushSkillAnim(G, ownerIdx, unit, '斷糧', '削弱敵最高攻 -1 攻，並扣除敵方 1 點糧倉！', 'skill');
        if (bestSlot !== -1) {
          applyEffect(G, enemyIdx, bestSlot, { type: 'atk_buff', val: -1, turns: 2, label: '-1攻' });
          addLog(G, `【徐晃·斷糧】使敵方【${enemy.board[bestSlot].name}】攻擊力 -1（2回合）。`);
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
        if (enemy.hand.length > 0) {
          let maxIdx = 0;
          for (let i = 1; i < enemy.hand.length; i++) {
            if (enemy.hand[i].cost > enemy.hand[maxIdx].cost) maxIdx = i;
          }
          const targetCard = enemy.hand[maxIdx];
          if (targetCard.type === 'TACTIC') {
            targetCard.cost += 1;
            pushSkillAnim(G, ownerIdx, unit, '料敵', `洞悉敵手牌【${targetCard.name}】（謀略），費用 +1！`, 'skill');
            addLog(G, `🎯【張郃·料敵】查看敵方最高費手牌【${targetCard.name}】，使其費用 +1（變為 ${targetCard.cost} 糧）！`);
          } else {
            targetCard.baseAtk = Math.max(0, targetCard.baseAtk - 1);
            targetCard.baseHp = Math.max(1, targetCard.baseHp - 1);
            pushSkillAnim(G, ownerIdx, unit, '料敵', `洞悉敵手牌【${targetCard.name}】（武將），使其 -1/-1！`, 'skill');
            addLog(G, `🎯【張郃·料敵】查看敵方最高費手牌【${targetCard.name}】，使其變為 ${targetCard.baseAtk}/${targetCard.baseHp}！`);
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
      case 'wei_simayi':
        pushSkillAnim(G, ownerIdx, unit, '鷹視', '敵全體造成 1 傷並施加灼燒（2回合）！', 'burn');
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (enemy.board[s]) {
            dealDamageToUnit(G, enemyIdx, s, 1, '【司馬懿·鷹視】');
            if (enemy.board[s] && enemy.board[s].hp > 0) {
              applyEffect(G, enemyIdx, s, { type: 'burn', val: 1, turns: 2, label: '灼燒' });
            }
          }
        }
        break;
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
      case 'wu_lingtong':
        if (wasFirstGeneral) {
          pushSkillAnim(G, ownerIdx, unit, '先登', '本場首位登場武將，獲得 +1/+0！', 'buff');
          buffUnitStats(G, ownerIdx, slotIdx, 1, 0, '【凌統·先登】');
        }
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
            desc: '請選擇一名敵方武將，移除其所有技能：',
            context: { type: 'SILENCE', sourceSlot: slotIdx }
          };
        }
        break;
      case 'wu_zhouyu':
        pushSkillAnim(G, ownerIdx, unit, '火攻', '烈焰焚陣！敵全體 2 傷並灼燒（2回合）！', 'burn');
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (enemy.board[s]) {
            dealDamageToUnit(G, enemyIdx, s, 2, '【周瑜·火攻】');
            if (enemy.board[s] && enemy.board[s].hp > 0) {
              applyEffect(G, enemyIdx, s, { type: 'burn', val: 1, turns: 2, label: '灼燒' });
            }
          }
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
        pushSkillAnim(G, ownerIdx, unit, '完殺・帷幕', '在場時雙方增益無效，且不受謀略指定！', 'poison');
        break;
      case 'qun_zhangjiao': {
        const emptySlot = p.board.findIndex(u => u === null);
        if (emptySlot !== -1) {
          const tokenCard = createCardInstance('qun_yellow_turban');
          const tokenUnit = createUnitFromCard(tokenCard, ownerIdx, emptySlot);
          p.board[emptySlot] = tokenUnit;
          pushSkillAnim(G, ownerIdx, unit, '黃天', `於 ${SLOT_NAMES[emptySlot]} 召喚 1 名【黃巾力士】！`, 'skill');
          addLog(G, `【張角·黃天】於 ${SLOT_NAMES[emptySlot]} 召喚了 1 名【黃巾力士】！`);
        }
        break;
      }
      case 'qun_yuanshu':
        pushSkillAnim(G, ownerIdx, unit, '稱帝', '我方國力 -5，自身獲得 +3/+3 與護衛！', 'buff');
        dealDamageToHero(G, ownerIdx, 5, '【袁術·稱帝】');
        buffUnitStats(G, ownerIdx, slotIdx, 3, 3, '【袁術·稱帝】');
        if (!unit.keywords.includes('GUARD')) unit.keywords.push('GUARD');
        break;
      case 'qun_yuanshao':
        pushSkillAnim(G, ownerIdx, unit, '亂擊', '敵全體 1 傷，全友軍 +1 攻（2回合）！', 'slash');
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (enemy.board[s]) dealDamageToUnit(G, enemyIdx, s, 1, '【袁紹·亂擊】');
          if (p.board[s]) applyEffect(G, ownerIdx, s, { type: 'atk_buff', val: 1, turns: 2, label: '+1攻' });
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
          { id: 'zgl_armor', label: '🛡️ 八陣護軍', desc: '消耗 1 糧，所有友方武將 +1 臨時護甲（1回合）' },
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
          { id: 'huatuo_hero', label: '💚 國力回春', desc: '消耗 1 糧，回復己方國力 3 點' },
          { id: 'huatuo_units', label: '🌿 妙手仁心', desc: '消耗 1 糧，所有友方武將回復 2 點生命' }
        ],
        context: { sourceSlot: slotIdx, cost: 1 }
      };
      return true;
    }

    // Direct active skills (no modal needed)
    spendFood(p, u.activeSkill.cost, 'TACTIC');
    u.activeUsedThisTurn = true;
    G.actedThisTurn = true;
    Sound.playTactic();

    switch (u.id) {
      case 'shu_zhaoyun':
        pushSkillAnim(G, pIdx, u, '龍膽', '本回合獲得 +1 攻擊力與 +1 臨時護甲！', 'buff');
        applyEffect(G, pIdx, slotIdx, { type: 'atk_buff', val: 1, turns: 1, label: '+1攻' });
        applyEffect(G, pIdx, slotIdx, { type: 'armor_buff', val: 1, turns: 1, label: '+1甲' });
        break;
      case 'wei_caoren':
        u.atk = Math.max(0, u.atk - 1);
        pushSkillAnim(G, pIdx, u, '據守', '自身 -1 攻，自己與相鄰友軍 +2 臨時護甲！', 'shield');
        for (let s = Math.max(0, slotIdx - 1); s <= Math.min(BOARD_SIZE - 1, slotIdx + 1); s++) {
          if (p.board[s]) {
            applyEffect(G, pIdx, s, { type: 'armor_buff', val: 2, turns: 1, label: '+2甲' });
            pushVfx(G, `unit-${pIdx}-${s}`, '+2🛡️', 'text-sky-300');
          }
        }
        addLog(G, `🏰【曹仁·據守】自身 -1 攻，自己及相鄰友軍獲得 +2 臨時護甲！`);
        break;
      case 'wei_simayi':
      case 'qun_diaochan': {
        const sName = u.id === 'wei_simayi' ? '鷹視' : '離間';
        let bestSlot = -1, bestAtk = -1;
        for (let s = 0; s < BOARD_SIZE; s++) {
          const eu = enemy.board[s];
          if (eu && getUnitAtk(eu, G) > bestAtk) { bestAtk = getUnitAtk(eu, G); bestSlot = s; }
        }
        pushSkillAnim(G, pIdx, u, sName, bestSlot !== -1 ? `使敵方【${enemy.board[bestSlot].name}】-2 攻擊力！` : '敵方無武將。', 'skill');
        if (bestSlot !== -1) {
          applyEffect(G, enemyIdx, bestSlot, { type: 'atk_buff', val: -2, turns: 1, label: '-2攻' });
          pushVfx(G, `unit-${enemyIdx}-${bestSlot}`, '-2攻', 'text-indigo-300');
          addLog(G, `【${u.name}·${sName}】使敵方【${enemy.board[bestSlot].name}】攻擊力 -2（1回合）！`);
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
    }

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
      G.pendingPrompt = null;
      if (prompt.afterEndTurn) {
        finishEndTurn(G);
      }
      return true;
    }

    if (prompt.kind === 'ZHIHENG') {
      const uids = Array.isArray(response && response.selectedUids) ? response.selectedUids : [];
      if (uids.length === 0) {
        G.pendingPrompt = null; // Cancelled
        return true;
      }
      const x = Math.min(3, uids.length);
      const cost = x > 1 ? 1 : 0;
      if (getTotalFood(p, 'TACTIC') < cost) return false;
      const u = p.board[prompt.slotIdx];
      if (!u) { G.pendingPrompt = null; return false; }

      spendFood(p, cost, 'TACTIC');
      u.activeUsedThisTurn = true;
      G.actedThisTurn = true;
      const dropSet = new Set(uids.slice(0, x));
      const kept = [];
      let dropped = 0;
      for (const c of p.hand) {
        if (dropSet.has(c.uid)) { p.graveyard.push(c); dropped++; }
        else kept.push(c);
      }
      p.hand = kept;
      Sound.playTactic();
      pushSkillAnim(G, pIdx, u, '制衡', `棄置 ${dropped} 張手牌並重抽 ${dropped} 張！`, 'skill');
      for (let i = 0; i < dropped; i++) drawCard(G, pIdx, '孫權·制衡');
      G.pendingPrompt = null;
      return true;
    }

    if (prompt.kind === 'TARGET_ENEMY') {
      const slot = response && typeof response.slot === 'number' ? response.slot : -1;
      const eu = enemy.board[slot];
      if (!eu) return false;
      const srcUnit = p.board[prompt.context.sourceSlot] || { name: prompt.sourceName, icon: prompt.sourceIcon, faction: p.faction, slot: prompt.context.sourceSlot };
      G.pendingPrompt = null;

      if (prompt.context.type === 'SILENCE') {
        pushSkillAnim(G, pIdx, srcUnit, prompt.skillName, `使【${eu.name}】失去所有技能！`, 'silence');
        silenceUnit(G, enemyIdx, slot, `【${srcUnit.name}·${prompt.skillName}】`);
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
        G.actedThisTurn = true;
        Sound.playTactic();
      }

      switch (choiceId) {
        case 'caocao_atk':
          pushSkillAnim(G, pIdx, u, '奸雄', '橫掃千軍！全友軍本回合 +2 攻擊力！', 'buff');
          for (let s = 0; s < BOARD_SIZE; s++) {
            if (p.board[s]) applyEffect(G, pIdx, s, { type: 'atk_buff', val: 2, turns: 1, label: '+2攻' });
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
          pushSkillAnim(G, pIdx, u, '錦囊', '八陣護軍！所有友方武將 +1 臨時護甲！', 'shield');
          for (let s = 0; s < BOARD_SIZE; s++) {
            if (p.board[s]) {
              applyEffect(G, pIdx, s, { type: 'armor_buff', val: 1, turns: 1, label: '+1甲' });
              pushVfx(G, `unit-${pIdx}-${s}`, '+1🛡️', 'text-sky-300');
            }
          }
          break;
        case 'zgl_draw':
          pushSkillAnim(G, pIdx, u, '錦囊', '運籌屯糧！抽 1 張牌並存入 1 點糧倉！', 'skill');
          drawCard(G, pIdx, '諸葛亮·錦囊');
          addReserveFood(G, pIdx, 1, '【諸葛亮·錦囊】');
          break;
        case 'huatuo_hero':
          pushSkillAnim(G, pIdx, u, '青囊', '國力回春！回復己方國力 3 點！', 'heal');
          healHero(G, pIdx, 3, '【華佗·青囊】');
          break;
        case 'huatuo_units':
          pushSkillAnim(G, pIdx, u, '青囊', '妙手仁心！所有友方武將回復 2 點生命！', 'heal');
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

    const wasFirst = !G.firstGeneralPlayed;
    G.firstGeneralPlayed = true;

    spendFood(p, card.cost, 'GENERAL');
    p.hand.splice(handIdx, 1);
    const unit = createUnitFromCard(card, pIdx, slotIdx);
    p.board[slotIdx] = unit;
    G.actedThisTurn = true;
    Sound.playDeploy();

    addLog(G, `${p.name} 消耗 ${card.cost} 糧草，將【${unit.name}】部署於 ${SLOT_NAMES[slotIdx]}（${unit.isPrep ? '整備中' : '突襲就緒'}）。`);
    triggerOnPlay(G, pIdx, slotIdx, unit, wasFirst);
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
    if (card.type !== 'TACTIC' || getTotalFood(p, 'TACTIC') < card.cost) return false;

    if (card.target === 'enemy_general') {
      const eu = targetSlot !== null ? enemy.board[targetSlot] : null;
      if (!eu || (!eu.silenced && eu.keywords.includes('SHROUD'))) return false;
    } else if (card.target === 'ally_general') {
      const au = targetSlot !== null ? p.board[targetSlot] : null;
      if (!au || (!au.silenced && au.keywords.includes('SHROUD'))) return false;
    }

    spendFood(p, card.cost, 'TACTIC');
    p.hand.splice(handIdx, 1);
    G.actedThisTurn = true;
    Sound.playTactic();
    pushAnim(G, {
      kind: 'tactic',
      owner: pIdx,
      ownerName: p.name,
      targetSlot,
      card: { id: card.id, name: card.name, faction: card.faction, cost: card.cost, icon: card.icon, text: card.text, flavor: card.flavor || '', target: card.target }
    });
    addLog(G, `${p.name} 消耗 ${card.cost} 糧草打出謀略【${card.name}】！`);

    // 張紘【文采】：每當我方打出謀略牌時，張紘獲得 +1/+1
    for (let s = 0; s < BOARD_SIZE; s++) {
      const u = p.board[s];
      if (u && u.id === 'wu_zhanghong' && !u.silenced) {
        pushSkillAnim(G, pIdx, u, '文采', '感應謀略，獲得 +1/+1！', 'buff');
        buffUnitStats(G, pIdx, s, 1, 1, '【張紘·文采】');
      }
    }

    switch (card.id) {
      case 'rapid_march':
        p.tempFood += 1;
        pushVfx(G, `hero-${pIdx}`, '+1 臨時糧草', 'text-amber-300');
        break;
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
            applyEffect(G, pIdx, s, { type: 'armor_buff', val: 2, turns: 2, label: '+2甲' });
            pushVfx(G, `unit-${pIdx}-${s}`, '+2🛡️', 'text-sky-300');
          }
        }
        drawCard(G, pIdx, '空城計');
        break;
      case 'shu_beifa': {
        const res = dealDamageToUnit(G, enemyIdx, targetSlot, 4, '【出師北伐】');
        cleanupDeadUnits(G);
        if (res.killed) drawCard(G, pIdx, '出師北伐擊殺獎勵');
        break;
      }
      case 'wei_xietianzi':
        dealDamageToHero(G, pIdx, 1, '【挾天子令諸侯】');
        drawCard(G, pIdx, '挾天子令諸侯');
        drawCard(G, pIdx, '挾天子令諸侯');
        break;
      case 'wei_duanliang': {
        const stolen = Math.min(2, enemy.reserveFood);
        if (stolen > 0) {
          enemy.reserveFood -= stolen;
          p.tempFood += stolen;
          pushVfx(G, `hero-${pIdx}`, `+${stolen} 臨糧`, 'text-amber-300');
          addLog(G, `【斷糧奇兵】從 ${enemy.name} 糧倉掠奪了 ${stolen} 點糧草！`);
        }
        let bestSlot = -1, bestAtk = -1;
        for (let s = 0; s < BOARD_SIZE; s++) {
          const eu = enemy.board[s];
          if (eu && getUnitAtk(eu, G) > bestAtk) { bestAtk = getUnitAtk(eu, G); bestSlot = s; }
        }
        if (bestSlot !== -1) {
          applyEffect(G, enemyIdx, bestSlot, { type: 'atk_buff', val: -1, turns: 2, label: '-1攻' });
        }
        break;
      }
      case 'wei_quhu': {
        dealDamageToUnit(G, enemyIdx, targetSlot, 3, '【驅虎吞狼】');
        const eu = enemy.board[targetSlot];
        if (eu && eu.hp > 0) applyEffect(G, enemyIdx, targetSlot, { type: 'atk_buff', val: -1, turns: 2, label: '-1攻' });
        break;
      }
      case 'wei_guandu':
        // v3.0 史實重做：敵方糧草上限 -1（最低 1），己方本回合 +2 臨時糧草
        enemy.maxFood = Math.max(1, enemy.maxFood - 1);
        p.tempFood += 2;
        pushVfx(G, `hero-${enemyIdx}`, '-1 糧草上限', 'text-rose-400');
        pushVfx(G, `hero-${pIdx}`, '+2 臨時糧草', 'text-amber-300');
        addLog(G, `🔥【奇襲烏巢】焚毀敵軍輜重！${enemy.name} 糧草上限 -1（目前 ${enemy.maxFood}），${p.name} 獲得 +2 臨時糧草！`);
        break;
      case 'wu_shensu': {
        const au = p.board[targetSlot];
        if (au) {
          au.isPrep = false;
          if (targetSlot !== 2) {
            applyEffect(G, pIdx, targetSlot, { type: 'atk_buff', val: 1, turns: 1, label: '+1攻' });
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
          if (p.board[s]) applyEffect(G, pIdx, s, { type: 'atk_buff', val: 1, turns: 2, label: '+1攻' });
        }
        break;
      case 'qun_manli':
        dealDamageToUnit(G, enemyIdx, targetSlot, 3, '【鐵騎突襲】');
        break;
      case 'qun_wushuang': {
        const au = p.board[targetSlot];
        if (au) {
          applyEffect(G, pIdx, targetSlot, { type: 'atk_buff', val: 3, turns: 1, label: '+3攻' });
          applyEffect(G, pIdx, targetSlot, { type: 'armor_buff', val: 1, turns: 1, label: '+1甲' });
          pushVfx(G, `unit-${pIdx}-${targetSlot}`, '+3攻 +1🛡️', 'text-amber-300');
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
        drawCard(G, pIdx, '屯田積糧');
        healHero(G, pIdx, 2, '【屯田積糧】');
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
          applyEffect(G, pIdx, dest, { type: 'armor_buff', val: 2, turns: 1, label: '+2甲' });
          applyEffect(G, pIdx, dest, { type: 'guard_buff', val: 1, turns: 1, label: '護衛' });
          pushVfx(G, `unit-${pIdx}-${dest}`, '+2🛡️ 護衛', 'text-sky-300');
          addLog(G, `【移形換位】將【${moving.name}】調至 ${SLOT_NAMES[dest]}，獲得 +2 臨時護甲與護衛！`);
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
      case 'neu_jianyu':
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (enemy.board[s]) dealDamageToUnit(G, enemyIdx, s, 1, '【萬箭齊發】');
        }
        drawCard(G, pIdx, '萬箭齊發');
        break;
    }

    p.graveyard.push(card);
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
      let dmg = getUnitAtk(attacker, G);
      // 姜維【九伐】：攻擊國力時，若敵方國力 ≤ 15，額外造成 2 點傷害
      if (attacker.id === 'shu_jiangwei' && !attacker.silenced && enemy.hp <= 15) {
        dmg += 2;
        pushSkillAnim(G, pIdx, attacker, '九伐', '敵方國力 ≤ 15，額外造成 2 點傷害！', 'slash');
      }
      // 鄧艾【急襲】：無視敵陣直擊國力
      if (attacker.id === 'wei_dengai' && !attacker.silenced && enemy.board.some(u => u !== null)) {
        pushSkillAnim(G, pIdx, attacker, '急襲', '偷渡陰平，無視敵陣直擊國力！', 'slash');
      }
      attacker.attacksUsed += 1;
      G.actedThisTurn = true;
      Sound.playAttack();
      pushAnim(G, { kind: 'attack', attackerOwner: pIdx, attackerSlot, targetType: 'HERO', targetOwner: enemyIdx, targetSlot: null, slashDir: attacker.attacksUsed });
      dealDamageToHero(G, enemyIdx, dmg, `【${attacker.name}】直擊`);
      checkVictory(G);
      return true;
    }

    if (targetType === 'UNIT') {
      if (!valid.slots.includes(targetSlot)) return false;
      const defender = enemy.board[targetSlot];
      if (!defender) return false;

      // 樂進【先登】：每次主動攻擊敵方武將時，本回合 +1 攻
      if (attacker.id === 'wei_yuejin' && !attacker.silenced) {
        applyEffect(G, pIdx, attackerSlot, { type: 'atk_buff', val: 1, turns: 1, label: '+1攻' });
        pushSkillAnim(G, pIdx, attacker, '先登', '主動出擊，本回合 +1 攻擊力！', 'buff');
      }

      let atkDmg = getUnitAtk(attacker, G);
      const defDmg = getUnitAtk(defender, G);
      const hasPierce = !attacker.silenced && attacker.keywords.includes('PIERCE');

      // 張遼【威震】：敵方武將攻擊張遼時，攻擊力 -1（最低為 0）
      if (defender.id === 'wei_zhangliao' && !defender.silenced) {
        atkDmg = Math.max(0, atkDmg - 1);
        pushSkillAnim(G, enemyIdx, defender, '威震', '震懾來犯敵將，本次攻擊力 -1！', 'shield');
        addLog(G, `⚡【張遼·威震】使【${attacker.name}】本次攻擊力 -1（變為 ${atkDmg}）！`);
      }

      // 王平【無當】：受到攻擊力 ≤ 3 的武將攻擊時，傷害 -1
      if (defender.id === 'shu_wangping' && !defender.silenced && atkDmg <= 3) {
        atkDmg = Math.max(0, atkDmg - 1);
        pushSkillAnim(G, enemyIdx, defender, '無當', '無當飛軍堅守，抵消 1 點傷害！', 'shield');
      }

      // 馬騰【鐵騎】：攻擊護衛武將時，傷害 +2
      if (attacker.id === 'qun_mateng' && !attacker.silenced && unitHasGuard(defender)) {
        atkDmg += 2;
        pushSkillAnim(G, pIdx, attacker, '鐵騎', '衝破護衛陣線，傷害 +2！', 'slash');
      }

      attacker.attacksUsed += 1;
      G.actedThisTurn = true;
      Sound.playAttack();
      addLog(G, `⚔️ ${p.name} 的【${attacker.name}】攻擊 ${enemy.name} 的【${defender.name}】！`);
      pushAnim(G, { kind: 'attack', attackerOwner: pIdx, attackerSlot, targetType: 'UNIT', targetOwner: enemyIdx, targetSlot, pierce: hasPierce, slashDir: attacker.attacksUsed });

      // 張任【伏擊】：防守時若攻擊力 ≥ 攻擊者生命值，直接反殺且不受傷害
      if (defender.id === 'qun_zhangren' && !defender.silenced && defDmg >= attacker.hp) {
        pushSkillAnim(G, enemyIdx, defender, '伏擊', '先發制人！反殺來敵且自身不受傷害！', 'slash');
        addLog(G, `🏹【張任·伏擊】反殺【${attacker.name}】且自身不受傷害！`);
        const defRes = dealDamageToUnit(G, pIdx, attackerSlot, defDmg, `【${defender.name}·伏擊】`, { ignoreArmor: true });
        cleanupDeadUnits(G);
        if (defRes.killed) triggerKillBonus(G, defender, enemyIdx);
        cleanupDeadUnits(G);
        checkVictory(G);
        return true;
      }

      const atkRes = dealDamageToUnit(G, enemyIdx, targetSlot, atkDmg, `【${attacker.name}】攻擊`, { ignoreArmor: hasPierce });
      const defRes = defDmg > 0
        ? dealDamageToUnit(G, pIdx, attackerSlot, defDmg, `【${defender.name}】反擊`)
        : { killed: false };

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

    // v3.0: If hand exceeds dynamic hand limit, prompt player to choose discards before finishing turn
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
      const space = MAX_RESERVE_FOOD - p.reserveFood;
      const stored = Math.min(space, p.food);
      if (stored > 0) {
        p.reserveFood += stored;
        addLog(G, `【屯糧】${p.name} 將剩餘 ${stored} 點糧草存入糧倉（目前 ${p.reserveFood}/${MAX_RESERVE_FOOD}）。`);
      }
      p.food = 0;
    }

    for (let s = 0; s < BOARD_SIZE; s++) {
      const u = p.board[s];
      if (!u || u.silenced) continue;
      if (u.id === 'wu_luxun') {
        pushSkillAnim(G, pIdx, u, '連營', '對敵全體造成 1 傷（已灼燒者額外 +1 傷）！', 'burn');
        for (let k = 0; k < BOARD_SIZE; k++) {
          const eu = enemy.board[k];
          if (eu) {
            const hasBurn = eu.effects.some(e => e.type === 'burn');
            dealDamageToUnit(G, enemyIdx, k, hasBurn ? 2 : 1, '【陸遜·連營】');
          }
        }
      } else if (u.id === 'qun_diaochan') {
        healHero(G, pIdx, 2, '【貂蟬·閉月】');
        if (s > 0 && p.board[s - 1]) healUnit(G, pIdx, s - 1, 1, '【貂蟬·閉月】');
        if (s < BOARD_SIZE - 1 && p.board[s + 1]) healUnit(G, pIdx, s + 1, 1, '【貂蟬·閉月】');
      } else if (u.id === 'qun_yuanshu') {
        if (p.hand.length > 0) {
          pushSkillAnim(G, pIdx, u, '眾叛', '回合結束隨機棄置 1 張手牌！', 'skill');
          discardRandomCard(G, pIdx, '【袁術·眾叛】');
        }
      }
    }

    for (let s = 0; s < BOARD_SIZE; s++) {
      const u = p.board[s];
      if (!u) continue;
      const remaining = [];
      for (const eff of u.effects) {
        if (eff.type === 'burn' || eff.type === 'poison') {
          pushAnim(G, { kind: 'fx', fxType: eff.type, owner: pIdx, slot: s });
          dealDamageToUnit(G, pIdx, s, eff.val, `【${eff.label}持續】`);
        }
        eff.turns -= 1;
        if (eff.turns > 0) {
          remaining.push(eff);
        } else if (eff.type === 'armor_buff') {
          u.armor = Math.max(0, u.armor - eff.val);
        }
      }
      u.effects = remaining;
    }

    cleanupDeadUnits(G);
    if (checkVictory(G)) return;

    Sound.playTurn();
    startTurn(G, enemyIdx);
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
      Sound.playVictory();
      return true;
    }
    if (p1.hp <= 0) {
      G.phase = 'GAMEOVER';
      G.winner = 0;
      G.winReason = `${p1.name} 國力降至 ${p1.hp}，${p0.name} 獲得勝利！`;
      addLog(G, `🏆 ${G.winReason}`);
      Sound.playVictory();
      return true;
    }
    if (p0.hp <= 0) {
      G.phase = 'GAMEOVER';
      G.winner = 1;
      G.winReason = `${p0.name} 國力降至 ${p0.hp}，${p1.name} 獲得勝利！`;
      addLog(G, `🏆 ${G.winReason}`);
      Sound.playVictory();
      return true;
    }

    if (p0.deck.length === 0 && p1.deck.length === 0) {
      const bothNoBoardAndNoPlayable =
        p0.board.every(u => u === null) &&
        p1.board.every(u => u === null) &&
        !p0.hand.some(c => c.cost <= MAX_FOOD_CAP) &&
        !p1.hand.some(c => c.cost <= MAX_FOOD_CAP);

      if (bothNoBoardAndNoPlayable || G.consecutiveNoActionEmptyDeckTurns >= 2) {
        G.phase = 'GAMEOVER';
        if (p0.hp > p1.hp) {
          G.winner = 0;
          G.winReason = `雙方牌庫耗盡且無法行動，${p0.name} 以較高國力（${p0.hp} vs ${p1.hp}）獲勝！`;
        } else if (p1.hp > p0.hp) {
          G.winner = 1;
          G.winReason = `雙方牌庫耗盡且無法行動，${p1.name} 以較高國力（${p1.hp} vs ${p0.hp}）獲勝！`;
        } else {
          G.winner = 'DRAW';
          G.winReason = `雙方牌庫耗盡且無法行動，國力相同（${p0.hp} vs ${p1.hp}），平局！`;
        }
        addLog(G, `🏆 ${G.winReason}`);
        Sound.playVictory();
        return true;
      }
    }
    return false;
  }

  Object.assign(global.Sanguo, {
    isWanshaActive,
    getUnitAtk,
    getUnitMaxAttacks,
    unitHasGuard,
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