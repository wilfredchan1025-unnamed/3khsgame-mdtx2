(function (global) {
  'use strict';

  const {
    FACTIONS, BOARD_SIZE, SLOT_NAMES, MAX_HAND_SIZE, MAX_FOOD_CAP, MAX_RESERVE_FOOD, INITIAL_HP,
    isCountering, CARD_DB, getDeckForFaction, Sound
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
      text: def.text,
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
      summonedThisTurn: Boolean(card.keywords.includes('RUSH')),
      attacksUsed: 0,
      effects: []
    };
  }

  function getUnitAtk(unit) {
    let total = unit.atk;
    for (const eff of unit.effects) {
      if (eff.type === 'atk_buff') total += eff.val;
    }
    return Math.max(0, total);
  }

  function getUnitMaxAttacks(unit) {
    return unit.keywords.includes('COMBO') ? 2 : 1;
  }

  function unitHasGuard(unit) {
    if (!unit) return false;
    return unit.keywords.includes('GUARD') || unit.effects.some(e => e.type === 'guard_buff');
  }

  function isProtectedByAdjacentGuard(board, slotIdx) {
    const unit = board[slotIdx];
    if (!unit || unitHasGuard(unit)) return false;
    const left = slotIdx > 0 ? board[slotIdx - 1] : null;
    const right = slotIdx < BOARD_SIZE - 1 ? board[slotIdx + 1] : null;
    return Boolean((left && unitHasGuard(left)) || (right && unitHasGuard(right)));
  }

  function canUnitAttack(unit) {
    return Boolean(unit && !unit.isPrep && unit.attacksUsed < getUnitMaxAttacks(unit) && getUnitAtk(unit) > 0);
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
        `【開局】${players[firstPlayer].name}（${FACTIONS[players[firstPlayer].faction].title}）取得先手（初始 3 張手牌）；${players[secondPlayer].name}（${FACTIONS[players[secondPlayer].faction].title}）為後手（初始 4 張手牌）。`
      ],
      consecutiveNoActionEmptyDeckTurns: 0,
      actedThisTurn: false,
      vfxEvents: [],
      animEvents: []
    };
  }

  function addLog(G, msg) {
    G.log.push(msg);
    if (G.log.length > 200) G.log.shift();
  }

  function pushVfx(G, targetKey, text, colorClass) {
    G.vfxEvents.push({ targetKey, text, colorClass, id: nextUid++ });
  }

  function pushAnim(G, evt) {
    G.animEvents.push(Object.assign({ id: nextUid++ }, evt));
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

  function drawCard(G, pIdx, reason = '') {
    const p = G.players[pIdx];
    if (p.deck.length === 0) {
      addLog(G, `${p.name} 試圖抽牌${reason ? '（' + reason + '）' : ''}，但牌庫已耗盡！`);
      return null;
    }
    const card = p.deck.pop();
    if (p.hand.length >= MAX_HAND_SIZE) {
      p.graveyard.push(card);
      addLog(G, `【爆牌】${p.name} 手牌已達上限（${MAX_HAND_SIZE} 張），抽到的【${card.name}】直接進入墓地！`);
      return null;
    }
    p.hand.push(card);
    addLog(G, `${p.name} 抽了 1 張牌${reason ? '（' + reason + '）' : ''}。`);
    return card;
  }

  function addCardToHand(G, pIdx, cardInstance) {
    const p = G.players[pIdx];
    if (p.hand.length >= MAX_HAND_SIZE) {
      p.graveyard.push(cardInstance);
      addLog(G, `【爆牌】${p.name} 手牌已滿，獲得的【${cardInstance.name}】直接進入墓地！`);
      return false;
    }
    p.hand.push(cardInstance);
    return true;
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
    const p = G.players[pIdx];
    p.turnsTaken += 1;

    p.maxFood = Math.min(MAX_FOOD_CAP, p.maxFood + 1);
    p.food = p.maxFood;
    p.tempFood = 0;

    for (let s = 0; s < BOARD_SIZE; s++) {
      const u = p.board[s];
      if (!u) continue;
      u.isPrep = false;
      u.summonedThisTurn = false;
      u.attacksUsed = 0;
      let bonusArmor = 0;
      for (const eff of u.effects) {
        if (eff.type === 'armor_buff') bonusArmor += eff.val;
      }
      u.armor = u.baseArmor + bonusArmor;
    }

    const roundNum = Math.ceil(G.turnNumber / 2);
    addLog(G, `——— 第 ${roundNum} 大回合｜${p.name} 回合開始（糧草 ${p.food}/${p.maxFood}｜糧倉 ${p.reserveFood}/${MAX_RESERVE_FOOD}） ———`);

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
    if (!canUnitAttack(attacker)) return { slots: [], canHitHero: false };

    const enemyIdx = 1 - attackerOwner;
    const enemy = G.players[enemyIdx];
    const hasSnipe = attacker.keywords.includes('SNIPE');
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
      return { slots: targetableSlots.length > 0 ? targetableSlots : aliveSlots, canHitHero: false };
    }
    if (attacker.summonedThisTurn) {
      return { slots: [], canHitHero: false };
    }
    return { slots: [], canHitHero: true };
  }

  function getValidTacticTargets(G, ownerIdx, card) {
    const enemyIdx = 1 - ownerIdx;
    if (card.target === 'enemy_general') {
      const slots = [];
      for (let s = 0; s < BOARD_SIZE; s++) {
        if (G.players[enemyIdx].board[s]) slots.push(s);
      }
      return { type: 'enemy_general', slots };
    }
    if (card.target === 'ally_general') {
      const slots = [];
      for (let s = 0; s < BOARD_SIZE; s++) {
        if (G.players[ownerIdx].board[s]) slots.push(s);
      }
      return { type: 'ally_general', slots };
    }
    return { type: 'none', slots: [] };
  }

  function canPlayCard(G, pIdx, card) {
    if (G.phase !== 'MAIN' || G.activePlayer !== pIdx) return false;
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

  function dealDamageToUnit(G, targetOwner, targetSlot, baseDmg, sourceFaction = null, sourceLabel = '') {
    const unit = G.players[targetOwner].board[targetSlot];
    if (!unit || baseDmg <= 0) return { actualHpLoss: 0, killed: false, totalDmg: 0, countered: false };

    const countered = Boolean(sourceFaction && isCountering(sourceFaction, unit.faction));
    const totalDmg = baseDmg + (countered ? 1 : 0);
    const blocked = Math.min(unit.armor, totalDmg);
    unit.armor -= blocked;
    const hpLoss = totalDmg - blocked;
    unit.hp -= hpLoss;

    const key = `unit-${targetOwner}-${targetSlot}`;
    if (blocked > 0 && hpLoss === 0) {
      pushVfx(G, key, `🛡️格擋 ${blocked}`, 'text-sky-300');
    } else if (blocked > 0) {
      pushVfx(G, key, `-${hpLoss} (🛡️-${blocked})`, 'text-rose-400');
    } else {
      pushVfx(G, key, `-${hpLoss}${countered ? ' 克制!' : ''}`, countered ? 'text-amber-300' : 'text-rose-400');
    }

    const counterNote = countered ? `（陣營克制 +1）` : '';
    const armorNote = blocked > 0 ? `，護甲抵擋 ${blocked}` : '';
    addLog(G, `${sourceLabel}對 ${G.players[targetOwner].name} 的【${unit.name}】造成 ${totalDmg} 點傷害${counterNote}${armorNote}（剩餘生命 ${Math.max(0, unit.hp)}）。`);

    return { actualHpLoss: hpLoss, killed: unit.hp <= 0, totalDmg, countered };
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
      addLog(G, `${sourceLabel}使【${u.name}】回復 ${healed} 點生命。`);
    }
  }

  function triggerDeathrattle(G, unit, ownerIdx) {
    if (!unit || !unit.keywords.includes('DEATHRATTLE')) return;
    const enemyIdx = 1 - ownerIdx;
    const enemy = G.players[enemyIdx];
    addLog(G, `🕯️ 觸發【${unit.name}】遺計效果！`);
    switch (unit.id) {
      case 'wei_guojia':
        drawCard(G, ownerIdx, '郭嘉·遺計');
        drawCard(G, ownerIdx, '郭嘉·遺計');
        addReserveFood(G, ownerIdx, 1, '【郭嘉·遺計】');
        break;
      case 'qun_zhangjiao':
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (enemy.board[s]) {
            dealDamageToUnit(G, enemyIdx, s, 1, unit.faction, '【張角·遺計】');
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
    if (!killer || !killer.keywords.includes('KILL')) return;
    const enemyIdx = 1 - killerOwner;
    pushAnim(G, { kind: 'kill_bonus', owner: killerOwner, slot: killer.slot, name: killer.name });
    addLog(G, `⚡ 觸發【${killer.name}】斬殺效果！`);
    Sound.playKill();
    switch (killer.id) {
      case 'shu_weiyan':
        healHero(G, killerOwner, 2, '【魏延·斬殺】');
        break;
      case 'shu_guanyu':
        drawCard(G, killerOwner, '關羽·斬殺');
        dealDamageToHero(G, enemyIdx, 2, '【關羽·斬殺】');
        break;
      case 'wei_xiahoudun':
        if (killer.hp > 0) healUnit(G, killerOwner, killer.slot, 2, '【夏侯惇·斬殺】');
        break;
      case 'wu_ganning':
        dealDamageToHero(G, enemyIdx, 3, '【甘寧·斬殺】');
        break;
      case 'wu_sunce':
        if (killer.hp > 0) {
          killer.atk += 1;
          killer.maxHp += 1;
          killer.hp += 1;
          pushVfx(G, `unit-${killerOwner}-${killer.slot}`, '+1/+1', 'text-amber-300');
          addLog(G, `【孫策·斬殺】自身獲得 +1/+1！`);
        }
        break;
      case 'qun_huaxiong':
        if (killer.hp > 0) {
          killer.atk += 2;
          killer.maxHp += 1;
          killer.hp += 1;
          pushVfx(G, `unit-${killerOwner}-${killer.slot}`, '+2/+1', 'text-amber-300');
          addLog(G, `【華雄·斬殺】自身獲得 +2/+1！`);
        }
        break;
      case 'qun_lubu':
        dealDamageToHero(G, enemyIdx, 3, '【呂布·斬殺】');
        break;
    }
  }

  function triggerOnPlay(G, ownerIdx, slotIdx, unit) {
    const enemyIdx = 1 - ownerIdx;
    const p = G.players[ownerIdx];
    const enemy = G.players[enemyIdx];

    switch (unit.id) {
      case 'shu_liaohua': {
        const hasAdj = (slotIdx > 0 && p.board[slotIdx - 1]) || (slotIdx < BOARD_SIZE - 1 && p.board[slotIdx + 1]);
        if (hasAdj) {
          unit.atk += 1;
          pushVfx(G, `unit-${ownerIdx}-${slotIdx}`, '+1攻', 'text-emerald-300');
          addLog(G, `【廖化·登場】相鄰格已有友軍，自身獲得 +1 攻擊力！`);
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
          if (getUnitAtk(eu) > bestAtk) { bestAtk = getUnitAtk(eu); bestAtkSlot = s; }
        }
        if (bestGuard !== -1) {
          dealDamageToUnit(G, enemyIdx, bestGuard, 3, unit.faction, '【張飛·破盾咆哮】');
        } else if (bestAtkSlot !== -1) {
          dealDamageToUnit(G, enemyIdx, bestAtkSlot, 2, unit.faction, '【張飛·登場】');
        }
        break;
      }
      case 'shu_machao':
        unit.effects.push({ type: 'atk_buff', val: 1, turns: 2, label: '+1攻' });
        addLog(G, `【馬超·登場】獲得 +1 攻擊力（持續 2 回合）。`);
        break;
      case 'shu_zhugeliang':
        drawCard(G, ownerIdx, '諸葛亮·登場');
        drawCard(G, ownerIdx, '諸葛亮·登場');
        break;
      case 'wei_xuhuang': {
        let bestSlot = -1, bestAtk = -1;
        for (let s = 0; s < BOARD_SIZE; s++) {
          const eu = enemy.board[s];
          if (eu && getUnitAtk(eu) > bestAtk) { bestAtk = getUnitAtk(eu); bestSlot = s; }
        }
        if (bestSlot !== -1) {
          enemy.board[bestSlot].effects.push({ type: 'atk_buff', val: -1, turns: 2, label: '-1攻' });
          addLog(G, `【徐晃·登場】使敵方【${enemy.board[bestSlot].name}】攻擊力 -1（持續 2 回合）。`);
        }
        break;
      }
      case 'wei_dianwei':
        healHero(G, ownerIdx, 2, '【典韋·登場】');
        break;
      case 'wei_simayi':
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (enemy.board[s]) {
            dealDamageToUnit(G, enemyIdx, s, 1, unit.faction, '【司馬懿·登場】');
            if (enemy.board[s].hp > 0) {
              enemy.board[s].effects.push({ type: 'burn', val: 1, turns: 2, label: '灼燒' });
            }
          }
        }
        break;
      case 'wei_caocao':
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (p.board[s]) {
            p.board[s].effects.push({ type: 'atk_buff', val: 2, turns: 1, label: '+2攻' });
          }
        }
        drawCard(G, ownerIdx, '曹操·登場');
        addLog(G, `【曹操·登場】所有友方武將獲得 +2 攻擊力（持續 1 回合）！`);
        break;
      case 'wu_huanggai':
        dealDamageToHero(G, ownerIdx, 2, '【黃蓋·苦肉】');
        drawCard(G, ownerIdx, '黃蓋·登場');
        break;
      case 'wu_lumeng': {
        let lowSlot = -1, lowHp = 999;
        for (let s = 0; s < BOARD_SIZE; s++) {
          const eu = enemy.board[s];
          if (eu && eu.hp < lowHp) { lowHp = eu.hp; lowSlot = s; }
        }
        if (lowSlot !== -1) {
          dealDamageToUnit(G, enemyIdx, lowSlot, 2, unit.faction, '【呂蒙·登場】');
        } else {
          dealDamageToHero(G, enemyIdx, 2, '【呂蒙·登場】');
        }
        break;
      }
      case 'wu_zhouyu':
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (enemy.board[s]) {
            dealDamageToUnit(G, enemyIdx, s, 2, unit.faction, '【周瑜·登場】');
            if (enemy.board[s].hp > 0) {
              enemy.board[s].effects.push({ type: 'burn', val: 1, turns: 2, label: '灼燒' });
            }
          }
        }
        break;
      case 'qun_yanliang':
      case 'neu_gongbing':
        dealDamageToHero(G, enemyIdx, 1, `【${unit.name}·登場】`);
        break;
      case 'qun_jiaxu':
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (enemy.board[s]) {
            enemy.board[s].effects.push({ type: 'burn', val: 1, turns: 3, label: '毒計' });
          }
        }
        addLog(G, `【賈詡·登場】對敵方全體武將施加毒計（每回合結束扣 1 血，持續 3 回合）！`);
        break;
      case 'qun_yuanshao':
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (enemy.board[s]) dealDamageToUnit(G, enemyIdx, s, 1, unit.faction, '【袁紹·登場】');
          if (p.board[s]) p.board[s].effects.push({ type: 'atk_buff', val: 1, turns: 2, label: '+1攻' });
        }
        break;
      case 'qun_dongzhuo':
        dealDamageToHero(G, ownerIdx, 2, '【董卓·暴政】');
        break;
      case 'wu_sunquan': {
        const bonus = p.reserveFood;
        if (bonus > 0) {
          for (let s = Math.max(0, slotIdx - 1); s <= Math.min(BOARD_SIZE - 1, slotIdx + 1); s++) {
            const fu = p.board[s];
            if (fu) {
              fu.atk += bonus;
              fu.maxHp += bonus;
              fu.hp += bonus;
              pushVfx(G, `unit-${ownerIdx}-${s}`, `+${bonus}/+${bonus}`, 'text-amber-300');
            }
          }
          addLog(G, `【孫權·登場】依糧倉 ${bonus} 點糧草，自身與相鄰友軍獲得 +${bonus}/+${bonus}！`);
        }
        break;
      }
      case 'qun_zhangjiao': {
        const emptySlot = p.board.findIndex(u => u === null);
        if (emptySlot !== -1) {
          const tokenCard = createCardInstance('qun_yellow_turban');
          const tokenUnit = createUnitFromCard(tokenCard, ownerIdx, emptySlot);
          p.board[emptySlot] = tokenUnit;
          addLog(G, `【張角·登場】於 ${SLOT_NAMES[emptySlot]} 召喚了 1 名【黃巾力士】！`);
        }
        break;
      }
      case 'qun_xiliang':
        if (p.reserveFood >= 1) {
          p.reserveFood -= 1;
          unit.atk += 1;
          unit.maxHp += 1;
          unit.hp += 1;
          pushVfx(G, `unit-${ownerIdx}-${slotIdx}`, '+1/+1', 'text-amber-300');
          addLog(G, `【西涼鐵騎·登場】消耗 1 點糧倉，獲得 +1/+1！`);
        }
        break;
      case 'neu_chengong':
        if (p.reserveFood >= 1) {
          p.reserveFood -= 1;
          drawCard(G, ownerIdx, '陳宮·登場');
          addLog(G, `【陳宮·登場】消耗 1 點糧倉並抽 1 張牌。`);
        } else {
          addReserveFood(G, ownerIdx, 1, '【陳宮·登場】');
        }
        break;
    }
    cleanupDeadUnits(G);
    checkVictory(G);
  }

  function playGeneral(G, pIdx, cardUid, slotIdx) {
    const p = G.players[pIdx];
    if (G.phase !== 'MAIN' || G.activePlayer !== pIdx) return false;
    if (slotIdx < 0 || slotIdx >= BOARD_SIZE || p.board[slotIdx] !== null) return false;
    const handIdx = p.hand.findIndex(c => c.uid === cardUid);
    if (handIdx === -1) return false;
    const card = p.hand[handIdx];
    if (card.type !== 'GENERAL' || getTotalFood(p, 'GENERAL') < card.cost) return false;

    spendFood(p, card.cost, 'GENERAL');
    p.hand.splice(handIdx, 1);
    const unit = createUnitFromCard(card, pIdx, slotIdx);
    p.board[slotIdx] = unit;
    G.actedThisTurn = true;
    Sound.playDeploy();

    addLog(G, `${p.name} 消耗 ${card.cost} 糧草，將【${unit.name}】部署於 ${SLOT_NAMES[slotIdx]}（${unit.isPrep ? '進入整備狀態' : '突襲就緒'}）。`);
    triggerOnPlay(G, pIdx, slotIdx, unit);
    return true;
  }

  function playTactic(G, pIdx, cardUid, targetSlot = null) {
    const p = G.players[pIdx];
    const enemyIdx = 1 - pIdx;
    const enemy = G.players[enemyIdx];
    if (G.phase !== 'MAIN' || G.activePlayer !== pIdx) return false;
    const handIdx = p.hand.findIndex(c => c.uid === cardUid);
    if (handIdx === -1) return false;
    const card = p.hand[handIdx];
    if (card.type !== 'TACTIC' || getTotalFood(p, 'TACTIC') < card.cost) return false;

    if (card.target === 'enemy_general') {
      if (targetSlot === null || !enemy.board[targetSlot]) return false;
    } else if (card.target === 'ally_general') {
      if (targetSlot === null || !p.board[targetSlot]) return false;
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
      card: { id: card.id, name: card.name, faction: card.faction, cost: card.cost, icon: card.icon, text: card.text, target: card.target }
    });
    addLog(G, `${p.name} 消耗 ${card.cost} 糧草打出謀略【${card.name}】！`);

    switch (card.id) {
      case 'rapid_march':
        p.tempFood += 1;
        pushVfx(G, `hero-${pIdx}`, '+1 臨時糧草', 'text-amber-300');
        addLog(G, `【急行軍】${p.name} 本回合臨時獲得 1 點糧草。`);
        break;
      case 'shu_taoyuan':
        for (let s = 0; s < BOARD_SIZE; s++) {
          const u = p.board[s];
          if (u) {
            u.atk += 1; u.maxHp += 1; u.hp += 1;
            pushVfx(G, `unit-${pIdx}-${s}`, '+1/+1', 'text-emerald-300');
          }
        }
        break;
      case 'shu_kongcheng':
        for (let s = 0; s < BOARD_SIZE; s++) {
          const u = p.board[s];
          if (u) {
            u.armor += 2;
            u.effects.push({ type: 'armor_buff', val: 2, turns: 2, label: '+2甲' });
            pushVfx(G, `unit-${pIdx}-${s}`, '+2🛡️', 'text-sky-300');
          }
        }
        drawCard(G, pIdx, '空城計');
        break;
      case 'shu_beifa': {
        const res = dealDamageToUnit(G, enemyIdx, targetSlot, 4, null, '【出師北伐】');
        cleanupDeadUnits(G);
        if (res.killed) drawCard(G, pIdx, '出師北伐擊殺獎勵');
        break;
      }
      case 'wei_xietianzi':
        dealDamageToHero(G, pIdx, 1, '【挾天子令諸侯】');
        drawCard(G, pIdx, '挾天子令諸侯');
        drawCard(G, pIdx, '挾天子令諸侯');
        break;
      case 'wei_quhu': {
        dealDamageToUnit(G, enemyIdx, targetSlot, 3, null, '【驅虎吞狼】');
        const eu = enemy.board[targetSlot];
        if (eu && eu.hp > 0) {
          eu.effects.push({ type: 'atk_buff', val: -1, turns: 2, label: '-1攻' });
        }
        break;
      }
      case 'wei_guandu':
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (enemy.board[s]) dealDamageToUnit(G, enemyIdx, s, 1, null, '【奇襲烏巢】');
        }
        healHero(G, pIdx, 2, '【奇襲烏巢】');
        break;
      case 'wu_lianhuan': {
        dealDamageToUnit(G, enemyIdx, targetSlot, 2, null, '【連環計】');
        const eu = enemy.board[targetSlot];
        if (eu && eu.hp > 0) {
          eu.effects.push({ type: 'burn', val: 1, turns: 3, label: '灼燒' });
        }
        drawCard(G, pIdx, '連環計');
        break;
      }
      case 'wu_huogong':
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (enemy.board[s]) {
            dealDamageToUnit(G, enemyIdx, s, 2, null, '【火燒赤壁】');
            if (enemy.board[s] && enemy.board[s].hp > 0) {
              enemy.board[s].effects.push({ type: 'burn', val: 1, turns: 2, label: '灼燒' });
            }
          }
        }
        break;
      case 'wu_jiangdong':
        dealDamageToHero(G, enemyIdx, 3, '【江東水師】');
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (p.board[s]) {
            p.board[s].effects.push({ type: 'atk_buff', val: 1, turns: 2, label: '+1攻' });
          }
        }
        break;
      case 'qun_manli':
        dealDamageToUnit(G, enemyIdx, targetSlot, 3, null, '【鐵騎突襲】');
        break;
      case 'qun_wushuang': {
        const au = p.board[targetSlot];
        if (au) {
          au.armor += 1;
          au.effects.push({ type: 'atk_buff', val: 3, turns: 1, label: '+3攻' });
          au.effects.push({ type: 'armor_buff', val: 1, turns: 1, label: '+1甲' });
          pushVfx(G, `unit-${pIdx}-${targetSlot}`, '+3攻 +1🛡️', 'text-amber-300');
        }
        break;
      }
      case 'qun_huoshao':
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (enemy.board[s]) dealDamageToUnit(G, enemyIdx, s, 2, null, '【焚城掠地】');
        }
        dealDamageToHero(G, enemyIdx, 2, '【焚城掠地】');
        break;
      case 'neu_tuntian':
        drawCard(G, pIdx, '屯田積糧');
        healHero(G, pIdx, 2, '【屯田積糧】');
        break;
      case 'neu_anfuminxin':
        healHero(G, pIdx, 4, '【安撫民心】');
        break;
      case 'neu_guwu': {
        const au = p.board[targetSlot];
        if (au) {
          au.atk += 2; au.maxHp += 2; au.hp += 2;
          pushVfx(G, `unit-${pIdx}-${targetSlot}`, '+2/+2', 'text-emerald-300');
        }
        break;
      }
      case 'neu_pojia': {
        const eu = enemy.board[targetSlot];
        if (eu) {
          if (eu.armor > 0) {
            addLog(G, `【破甲強弩】粉碎了【${eu.name}】的 ${eu.armor} 點護甲！`);
            eu.armor = 0;
          }
          dealDamageToUnit(G, enemyIdx, targetSlot, 2, null, '【破甲強弩】');
        }
        break;
      }
      case 'neu_jianyu':
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (enemy.board[s]) dealDamageToUnit(G, enemyIdx, s, 1, null, '【萬箭齊發】');
        }
        drawCard(G, pIdx, '萬箭齊發');
        break;
      case 'shu_muniuliuma':
        addReserveFood(G, pIdx, 2, '【木牛流馬】');
        drawCard(G, pIdx, '木牛流馬');
        break;
      case 'wei_duanliang': {
        const stolen = Math.min(2, enemy.reserveFood);
        if (stolen > 0) {
          enemy.reserveFood -= stolen;
          p.tempFood += stolen;
          pushVfx(G, `hero-${pIdx}`, `+${stolen} 臨糧`, 'text-amber-300');
          addLog(G, `【斷糧奇兵】從 ${enemy.name} 糧倉掠奪了 ${stolen} 點糧草轉為臨時糧草！`);
        }
        let bestSlot = -1, bestAtk = -1;
        for (let s = 0; s < BOARD_SIZE; s++) {
          const eu = enemy.board[s];
          if (eu && getUnitAtk(eu) > bestAtk) { bestAtk = getUnitAtk(eu); bestSlot = s; }
        }
        if (bestSlot !== -1) {
          enemy.board[bestSlot].effects.push({ type: 'atk_buff', val: -1, turns: 2, label: '-1攻' });
          addLog(G, `【斷糧奇兵】使敵方【${enemy.board[bestSlot].name}】攻擊力 -1（持續 2 回合）。`);
        }
        break;
      }
      case 'wu_shensu': {
        const au = p.board[targetSlot];
        if (au) {
          if (au.isPrep) {
            au.isPrep = false;
            au.summonedThisTurn = true;
          }
          if (targetSlot !== 2) {
            au.effects.push({ type: 'atk_buff', val: 1, turns: 1, label: '+1攻' });
            pushVfx(G, `unit-${pIdx}-${targetSlot}`, '神速 +1攻', 'text-emerald-300');
          } else {
            pushVfx(G, `unit-${pIdx}-${targetSlot}`, '神速就緒', 'text-emerald-300');
          }
          addLog(G, `【兵貴神速】使【${au.name}】解除整備，本回合可攻擊敵方武將！`);
        }
        break;
      }
      case 'neu_huanwei': {
        const moving = p.board[targetSlot];
        if (moving) {
          const dest = targetSlot === 2 ? 1 : 2;
          const other = p.board[dest];
          p.board[dest] = moving;
          p.board[targetSlot] = other;
          moving.slot = dest;
          if (other) other.slot = targetSlot;
          moving.armor += 2;
          moving.effects.push({ type: 'armor_buff', val: 2, turns: 1, label: '+2甲' });
          moving.effects.push({ type: 'guard_buff', val: 1, turns: 1, label: '守護' });
          pushVfx(G, `unit-${pIdx}-${dest}`, '+2🛡️ 守護', 'text-sky-300');
          addLog(G, `【移形換位】將【${moving.name}】調至 ${SLOT_NAMES[dest]}，獲得 +2 臨時護甲與守護！`);
        }
        break;
      }
    }

    p.graveyard.push(card);
    cleanupDeadUnits(G);
    checkVictory(G);
    return true;
  }

  function executeAttack(G, pIdx, attackerSlot, targetType, targetSlot = null) {
    if (G.phase !== 'MAIN' || G.activePlayer !== pIdx) return false;
    const p = G.players[pIdx];
    const enemyIdx = 1 - pIdx;
    const enemy = G.players[enemyIdx];
    const attacker = p.board[attackerSlot];
    if (!canUnitAttack(attacker)) return false;

    const valid = getValidAttackTargets(G, pIdx, attackerSlot);
    if (targetType === 'HERO') {
      if (!valid.canHitHero) return false;
      const dmg = getUnitAtk(attacker);
      attacker.attacksUsed += 1;
      G.actedThisTurn = true;
      Sound.playAttack();
      pushAnim(G, { kind: 'attack', attackerOwner: pIdx, attackerSlot, targetType: 'HERO', targetOwner: enemyIdx, targetSlot: null, countered: false });
      dealDamageToHero(G, enemyIdx, dmg, `【${attacker.name}】直擊`);
      checkVictory(G);
      return true;
    }

    if (targetType === 'UNIT') {
      if (!valid.slots.includes(targetSlot)) return false;
      const defender = enemy.board[targetSlot];
      if (!defender) return false;

      const atkDmg = getUnitAtk(attacker);
      const defDmg = getUnitAtk(defender);

      attacker.attacksUsed += 1;
      G.actedThisTurn = true;
      Sound.playAttack();

      addLog(G, `⚔️ ${p.name} 的【${attacker.name}】攻擊 ${enemy.name} 的【${defender.name}】！`);

      const atkRes = dealDamageToUnit(G, enemyIdx, targetSlot, atkDmg, attacker.faction, `【${attacker.name}】攻擊`);
      pushAnim(G, { kind: 'attack', attackerOwner: pIdx, attackerSlot, targetType: 'UNIT', targetOwner: enemyIdx, targetSlot, countered: Boolean(atkRes.countered) });
      const defRes = defDmg > 0
        ? dealDamageToUnit(G, pIdx, attackerSlot, defDmg, defender.faction, `【${defender.name}】反擊`)
        : { killed: false };

      cleanupDeadUnits(G);

      if (atkRes.killed) {
        triggerKillBonus(G, attacker, pIdx);
      }
      if (defRes.killed) {
        triggerKillBonus(G, defender, enemyIdx);
      }

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
      if (canUnitAttack(p.board[s])) return true;
    }
    return false;
  }

  function endTurn(G) {
    if (G.phase !== 'MAIN') return;
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
      if (!u) continue;
      if (u.id === 'shu_zhugeliang') {
        for (let k = 0; k < BOARD_SIZE; k++) {
          if (p.board[k]) {
            p.board[k].armor += 1;
            p.board[k].effects.push({ type: 'armor_buff', val: 1, turns: 1, label: '+1甲' });
          }
        }
        addLog(G, `【諸葛亮·回合結束】友方全體獲得 +1 臨時護甲。`);
      } else if (u.id === 'wu_luxun') {
        for (let k = 0; k < BOARD_SIZE; k++) {
          if (enemy.board[k]) dealDamageToUnit(G, enemyIdx, k, 1, u.faction, '【陸遜·火計】');
        }
      } else if (u.id === 'qun_diaochan') {
        healHero(G, pIdx, 2, '【貂蟬·回合結束】');
        if (s > 0 && p.board[s - 1]) healUnit(G, pIdx, s - 1, 1, '【貂蟬·回合結束】');
        if (s < BOARD_SIZE - 1 && p.board[s + 1]) healUnit(G, pIdx, s + 1, 1, '【貂蟬·回合結束】');
      } else if (u.id === 'neu_huatuo') {
        healHero(G, pIdx, 2, '【華佗·回合結束】');
        for (let k = 0; k < BOARD_SIZE; k++) {
          if (p.board[k]) healUnit(G, pIdx, k, 1, '【華佗·回合結束】');
        }
      }
    }

    for (let s = 0; s < BOARD_SIZE; s++) {
      const u = p.board[s];
      if (!u) continue;
      const remaining = [];
      for (const eff of u.effects) {
        if (eff.type === 'burn') {
          dealDamageToUnit(G, pIdx, s, eff.val, null, `【${eff.label}持續】`);
        }
        eff.turns -= 1;
        if (eff.turns > 0) {
          remaining.push(eff);
        } else {
          if (eff.type === 'armor_buff') {
            u.armor = Math.max(0, u.armor - eff.val);
          }
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
    getUnitAtk,
    getUnitMaxAttacks,
    unitHasGuard,
    isProtectedByAdjacentGuard,
    canUnitAttack,
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
    executeAttack,
    endTurn
  });

  global.__SANGUO_ENGINE__ = global.Sanguo;
})(window);