(function (global) {
  'use strict';

  const {
    BOARD_SIZE,
    isCountering,
    getUnitAtk,
    canUnitAttack,
    getTotalFood,
    getValidAttackTargets,
    getValidTacticTargets,
    canPlayCard,
    playGeneral,
    playTactic,
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

    const rm = ai.hand.find(c => c.id === 'rapid_march');
    if (rm) {
      const currentFood = getTotalFood(ai, 'GENERAL');
      const unlocks = ai.hand.some(c => c.id !== 'rapid_march' && (c.type === 'TACTIC' ? getTotalFood(ai, 'TACTIC') : currentFood) + 1 === c.cost && (c.type === 'GENERAL' ? ai.board.some(s => s === null) : true));
      if (unlocks) {
        playTactic(G, aiIdx, rm.uid);
        return true;
      }
    }

    for (let s = 0; s < BOARD_SIZE; s++) {
      const u = ai.board[s];
      if (!canUnitAttack(u)) continue;
      const valid = getValidAttackTargets(G, aiIdx, s);
      if (valid.canHitHero) {
        executeAttack(G, aiIdx, s, 'HERO');
        return true;
      }
      if (valid.slots.length > 0) {
        let bestSlot = valid.slots[0], bestScore = -999;
        for (const ts of valid.slots) {
          const def = opp.board[ts];
          const dmg = getUnitAtk(u) + (isCountering(u.faction, def.faction) ? 1 : 0);
          const kills = (dmg - def.armor) >= def.hp;
          const retal = getUnitAtk(def) + (isCountering(def.faction, u.faction) ? 1 : 0);
          const survives = (retal - u.armor) < u.hp;
          const score = (kills ? 30 : 0) + (survives ? 15 : -10) + getUnitAtk(def) * 3 + (isCountering(u.faction, def.faction) ? 6 : 0);
          if (score > bestScore) { bestScore = score; bestSlot = ts; }
        }
        executeAttack(G, aiIdx, s, 'UNIT', bestSlot);
        return true;
      }
    }

    const playable = ai.hand.filter(c => c.id !== 'rapid_march' && canPlayCard(G, aiIdx, c));
    if (playable.length > 0) {
      playable.sort((a, b) => {
        const aScore = a.cost * 10 + (a.type === 'GENERAL' ? 8 : 0);
        const bScore = b.cost * 10 + (b.type === 'GENERAL' ? 8 : 0);
        return bScore - aScore;
      });
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
          const best = t.slots.slice().sort((a, b) => getUnitAtk(opp.board[b]) - getUnitAtk(opp.board[a]))[0];
          playTactic(G, aiIdx, card.uid, best);
          return true;
        } else if (t.type === 'ally_general' && t.slots.length > 0) {
          const best = t.slots.slice().sort((a, b) => getUnitAtk(ai.board[b]) - getUnitAtk(ai.board[a]))[0];
          playTactic(G, aiIdx, card.uid, best);
          return true;
        }
      }
    }

    endTurn(G);
    return false;
  }

  Object.assign(global.Sanguo, {
    aiChooseMulligan,
    runAIStep
  });
})(window);