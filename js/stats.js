(function (global) {
  'use strict';

  const Sanguo = global.Sanguo = global.Sanguo || {};

  function createPlayerStats(initialHp) {
    return {
      units: {},
      tactics: {},
      currentTurnDamage: 0,
      currentTurnHeroDamage: 0,
      currentTurnUnitDamage: 0,
      currentTurnBurnKills: 0,
      maxTurnDamage: 0,
      maxTurnDamageTurn: 0,
      maxTurnHeroDamage: 0,
      maxTurnUnitDamage: 0,
      totalDamageDealt: 0,
      cardsPlayed: 0,
      comebacks: 0,
      inDeficit: false,
      maxHpDeficit: 0,
      minHp: typeof initialHp === 'number' ? initialHp : 30,
      triggeredDefenseLine: false
    };
  }

  function ensureStats(G) {
    if (!G) return null;
    if (!G.stats || !G.stats.players) {
      const hp0 = G.players && G.players[0] ? G.players[0].hp : 30;
      const hp1 = G.players && G.players[1] ? G.players[1].hp : 30;
      G.stats = {
        players: [createPlayerStats(hp0), createPlayerStats(hp1)]
      };
    }
    return G.stats;
  }

  function initMatchStats(G) {
    if (!G) return;
    const hp0 = G.players && G.players[0] ? G.players[0].hp : 30;
    const hp1 = G.players && G.players[1] ? G.players[1].hp : 30;
    G.stats = {
      players: [createPlayerStats(hp0), createPlayerStats(hp1)]
    };
  }

  function getOrCreateUnitStat(ps, unit, turnNumber) {
    if (!ps || !unit || !unit.id) return null;
    if (!ps.units[unit.id]) {
      ps.units[unit.id] = {
        id: unit.id,
        name: unit.name || unit.id,
        faction: unit.faction || 'NEU',
        icon: unit.icon || '⚔️',
        dmgToUnits: 0,
        dmgToHero: 0,
        kills: 0,
        damageBlocked: 0,
        skillDmg: 0,
        healing: 0,
        firstPlayedTurn: turnNumber || 1
      };
    }
    return ps.units[unit.id];
  }

  function getOrCreateTacticStat(ps, card) {
    if (!ps || !card || !card.id) return null;
    if (!ps.tactics[card.id]) {
      ps.tactics[card.id] = {
        id: card.id,
        name: card.name || card.id,
        faction: card.faction || 'NEU',
        icon: card.icon || '📜',
        dmgTotal: 0,
        kills: 0,
        uses: 0
      };
    }
    return ps.tactics[card.id];
  }

  function onTurnStart(G, pIdx) {
    if (!G || G.silent) return;
    const stats = ensureStats(G);
    const ps = stats.players[pIdx];
    if (!ps) return;
    ps.currentTurnDamage = 0;
    ps.currentTurnHeroDamage = 0;
    ps.currentTurnUnitDamage = 0;
    ps.currentTurnBurnKills = 0;
  }

  function recordUnitDeploy(G, ownerIdx, unit) {
    if (!G || G.silent || !unit) return;
    const stats = ensureStats(G);
    const ps = stats.players[ownerIdx];
    if (!ps) return;
    ps.cardsPlayed += 1;
    getOrCreateUnitStat(ps, unit, G.turnNumber);
  }

  function recordTacticPlay(G, ownerIdx, card) {
    if (!G || G.silent || !card) return;
    const stats = ensureStats(G);
    const ps = stats.players[ownerIdx];
    if (!ps) return;
    ps.cardsPlayed += 1;
    const ts = getOrCreateTacticStat(ps, card);
    if (ts) ts.uses += 1;
  }

  function recordDamage(G, sourceOwner, targetOwner, amount, meta) {
    if (!G || G.silent || !amount || amount <= 0) return;
    if (sourceOwner === targetOwner || sourceOwner === null || sourceOwner === undefined) return;
    const stats = ensureStats(G);
    const ps = stats.players[sourceOwner];
    if (!ps) return;

    const m = meta || {};
    ps.totalDamageDealt += amount;

    // 僅在該玩家自己的回合中累計單回合爆發傷害
    if (G.activePlayer === sourceOwner) {
      ps.currentTurnDamage += amount;
      if (m.targetType === 'HERO') ps.currentTurnHeroDamage += amount;
      else ps.currentTurnUnitDamage += amount;

      if (ps.currentTurnDamage > ps.maxTurnDamage) {
        ps.maxTurnDamage = ps.currentTurnDamage;
        ps.maxTurnDamageTurn = G.turnNumber || 1;
        ps.maxTurnHeroDamage = ps.currentTurnHeroDamage;
        ps.maxTurnUnitDamage = ps.currentTurnUnitDamage;
      }
    }

    if (m.unit) {
      const us = getOrCreateUnitStat(ps, m.unit, G.turnNumber);
      if (us) {
        if (m.isSkill) {
          us.skillDmg += amount;
        } else if (m.targetType === 'HERO') {
          us.dmgToHero += amount;
        } else {
          us.dmgToUnits += amount;
        }
        if (m.killed) us.kills += 1;
      }
    } else if (m.card) {
      const ts = getOrCreateTacticStat(ps, m.card);
      if (ts) {
        ts.dmgTotal += amount;
        if (m.killed) ts.kills += 1;
      }
    }

    if (m.killed && m.isBurn && G.activePlayer === sourceOwner) {
      ps.currentTurnBurnKills += 1;
    }
  }

  function recordBlock(G, ownerIdx, unit, blocked) {
    if (!G || G.silent || !unit || !blocked || blocked <= 0) return;
    const stats = ensureStats(G);
    const ps = stats.players[ownerIdx];
    if (!ps) return;
    const us = getOrCreateUnitStat(ps, unit, G.turnNumber);
    if (us) us.damageBlocked += blocked;
  }

  function recordHeal(G, ownerIdx, unit, healed) {
    if (!G || G.silent || !healed || healed <= 0) return;
    const stats = ensureStats(G);
    const ps = stats.players[ownerIdx];
    if (!ps) return;
    if (unit) {
      const us = getOrCreateUnitStat(ps, unit, G.turnNumber);
      if (us) us.healing += healed;
    }
  }

  function recordDefenseLine(G, ownerIdx) {
    if (!G || G.silent) return;
    const stats = ensureStats(G);
    const ps = stats.players[ownerIdx];
    if (ps) ps.triggeredDefenseLine = true;
  }

  function recordHpChange(G) {
    if (!G || G.silent || !G.players || G.players.length < 2) return;
    const stats = ensureStats(G);
    const hp0 = G.players[0].hp;
    const hp1 = G.players[1].hp;
    const hps = [hp0, hp1];

    for (let i = 0; i < 2; i++) {
      const ps = stats.players[i];
      const myHp = hps[i];
      const oppHp = hps[1 - i];
      if (myHp < ps.minHp) ps.minHp = myHp;
      const deficit = oppHp - myHp;
      if (deficit > ps.maxHpDeficit) ps.maxHpDeficit = deficit;

      // 國力曾落後 >= 6 點後反超領先對手，記為 1 次逆轉
      if (deficit >= 6) {
        ps.inDeficit = true;
      } else if (ps.inDeficit && myHp > oppHp) {
        ps.comebacks += 1;
        ps.inDeficit = false;
      }
    }
  }

  function scoreUnitStat(u) {
    return (
      (u.dmgToUnits || 0) * 1.0 +
      (u.dmgToHero || 0) * 1.2 +
      (u.kills || 0) * 4.0 +
      (u.damageBlocked || 0) * 0.5 +
      (u.skillDmg || 0) * 1.0 +
      (u.healing || 0) * 0.8
    );
  }

  function pickUnitTitle(u) {
    if (u.kills >= 3) return '無雙斬將';
    if (u.skillDmg >= 5) return '焚營軍師';
    if (u.damageBlocked >= 4) return '鐵壁柱石';
    if (u.dmgToHero >= 7) return '破陣先鋒';
    if (u.healing >= 4) return '妙手回春';
    return '全場功臣';
  }

  function computePlayerMvp(ps) {
    if (!ps) return null;
    const unitList = Object.values(ps.units || {});
    const scored = unitList
      .map(u => ({
        unit: u,
        score: scoreUnitStat(u),
        totalDmg: (u.dmgToUnits || 0) + (u.dmgToHero || 0) + (u.skillDmg || 0)
      }))
      .filter(item => item.score > 0);

    if (scored.length > 0) {
      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.unit.kills !== a.unit.kills) return b.unit.kills - a.unit.kills;
        if (b.totalDmg !== a.totalDmg) return b.totalDmg - a.totalDmg;
        return (a.unit.firstPlayedTurn || 99) - (b.unit.firstPlayedTurn || 99);
      });
      const best = scored[0];
      const u = best.unit;
      const parts = [];
      if (best.totalDmg > 0) parts.push(`造成 ${best.totalDmg} 傷`);
      if (u.kills > 0) parts.push(`擊殺 ${u.kills} 將`);
      if (u.damageBlocked > 0) parts.push(`格擋 ${u.damageBlocked}`);
      if (u.healing > 0) parts.push(`治療 ${u.healing}`);
      return {
        id: u.id,
        name: u.name,
        faction: u.faction,
        icon: u.icon,
        score: Math.round(best.score * 10) / 10,
        title: pickUnitTitle(u),
        summary: parts.slice(0, 2).join('・') || '穩健輸出',
        isTacticOnly: false
      };
    }

    const tacticList = Object.values(ps.tactics || {}).sort((a, b) => b.dmgTotal - a.dmgTotal);
    if (tacticList.length > 0 && tacticList[0].dmgTotal > 0) {
      const t = tacticList[0];
      return {
        id: t.id,
        name: t.name,
        faction: t.faction,
        icon: t.icon,
        score: t.dmgTotal,
        title: '運籌帷幄',
        summary: `謀略輸出 ${t.dmgTotal} 傷`,
        isTacticOnly: true
      };
    }

    return {
      id: 'none',
      name: '奇謀制勝',
      faction: 'NEU',
      icon: '📜',
      score: 0,
      title: '不戰屈兵',
      summary: '以全局節奏取勝',
      isTacticOnly: true
    };
  }

  function computeHighlights(G) {
    const stats = ensureStats(G);
    const winnerIdx = (G && (G.winner === 0 || G.winner === 1)) ? G.winner : null;
    // 在 AI 模式中，若玩家獲勝或落敗皆優先展示「我方(0)」或「勝方」：勝方為高光主軸，並附上我方數據
    const focusIdx = winnerIdx !== null ? winnerIdx : 0;
    const focusPlayer = G.players[focusIdx];
    const focusStats = stats.players[focusIdx];
    const mvp = computePlayerMvp(focusStats);

    const isDefenseLineComeback = Boolean(
      winnerIdx === focusIdx && focusStats.triggeredDefenseLine
    );
    const totalComebacks = focusStats.comebacks + (isDefenseLineComeback && focusStats.comebacks === 0 ? 1 : 0);

    const mvpLabel = winnerIdx === null ? '本局焦點武將' : (focusIdx === 0 || G.mode !== 'AI' ? '本局 MVP 武將' : '敵軍 MVP 武將');
    const factionTitles = Sanguo.FACTIONS || {};
    const f0 = factionTitles[G.players[0].faction] ? (factionTitles[G.players[0].faction].name || G.players[0].faction) : G.players[0].faction;
    const f1 = factionTitles[G.players[1].faction] ? (factionTitles[G.players[1].faction].name || G.players[1].faction) : G.players[1].faction;
    const resultStr = winnerIdx === null ? '平局' : `${G.players[winnerIdx].name}獲勝`;

    const shareText = [
      `【《三國·謀定天下》v3.5 戰報高光】`,
      `對陣：${G.players[0].name}(${f0} ${Math.max(0, G.players[0].hp)}HP) vs ${G.players[1].name}(${f1} ${Math.max(0, G.players[1].hp)}HP)｜${resultStr}（共 ${G.turnNumber} 回合）`,
      `🏆 ${mvpLabel}：${mvp.name}（${mvp.title}｜${mvp.summary}）`,
      `🔥 最高單回合傷害：${focusStats.maxTurnDamage} 傷${focusStats.maxTurnDamageTurn ? `（第 ${focusStats.maxTurnDamageTurn} 回合）` : ''}`,
      `⚡ 逆轉次數：${totalComebacks} 次${isDefenseLineComeback ? '【背水逆轉】' : ''}`
    ].join('\n');

    return {
      winnerIdx,
      focusIdx,
      focusName: focusPlayer.name,
      mvpLabel,
      mvp,
      maxTurnDamage: {
        value: focusStats.maxTurnDamage,
        turn: focusStats.maxTurnDamageTurn,
        heroDmg: focusStats.maxTurnHeroDamage,
        unitDmg: focusStats.maxTurnUnitDamage
      },
      comebacks: {
        count: totalComebacks,
        isDefenseLineComeback,
        maxDeficit: focusStats.maxHpDeficit,
        minHp: Math.max(0, focusStats.minHp)
      },
      totalDamageDealt: focusStats.totalDamageDealt,
      cardsPlayed: focusStats.cardsPlayed,
      turns: G.turnNumber || 1,
      shareText
    };
  }

  Sanguo.Stats = {
    initMatchStats,
    ensureStats,
    onTurnStart,
    recordUnitDeploy,
    recordTacticPlay,
    recordDamage,
    recordBlock,
    recordHeal,
    recordDefenseLine,
    recordHpChange,
    computeHighlights
  };
})(typeof window !== 'undefined' ? window : globalThis);