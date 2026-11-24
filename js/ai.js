(function (global) {
  'use strict';

  const {
    BOARD_SIZE,
    getUnitAtk,
    canUnitAttack,
    canUseActiveSkill,
    getTotalFood,
    getValidAttackTargets,
    getValidTacticTargets,
    canPlayCard,
    playGeneral,
    playTactic,
    activateUnitSkill,
    resolvePendingPrompt,
    executeAttack,
    endTurn
  } = global.Sanguo;

  function aiChooseMulligan(G, pIdx) {
    const p = G.players[pIdx];
    return p.hand.filter(c => c.cost >= 4).map(c => c.uid);
  }

  function runAIStep(G) {
    if (!G || G.phase !== 'MAIN' || !G.players[G.activePlayer].isAI) return false;
    const aiIdx = G.activePlayer;
    const ai = G.players[aiIdx];
    const oppIdx = 1 - aiIdx;
    const opp = G.players[oppIdx];

    // 1. Resolve any pending prompt for AI (choice, target enemy, zhiheng, or over-limit discard)
    if (G.pendingPrompt && G.pendingPrompt.owner === aiIdx) {
      const pr = G.pendingPrompt;
      if (pr.kind === 'DISCARD') {
        const sorted = ai.hand.slice().sort((a, b) => b.cost - a.cost);
        resolvePendingPrompt(G, aiIdx, { selectedUids: sorted.slice(0, pr.count).map(c => c.uid) });
        return true;
      }
      if (pr.kind === 'ZHIHENG') {
        const high = ai.hand.slice().sort((a, b) => b.cost - a.cost);
        resolvePendingPrompt(G, aiIdx, { selectedUids: high.slice(0, 1).map(c => c.uid) });
        return true;
      }
      if (pr.kind === 'TARGET_ENEMY') {
        const slots = [];
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (opp.board[s]) slots.push(s);
        }
        if (slots.length > 0) {
          slots.sort((a, b) => getUnitAtk(opp.board[b], G) - getUnitAtk(opp.board[a], G));
          resolvePendingPrompt(G, aiIdx, { slot: slots[0] });
          return true;
        }
        G.pendingPrompt = null;
        return true;
      }
      if (pr.kind === 'CHOICE') {
        const opt = pr.options[0];
        resolvePendingPrompt(G, aiIdx, { choiceId: opt.id });
        return true;
      }
    }

    // 2. Use rapid_march if it unlocks a card
    const rm = ai.hand.find(c => c.id === 'rapid_march');
    if (rm) {
      const currentFood = getTotalFood(ai, 'GENERAL');
      const unlocks = ai.hand.some(c => c.id !== 'rapid_march' && (c.type === 'TACTIC' ? getTotalFood(ai, 'TACTIC') : currentFood) + 1 === c.cost && (c.type === 'GENERAL' ? ai.board.some(s => s === null) : true));
      if (unlocks) {
        playTactic(G, aiIdx, rm.uid);
        return true;
      }
    }

    // 3. Use beneficial active skills
    for (let s = 0; s < BOARD_SIZE; s++) {
      if (canUseActiveSkill(G, aiIdx, s)) {
        const u = ai.board[s];
        if (u.id === 'wu_huanggai' && ai.hp <= 12) continue;
        if (u.id === 'wei_caoren' && u.atk <= 1) continue;
        if (activateUnitSkill(G, aiIdx, s)) return true;
      }
    }

    // 4. Execute attacks
    for (let s = 0; s < BOARD_SIZE; s++) {
      const u = ai.board[s];
      if (!canUnitAttack(u, G)) continue;
      const valid = getValidAttackTargets(G, aiIdx, s);
      if (valid.canHitHero) {
        executeAttack(G, aiIdx, s, 'HERO');
        return true;
      }
      if (valid.slots.length > 0) {
        let bestSlot = valid.slots[0], bestScore = -999;
        for (const ts of valid.slots) {
          const def = opp.board[ts];
          const dmg = getUnitAtk(u, G);
          const kills = (dmg - def.armor) >= def.hp;
          const retal = getUnitAtk(def, G);
          const survives = (retal - u.armor) < u.hp;
          const score = (kills ? 30 : 0) + (survives ? 15 : -10) + getUnitAtk(def, G) * 3;
          if (score > bestScore) { bestScore = score; bestSlot = ts; }
        }
        executeAttack(G, aiIdx, s, 'UNIT', bestSlot);
        return true;
      }
    }

    // 5. Play cards
    const playable = ai.hand.filter(c => c.id !== 'rapid_march' && canPlayCard(G, aiIdx, c));
    if (playable.length > 0) {
      playable.sort((a, b) => (b.cost * 10 + (b.type === 'GENERAL' ? 8 : 0)) - (a.cost * 10 + (a.type === 'GENERAL' ? 8 : 0)));
      const card = playable[0];
      if (card.type === 'GENERAL') {
        const isGuard = (card.keywords || []).includes('GUARD');
        const slotOrder = isGuard ? [1, 3, 2, 0, 4] : [2, 0, 4, 1, 3];
        const chosenSlot = slotOrder.find(s => ai.board[s] === null);
        if (chosenSlot !== undefined) {
          playGeneral(G, aiIdx, card.uid, chosenSlot);
          return true;
        }
      } else {
        const t = getValidTacticTargets(G, aiIdx, card);
        if (t.type === 'none') {
          playTactic(G, aiIdx, card.uid);
          return true;
        } else if (t.type === 'enemy_general' && t.slots.length > 0) {
          const best = t.slots.slice().sort((a, b) => getUnitAtk(opp.board[b], G) - getUnitAtk(opp.board[a], G))[0];
          playTactic(G, aiIdx, card.uid, best);
          return true;
        } else if (t.type === 'ally_general' && t.slots.length > 0) {
          const best = t.slots.slice().sort((a, b) => getUnitAtk(ai.board[b], G) - getUnitAtk(ai.board[a], G))[0];
          playTactic(G, aiIdx, card.uid, best);
          return true;
        }
      }
    }

    const ended = endTurn(G);
    // If endTurn triggered over-limit DISCARD prompt for AI, keep stepping
    if (!ended && G.pendingPrompt && G.pendingPrompt.owner === aiIdx) {
      return true;
    }
    return false;
  }

  Object.assign(global.Sanguo, {
    aiChooseMulligan,
    runAIStep
  });
})(window);