(function (global) {
  'use strict';

  const { FACTIONS, FACTION_LIST, DECK_SIZE, MAX_COPIES, MAX_SUB_FACTION_CARDS, SUB_FACTION_MAX_COST } = global.Sanguo;

  const CARD_DB = {
    // --- Special Token ---
    rapid_march: {
      id: 'rapid_march', name: '急行軍', type: 'TACTIC', faction: 'NEU', cost: 0, token: true,
      target: 'none', icon: '🐎',
      text: '後手專屬：本回合臨時獲得 1 點糧草。'
    },

    // --- 蜀 SHU (11 cards) ---
    shu_liaohua: {
      id: 'shu_liaohua', name: '廖化', type: 'GENERAL', faction: 'SHU', cost: 1, atk: 2, hp: 2, armor: 0,
      keywords: [], icon: '🗡️',
      text: '登場時：若相鄰格已有友方武將，自身獲得 +1 攻擊力。'
    },
    shu_guanping: {
      id: 'shu_guanping', name: '關平', type: 'GENERAL', faction: 'SHU', cost: 2, atk: 2, hp: 3, armor: 1,
      keywords: ['ARMOR', 'GUARD'], icon: '🛡️',
      text: '護甲 1、守護（保護相鄰友方武將免受普通攻擊）。'
    },
    shu_weiyan: {
      id: 'shu_weiyan', name: '魏延', type: 'GENERAL', faction: 'SHU', cost: 3, atk: 3, hp: 3, armor: 0,
      keywords: ['KILL'], icon: '⚔️',
      text: '斬殺：回復己方國力 2 點。'
    },
    shu_zhaoyun: {
      id: 'shu_zhaoyun', name: '趙雲', type: 'GENERAL', faction: 'SHU', cost: 4, atk: 3, hp: 4, armor: 1,
      keywords: ['COMBO', 'ARMOR'], icon: '🐉',
      text: '連擊、護甲 1。常山趙子龍，單騎破陣。'
    },
    shu_zhangfei: {
      id: 'shu_zhangfei', name: '張飛', type: 'GENERAL', faction: 'SHU', cost: 4, atk: 4, hp: 5, armor: 0,
      keywords: [], icon: '🦁',
      text: '登場時：對敵方生命最高的守護武將造成 3 點傷害（若無守護武將則對敵方攻擊力最高的武將造成 2 點傷害）。'
    },
    shu_guanyu: {
      id: 'shu_guanyu', name: '關羽', type: 'GENERAL', faction: 'SHU', cost: 5, atk: 5, hp: 5, armor: 0,
      keywords: ['KILL'], icon: '🌙',
      text: '斬殺：抽 1 張牌，並對敵方國力造成 2 點傷害。'
    },
    shu_machao: {
      id: 'shu_machao', name: '馬超', type: 'GENERAL', faction: 'SHU', cost: 5, atk: 4, hp: 4, armor: 0,
      keywords: ['COMBO'], icon: '🐎',
      text: '連擊。登場時：獲得 +1 攻擊力（持續 2 回合）。'
    },
    shu_zhugeliang: {
      id: 'shu_zhugeliang', name: '諸葛亮', type: 'GENERAL', faction: 'SHU', cost: 6, atk: 3, hp: 6, armor: 0,
      keywords: [], icon: '🪶',
      text: '登場時：抽 2 張牌。每回合結束時：所有友方武將獲得 +1 臨時護甲（1回合）。'
    },
    shu_taoyuan: {
      id: 'shu_taoyuan', name: '桃園結義', type: 'TACTIC', faction: 'SHU', cost: 3, target: 'none', icon: '🍑',
      text: '使所有友方武將獲得 +1/+1。'
    },
    shu_kongcheng: {
      id: 'shu_kongcheng', name: '空城計', type: 'TACTIC', faction: 'SHU', cost: 3, target: 'none', icon: '🏯',
      text: '所有友方武將獲得 +2 臨時護甲（持續 2 回合），並抽 1 張牌。'
    },
    shu_beifa: {
      id: 'shu_beifa', name: '出師北伐', type: 'TACTIC', faction: 'SHU', cost: 4, target: 'enemy_general', icon: '📜',
      text: '指定一名敵方武將造成 4 點傷害（無視守護保護）；若擊殺目標則抽 1 張牌。'
    },

    // --- 魏 WEI (11 cards) ---
    wei_yuejin: {
      id: 'wei_yuejin', name: '樂進', type: 'GENERAL', faction: 'WEI', cost: 1, atk: 1, hp: 3, armor: 1,
      keywords: ['ARMOR'], icon: '🛡️',
      text: '護甲 1。先登破敵。'
    },
    wei_xuhuang: {
      id: 'wei_xuhuang', name: '徐晃', type: 'GENERAL', faction: 'WEI', cost: 2, atk: 2, hp: 3, armor: 0,
      keywords: [], icon: '🪓',
      text: '登場時：使敵方攻擊力最高的武將 -1 攻擊力（持續 2 回合）。'
    },
    wei_zhangliao: {
      id: 'wei_zhangliao', name: '張遼', type: 'GENERAL', faction: 'WEI', cost: 3, atk: 3, hp: 3, armor: 0,
      keywords: ['COMBO'], icon: '⚡',
      text: '連擊。威震逍遙津。'
    },
    wei_caoren: {
      id: 'wei_caoren', name: '曹仁', type: 'GENERAL', faction: 'WEI', cost: 3, atk: 2, hp: 4, armor: 2,
      keywords: ['ARMOR', 'GUARD'], icon: '🏰',
      text: '護甲 2、守護。堅守防線的銅牆鐵壁。'
    },
    wei_xiahoudun: {
      id: 'wei_xiahoudun', name: '夏侯惇', type: 'GENERAL', faction: 'WEI', cost: 4, atk: 4, hp: 4, armor: 1,
      keywords: ['ARMOR', 'KILL'], icon: '👁️',
      text: '護甲 1、斬殺：自身回復 2 點生命。'
    },
    wei_dianwei: {
      id: 'wei_dianwei', name: '典韋', type: 'GENERAL', faction: 'WEI', cost: 4, atk: 3, hp: 5, armor: 2,
      keywords: ['ARMOR', 'GUARD'], icon: '🔱',
      text: '護甲 2、守護。登場時：回復己方國力 2 點。'
    },
    wei_simayi: {
      id: 'wei_simayi', name: '司馬懿', type: 'GENERAL', faction: 'WEI', cost: 5, atk: 3, hp: 5, armor: 0,
      keywords: [], icon: '🐺',
      text: '登場時：對敵方全體武將造成 1 點傷害並施加灼燒（每回合結束扣 1 血，持續 2 回合）。'
    },
    wei_caocao: {
      id: 'wei_caocao', name: '曹操', type: 'GENERAL', faction: 'WEI', cost: 6, atk: 4, hp: 6, armor: 1,
      keywords: ['ARMOR'], icon: '👑',
      text: '護甲 1。登場時：所有友方武將獲得 +2 攻擊力（持續 1 回合），並抽 1 張牌。'
    },
    wei_xietianzi: {
      id: 'wei_xietianzi', name: '挾天子令諸侯', type: 'TACTIC', faction: 'WEI', cost: 2, target: 'none', icon: '👑',
      text: '抽 2 張牌，己方國力 -1。'
    },
    wei_quhu: {
      id: 'wei_quhu', name: '驅虎吞狼', type: 'TACTIC', faction: 'WEI', cost: 3, target: 'enemy_general', icon: '🐯',
      text: '指定一名敵方武將造成 3 點傷害（無視守護保護），並使其攻擊力 -1（持續 2 回合）。'
    },
    wei_guandu: {
      id: 'wei_guandu', name: '奇襲烏巢', type: 'TACTIC', faction: 'WEI', cost: 4, target: 'none', icon: '🔥',
      text: '對敵方所有武將造成 1 點傷害，並回復己方國力 2 點。'
    },

    // --- 吳 WU (11 cards) ---
    wu_lingtong: {
      id: 'wu_lingtong', name: '凌統', type: 'GENERAL', faction: 'WU', cost: 1, atk: 2, hp: 1, armor: 0,
      keywords: ['COMBO'], icon: '🌊',
      text: '連擊。迅捷出擊的江東先鋒。'
    },
    wu_huanggai: {
      id: 'wu_huanggai', name: '黃蓋', type: 'GENERAL', faction: 'WU', cost: 2, atk: 3, hp: 3, armor: 0,
      keywords: [], icon: '🔥',
      text: '登場時：己方國力 -2，抽 1 張牌。'
    },
    wu_ganning: {
      id: 'wu_ganning', name: '甘寧', type: 'GENERAL', faction: 'WU', cost: 3, atk: 3, hp: 2, armor: 0,
      keywords: ['KILL'], icon: '⚓',
      text: '斬殺：對敵方國力造成 3 點傷害。'
    },
    wu_taishici: {
      id: 'wu_taishici', name: '太史慈', type: 'GENERAL', faction: 'WU', cost: 3, atk: 2, hp: 4, armor: 0,
      keywords: ['COMBO'], icon: '🏹',
      text: '連擊。神射雙發。'
    },
    wu_lumeng: {
      id: 'wu_lumeng', name: '呂蒙', type: 'GENERAL', faction: 'WU', cost: 4, atk: 3, hp: 4, armor: 1,
      keywords: ['ARMOR'], icon: '⛵',
      text: '護甲 1。登場時：對敵方生命最低的武將造成 2 點傷害（若無敵軍則對敵方國力造成 2 點傷害）。'
    },
    wu_sunce: {
      id: 'wu_sunce', name: '孫策', type: 'GENERAL', faction: 'WU', cost: 4, atk: 4, hp: 3, armor: 0,
      keywords: ['COMBO', 'KILL'], icon: '🦅',
      text: '連擊、斬殺：自身獲得 +1/+1。'
    },
    wu_zhouyu: {
      id: 'wu_zhouyu', name: '周瑜', type: 'GENERAL', faction: 'WU', cost: 5, atk: 3, hp: 5, armor: 0,
      keywords: [], icon: '🏮',
      text: '登場時：對敵方全體武將造成 2 點傷害並施加灼燒（每回合結束扣 1 血，持續 2 回合）。'
    },
    wu_luxun: {
      id: 'wu_luxun', name: '陸遜', type: 'GENERAL', faction: 'WU', cost: 6, atk: 4, hp: 5, armor: 1,
      keywords: ['ARMOR'], icon: '🔥',
      text: '護甲 1。每回合結束時：對所有敵方武將造成 1 點傷害。'
    },
    wu_lianhuan: {
      id: 'wu_lianhuan', name: '連環計', type: 'TACTIC', faction: 'WU', cost: 2, target: 'enemy_general', icon: '⛓️',
      text: '指定一名敵方武將造成 2 點傷害並施加灼燒（持續 3 回合），抽 1 張牌。'
    },
    wu_huogong: {
      id: 'wu_huogong', name: '火燒赤壁', type: 'TACTIC', faction: 'WU', cost: 4, target: 'none', icon: '🔥',
      text: '對敵方所有武將造成 2 點傷害，並施加灼燒（每回合結束扣 1 血，持續 2 回合）。'
    },
    wu_jiangdong: {
      id: 'wu_jiangdong', name: '江東水師', type: 'TACTIC', faction: 'WU', cost: 4, target: 'none', icon: '⛵',
      text: '對敵方國力造成 3 點傷害，並使所有友方武將獲得 +1 攻擊力（持續 2 回合）。'
    },

    // --- 群 QUN (11 cards) ---
    qun_huaxiong: {
      id: 'qun_huaxiong', name: '華雄', type: 'GENERAL', faction: 'QUN', cost: 2, atk: 3, hp: 2, armor: 0,
      keywords: ['KILL'], icon: '🪓',
      text: '斬殺：自身獲得 +2/+1。'
    },
    qun_diaochan: {
      id: 'qun_diaochan', name: '貂蟬', type: 'GENERAL', faction: 'QUN', cost: 2, atk: 1, hp: 3, armor: 0,
      keywords: [], icon: '🌸',
      text: '每回合結束時：回復己方國力 2 點，並使相鄰友方武將回復 1 點生命。'
    },
    qun_yanliang: {
      id: 'qun_yanliang', name: '顏良', type: 'GENERAL', faction: 'QUN', cost: 3, atk: 4, hp: 3, armor: 0,
      keywords: [], icon: '⚔️',
      text: '登場時：對敵方國力造成 1 點傷害。'
    },
    qun_wenchou: {
      id: 'qun_wenchou', name: '文醜', type: 'GENERAL', faction: 'QUN', cost: 3, atk: 3, hp: 4, armor: 1,
      keywords: ['ARMOR', 'GUARD'], icon: '🛡️',
      text: '護甲 1、守護。河北雙雄之一。'
    },
    qun_jiaxu: {
      id: 'qun_jiaxu', name: '賈詡', type: 'GENERAL', faction: 'QUN', cost: 4, atk: 2, hp: 4, armor: 0,
      keywords: [], icon: '☠️',
      text: '登場時：對敵方所有武將施加毒計（每回合結束扣 1 血，持續 3 回合）。'
    },
    qun_yuanshao: {
      id: 'qun_yuanshao', name: '袁紹', type: 'GENERAL', faction: 'QUN', cost: 5, atk: 4, hp: 5, armor: 1,
      keywords: ['ARMOR'], icon: '🚩',
      text: '護甲 1。登場時：對敵方全體武將造成 1 點傷害，友方全體 +1 攻擊力（持續 2 回合）。'
    },
    qun_dongzhuo: {
      id: 'qun_dongzhuo', name: '董卓', type: 'GENERAL', faction: 'QUN', cost: 5, atk: 5, hp: 6, armor: 2,
      keywords: ['ARMOR'], icon: '👹',
      text: '護甲 2。登場時：己方國力 -2。'
    },
    qun_lubu: {
      id: 'qun_lubu', name: '呂布', type: 'GENERAL', faction: 'QUN', cost: 7, atk: 6, hp: 6, armor: 0,
      keywords: ['COMBO', 'KILL'], icon: '🔱',
      text: '連擊、斬殺：對敵方國力造成 3 點傷害。飛將無雙！'
    },
    qun_manli: {
      id: 'qun_manli', name: '鐵騎突襲', type: 'TACTIC', faction: 'QUN', cost: 2, target: 'enemy_general', icon: '🐎',
      text: '指定一名敵方武將造成 3 點傷害（無視守護保護）。'
    },
    qun_wushuang: {
      id: 'qun_wushuang', name: '天下無雙', type: 'TACTIC', faction: 'QUN', cost: 3, target: 'ally_general', icon: '⚡',
      text: '指定一名友方武將獲得 +3 攻擊力與 +1 臨時護甲（持續 1 回合）。'
    },
    qun_huoshao: {
      id: 'qun_huoshao', name: '焚城掠地', type: 'TACTIC', faction: 'QUN', cost: 4, target: 'none', icon: '🔥',
      text: '對敵方所有武將造成 2 點傷害，並對敵方國力造成 2 點傷害。'
    },

    // --- 中立 NEUTRAL (10 cards) ---
    neu_bubing: {
      id: 'neu_bubing', name: '精銳步卒', type: 'GENERAL', faction: 'NEU', cost: 1, atk: 1, hp: 2, armor: 1,
      keywords: ['ARMOR'], icon: '🛡️',
      text: '護甲 1。穩健的前期防線。'
    },
    neu_gongbing: {
      id: 'neu_gongbing', name: '強弩手', type: 'GENERAL', faction: 'NEU', cost: 2, atk: 2, hp: 2, armor: 0,
      keywords: [], icon: '🏹',
      text: '登場時：對敵方國力造成 1 點傷害。'
    },
    neu_qibing: {
      id: 'neu_qibing', name: '輕騎兵', type: 'GENERAL', faction: 'NEU', cost: 2, atk: 3, hp: 2, armor: 0,
      keywords: [], icon: '🐎',
      text: '高機動邊翼先鋒。'
    },
    neu_dunbing: {
      id: 'neu_dunbing', name: '重甲盾衛', type: 'GENERAL', faction: 'NEU', cost: 3, atk: 1, hp: 5, armor: 2,
      keywords: ['ARMOR', 'GUARD'], icon: '🛡️',
      text: '護甲 2、守護。保護相鄰友軍的防禦重盾。'
    },
    neu_huatuo: {
      id: 'neu_huatuo', name: '華佗', type: 'GENERAL', faction: 'NEU', cost: 3, atk: 1, hp: 4, armor: 0,
      keywords: [], icon: '🌿',
      text: '每回合結束時：回復己方國力 2 點，並回復所有友方武將 1 點生命。'
    },
    neu_tuntian: {
      id: 'neu_tuntian', name: '屯田積糧', type: 'TACTIC', faction: 'NEU', cost: 1, target: 'none', icon: '🌾',
      text: '抽 1 張牌，回復己方國力 2 點。'
    },
    neu_anfuminxin: {
      id: 'neu_anfuminxin', name: '安撫民心', type: 'TACTIC', faction: 'NEU', cost: 2, target: 'none', icon: '🏮',
      text: '回復己方國力 4 點。'
    },
    neu_guwu: {
      id: 'neu_guwu', name: '擂鼓助威', type: 'TACTIC', faction: 'NEU', cost: 2, target: 'ally_general', icon: '🥁',
      text: '指定一名友方武將獲得 +2/+2。'
    },
    neu_pojia: {
      id: 'neu_pojia', name: '破甲強弩', type: 'TACTIC', faction: 'NEU', cost: 2, target: 'enemy_general', icon: '🎯',
      text: '指定一名敵方武將，清除其當前護甲並造成 2 點傷害（無視守護保護）。'
    },
    neu_jianyu: {
      id: 'neu_jianyu', name: '萬箭齊發', type: 'TACTIC', faction: 'NEU', cost: 3, target: 'none', icon: '🏹',
      text: '對敵方所有武將造成 1 點傷害，並抽 1 張牌。'
    }
,
    // --- Special Token (v2.0) ---
    qun_yellow_turban: {
      id: 'qun_yellow_turban', name: '黃巾力士', type: 'GENERAL', faction: 'QUN', cost: 1, atk: 1, hp: 2, armor: 0,
      token: true, keywords: [], icon: '🔱',
      text: '由【張角】召喚的黃巾精兵。'
    },

    // --- 蜀 SHU 新增 (v2.0) ---
    shu_huangzhong: {
      id: 'shu_huangzhong', name: '黃忠', type: 'GENERAL', faction: 'SHU', cost: 4, atk: 3, hp: 3, armor: 0,
      keywords: ['SNIPE'], icon: '🏹',
      text: '狙擊（普通攻擊無視敵方守護保護，可瞄準任意敵方武將）。老當益壯，百步穿楊。'
    },
    shu_muniuliuma: {
      id: 'shu_muniuliuma', name: '木牛流馬', type: 'TACTIC', faction: 'SHU', cost: 2, target: 'none', icon: '🐂',
      text: '往己方糧倉存入 2 點糧草（上限 3），並抽 1 張牌。'
    },

    // --- 魏 WEI 新增 (v2.0) ---
    wei_guojia: {
      id: 'wei_guojia', name: '郭嘉', type: 'GENERAL', faction: 'WEI', cost: 3, atk: 2, hp: 3, armor: 0,
      keywords: ['DEATHRATTLE'], icon: '🪶',
      text: '遺計（陣亡時）：抽 2 張牌，並往己方糧倉存入 1 點糧草。'
    },
    wei_duanliang: {
      id: 'wei_duanliang', name: '斷糧奇兵', type: 'TACTIC', faction: 'WEI', cost: 2, target: 'none', icon: '🔥',
      text: '掠奪敵方最多 2 點糧倉轉為己方臨時糧草，並使敵方攻擊力最高的武將 -1 攻擊力（持續 2 回合）。'
    },

    // --- 吳 WU 新增 (v2.0) ---
    wu_sunquan: {
      id: 'wu_sunquan', name: '孫權', type: 'GENERAL', faction: 'WU', cost: 5, atk: 3, hp: 5, armor: 1,
      keywords: ['ARMOR'], icon: '👑',
      text: '護甲 1。登場時：己方糧倉每有 1 點糧草，自身與相鄰友方武將獲得 +1/+1（不消耗糧倉）。'
    },
    wu_shensu: {
      id: 'wu_shensu', name: '兵貴神速', type: 'TACTIC', faction: 'WU', cost: 1, target: 'ally_general', icon: '💨',
      text: '使一名友方武將立即解除整備（本回合可攻擊敵方武將）；若位於非中軍格，本回合額外 +1 攻擊力。'
    },

    // --- 群 QUN 新增 (v2.0) ---
    qun_zhangjiao: {
      id: 'qun_zhangjiao', name: '張角', type: 'GENERAL', faction: 'QUN', cost: 4, atk: 2, hp: 4, armor: 0,
      keywords: ['DEATHRATTLE'], icon: '⚡',
      text: '登場時：在己方空置上陣位召喚 1 名 1/2「黃巾力士」。遺計：對敵方全體武將造成 1 點傷害。'
    },
    qun_xiliang: {
      id: 'qun_xiliang', name: '西涼鐵騎', type: 'GENERAL', faction: 'QUN', cost: 3, atk: 3, hp: 2, armor: 0,
      keywords: ['RUSH'], icon: '🐎',
      text: '突襲（登場當回合可攻擊敵方武將）。登場時：若己方糧倉 ≥ 1，消耗 1 點糧倉並獲得 +1/+1。'
    },

    // --- 中立 NEU 新增 (v2.0) ---
    neu_chengong: {
      id: 'neu_chengong', name: '陳宮', type: 'GENERAL', faction: 'NEU', cost: 2, atk: 2, hp: 2, armor: 0,
      keywords: [], icon: '📜',
      text: '登場時：若己方糧倉 ≥ 1，消耗 1 點糧倉並抽 1 張牌；否則往糧倉存入 1 點糧草。'
    },
    neu_huanwei: {
      id: 'neu_huanwei', name: '移形換位', type: 'TACTIC', faction: 'NEU', cost: 1, target: 'ally_general', icon: '🔄',
      text: '將指定友方武將與己方 3 號位（中軍）互換位置（若已在 3 號位則與 2 號位互換），並獲得 +2 臨時護甲與「守護」（1 回合）。'
    }
  };

  const STARTER_DECKS = {
    SHU: [
      'shu_liaohua', 'shu_liaohua',
      'shu_guanping', 'shu_guanping',
      'shu_weiyan', 'shu_weiyan',
      'shu_zhaoyun', 'shu_zhaoyun',
      'shu_zhangfei', 'shu_zhangfei',
      'shu_guanyu', 'shu_guanyu',
      'shu_machao', 'shu_zhugeliang',
      'shu_taoyuan', 'shu_taoyuan',
      'shu_kongcheng', 'shu_kongcheng',
      'shu_beifa', 'shu_beifa',
      'neu_bubing', 'neu_bubing',
      'neu_dunbing', 'neu_dunbing',
      'neu_tuntian', 'neu_tuntian',
      'neu_pojia', 'neu_pojia',
      'shu_huangzhong', 'shu_muniuliuma'
    ],
    WEI: [
      'wei_yuejin', 'wei_yuejin',
      'wei_xuhuang', 'wei_xuhuang',
      'wei_zhangliao', 'wei_zhangliao',
      'wei_caoren', 'wei_caoren',
      'wei_xiahoudun', 'wei_xiahoudun',
      'wei_dianwei', 'wei_dianwei',
      'wei_simayi', 'wei_caocao',
      'wei_xietianzi', 'wei_xietianzi',
      'wei_quhu', 'wei_quhu',
      'wei_guandu', 'wei_guandu',
      'neu_bubing', 'neu_bubing',
      'neu_huatuo', 'neu_huatuo',
      'neu_tuntian', 'neu_tuntian',
      'wei_guojia', 'wei_duanliang',
      'neu_pojia', 'neu_pojia'
    ],
    WU: [
      'wu_lingtong', 'wu_lingtong',
      'wu_huanggai', 'wu_huanggai',
      'wu_ganning', 'wu_ganning',
      'wu_taishici', 'wu_taishici',
      'wu_lumeng', 'wu_lumeng',
      'wu_sunce', 'wu_sunce',
      'wu_zhouyu', 'wu_luxun',
      'wu_lianhuan', 'wu_lianhuan',
      'wu_huogong', 'wu_huogong',
      'wu_jiangdong', 'wu_jiangdong',
      'neu_bubing', 'neu_bubing',
      'neu_dunbing', 'neu_dunbing',
      'neu_tuntian', 'neu_tuntian',
      'wu_sunquan', 'wu_shensu',
      'neu_pojia', 'neu_pojia'
    ],
    QUN: [
      'qun_huaxiong', 'qun_huaxiong',
      'qun_diaochan', 'qun_diaochan',
      'qun_yanliang', 'qun_yanliang',
      'qun_wenchou', 'qun_wenchou',
      'qun_jiaxu', 'qun_jiaxu',
      'qun_yuanshao', 'qun_dongzhuo',
      'qun_lubu', 'qun_lubu',
      'qun_manli', 'qun_manli',
      'qun_wushuang', 'qun_wushuang',
      'qun_huoshao', 'qun_huoshao',
      'neu_bubing', 'neu_bubing',
      'qun_zhangjiao', 'qun_xiliang',
      'neu_dunbing', 'neu_dunbing',
      'neu_tuntian', 'neu_tuntian',
      'neu_jianyu', 'neu_jianyu'
    ]
  };

  function validateDeck(faction, cardIds, subFaction = null) {
    const errors = [];
    if (!FACTION_LIST.includes(faction)) {
      errors.push('必須選擇有效的主陣營（蜀、魏、吳、群）。');
    }
    if (subFaction && (!FACTION_LIST.includes(subFaction) || subFaction === faction)) {
      errors.push('副陣營必須與主陣營不同且為有效陣營。');
    }
    if (!Array.isArray(cardIds) || cardIds.length !== DECK_SIZE) {
      errors.push(`卡組必須剛好為 ${DECK_SIZE} 張（目前 ${cardIds ? cardIds.length : 0} 張）。`);
    }
    const counts = {};
    const subFactionsFound = new Set();
    let subCount = 0;

    for (const id of (cardIds || [])) {
      const card = CARD_DB[id];
      if (!card || card.token) {
        errors.push(`無效卡牌：${id}`);
        continue;
      }
      if (card.faction !== faction && card.faction !== 'NEU') {
        if (subFaction && card.faction !== subFaction) {
          errors.push(`【${card.name}】不屬於主陣營（${FACTIONS[faction].name}）、副陣營（${FACTIONS[subFaction].name}）或中立卡牌。`);
        } else {
          subFactionsFound.add(card.faction);
          subCount += 1;
          if (card.cost > SUB_FACTION_MAX_COST) {
            errors.push(`副陣營卡牌【${card.name}】費用為 ${card.cost}，超過副陣營上限（最高 ${SUB_FACTION_MAX_COST} 費）。`);
          }
        }
      }
      counts[id] = (counts[id] || 0) + 1;
      if (counts[id] > MAX_COPIES) {
        errors.push(`【${card.name}】同名卡牌最多攜帶 ${MAX_COPIES} 張。`);
      }
    }
    if (subFactionsFound.size > 1) {
      errors.push('每副卡組最多只能選擇 1 個副陣營。');
    }
    if (subCount > MAX_SUB_FACTION_CARDS) {
      errors.push(`副陣營卡牌最多攜帶 ${MAX_SUB_FACTION_CARDS} 張（目前 ${subCount} 張）。`);
    }
    const resolvedSub = subFaction || (subFactionsFound.size === 1 ? Array.from(subFactionsFound)[0] : null);
    return { valid: errors.length === 0, errors, subFaction: resolvedSub, subCount };
  }

  const customDecks = {};
  try {
    const saved = global.localStorage && global.localStorage.getItem('sanguo_custom_decks_v2');
    if (saved) {
      const parsed = JSON.parse(saved);
      for (const f of FACTION_LIST) {
        if (parsed[f] && validateDeck(f, parsed[f]).valid) {
          customDecks[f] = parsed[f];
        }
      }
    }
  } catch (_) {}

  function getDeckForFaction(faction) {
    return (customDecks[faction] || STARTER_DECKS[faction]).slice();
  }

  function saveCustomDeck(faction, cards) {
    customDecks[faction] = cards.slice();
    try {
      if (global.localStorage) {
        global.localStorage.setItem('sanguo_custom_decks_v2', JSON.stringify(customDecks));
      }
    } catch (_) {}
  }

  Object.assign(global.Sanguo, {
    CARD_DB,
    STARTER_DECKS,
    customDecks,
    validateDeck,
    getDeckForFaction,
    saveCustomDeck
  });
})(window);