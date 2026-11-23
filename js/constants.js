(function (global) {
  'use strict';

  const FACTIONS = {
    SHU: {
      id: 'SHU', name: '蜀', title: '蜀·關外精銳', counters: 'QUN', counteredBy: 'WU',
      color: '#2d6a4f', accent: '#52b788', badgeBg: 'bg-emerald-900/90 text-emerald-200 border-emerald-500/50',
      ring: 'border-emerald-500/60', desc: '連擊與斬殺見長，善於突襲滾雪球。克制【群】。'
    },
    QUN: {
      id: 'QUN', name: '群', title: '群·異族蠻力', counters: 'WEI', counteredBy: 'SHU',
      color: '#6b21a8', accent: '#c084fc', badgeBg: 'bg-purple-900/90 text-purple-200 border-purple-500/50',
      ring: 'border-purple-500/60', desc: '高攻爆發與毒計消耗，強勢破陣。克制【魏】。'
    },
    WEI: {
      id: 'WEI', name: '魏', title: '魏·霸府權謀', counters: 'WU', counteredBy: 'QUN',
      color: '#1e3a8a', accent: '#60a5fa', badgeBg: 'bg-blue-900/90 text-blue-200 border-blue-500/50',
      ring: 'border-blue-500/60', desc: '厚重護甲與削弱控場，穩守中軍。克制【吳】。'
    },
    WU: {
      id: 'WU', name: '吳', title: '吳·江東水師', counters: 'SHU', counteredBy: 'WEI',
      color: '#991b1b', accent: '#f87171', badgeBg: 'bg-red-900/90 text-red-200 border-red-500/50',
      ring: 'border-red-500/60', desc: '火攻灼燒與靈活直傷，持續壓制。克制【蜀】。'
    },
    NEU: {
      id: 'NEU', name: '中立', title: '中立', counters: null, counteredBy: null,
      color: '#475569', accent: '#94a3b8', badgeBg: 'bg-slate-800/90 text-slate-200 border-slate-500/50',
      ring: 'border-slate-500/60', desc: '任何主陣營卡組皆可攜帶。無克制關係。'
    }
  };

  const FACTION_LIST = ['SHU', 'QUN', 'WEI', 'WU'];
  const BOARD_SIZE = 5;
  const SLOT_NAMES = ['1號位·左翼', '2號位·左輔', '3號位·中軍', '4號位·右輔', '5號位·右翼'];
  const MAX_HAND_SIZE = 10;
  const MAX_FOOD_CAP = 10;
  const MAX_RESERVE_FOOD = 3;
  const MAX_SUB_FACTION_CARDS = 10;
  const SUB_FACTION_MAX_COST = 4;
  const INITIAL_HP = 30;
  const DECK_SIZE = 30;
  const MAX_COPIES = 2;

  function isCountering(attackerFaction, defenderFaction) {
    if (!attackerFaction || !defenderFaction) return false;
    const f = FACTIONS[attackerFaction];
    return Boolean(f && f.counters === defenderFaction);
  }

  global.Sanguo = global.Sanguo || {};
  Object.assign(global.Sanguo, {
    FACTIONS,
    FACTION_LIST,
    BOARD_SIZE,
    SLOT_NAMES,
    MAX_HAND_SIZE,
    MAX_FOOD_CAP,
    MAX_RESERVE_FOOD,
    MAX_SUB_FACTION_CARDS,
    SUB_FACTION_MAX_COST,
    INITIAL_HP,
    DECK_SIZE,
    MAX_COPIES,
    isCountering
  });
})(window);