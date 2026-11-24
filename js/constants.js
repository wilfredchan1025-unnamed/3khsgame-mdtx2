(function (global) {
  'use strict';

  const FACTIONS = {
    SHU: {
      id: 'SHU', name: '蜀', title: '蜀·漢室精銳',
      color: '#991b1b', accent: '#f87171',
      badgeBg: 'bg-red-900/90 text-red-200 border-red-500/50',
      ring: 'border-red-500/60',
      desc: '赤血忠義，擅長連擊斬殺、破甲突襲與相鄰協戰。'
    },
    WEI: {
      id: 'WEI', name: '魏', title: '魏·霸府權謀',
      color: '#1e3a8a', accent: '#60a5fa',
      badgeBg: 'bg-blue-900/90 text-blue-200 border-blue-500/50',
      ring: 'border-blue-500/60',
      desc: '深謀遠慮，擅長護衛護甲、沉默控場與斷糧權謀。'
    },
    WU: {
      id: 'WU', name: '吳', title: '吳·江東水師',
      color: '#166534', accent: '#4ade80',
      badgeBg: 'bg-emerald-900/90 text-emerald-200 border-emerald-500/50',
      ring: 'border-emerald-500/60',
      desc: '碧水長江，擅長火攻灼燒、制衡調度與謀略連動。'
    },
    QUN: {
      id: 'QUN', name: '群', title: '群·天下群雄',
      color: '#6b21a8', accent: '#c084fc',
      badgeBg: 'bg-purple-900/90 text-purple-200 border-purple-500/50',
      ring: 'border-purple-500/60',
      desc: '豪強並起，擅長高攻爆發、毒計壓制與破盾伏擊。'
    },
    NEU: {
      id: 'NEU', name: '中立', title: '中立',
      color: '#475569', accent: '#94a3b8',
      badgeBg: 'bg-slate-800/90 text-slate-200 border-slate-500/50',
      ring: 'border-slate-500/60',
      desc: '任何主陣營卡組皆可攜帶。'
    }
  };

  const FACTION_LIST = ['SHU', 'WEI', 'WU', 'QUN'];
  const BOARD_SIZE = 5;
  const SLOT_NAMES = ['1號位·左翼', '2號位·左輔', '3號位·中軍', '4號位·右輔', '5號位·右翼'];
  const MAX_HAND_SIZE = 8;
  const MAX_FOOD_CAP = 7;
  const MAX_RESERVE_FOOD = 3;
  const MAX_SUB_FACTION_CARDS = 10;
  const SUB_FACTION_MAX_COST = 4;
  const INITIAL_HP = 30;
  const DECK_SIZE = 30;
  const MAX_COPIES = 2;

  // Dynamic hand limit based on current HP: 21-30 -> 8, 11-20 -> 6, <=10 -> 4
  function getHandLimit(hp) {
    if (hp >= 21) return 8;
    if (hp >= 11) return 6;
    return 4;
  }

  // v3.0: Faction counter (+1 dmg) removed; kept as false for backwards compatibility
  function isCountering() {
    return false;
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
    getHandLimit,
    isCountering
  });
})(window);