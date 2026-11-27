(function (global) {
  'use strict';

  const {
    BOARD_SIZE,
    getHandLimit,
    isUnitSilenced,
    getUnitAtk,
    getUnitMaxAttacks,
    unitHasGuard,
    unitHasSnipe,
    isProtectedByAdjacentGuard,
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

  const AI_DIFFICULTIES = {
    easy: {
      id: 'easy',
      name: '初級・新兵',
      desc: '單步決策並帶有隨機失誤，適合新手熟悉規則。',
      mode: 'greedy',
      noise: 14,
      beamWidth: 1,
      maxDepth: 1,
      lookaheadTop: 0
    },
    normal: {
      id: 'normal',
      name: '中級・校尉',
      desc: '完整盤面評分與單步最佳化，懂護衛站位與技能抉擇。',
      mode: 'greedy',
      noise: 1.5,
      beamWidth: 1,
      maxDepth: 1,
      lookaheadTop: 0
    },
    hard: {
      id: 'hard',
      name: '困難・都督',
      desc: '單回合 Beam Search 搜尋最佳出牌與攻擊順序，會算斬殺。',
      mode: 'beam',
      noise: 0.4,
      beamWidth: 6,
      maxDepth: 7,
      lookaheadTop: 0
    },
    master: {
      id: 'master',
      name: '宗師・軍師',
      desc: 'Beam Search 搭配對手下回合反擊預演（不窺視玩家手牌）。',
      mode: 'beam',
      noise: 0,
      beamWidth: 8,
      maxDepth: 8,
      lookaheadTop: 4
    }
  };

  let defaultDifficulty = 'normal';

  function setAIDifficulty(level) {
    if (AI_DIFFICULTIES[level]) defaultDifficulty = level;
  }

  function getAIDifficulty(G, pIdx) {
    const pLevel = G && G.players && G.players[pIdx] && G.players[pIdx].aiDifficulty;
    if (pLevel && AI_DIFFICULTIES[pLevel]) return pLevel;
    if (G && G.aiDifficulty && AI_DIFFICULTIES[G.aiDifficulty]) return G.aiDifficulty;
    return defaultDifficulty;
  }

  function cloneState(G) {
    const copy = typeof structuredClone === 'function'
      ? structuredClone(G)
      : JSON.parse(JSON.stringify(G));
    copy.silent = true;
    return copy;
  }

  function aiChooseMulligan(G, pIdx) {
    const p = G.players[pIdx];
    const diff = getAIDifficulty(G, pIdx);
    const maxKeepCost = diff === 'easy' ? 4 : 3;
    const seen = new Set();
    const toSwap = [];

    for (const c of p.hand) {
      if (c.id === 'rapid_march') continue;
      const tooExpensive = c.cost > maxKeepCost;
      const awkwardTactic = c.type === 'TACTIC' && c.cost >= 3 && diff !== 'easy';
      const duplicateMid = c.cost >= 3 && seen.has(c.id);
      if (tooExpensive || awkwardTactic || duplicateMid) {
        toSwap.push(c.uid);
      } else {
        seen.add(c.id);
      }
    }
    return toSwap;
  }

  function scoreUnit(G, ownerIdx, slotIdx, u) {
    const board = G.players[ownerIdx].board;
    const atk = getUnitAtk(u, G);
    const maxAttacks = getUnitMaxAttacks(u);
    let score = atk * (maxAttacks > 1 ? 4.8 : 3.3);
    score += u.hp * 2.5 + u.armor * 2.2;

    if (!isUnitSilenced(u)) {
      if (unitHasGuard(u)) {
        score += 3.2;
        if (slotIdx > 0 && board[slotIdx - 1] && !unitHasGuard(board[slotIdx - 1])) score += 2.2;
        if (slotIdx < BOARD_SIZE - 1 && board[slotIdx + 1] && !unitHasGuard(board[slotIdx + 1])) score += 2.2;
      }
      if (isProtectedByAdjacentGuard(board, slotIdx)) {
        score += 1.6 + atk * 0.45;
      }
      if (u.keywords.includes('PIERCE')) score += 1.5;
      if (unitHasSnipe(u)) score += 1.8;
      if (u.keywords.includes('SHROUD')) score += 2.0;
      if (u.keywords.includes('KILL')) score += 1.6;
      if (u.keywords.includes('DEATHRATTLE')) score += 2.0;
      if (u.activeSkill && !u.effects.some(e => e.type === 'no_active')) {
        if (!u.activeSkill.maxUses || (u.activeUsesTotal || 0) < u.activeSkill.maxUses) {
          score += 2.2;
        }
      }
      if (u.id === 'wu_zhoutai' && (Number(G.zhoutaiBquUsed[ownerIdx]) || 0) < 2) score += 3.0 * (2 - (Number(G.zhoutaiBquUsed[ownerIdx]) || 0));
      if (u.id === 'wu_lingtong' && !G.lingtongSizhanUsed[ownerIdx]) score += 3.0;
      if (u.id === 'wu_luxun' || u.id === 'qun_diaochan') score += 3.2;
      if (u.id === 'qun_zhangren') score += 2.5;
      if (u.id === 'wu_zhanghong') score += 1.8;
      if (u.id === 'qun_yuanshu') score -= 1.8;
    }

    if (u.frozenNextTurn) score -= 2.5;
    for (const eff of u.effects) {
      if (eff.type === 'burn' || eff.type === 'poison') {
        score -= 1.8 * eff.turns;
      }
    }
    return score;
  }

  function scoreHeroHp(hp) {
    let s = hp * 3.0;
    if (hp <= 20) s -= 3.5;
    if (hp <= 10) s -= 9.0 + (11 - hp) * 1.4;
    return s;
  }

  function evaluateState(G, aiIdx) {
    const oppIdx = 1 - aiIdx;
    if (G.phase === 'GAMEOVER') {
      if (G.winner === aiIdx) return 100000 - G.turnNumber;
      if (G.winner === oppIdx) return -100000 + G.turnNumber;
      return 0;
    }

    const ai = G.players[aiIdx];
    const opp = G.players[oppIdx];
    let score = scoreHeroHp(ai.hp) - scoreHeroHp(opp.hp);

    let aiBoardCount = 0;
    let oppBoardCount = 0;
    for (let s = 0; s < BOARD_SIZE; s++) {
      if (ai.board[s]) {
        score += scoreUnit(G, aiIdx, s, ai.board[s]);
        aiBoardCount += 1;
      }
      if (opp.board[s]) {
        score -= scoreUnit(G, oppIdx, s, opp.board[s]) * 1.06;
        oppBoardCount += 1;
      }
    }

    score += (aiBoardCount - oppBoardCount) * 1.2;

    const aiEffHand = Math.min(ai.hand.length, getHandLimit(ai.hp));
    const oppEffHand = Math.min(opp.hand.length, getHandLimit(opp.hp));
    score += (aiEffHand - oppEffHand) * 3.1;

    score += (ai.reserveFood - opp.reserveFood) * 2.0;
    score += (ai.maxFood - opp.maxFood) * 1.8;
    score += ((opp.nextTurnFoodPenalty || 0) - (ai.nextTurnFoodPenalty || 0)) * 2.5;

    return score;
  }

  function pickCandidateSlotsForGeneral(G, pIdx, card) {
    const board = G.players[pIdx].board;
    const isGuard = (card.keywords || []).includes('GUARD');
    const empty = [];
    for (let s = 0; s < BOARD_SIZE; s++) {
      if (board[s] === null) empty.push(s);
    }
    if (empty.length <= 2) return empty;

    const scored = empty.map(s => {
      const left = s > 0 ? board[s - 1] : null;
      const right = s < BOARD_SIZE - 1 ? board[s + 1] : null;
      let val = 0;
      if (isGuard) {
        if (left && !unitHasGuard(left)) val += 5 + getUnitAtk(left, G);
        if (right && !unitHasGuard(right)) val += 5 + getUnitAtk(right, G);
        if (s === 1 || s === 3) val += 1.5;
      } else {
        if (left && unitHasGuard(left)) val += 7;
        if (right && unitHasGuard(right)) val += 7;
        if (card.id === 'shu_liaohua' && (left || right)) val += 6;
        if (s === 1 || s === 3) val += 0.8;
        if (s === 2) val += 1;
      }
      return { s, val };
    });

    scored.sort((a, b) => b.val - a.val);
    return scored.slice(0, 3).map(x => x.s);
  }

  function rankHandForDiscard(G, pIdx) {
    const p = G.players[pIdx];
    const foodNow = Math.max(p.maxFood, getTotalFood(p, 'GENERAL'));
    return p.hand.slice().sort((a, b) => {
      const scoreCard = c => {
        if (c.id === 'rapid_march') return 15;
        let v = 10 - Math.max(0, c.cost - foodNow) * 4;
        if (c.type === 'GENERAL') v += 2;
        if (c.cost <= foodNow) v += c.cost * 1.2;
        return v;
      };
      return scoreCard(a) - scoreCard(b);
    });
  }

  function generateLegalActions(G, pIdx) {
    const actions = [];
    const p = G.players[pIdx];
    const opp = G.players[1 - pIdx];

    if (G.pendingPrompt && G.pendingPrompt.owner === pIdx) {
      const pr = G.pendingPrompt;
      if (pr.kind === 'REVEAL_ENEMY_HAND') {
        actions.push({ kind: 'PROMPT', payload: {} });
        return actions;
      }
      if (pr.kind === 'PICK_ENEMY_HAND') {
        // 優先挑選敵方下回合最可能打出的高威脅牌
        const oppNextFood = Math.min(8, opp.maxFood + 1);
        const candidates = opp.hand.slice().sort((a, b) => {
          const scoreA = (a.cost <= oppNextFood ? 20 : 0) + a.cost * 2 + (a.type === 'GENERAL' ? 2 : 1);
          const scoreB = (b.cost <= oppNextFood ? 20 : 0) + b.cost * 2 + (b.type === 'GENERAL' ? 2 : 1);
          return scoreB - scoreA;
        });
        for (const c of candidates.slice(0, 3)) {
          actions.push({ kind: 'PROMPT', payload: { cardUid: c.uid } });
        }
        return actions;
      }
      if (pr.kind === 'CHOICE') {
        for (const opt of pr.options) {
          actions.push({ kind: 'PROMPT', payload: { choiceId: opt.id } });
        }
        return actions;
      }
      if (pr.kind === 'TARGET_ENEMY') {
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (opp.board[s]) actions.push({ kind: 'PROMPT', payload: { slot: s } });
        }
        return actions;
      }
      if (pr.kind === 'TARGET_ALLY') {
        for (let s = 0; s < BOARD_SIZE; s++) {
          if (p.board[s]) actions.push({ kind: 'PROMPT', payload: { slot: s } });
        }
        return actions;
      }
      if (pr.kind === 'GUYONG_DISCARD') {
        const ranked = rankHandForDiscard(G, pIdx);
        for (const c of ranked.slice(0, 3)) {
          actions.push({ kind: 'PROMPT', payload: { cardUid: c.uid } });
        }
        return actions;
      }
      if (pr.kind === 'DISCARD') {
        const ranked = rankHandForDiscard(G, pIdx);
        actions.push({
          kind: 'PROMPT',
          payload: { selectedUids: ranked.slice(0, pr.count).map(c => c.uid) }
        });
        const byCostDesc = p.hand.slice().sort((a, b) => b.cost - a.cost);
        const altUids = byCostDesc.slice(0, pr.count).map(c => c.uid);
        if (altUids.join(',') !== actions[0].payload.selectedUids.join(',')) {
          actions.push({ kind: 'PROMPT', payload: { selectedUids: altUids } });
        }
        return actions;
      }
      if (pr.kind === 'ZHIHENG') {
        const ranked = rankHandForDiscard(G, pIdx);
        actions.push({ kind: 'PROMPT', payload: { selectedUids: [] } });
        if (ranked.length >= 1) {
          actions.push({ kind: 'PROMPT', payload: { selectedUids: [ranked[0].uid] } });
        }
        if (ranked.length >= 2) {
          actions.push({ kind: 'PROMPT', payload: { selectedUids: ranked.slice(0, 2).map(c => c.uid) } });
        }
        if (ranked.length >= 3) {
          actions.push({ kind: 'PROMPT', payload: { selectedUids: ranked.slice(0, 3).map(c => c.uid) } });
        }
        return actions;
      }
      if (pr.kind === 'JIAXU_LUANWU') {
        actions.push({ kind: 'PROMPT', payload: { mode: 'AOE' } });
        const ranked = rankHandForDiscard(G, pIdx);
        for (const c of ranked.slice(0, 2)) {
          actions.push({ kind: 'PROMPT', payload: { mode: 'DISCARD', cardUid: c.uid } });
        }
        return actions;
      }
      if (pr.kind === 'ZHANGZHAO_DISCARD') {
        const ranked = rankHandForDiscard(G, pIdx);
        actions.push({ kind: 'PROMPT', payload: { cardUid: null } });
        if (ranked.length >= 1) {
          actions.push({ kind: 'PROMPT', payload: { cardUid: ranked[0].uid } });
        }
        return actions;
      }
    }

    // 1. 主動技能
    for (let s = 0; s < BOARD_SIZE; s++) {
      if (canUseActiveSkill(G, pIdx, s)) {
        const u = p.board[s];
        if (u.id === 'wu_huanggai' && p.hp <= 10) continue;
        actions.push({ kind: 'ACTIVE_SKILL', slot: s });
      }
    }

    // 2. 出牌（同 ID 只展開一次）
    const seenCardIds = new Set();
    for (const c of p.hand) {
      if (seenCardIds.has(c.id)) continue;
      if (!canPlayCard(G, pIdx, c)) continue;
      seenCardIds.add(c.id);

      if (c.type === 'GENERAL') {
        const slots = pickCandidateSlotsForGeneral(G, pIdx, c);
        for (const s of slots) {
          actions.push({ kind: 'PLAY_GENERAL', uid: c.uid, slot: s });
        }
      } else {
        const t = getValidTacticTargets(G, pIdx, c);
        if (t.type === 'none') {
          actions.push({ kind: 'PLAY_TACTIC', uid: c.uid, targetSlot: null });
        } else {
          for (const ts of t.slots) {
            actions.push({ kind: 'PLAY_TACTIC', uid: c.uid, targetSlot: ts });
          }
        }
      }
    }

    // 3. 攻擊
    for (let s = 0; s < BOARD_SIZE; s++) {
      const u = p.board[s];
      if (!canUnitAttack(u, G)) continue;
      const valid = getValidAttackTargets(G, pIdx, s);
      if (valid.canHitHero) {
        actions.push({ kind: 'ATTACK', slot: s, targetType: 'HERO', targetSlot: null });
      }
      for (const ts of valid.slots) {
        actions.push({ kind: 'ATTACK', slot: s, targetType: 'UNIT', targetSlot: ts });
      }
    }

    return actions;
  }

  function applyAction(G, pIdx, act) {
    switch (act.kind) {
      case 'PROMPT':
        return resolvePendingPrompt(G, pIdx, act.payload);
      case 'ACTIVE_SKILL':
        return activateUnitSkill(G, pIdx, act.slot);
      case 'PLAY_GENERAL':
        return playGeneral(G, pIdx, act.uid, act.slot);
      case 'PLAY_TACTIC':
        return playTactic(G, pIdx, act.uid, act.targetSlot);
      case 'ATTACK':
        return executeAttack(G, pIdx, act.slot, act.targetType, act.targetSlot);
      case 'END_TURN':
        return endTurn(G);
      default:
        return false;
    }
  }

  function simulateEndTurn(G, pIdx) {
    const sim = cloneState(G);
    if (sim.phase !== 'MAIN' || sim.activePlayer !== pIdx) return sim;
    const ended = endTurn(sim);
    if (!ended && sim.pendingPrompt && sim.pendingPrompt.owner === pIdx && sim.pendingPrompt.kind === 'DISCARD') {
      const ranked = rankHandForDiscard(sim, pIdx);
      resolvePendingPrompt(sim, pIdx, {
        selectedUids: ranked.slice(0, sim.pendingPrompt.count).map(c => c.uid)
      });
    }
    return sim;
  }

  function evaluateAfterOpponentReply(endState, aiIdx) {
    if (endState.phase === 'GAMEOVER') return evaluateState(endState, aiIdx);
    const oppIdx = 1 - aiIdx;
    const sim = cloneState(endState);

    // 不窺視玩家手牌，只推演場面可見武將與主動技的反擊威脅
    sim.players[oppIdx].hand = [];

    for (let step = 0; step < 8; step++) {
      if (sim.phase !== 'MAIN' || sim.activePlayer !== oppIdx) break;
      const oppActions = generateLegalActions(sim, oppIdx);
      if (oppActions.length === 0) break;

      let bestAct = null;
      let bestOppScore = evaluateState(sim, oppIdx);
      for (const act of oppActions) {
        const next = cloneState(sim);
        if (!applyAction(next, oppIdx, act)) continue;
        const sc = evaluateState(next, oppIdx);
        if (sc > bestOppScore) {
          bestOppScore = sc;
          bestAct = act;
        }
      }
      if (!bestAct) break;
      applyAction(sim, oppIdx, bestAct);
    }

    const afterOppEnd = simulateEndTurn(sim, oppIdx);
    return evaluateState(afterOppEnd, aiIdx);
  }

  function pickBestActionBeam(G, aiIdx, cfg) {
    const startMs = Date.now();
    const TIME_BUDGET_MS = 320;
    let beam = [{ state: cloneState(G), firstAction: null, score: evaluateState(G, aiIdx) }];
    const completed = [];

    if (!G.pendingPrompt) {
      const passState = simulateEndTurn(G, aiIdx);
      completed.push({
        state: passState,
        firstAction: { kind: 'END_TURN' },
        score: evaluateState(passState, aiIdx)
      });
    }

    for (let depth = 0; depth < cfg.maxDepth; depth++) {
      if (Date.now() - startMs > TIME_BUDGET_MS) break;
      const nextBeam = [];
      for (const node of beam) {
        if (Date.now() - startMs > TIME_BUDGET_MS) break;
        const st = node.state;
        if (st.phase === 'GAMEOVER' || st.activePlayer !== aiIdx) {
          completed.push(node);
          continue;
        }

        const actions = generateLegalActions(st, aiIdx);
        if (actions.length === 0) {
          const endSt = simulateEndTurn(st, aiIdx);
          completed.push({
            state: endSt,
            firstAction: node.firstAction || { kind: 'END_TURN' },
            score: evaluateState(endSt, aiIdx)
          });
          continue;
        }

        for (const act of actions) {
          const nextSt = cloneState(st);
          if (!applyAction(nextSt, aiIdx, act)) continue;
          const firstAct = node.firstAction || act;
          const sc = evaluateState(nextSt, aiIdx);
          if (nextSt.phase === 'GAMEOVER') {
            if (nextSt.winner === aiIdx) return firstAct;
            completed.push({ state: nextSt, firstAction: firstAct, score: sc });
          } else {
            nextBeam.push({ state: nextSt, firstAction: firstAct, score: sc });
          }
        }

        if (!st.pendingPrompt && node.firstAction) {
          const endSt = simulateEndTurn(st, aiIdx);
          completed.push({
            state: endSt,
            firstAction: node.firstAction,
            score: evaluateState(endSt, aiIdx)
          });
        }
      }

      if (nextBeam.length === 0) break;
      nextBeam.sort((a, b) => b.score - a.score);
      beam = nextBeam.slice(0, cfg.beamWidth);
    }

    for (const node of beam) {
      const endSt = simulateEndTurn(node.state, aiIdx);
      completed.push({
        state: endSt,
        firstAction: node.firstAction || { kind: 'END_TURN' },
        score: evaluateState(endSt, aiIdx)
      });
    }

    completed.sort((a, b) => b.score - a.score);
    if (completed.length === 0) return { kind: 'END_TURN' };

    if (cfg.lookaheadTop > 0) {
      const topCandidates = completed.slice(0, cfg.lookaheadTop);
      let best = topCandidates[0];
      let bestScore = -Infinity;
      for (const cand of topCandidates) {
        if (Date.now() - startMs > TIME_BUDGET_MS + 120) break;
        const replyScore = evaluateAfterOpponentReply(cand.state, aiIdx);
        const blended = cand.score * 0.35 + replyScore * 0.65;
        if (blended > bestScore) {
          bestScore = blended;
          best = cand;
        }
      }
      return best.firstAction;
    }

    if (cfg.noise > 0 && completed.length > 1) {
      let best = completed[0];
      let bestScore = -Infinity;
      for (const cand of completed.slice(0, 3)) {
        const noisy = cand.score + (Math.random() * 2 - 1) * cfg.noise;
        if (noisy > bestScore) {
          bestScore = noisy;
          best = cand;
        }
      }
      return best.firstAction;
    }

    return completed[0].firstAction;
  }

  function pickBestActionGreedy(G, aiIdx, cfg) {
    const actions = generateLegalActions(G, aiIdx);
    if (actions.length === 0) return { kind: 'END_TURN' };

    let bestAct = G.pendingPrompt ? actions[0] : { kind: 'END_TURN' };
    let bestScore = G.pendingPrompt ? -Infinity : evaluateState(simulateEndTurn(G, aiIdx), aiIdx);

    for (const act of actions) {
      const sim = cloneState(G);
      if (!applyAction(sim, aiIdx, act)) continue;
      let sc = evaluateState(sim, aiIdx);
      if (cfg.noise > 0) sc += (Math.random() * 2 - 1) * cfg.noise;
      if (sc > bestScore) {
        bestScore = sc;
        bestAct = act;
      }
    }
    return bestAct;
  }

  function runAIStep(G) {
    if (!G || G.phase !== 'MAIN' || !G.players[G.activePlayer].isAI) return false;
    if (G.pendingPrompt && G.pendingPrompt.owner !== G.activePlayer) return false;
    const aiIdx = G.activePlayer;
    const diff = getAIDifficulty(G, aiIdx);
    const cfg = AI_DIFFICULTIES[diff] || AI_DIFFICULTIES.normal;

    const chosen = cfg.mode === 'beam'
      ? pickBestActionBeam(G, aiIdx, cfg)
      : pickBestActionGreedy(G, aiIdx, cfg);

    if (!chosen || chosen.kind === 'END_TURN') {
      const ended = endTurn(G);
      if (!ended && G.pendingPrompt && G.pendingPrompt.owner === aiIdx) {
        return true;
      }
      return false;
    }

    const ok = applyAction(G, aiIdx, chosen);
    if (!ok) {
      const ended = endTurn(G);
      return Boolean(!ended && G.pendingPrompt && G.pendingPrompt.owner === aiIdx);
    }
    return true;
  }

  Object.assign(global.Sanguo, {
    AI_DIFFICULTIES,
    setAIDifficulty,
    getAIDifficulty,
    evaluateState,
    aiChooseMulligan,
    runAIStep
  });
})(window);