(function (global) {
  'use strict';

  const { FACTIONS, FACTION_LIST, DECK_SIZE, MAX_COPIES, MAX_SUB_FACTION_CARDS, SUB_FACTION_MAX_COST } = global.Sanguo;

  const CARD_DB = {
    // --- Special Tokens ---
    rapid_march: {
      id: 'rapid_march', name: '急行軍', type: 'TACTIC', faction: 'NEU', cost: 0, token: true,
      target: 'none', icon: '🐎',
      text: '後手專屬：本回合臨時獲得 1 點糧草。',
      flavor: '「兵貴神速，日行三百里以奪先機。」'
    },
    qun_yellow_turban: {
      id: 'qun_yellow_turban', name: '黃巾力士', type: 'GENERAL', faction: 'QUN', cost: 1, atk: 1, hp: 2, armor: 0,
      token: true, keywords: [], icon: '🔱', skillName: '起義',
      text: '【起義】由《張角》召喚的黃巾精兵。'
    },

    // ==========================================
    // 蜀 SHU (12 Generals + 5 Tactics = 17 cards)
    // ==========================================
    shu_liaohua: {
      id: 'shu_liaohua', name: '廖化', type: 'GENERAL', faction: 'SHU', cost: 1, atk: 2, hp: 2, armor: 0,
      keywords: [], icon: '🗡️', skillName: '先鋒',
      text: '【先鋒】登場：若相鄰格有友軍，自身 +1 攻。'
    },
    shu_guanping: {
      id: 'shu_guanping', name: '關平', type: 'GENERAL', faction: 'SHU', cost: 2, atk: 2, hp: 2, armor: 1,
      keywords: ['ARMOR', 'GUARD'], icon: '🛡️', skillName: '龍吟',
      text: '【龍吟】護衛。每回合限 1 次，當相鄰友軍發動普通攻擊後，使其本回合 +1 攻；若該友軍為「關羽」，改為抽 1 張牌。'
    },
    shu_weiyan: {
      id: 'shu_weiyan', name: '魏延', type: 'GENERAL', faction: 'SHU', cost: 3, atk: 3, hp: 3, armor: 0,
      keywords: [], icon: '⚔️', skillName: '狂骨',
      text: '【狂骨】每當魏延造成傷害後（含防守反擊），回復自身 1 點生命（不超過上限）。'
    },
    shu_fazheng: {
      id: 'shu_fazheng', name: '法正', type: 'GENERAL', faction: 'SHU', cost: 3, atk: 2, hp: 4, armor: 0,
      keywords: [], icon: '📜', skillName: '奇謀',
      text: '【奇謀】登場：若我方手牌少於敵方，抽 2 張牌並使敵方最高攻武將 -2 攻（1大回合）；否則抽 1 張牌，並使一名友方武將本回合獲得狙擊。'
    },
    shu_wangping: {
      id: 'shu_wangping', name: '王平', type: 'GENERAL', faction: 'SHU', cost: 3, atk: 2, hp: 4, armor: 1,
      keywords: ['ARMOR', 'GUARD'], icon: '🏔️', skillName: '無當',
      text: '【無當】受到攻擊力 ≤ 2 的武將攻擊時，傷害 -1。'
    },
    shu_huangzhong: {
      id: 'shu_huangzhong', name: '黃忠', type: 'GENERAL', faction: 'SHU', cost: 4, atk: 3, hp: 4, armor: 0,
      keywords: ['SNIPE', 'KILL'], icon: '🏹', skillName: '烈弓',
      text: '【烈弓】狙擊。攻擊受相鄰護衛保護的敵方武將時，本次傷害 +2 且無視護甲。斬殺：抽 1 張牌。'
    },
    shu_zhaoyun: {
      id: 'shu_zhaoyun', name: '趙雲', type: 'GENERAL', faction: 'SHU', cost: 4, atk: 3, hp: 4, armor: 1,
      keywords: ['COMBO', 'ARMOR'], icon: '🐉', skillName: '龍膽',
      activeSkill: { name: '龍膽', cost: 1, desc: '本回合與下個敵方回合 +1 攻與 +1 臨時護甲' },
      text: '【龍膽】主動(1糧)：本回合與下個敵方回合獲得 +1 攻與 +1 臨時護甲。'
    },
    shu_zhangfei: {
      id: 'shu_zhangfei', name: '張飛', type: 'GENERAL', faction: 'SHU', cost: 4, atk: 4, hp: 4, armor: 0,
      keywords: ['RUSH'], icon: '🦁', skillName: '咆哮',
      text: '【咆哮】登場：對敵方生命最高的護衛造成 3 傷（無護衛則對最高攻敵軍造成 2 傷）。'
    },
    shu_guanyu: {
      id: 'shu_guanyu', name: '關羽', type: 'GENERAL', faction: 'SHU', cost: 5, atk: 5, hp: 5, armor: 0,
      keywords: ['PIERCE', 'KILL'], icon: '🌙', skillName: '武聖',
      text: '【武聖】破甲。斬殺：抽 1 張牌，並對敵方國力造成 1 點傷害。'
    },
    shu_machao: {
      id: 'shu_machao', name: '馬超', type: 'GENERAL', faction: 'SHU', cost: 5, atk: 4, hp: 4, armor: 0,
      keywords: ['RUSH', 'PIERCE'], icon: '🐎', skillName: '鐵騎',
      text: '【鐵騎】突襲、破甲。攻擊護衛武將時，傷害 +1。'
    },
    shu_jiangwei: {
      id: 'shu_jiangwei', name: '姜維', type: 'GENERAL', faction: 'SHU', cost: 5, atk: 4, hp: 5, armor: 0,
      keywords: [], icon: '🌟', skillName: '繼志・九伐',
      text: '【繼志】登場：若我方場上有諸葛亮，獲得 +2/+2 與護衛。【九伐】攻擊國力且敵方國力 ≤ 15 時，額外 +2 傷。'
    },
    shu_zhugeliang: {
      id: 'shu_zhugeliang', name: '諸葛亮', type: 'GENERAL', faction: 'SHU', cost: 6, atk: 2, hp: 5, armor: 1,
      keywords: ['ARMOR', 'SHROUD'], icon: '🪶', skillName: '觀星・八陣',
      activeSkill: { name: '八陣', cost: 1, desc: '二選一：全友軍+1臨時護甲並移除減益／存2點糧倉' },
      text: '【觀星】帷幕。登場：抽 2 張牌（若為謀略牌則費用 -1，最低 1，持續 2 大回合）。【八陣】主動(1糧，二選一)：全友軍 +1 臨時護甲並移除負面減益／往己方糧倉存入 2 點糧草。'
    },
    shu_guagu: {
      id: 'shu_guagu', name: '刮骨療毒', type: 'TACTIC', faction: 'SHU', cost: 1, target: 'ally_general', icon: '🩺',
      text: '移除一名友方武將的負面減益（包含灼燒）；若無負面減益，則回復其 2 點生命。',
      flavor: '「關羽刮骨療毒，飲酒食肉，談笑弈棋，神色自若。」'
    },
    shu_muniuliuma: {
      id: 'shu_muniuliuma', name: '木牛流馬', type: 'TACTIC', faction: 'SHU', cost: 2, target: 'none', icon: '🐂',
      text: '往己方糧倉存入 2 點糧草（上限 3），並抽 1 張牌。',
      flavor: '「諸葛亮北伐造木牛流馬，運糧崎嶇蜀道而不絕。」'
    },
    shu_taoyuan: {
      id: 'shu_taoyuan', name: '桃園結義', type: 'TACTIC', faction: 'SHU', cost: 3, target: 'none', icon: '🍑',
      text: '使所有友方武將獲得 +1/+1。',
      flavor: '「不求同年同月同日生，但願同年同月同日死。」'
    },
    shu_kongcheng: {
      id: 'shu_kongcheng', name: '空城計', type: 'TACTIC', faction: 'SHU', cost: 3, target: 'none', icon: '🏯',
      text: '所有友方武將獲得 +2 臨時護甲（持續 2 大回合），並抽 1 張牌。',
      flavor: '「西城樓上撫琴焚香，談笑退司馬十五萬大軍。」'
    },
    shu_jushui: {
      id: 'shu_jushui', name: '據水斷橋', type: 'TACTIC', faction: 'SHU', cost: 3, target: 'ally_general', icon: '🌉',
      text: '指定一名友方武將獲得「護衛」與 +2 臨時護甲（1大回合）；若該武將為「張飛」，額外對敵方最高攻武將造成 1 點傷害。',
      flavor: '「張飛據水斷橋，橫矛立馬，曹軍無人敢近。」'
    },
    shu_beifa: {
      id: 'shu_beifa', name: '出師北伐', type: 'TACTIC', faction: 'SHU', cost: 4, target: 'enemy_general', icon: '📜',
      text: '指定一名敵方武將造成 4 點傷害；若擊殺目標則抽 1 張牌。',
      flavor: '「今當遠離，臨表涕零，不知所言。」'
    },

    // ==========================================
    // 魏 WEI (13 Generals + 5 Tactics = 18 cards)
    // ==========================================
    wei_yuejin: {
      id: 'wei_yuejin', name: '樂進', type: 'GENERAL', faction: 'WEI', cost: 1, atk: 1, hp: 3, armor: 1,
      keywords: ['ARMOR'], icon: '🛡️', skillName: '驍果',
      text: '【驍果】攻擊生命值不低於自身的敵方武將時，本回合 +1 攻；若目標為護衛武將，改為 +2 攻。'
    },
    wei_xuhuang: {
      id: 'wei_xuhuang', name: '徐晃', type: 'GENERAL', faction: 'WEI', cost: 2, atk: 2, hp: 3, armor: 0,
      keywords: [], icon: '🪓', skillName: '斷糧',
      text: '【斷糧】登場：敵方最高攻武將 -1 攻（2大回合），並扣除敵方 1 點糧倉。'
    },
    wei_guojia: {
      id: 'wei_guojia', name: '郭嘉', type: 'GENERAL', faction: 'WEI', cost: 3, atk: 2, hp: 3, armor: 0,
      keywords: ['DEATHRATTLE'], icon: '🕯️', skillName: '奇佐・遺計',
      activeSkill: { name: '奇佐', cost: 1, maxUses: 2, desc: '抽 1 張牌，若為謀略牌則該牌本回合費用 -1（最低 1）' },
      text: '【奇佐】主動(1糧，每場限 2 次)：抽 1 張牌，若為謀略牌則該牌本回合費用 -1（最低 1）。【遺計】陣亡：抽 1 張牌；若我方手牌少於敵方，改為抽 2 張牌。'
    },
    wei_caoren: {
      id: 'wei_caoren', name: '曹仁', type: 'GENERAL', faction: 'WEI', cost: 3, atk: 2, hp: 4, armor: 2,
      keywords: ['ARMOR', 'GUARD'], icon: '🏰', skillName: '據守',
      activeSkill: { name: '據守', cost: 1, desc: '自己與相鄰友軍 +1 臨時護甲（1大回合）' },
      text: '【據守】主動(1糧)：自己與相鄰友軍 +1 臨時護甲（本回合與下個敵方回合）。'
    },
    wei_zhangliao: {
      id: 'wei_zhangliao', name: '張遼', type: 'GENERAL', faction: 'WEI', cost: 4, atk: 3, hp: 4, armor: 0,
      keywords: [], icon: '⚡', skillName: '止啼・威震',
      text: '【止啼】登場：指定一名敵方武將失去技能。【威震】敵方對張遼發動普通攻擊時，攻擊力 -1（最低 0）。'
    },
    wei_xiahoudun: {
      id: 'wei_xiahoudun', name: '夏侯惇', type: 'GENERAL', faction: 'WEI', cost: 4, atk: 4, hp: 4, armor: 1,
      keywords: ['ARMOR'], icon: '👁️', skillName: '剛烈',
      text: '【剛烈】每當夏侯惇受到傷害後，本回合攻擊力 +2（每回合限 1 次）。'
    },
    wei_dianwei: {
      id: 'wei_dianwei', name: '典韋', type: 'GENERAL', faction: 'WEI', cost: 4, atk: 3, hp: 5, armor: 1,
      keywords: ['ARMOR', 'GUARD'], icon: '🔱', skillName: '惡來',
      text: '【惡來】每次受到傷害時，攻擊力 +1。'
    },
    wei_dengai: {
      id: 'wei_dengai', name: '鄧艾', type: 'GENERAL', faction: 'WEI', cost: 4, atk: 3, hp: 3, armor: 0,
      keywords: ['RUSH'], icon: '🏔️', skillName: '急襲',
      text: '【急襲】可無視敵方場上武將直接攻擊敵方國力（登場當回合無法攻擊敵方國力）。'
    },
    wei_zhanghe: {
      id: 'wei_zhanghe', name: '張郃', type: 'GENERAL', faction: 'WEI', cost: 4, atk: 3, hp: 4, armor: 0,
      keywords: [], icon: '🎯', skillName: '料敵',
      text: '【料敵】登場：查看敵方最高費手牌，若為謀略牌則費用 +1（2大回合），若為武將牌則 -1/-1（2大回合）。'
    },
    wei_xunyou: {
      id: 'wei_xunyou', name: '荀攸', type: 'GENERAL', faction: 'WEI', cost: 4, atk: 2, hp: 4, armor: 0,
      keywords: [], icon: '🧭', skillName: '奇策',
      text: '【奇策】登場（三選一）：抽 2 張牌／對敵方武將造成 3 傷／全友軍 +1/+1。'
    },
    wei_xuchu: {
      id: 'wei_xuchu', name: '許褚', type: 'GENERAL', faction: 'WEI', cost: 5, atk: 5, hp: 5, armor: 0,
      keywords: ['SNIPE'], icon: '🐯', skillName: '裸衣・虎痴',
      text: '【裸衣】登場可選自損 2 生命換 +2 攻。【虎痴】攻擊時無視護衛。'
    },
    wei_simayi: {
      id: 'wei_simayi', name: '司馬懿', type: 'GENERAL', faction: 'WEI', cost: 5, atk: 3, hp: 4, armor: 1,
      keywords: ['ARMOR', 'SHROUD'], icon: '🐺', skillName: '隱忍・反噬',
      activeSkill: { name: '反噬', cost: 1, maxUses: 1, desc: '需 ≥2 層權謀（限1次）：消耗全部權謀，對敵全體造成層數點傷害，自身永久 +2/+2' },
      text: '【隱忍】帷幕。登場：存 1 點糧倉，敵全體本回合與下個敵方回合 -1 攻。【反噬】敵方打謀略牌或用主動技時，獲 1 層權謀（上限3，用主動技後失效）並打敵國力 1 傷。主動(1糧，需≥2層，限1次)：耗全部權謀對敵全體造層數點傷並自身永久 +2/+2。'
    },
    wei_caocao: {
      id: 'wei_caocao', name: '曹操', type: 'GENERAL', faction: 'WEI', cost: 6, atk: 4, hp: 6, armor: 1,
      keywords: ['ARMOR', 'SHROUD'], icon: '👑', skillName: '奸雄・魏武',
      text: '【奸雄】帷幕。登場(二選一)：全友軍本回合 +2 攻／抽 2 張牌並存 1 點糧倉。【魏武】每當我方對敵將施加減攻或打出謀略牌時，對敵最高攻造 1 傷（每回合限 2 次；空場則打敵國力 1 傷）。'
    },
    wei_wangmei: {
      id: 'wei_wangmei', name: '望梅止渴', type: 'TACTIC', faction: 'WEI', cost: 1, target: 'ally_general', icon: '🍑',
      text: '指定一名友方武將本回合獲得 +1 攻；若其帶有「突襲」，改為 +2 攻。',
      flavor: '「前有大梅林，饒子，甘酸可以解渴。」'
    },
    wei_xietianzi: {
      id: 'wei_xietianzi', name: '挾天子令諸侯', type: 'TACTIC', faction: 'WEI', cost: 2, target: 'none', icon: '👑',
      text: '抽 1 張牌，使敵方最高攻武將攻擊力 -1（2大回合；若其攻擊力 ≥ 4 改為 -2 攻），己方國力 -1。',
      flavor: '「迎漢獻帝都許昌，奉天子以令不臣。」'
    },
    wei_duanliang: {
      id: 'wei_duanliang', name: '斷糧奇兵', type: 'TACTIC', faction: 'WEI', cost: 2, target: 'none', icon: '🔥',
      text: '掠奪敵方最多 2 點糧倉轉為己方臨時糧草（若敵方無糧倉改為抽 1 張牌），並使敵方最高攻武將 -1 攻（2大回合）。',
      flavor: '「兵馬未動，糧草先行；斷其輜重，敵陣自潰。」'
    },
    wei_jianbi: {
      id: 'wei_jianbi', name: '堅壁清野', type: 'TACTIC', faction: 'WEI', cost: 2, target: 'none', icon: '🧱',
      text: '所有友方武將獲得 +1 臨時護甲（1大回合）；敵方下回合糧草收入 -1（最低 0，不影響糧草上限）。',
      flavor: '「堅壁清野，使敵無所掠，糧盡自退。」'
    },
    wei_quhu: {
      id: 'wei_quhu', name: '驅虎吞狼', type: 'TACTIC', faction: 'WEI', cost: 3, target: 'enemy_general', icon: '🐯',
      text: '指定一名敵方武將造成 3 點傷害，並使其攻擊力 -1（持續 2 大回合）；若擊殺目標，往己方糧倉存入 1 點糧草。',
      flavor: '「荀彧獻二虎競食、驅虎吞狼之計，令劉備呂布自相殘殺。」'
    },
    wei_guandu: {
      id: 'wei_guandu', name: '奇襲烏巢', type: 'TACTIC', faction: 'WEI', cost: 3, target: 'none', icon: '🔥',
      text: '敵方糧草上限 -1（最低 1），己方本回合獲得 +1 臨時糧草，並對敵方最高攻武將造成 2 點傷害。',
      flavor: '「官渡夜襲烏巢，盡焚袁軍萬車軍糧，一戰定北方。」'
    },

    // ==========================================
    // 吳 WU (12 Generals + 5 Tactics = 17 cards)
    // ==========================================
    wu_lingtong: {
      id: 'wu_lingtong', name: '凌統', type: 'GENERAL', faction: 'WU', cost: 1, atk: 1, hp: 2, armor: 0,
      keywords: [], icon: '🌊', skillName: '死戰',
      text: '【死戰】首次受到致命傷害時，保留 1 點生命並獲得 +1 攻擊力（每場遊戲一次）。'
    },
    wu_huanggai: {
      id: 'wu_huanggai', name: '黃蓋', type: 'GENERAL', faction: 'WU', cost: 2, atk: 3, hp: 3, armor: 0,
      keywords: [], icon: '🔥', skillName: '苦肉',
      activeSkill: { name: '苦肉', cost: 0, maxUses: 2, desc: '己方國力 -2，抽 1 牌並獲得 +1 臨時糧草（每場限 2 次）' },
      text: '【苦肉】主動(0糧，每場限 2 次)：己方國力 -2，抽 1 張牌並獲得 +1 臨時糧草。'
    },
    wu_ganning: {
      id: 'wu_ganning', name: '甘寧', type: 'GENERAL', faction: 'WU', cost: 3, atk: 3, hp: 2, armor: 0,
      keywords: ['RUSH'], icon: '⚓', skillName: '劫營',
      text: '【劫營】登場：敵方隨機棄 1 張手牌。'
    },
    wu_taishici: {
      id: 'wu_taishici', name: '太史慈', type: 'GENERAL', faction: 'WU', cost: 3, atk: 2, hp: 4, armor: 0,
      keywords: ['COMBO'], icon: '🏹', skillName: '神射',
      text: '【神射】登場：對指定敵方武將造成 2 點傷害（無反擊）；若目標陣亡，自身 +1/+1。'
    },
    wu_zhugejin: {
      id: 'wu_zhugejin', name: '諸葛瑾', type: 'GENERAL', faction: 'WU', cost: 3, atk: 2, hp: 4, armor: 0,
      keywords: [], icon: '🕊️', skillName: '緩兵・緩釋',
      text: '【緩兵】登場：指定一名敵方武將下回合無法攻擊。【緩釋】在場時，我方其他武將受到的謀略牌與技能傷害 -1（最低 1）。'
    },
    wu_zhanghong: {
      id: 'wu_zhanghong', name: '張紘', type: 'GENERAL', faction: 'WU', cost: 3, atk: 2, hp: 4, armor: 0,
      keywords: [], icon: '✒️', skillName: '文采',
      text: '【文采】每當我方打出謀略牌時，張紘獲得 +1/+1。'
    },
    wu_lumeng: {
      id: 'wu_lumeng', name: '呂蒙', type: 'GENERAL', faction: 'WU', cost: 4, atk: 3, hp: 4, armor: 1,
      keywords: ['ARMOR'], icon: '⛵', skillName: '攻心',
      text: '【攻心】登場：指定一名敵方武將，其技能在之後 2 大回合無效，且攻擊力 -1（2大回合）。'
    },
    wu_sunce: {
      id: 'wu_sunce', name: '孫策', type: 'GENERAL', faction: 'WU', cost: 4, atk: 4, hp: 3, armor: 0,
      keywords: ['COMBO', 'KILL'], icon: '🦅', skillName: '激昂',
      text: '【激昂】斬殺：自身獲得 +1/+1。'
    },
    wu_zhouyu: {
      id: 'wu_zhouyu', name: '周瑜', type: 'GENERAL', faction: 'WU', cost: 5, atk: 3, hp: 4, armor: 1,
      keywords: ['ARMOR'], icon: '🔥', skillName: '英姿・火計',
      activeSkill: { name: '火計', cost: 1, desc: '指定敵將：已灼燒造2傷並本回合-1攻；未灼燒施灼燒(2回合)並抽1牌' },
      text: '【英姿】登場：對敵全體造成 1 傷並施加灼燒（2回合）；若場上有「小喬」，額外抽 1 張牌。【火計】主動(1糧，每回合限1次)：指定一名敵將，若其已灼燒，造成 2 傷並使其本回合 -1 攻；若未灼燒，施加灼燒（2回合）並抽 1 張牌。'
    },
    wu_sunquan: {
      id: 'wu_sunquan', name: '孫權', type: 'GENERAL', faction: 'WU', cost: 5, atk: 3, hp: 5, armor: 1,
      keywords: ['ARMOR'], icon: '🐯', skillName: '制衡・坐斷東南',
      activeSkill: { name: '制衡', cost: 0, desc: '0糧：選棄1~3張手牌並摸等量牌（棄≥2張額外多抽1牌並存1糧倉）' },
      text: '【制衡】主動(0糧，每回合限 1 次)：選棄 1～3 張手牌並摸等量牌；若棄 ≥ 2 張，額外多抽 1 張牌並存 1 點糧倉。【坐斷東南】回合結束時，若我方手牌 ≥ 敵方，回國力 2 點並使相鄰友軍 +1 攻（1大回合）；若手牌 ≥ 6 張，額外打敵國力 2 傷。'
    },
    wu_zhoutai: {
      id: 'wu_zhoutai', name: '周泰', type: 'GENERAL', faction: 'WU', cost: 5, atk: 2, hp: 8, armor: 0,
      keywords: ['GUARD'], icon: '🛡️', skillName: '不屈',
      text: '【不屈】周泰的生命值不會低於 1（每場遊戲最多觸發 2 次）。'
    },
    wu_luxun: {
      id: 'wu_luxun', name: '陸遜', type: 'GENERAL', faction: 'WU', cost: 6, atk: 3, hp: 5, armor: 1,
      keywords: ['ARMOR', 'SHROUD'], icon: '🏮', skillName: '謙遜・連營・度勢',
      text: '【謙遜】帷幕。【連營】登場：指定一名敵方武將造成 2 傷並施加灼燒（2回合），火勢向其左右相鄰敵將蔓延（各受 1 傷並灼燒 2 回合）。【度勢】回合結束：若敵方場上有 ≥ 2 名灼燒武將，對所有灼燒敵將造成 1 傷，並對敵方國力造成 2 點傷害。'
    },
    wu_kurouji: {
      id: 'wu_kurouji', name: '苦肉計', type: 'TACTIC', faction: 'WU', cost: 1, target: 'ally_general', icon: '🩸',
      text: '指定一名友方武將受到 1 點傷害；若其存活，抽 1 張牌並獲得 +1 攻（本回合）。',
      flavor: '「周瑜打黃蓋，一個願打，一個願挨。」'
    },
    wu_shensu: {
      id: 'wu_shensu', name: '兵貴神速', type: 'TACTIC', faction: 'WU', cost: 1, target: 'ally_general', icon: '💨',
      text: '使一名友方武將立即解除整備（空場亦可直擊國力）；非中軍格額外 +1 攻。',
      flavor: '「江東水師乘風破浪，出其不意直搗敵營。」'
    },
    wu_lianhuan: {
      id: 'wu_lianhuan', name: '連環計', type: 'TACTIC', faction: 'WU', cost: 2, target: 'enemy_general', icon: '⛓️',
      text: '指定一名敵方武將造成 2 點傷害並施加灼燒（持續 3 回合），抽 1 張牌。',
      flavor: '「龐統獻連環鐵索鎖戰船，為赤壁大火鋪下絕境。」'
    },
    wu_dongfeng: {
      id: 'wu_dongfeng', name: '東風助火', type: 'TACTIC', faction: 'WU', cost: 3, target: 'enemy_general', icon: '🌬️',
      text: '指定一名敵方武將：若其已灼燒，造成 3 點傷害並刷新灼燒持續時間；若未灼燒，造成 1 點傷害並施加灼燒（1回合）。',
      flavor: '「東風既起，火借風勢，赤壁一炬破曹軍。」'
    },
    wu_huogong: {
      id: 'wu_huogong', name: '火燒赤壁', type: 'TACTIC', faction: 'WU', cost: 4, target: 'none', icon: '🔥',
      text: '對敵方所有武將造成 2 點傷害，並施加灼燒（每回合扣 1 血，持續 2 回合）。',
      flavor: '「東風夜放花千樹，赤壁烈焰照徹長江。」'
    },
    wu_jiangdong: {
      id: 'wu_jiangdong', name: '江東水師', type: 'TACTIC', faction: 'WU', cost: 4, target: 'none', icon: '⛵',
      text: '對敵方國力造成 3 點傷害，並使所有友方武將獲得 +1 攻擊力（持續 2 大回合）。',
      flavor: '「樓船千艘列江岸，江東精銳莫敢當。」'
    },

    // ==========================================
    // 群 QUN (13 Generals + 4 Tactics = 17 cards)
    // ==========================================
    qun_huaxiong: {
      id: 'qun_huaxiong', name: '華雄', type: 'GENERAL', faction: 'QUN', cost: 2, atk: 3, hp: 2, armor: 0,
      keywords: ['KILL'], icon: '🪓', skillName: '耀武',
      text: '【耀武】斬殺：自身獲得 +2/+1。'
    },
    qun_diaochan: {
      id: 'qun_diaochan', name: '貂蟬', type: 'GENERAL', faction: 'QUN', cost: 3, atk: 1, hp: 3, armor: 0,
      keywords: [], icon: '🌸', skillName: '閉月・離間',
      activeSkill: { name: '離間', cost: 1, maxUses: 2, desc: '敵方最高攻武將 -2 攻（1大回合，每場限 2 次）' },
      text: '【閉月】回合結束：國力 +1、相鄰友軍回 1 血。【離間】主動(1糧，限用 2 次)：敵最高攻 -2 攻（1大回合）。'
    },
    qun_yanliang: {
      id: 'qun_yanliang', name: '顏良', type: 'GENERAL', faction: 'QUN', cost: 3, atk: 4, hp: 3, armor: 0,
      keywords: [], icon: '⚔️', skillName: '雙雄',
      text: '【雙雄】登場：若我方場上有文醜，顏良與文醜各獲得 +1/+1。'
    },
    qun_wenchou: {
      id: 'qun_wenchou', name: '文醜', type: 'GENERAL', faction: 'QUN', cost: 3, atk: 3, hp: 4, armor: 1,
      keywords: ['ARMOR', 'GUARD'], icon: '🛡️', skillName: '雙雄',
      text: '【雙雄】登場：若我方場上有顏良，顏良與文醜各獲得 +1/+1。'
    },
    qun_xiliang: {
      id: 'qun_xiliang', name: '西涼鐵騎', type: 'GENERAL', faction: 'QUN', cost: 3, atk: 3, hp: 2, armor: 0,
      keywords: ['RUSH'], icon: '🐎', skillName: '奔襲',
      text: '【奔襲】登場：若己方糧倉 ≥ 1，消耗 1 點糧倉並獲得 +1/+1。'
    },
    qun_jiaxu: {
      id: 'qun_jiaxu', name: '賈詡', type: 'GENERAL', faction: 'QUN', cost: 4, atk: 2, hp: 4, armor: 0,
      keywords: ['SHROUD'], icon: '☠️', skillName: '完殺・亂武',
      activeSkill: { name: '亂武', cost: 1, maxUses: 1, desc: '迫使敵方棄1張手牌，或敵全體受1傷且-1攻（1大回合）；若無手牌則敵全體2傷' },
      text: '【完殺】帷幕。登場：指定一名敵將清除其所有正向增益（攻／甲／護衛增益）。【亂武】主動(1糧，每場限1次)：迫使敵方二選一——棄置 1 張手牌，或使其全體武將受 1 傷且 -1 攻（1大回合）；若敵方無手牌，改為對敵全體造成 2 傷。'
    },
    qun_zhangjiao: {
      id: 'qun_zhangjiao', name: '張角', type: 'GENERAL', faction: 'QUN', cost: 4, atk: 2, hp: 4, armor: 0,
      keywords: ['DEATHRATTLE'], icon: '⚡', skillName: '黃天・雷擊',
      activeSkill: { name: '雷擊', cost: 1, desc: '獻祭1名黃巾力士（或耗1糧倉），對指定敵將造3傷並回自身1血' },
      text: '【黃天】登場：在空位召喚 1 名 1/2「黃巾力士」。【雷擊】主動(1糧)：獻祭 1 名黃巾力士（或耗 1 糧倉），對指定敵將造 3 傷並回自身 1 血。遺計：對敵全體造成 1 傷。'
    },
    qun_mateng: {
      id: 'qun_mateng', name: '馬騰', type: 'GENERAL', faction: 'QUN', cost: 4, atk: 4, hp: 3, armor: 0,
      keywords: ['RUSH'], icon: '🐴', skillName: '鐵騎',
      text: '【鐵騎】攻擊護衛武將時，傷害 +1。'
    },
    qun_zhangren: {
      id: 'qun_zhangren', name: '張任', type: 'GENERAL', faction: 'QUN', cost: 4, atk: 3, hp: 4, armor: 0,
      keywords: [], icon: '🏹', skillName: '伏擊',
      text: '【伏擊】防守時若攻擊力 ≥ 攻擊者生命值，直接反殺且不受傷害。'
    },
    qun_yuanshu: {
      id: 'qun_yuanshu', name: '袁術', type: 'GENERAL', faction: 'QUN', cost: 5, atk: 5, hp: 5, armor: 0,
      keywords: [], icon: '🏺', skillName: '稱帝・眾叛',
      text: '【稱帝】登場：隨機棄 1 張手牌，自身獲得 +2/+2 與護衛。【眾叛】每回合結束：己方國力 -2。'
    },
    qun_yuanshao: {
      id: 'qun_yuanshao', name: '袁紹', type: 'GENERAL', faction: 'QUN', cost: 5, atk: 3, hp: 5, armor: 1,
      keywords: ['ARMOR'], icon: '🚩', skillName: '亂擊',
      text: '【亂擊】登場：對敵全體造成 1 傷，友方全體 +1 攻（持續 2 大回合）。'
    },
    qun_dongzhuo: {
      id: 'qun_dongzhuo', name: '董卓', type: 'GENERAL', faction: 'QUN', cost: 5, atk: 4, hp: 6, armor: 1,
      keywords: ['ARMOR'], icon: '👹', skillName: '暴政',
      text: '【暴政】登場：己方國力 -2。'
    },
    qun_lubu: {
      id: 'qun_lubu', name: '呂布', type: 'GENERAL', faction: 'QUN', cost: 7, atk: 6, hp: 6, armor: 0,
      keywords: ['RUSH', 'PIERCE', 'KILL'], icon: '🔱', skillName: '無雙',
      text: '【無雙】突襲、破甲。斬殺：本回合可額外攻擊 1 次（每回合限 1 次），並對敵方國力造成 2 點傷害。'
    },
    qun_ertao: {
      id: 'qun_ertao', name: '二桃殺三士', type: 'TACTIC', faction: 'QUN', cost: 1, target: 'enemy_adjacent_pair', icon: '🍑',
      text: '指定兩名相鄰的敵方武將，各 -1 攻（1大回合）；若兩者攻擊力相同，抽 1 張牌。',
      flavor: '「二桃殺三士，誰為晏子謀。」'
    },
    qun_manli: {
      id: 'qun_manli', name: '鐵騎突襲', type: 'TACTIC', faction: 'QUN', cost: 2, target: 'enemy_general', icon: '🐎',
      text: '指定一名敵方武將造成 3 點傷害。',
      flavor: '「涼州鐵騎捲地而來，瞬息衝破前線陣列。」'
    },
    qun_wushuang: {
      id: 'qun_wushuang', name: '天下無雙', type: 'TACTIC', faction: 'QUN', cost: 3, target: 'ally_general', icon: '⚡',
      text: '指定一名友方武將獲得 +3 攻擊力與 +1 臨時護甲（持續 1 大回合）。',
      flavor: '「虎牢關前獨戰三英，畫戟所指無人能攖其鋒。」'
    },
    qun_meirenji: {
      id: 'qun_meirenji', name: '美人計', type: 'TACTIC', faction: 'QUN', cost: 3, target: 'enemy_general', icon: '🌺',
      text: '指定一名敵方武將，攻擊力 -2（2大回合）；若其為敵方最高攻武將，改為 -3 攻（2大回合）。',
      flavor: '「王允設連環美人計，呂布董卓相爭於鳳儀亭。」'
    },
    qun_huoshao: {
      id: 'qun_huoshao', name: '焚城掠地', type: 'TACTIC', faction: 'QUN', cost: 4, target: 'none', icon: '🔥',
      text: '對敵方所有武將造成 2 點傷害，並對敵方國力造成 2 點傷害。',
      flavor: '「董卓遷都長安，縱火焚燒洛陽宮室，千里焦土。」'
    },

    // ==========================================
    // 中立 NEUTRAL (6 Generals + 7 Tactics = 13 cards)
    // ==========================================
    neu_bubing: {
      id: 'neu_bubing', name: '精銳步卒', type: 'GENERAL', faction: 'NEU', cost: 1, atk: 1, hp: 2, armor: 1,
      keywords: ['ARMOR'], icon: '🛡️', skillName: '列陣',
      text: '【列陣】穩健的前期基礎步兵。'
    },

    // ==========================================
    // v3.3 NEW GENERALS (18 Cards)
    // ==========================================
    wei_yujin: {
      id: 'wei_yujin', name: '于禁', type: 'GENERAL', faction: 'WEI', cost: 2, atk: 2, hp: 4, armor: 2,
      keywords: ['ARMOR'], icon: '🛡️', skillName: '節潰',
      text: '【節潰】當于禁生命值 ≤ 1 時，永久失去護甲且攻擊力 -1（最低為 0）。'
    },
    wei_zhonghui: {
      id: 'wei_zhonghui', name: '鍾會', type: 'GENERAL', faction: 'WEI', cost: 3, atk: 3, hp: 3, armor: 0,
      keywords: ['SHROUD'], icon: '🗡️', skillName: '自立',
      text: '【自立】帷幕。回合結束時，若己方糧倉 ≥ 2，消耗 2 點糧倉，使鍾會永久獲得 +2/+2、破甲並抽 1 張牌。'
    },
    wei_lidian: {
      id: 'wei_lidian', name: '李典', type: 'GENERAL', faction: 'WEI', cost: 2, atk: 1, hp: 4, armor: 1,
      keywords: ['ARMOR', 'GUARD', 'DEATHRATTLE'], icon: '🏯', skillName: '恂恂',
      text: '【恂恂】護衛。遺計：往己方糧倉存入 1 點糧草，並使相鄰友軍獲得 +1 攻與 +1 臨時護甲（1 大回合）。'
    },
    wei_xiahouyuan: {
      id: 'wei_xiahouyuan', name: '夏侯淵', type: 'GENERAL', faction: 'WEI', cost: 3, atk: 3, hp: 3, armor: 0,
      keywords: ['RUSH'], icon: '🐎', skillName: '虎步',
      text: '【虎步】突襲。登場：若敵方場上武將數 ≥ 我方，夏侯淵本回合獲得 +1 攻與連擊。'
    },

    shu_liubei: {
      id: 'shu_liubei', name: '劉備', type: 'GENERAL', faction: 'SHU', cost: 6, atk: 2, hp: 6, armor: 1,
      keywords: ['ARMOR'], icon: '👑', skillName: '昭烈・激將',
      text: '【昭烈】登場：所有友方武將獲得 +1/+1；若場上有「關羽」或「張飛」，額外回復己方國力 2 點並抽 1 張牌。【激將】相鄰友軍發動攻擊時，本回合攻擊力 +1。'
    },
    shu_liushan: {
      id: 'shu_liushan', name: '劉禪', type: 'GENERAL', faction: 'SHU', cost: 2, atk: 1, hp: 4, armor: 0,
      keywords: [], icon: '🏮', skillName: '放權',
      activeSkill: { name: '放權', cost: 0, maxUses: 2, desc: '本回合無法攻擊，+1臨時糧草並使友將+1攻（孔明/姜維額外抽1牌）' },
      text: '【放權】主動(0糧，每場限 2 次)：劉禪本回合無法攻擊，使己方本回合有額外 1 點臨時糧草並使一名友方武將本回合 +1 攻；若目標為「諸葛亮」或「姜維」，額外抽 1 張牌。'
    },
    shu_menghuo: {
      id: 'shu_menghuo', name: '孟獲', type: 'GENERAL', faction: 'SHU', cost: 5, atk: 4, hp: 5, armor: 0,
      keywords: ['DEATHRATTLE'], icon: '🐘', skillName: '再起',
      text: '【再起】遺計：若己方國力 ≥ 18，在原位重新召喚 1 名 2/3/0、無遺計的「孟獲」。'
    },
    shu_masu: {
      id: 'shu_masu', name: '馬謖', type: 'GENERAL', faction: 'SHU', cost: 3, atk: 2, hp: 3, armor: 0,
      keywords: [], icon: '📜', skillName: '心戰・才氣',
      text: '【心戰】登場：查看敵方隨機 2 張手牌；若其中包含謀略牌，抽 1 張牌並對敵方最高攻武將造成 1 點傷害。【才氣】每回合我方打出的第一張謀略牌費用 -1（最低為 1）。'
    },
    shu_liyan: {
      id: 'shu_liyan', name: '李嚴', type: 'GENERAL', faction: 'SHU', cost: 4, atk: 2, hp: 4, armor: 1,
      keywords: ['ARMOR'], icon: '🌾', skillName: '督糧',
      activeSkill: { name: '督糧', cost: 0, desc: '耗1糧倉獲2臨時糧草；若無糧倉則存1糧倉' },
      text: '【督糧】登場：往己方糧倉存入 2 點糧草。主動(0糧)：若己方糧倉 ≥ 1，消耗 1 點糧倉獲得 2 點臨時糧草；否則存 1 點糧倉。在場時糧倉上限 +1（4點）；回合結束糧倉為 0 則國力 -1。'
    },

    wu_dingfeng: {
      id: 'wu_dingfeng', name: '丁奉', type: 'GENERAL', faction: 'WU', cost: 2, atk: 2, hp: 2, armor: 0,
      keywords: ['RUSH'], icon: '🗡️', skillName: '短兵',
      text: '【短兵】突襲。攻擊擁有護甲或護衛的敵方武將時，本回合 +2 攻並獲得破甲。'
    },
    wu_xusheng: {
      id: 'wu_xusheng', name: '徐盛', type: 'GENERAL', faction: 'WU', cost: 4, atk: 3, hp: 4, armor: 1,
      keywords: ['ARMOR', 'GUARD'], icon: '🏯', skillName: '疑城・破軍',
      text: '【疑城】護衛。登場：若我方手牌 ≥ 4 張，獲得 +2 臨時護甲（2大回合）與帷幕（1大回合）。【破軍】登場：清除指定敵將護甲並凍結下回合；若目標為護衛則額外造成 2 傷。'
    },
    wu_guyong: {
      id: 'wu_guyong', name: '顧雍', type: 'GENERAL', faction: 'WU', cost: 2, atk: 1, hp: 4, armor: 0,
      keywords: [], icon: '📖', skillName: '慎行',
      activeSkill: { name: '慎行', cost: 1, desc: '棄1手牌，存1糧倉抽1牌（棄謀略改抽2牌）' },
      text: '【慎行】主動(1糧)：棄 1 張手牌，往己方糧倉存入 1 點糧草並抽 1 張牌；若棄置的是謀略牌，改為抽 2 張牌。'
    },
    wu_xiaoqiao: {
      id: 'wu_xiaoqiao', name: '小喬', type: 'GENERAL', faction: 'WU', cost: 3, atk: 1, hp: 4, armor: 0,
      keywords: [], icon: '🌺', skillName: '天香',
      text: '【天香】每當小喬受到普通攻擊傷害時，傷害 -1（最低 0），並對敵方最高攻武將施加灼燒（持續 2 回合）；若我方場上有「周瑜」，額外抽 1 張牌。'
    },
    wu_zhangzhao: {
      id: 'wu_zhangzhao', name: '張昭', type: 'GENERAL', faction: 'WU', cost: 3, atk: 1, hp: 5, armor: 1,
      keywords: ['ARMOR'], icon: '🏛️', skillName: '固政',
      text: '【固政】每當我方棄置手牌時，回復己方國力 1 點並往己方糧倉存入 1 點糧草（每回合限 1 次）。登場：可棄 1 張牌並抽 1 張牌；若我方場上有「張紘」，抽 1 張牌。'
    },

    qun_jiling: {
      id: 'qun_jiling', name: '紀靈', type: 'GENERAL', faction: 'QUN', cost: 3, atk: 3, hp: 4, armor: 0,
      keywords: [], icon: '🔱', skillName: '雙刃',
      text: '【雙刃】每當紀靈主動攻擊敵方武將時，同時對目標相鄰的敵方武將造成 1 點傷害；若主目標陣亡，額外對敵方國力造成 1 點傷害。'
    },
    qun_tianfeng: {
      id: 'qun_tianfeng', name: '田豐', type: 'GENERAL', faction: 'QUN', cost: 1, atk: 1, hp: 2, armor: 0,
      keywords: ['DEATHRATTLE'], icon: '📜', skillName: '死諫',
      text: '【死諫】遺計：抽 1 張牌；若陣亡時我方手牌數為 0，改為抽 2 張牌並對敵方最高攻武將造成 2 點傷害。'
    },
    qun_gaoshun: {
      id: 'qun_gaoshun', name: '高順', type: 'GENERAL', faction: 'QUN', cost: 4, atk: 4, hp: 4, armor: 1,
      keywords: ['ARMOR', 'PIERCE'], icon: '⚔️', skillName: '陷陣',
      text: '【陷陣】破甲。攻擊護衛武將或敵方國力時，傷害 +1；若我方場上有「呂布」，高順獲得突襲。'
    },
    qun_jushou: {
      id: 'qun_jushou', name: '沮授', type: 'GENERAL', faction: 'QUN', cost: 3, atk: 2, hp: 4, armor: 0,
      keywords: [], icon: '🧭', skillName: '漸營',
      text: '【漸營】每當我方在單一回合內打出第 2 張牌時，抽 1 張牌並獲得 1 點臨時糧草；在單一回合內打出第 3 張牌時，使全友軍 +0/+1。'
    },

    neu_gongbing: {
      id: 'neu_gongbing', name: '強弩手', type: 'GENERAL', faction: 'NEU', cost: 2, atk: 2, hp: 2, armor: 0,
      keywords: [], icon: '🏹', skillName: '齊射',
      text: '【齊射】登場：對敵方國力造成 1 點傷害。'
    },
    neu_qibing: {
      id: 'neu_qibing', name: '輕騎兵', type: 'GENERAL', faction: 'NEU', cost: 2, atk: 3, hp: 2, armor: 0,
      keywords: ['RUSH'], icon: '🐎', skillName: '遊擊',
      text: '【遊擊】高機動突襲先鋒。'
    },
    neu_chengong: {
      id: 'neu_chengong', name: '陳宮', type: 'GENERAL', faction: 'NEU', cost: 2, atk: 2, hp: 2, armor: 0,
      keywords: [], icon: '📜', skillName: '明策',
      text: '【明策】登場：若糧倉 ≥ 1，耗 1 糧倉抽 1 牌；否則存入 1 糧倉。'
    },
    neu_dunbing: {
      id: 'neu_dunbing', name: '重甲盾衛', type: 'GENERAL', faction: 'NEU', cost: 3, atk: 1, hp: 5, armor: 2,
      keywords: ['ARMOR', 'GUARD'], icon: '🛡️', skillName: '鐵壁',
      text: '【鐵壁】重甲護衛相鄰友軍。'
    },
    neu_huatuo: {
      id: 'neu_huatuo', name: '華佗', type: 'GENERAL', faction: 'NEU', cost: 4, atk: 1, hp: 4, armor: 0,
      keywords: [], icon: '🌿', skillName: '青囊',
      activeSkill: { name: '青囊', cost: 1, desc: '二選一：回復國力 2 點／全友軍回復 2 血（不超過上限）' },
      text: '【青囊】主動(1糧，二選一)：回復己方國力 2 點／回復所有友方武將 2 點生命（回復生命，不超過生命上限）。'
    },
    neu_tuntian: {
      id: 'neu_tuntian', name: '屯田積糧', type: 'TACTIC', faction: 'NEU', cost: 1, target: 'none', icon: '🌾',
      text: '抽 1 張牌，回復己方國力 1 點。',
      flavor: '「棗祇、任峻行屯田之制，軍糧充盈而四方漸定。」'
    },
    neu_huanwei: {
      id: 'neu_huanwei', name: '移形換位', type: 'TACTIC', faction: 'NEU', cost: 1, target: 'ally_general', icon: '🔄',
      text: '將指定友方武將與 3 號位互換（若已在 3 號位則與 2 號位互換），獲 +2 臨時護甲與護衛（1大回合）。',
      flavor: '「陣勢隨敵而變，奇正相生若環之無端。」'
    },
    neu_anfuminxin: {
      id: 'neu_anfuminxin', name: '安撫民心', type: 'TACTIC', faction: 'NEU', cost: 2, target: 'none', icon: '🏮',
      text: '回復己方國力 4 點。',
      flavor: '「得民心者得天下，輕徭薄賦以養生息。」'
    },
    neu_guwu: {
      id: 'neu_guwu', name: '擂鼓助威', type: 'TACTIC', faction: 'NEU', cost: 2, target: 'ally_general', icon: '🥁',
      text: '指定一名友方武將獲得 +2/+2。',
      flavor: '「一鼓作氣，三軍士氣大振。」'
    },
    neu_pojia: {
      id: 'neu_pojia', name: '破甲強弩', type: 'TACTIC', faction: 'NEU', cost: 2, target: 'enemy_general', icon: '🎯',
      text: '指定一名敵方武將，清除其當前護甲並造成 2 點傷害。',
      flavor: '「連弩穿鐵甲，百步破堅陣。」'
    },
    neu_shengdong: {
      id: 'neu_shengdong', name: '聲東擊西', type: 'TACTIC', faction: 'NEU', cost: 2, target: 'ally_general', icon: '🧭',
      text: '指定一名友方武將，本回合獲得「狙擊」；若其位於 2 號位或 4 號位，抽 1 張牌。',
      flavor: '「聲言東擊，實則西取，敵不能測。」'
    },
    neu_jianyu: {
      id: 'neu_jianyu', name: '萬箭齊發', type: 'TACTIC', faction: 'NEU', cost: 3, target: 'none', icon: '🏹',
      text: '對敵方所有武將造成 1 點傷害，並抽 1 張牌。',
      flavor: '「箭如飛蝗蔽天日，敵陣一時難立。」'
    }
  };

  const STARTER_DECKS = {
    SHU: [
      'shu_liaohua', 'shu_liaohua',
      'shu_guanping', 'shu_guanping',
      'shu_fazheng', 'shu_fazheng',
      'shu_wangping', 'shu_wangping',
      'shu_weiyan', 'shu_huangzhong',
      'shu_zhaoyun', 'shu_zhaoyun',
      'shu_zhangfei', 'shu_zhangfei',
      'shu_guanyu', 'shu_jiangwei',
      'shu_machao', 'shu_zhugeliang',
      'shu_muniuliuma', 'shu_muniuliuma',
      'shu_taoyuan', 'shu_jushui',
      'shu_kongcheng', 'shu_beifa',
      'neu_bubing', 'neu_bubing',
      'shu_guagu', 'neu_shengdong',
      'neu_pojia', 'neu_huanwei'
    ],
    WEI: [
      'wei_yuejin', 'wei_yuejin',
      'wei_xuhuang', 'wei_xuhuang',
      'wei_guojia', 'wei_guojia',
      'wei_caoren', 'wei_caoren',
      'wei_zhangliao', 'wei_zhanghe',
      'wei_xunyou', 'wei_dengai',
      'wei_xiahoudun', 'wei_dianwei',
      'wei_xuchu', 'wei_simayi',
      'wei_caocao', 'wei_caocao',
      'wei_xietianzi', 'wei_xietianzi',
      'wei_duanliang', 'wei_jianbi',
      'wei_quhu', 'wei_quhu',
      'wei_guandu', 'wei_wangmei',
      'neu_huatuo', 'neu_tuntian',
      'neu_pojia', 'neu_huanwei'
    ],
    WU: [
      'wu_lingtong', 'wu_lingtong',
      'wu_huanggai', 'wu_huanggai',
      'wu_ganning', 'wu_taishici',
      'wu_zhugejin', 'wu_zhanghong',
      'wu_zhanghong', 'wu_lumeng',
      'wu_sunce', 'wu_sunce',
      'wu_zhouyu', 'wu_sunquan',
      'wu_zhoutai', 'wu_luxun',
      'wu_shensu', 'wu_shensu',
      'wu_lianhuan', 'wu_lianhuan',
      'wu_dongfeng', 'wu_huogong',
      'wu_huogong', 'wu_jiangdong',
      'wu_kurouji', 'neu_tuntian',
      'neu_shengdong', 'neu_anfuminxin',
      'neu_pojia', 'neu_jianyu'
    ],
    QUN: [
      'qun_huaxiong', 'qun_huaxiong',
      'qun_diaochan', 'qun_diaochan',
      'qun_yanliang', 'qun_yanliang',
      'qun_wenchou', 'qun_wenchou',
      'qun_xiliang', 'qun_xiliang',
      'qun_jiaxu', 'qun_zhangjiao',
      'qun_mateng', 'qun_zhangren',
      'qun_yuanshu', 'qun_yuanshao',
      'qun_dongzhuo', 'qun_lubu',
      'qun_manli', 'qun_manli',
      'qun_ertao', 'qun_meirenji',
      'qun_huoshao', 'qun_huoshao',
      'neu_bubing', 'neu_chengong',
      'neu_dunbing', 'neu_tuntian',
      'neu_pojia', 'neu_jianyu'
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
    const saved = global.localStorage && global.localStorage.getItem('sanguo_custom_decks_v3');
    if (saved) {
      const parsed = JSON.parse(saved);
      for (const f of FACTION_LIST) {
        if (parsed[f] && validateDeck(f, parsed[f]).valid) {
          customDecks[f] = parsed[f];
        }
      }
    }
  } catch (_) {}

  const RECOMMENDED_DECKS = {
    SHU: {
      id: 'rec_shu',
      name: '神速桃園・連擊中速',
      faction: 'SHU',
      subFaction: 'WU',
      desc: '外掛吳國兵貴神速與太史慈，搭配關羽／趙雲高爆發破防與劉備鋪場壓制。',
      cards: [
        'shu_liaohua', 'shu_liaohua',
        'shu_guanping', 'shu_guanping',
        'shu_fazheng', 'shu_fazheng',
        'shu_wangping', 'shu_wangping',
        'shu_huangzhong', 'shu_huangzhong',
        'shu_zhaoyun', 'shu_zhaoyun',
        'shu_zhangfei', 'shu_zhangfei',
        'shu_guanyu', 'shu_guanyu',
        'shu_machao',
        'shu_zhugeliang',
        'shu_liubei',
        'shu_muniuliuma', 'shu_muniuliuma',
        'shu_taoyuan',
        'shu_beifa', 'shu_beifa',
        'wu_lingtong', 'wu_lingtong',
        'wu_taishici', 'wu_taishici',
        'wu_shensu', 'wu_shensu'
      ]
    },
    WEI: {
      id: 'rec_wei',
      name: '霸府權謀・蓄糧魏武',
      faction: 'WEI',
      subFaction: 'SHU',
      desc: '外掛蜀國木牛流馬與法正，速養鍾會並以減攻與謀略連發觸發曹操【魏武】。',
      cards: [
        'wei_yuejin',
        'wei_xuhuang', 'wei_xuhuang',
        'wei_yujin', 'wei_yujin',
        'wei_lidian', 'wei_lidian',
        'wei_guojia', 'wei_guojia',
        'wei_zhonghui', 'wei_zhonghui',
        'wei_xiahouyuan', 'wei_xiahouyuan',
        'wei_xunyou', 'wei_xunyou',
        'wei_xiahoudun',
        'wei_simayi', 'wei_simayi',
        'wei_caocao', 'wei_caocao',
        'wei_xietianzi', 'wei_xietianzi',
        'wei_duanliang',
        'wei_quhu', 'wei_quhu',
        'shu_muniuliuma', 'shu_muniuliuma',
        'shu_fazheng', 'shu_fazheng',
        'shu_zhangfei'
      ]
    },
    WU: {
      id: 'rec_wu',
      name: '江東熾焰・制衡火攻',
      faction: 'WU',
      subFaction: 'QUN',
      desc: '孫權制衡維持手牌優勢護航徐盛，周瑜與陸遜灼燒連動收割，外掛鐵騎突襲點解。',
      cards: [
        'wu_lingtong', 'wu_lingtong',
        'wu_huanggai', 'wu_huanggai',
        'wu_dingfeng', 'wu_dingfeng',
        'wu_ganning', 'wu_ganning',
        'wu_taishici', 'wu_taishici',
        'wu_zhanghong', 'wu_zhanghong',
        'wu_sunce', 'wu_sunce',
        'wu_xusheng', 'wu_xusheng',
        'wu_zhouyu', 'wu_zhouyu',
        'wu_sunquan', 'wu_sunquan',
        'wu_zhoutai',
        'wu_luxun',
        'wu_shensu', 'wu_shensu',
        'wu_lianhuan', 'wu_lianhuan',
        'wu_huogong', 'wu_huogong',
        'qun_manli', 'qun_manli'
      ]
    },
    QUN: {
      id: 'rec_qun',
      name: '天下無雙・漸營突襲',
      faction: 'QUN',
      subFaction: 'WU',
      desc: '沮授低費連打補牌回糧，顏良文醜與袁術搶佔中盤，高順＋呂布＋兵貴神速收盤。',
      cards: [
        'qun_tianfeng', 'qun_tianfeng',
        'qun_huaxiong', 'qun_huaxiong',
        'qun_yanliang', 'qun_yanliang',
        'qun_wenchou', 'qun_wenchou',
        'qun_jushou', 'qun_jushou',
        'qun_gaoshun', 'qun_gaoshun',
        'qun_mateng', 'qun_mateng',
        'qun_yuanshu', 'qun_yuanshu',
        'qun_yuanshao', 'qun_yuanshao',
        'qun_lubu', 'qun_lubu',
        'qun_manli', 'qun_manli',
        'qun_huoshao', 'qun_huoshao',
        'wu_lingtong', 'wu_lingtong',
        'wu_taishici', 'wu_taishici',
        'wu_shensu', 'wu_shensu'
      ]
    }
  };

  function buildRandomLegalDeck(mainFaction) {
    const subCandidates = FACTION_LIST.filter(f => f !== mainFaction);
    const subFaction = Math.random() < 0.72
      ? subCandidates[Math.floor(Math.random() * subCandidates.length)]
      : null;

    const mainAndNeuPool = Object.values(CARD_DB).filter(
      c => !c.token && (c.faction === mainFaction || c.faction === 'NEU')
    );
    const subPool = subFaction
      ? Object.values(CARD_DB).filter(
          c => !c.token && c.faction === subFaction && c.cost <= SUB_FACTION_MAX_COST
        )
      : [];

    const deck = [];
    const counts = {};
    let subCount = 0;
    let guard = 0;

    while (deck.length < DECK_SIZE && guard < 2000) {
      guard += 1;
      const useSub = subPool.length > 0 && subCount < MAX_SUB_FACTION_CARDS && Math.random() < 0.28;
      const pool = useSub ? subPool : mainAndNeuPool;
      const card = pool[Math.floor(Math.random() * pool.length)];
      if (!card || (counts[card.id] || 0) >= MAX_COPIES) continue;

      deck.push(card.id);
      counts[card.id] = (counts[card.id] || 0) + 1;
      if (useSub) subCount += 1;
    }
    return deck.length === DECK_SIZE ? deck : STARTER_DECKS[mainFaction].slice();
  }

  const MAX_SAVED_DECK_SLOTS = 4;
  const savedDeckSlots = [null, null, null, null];
  try {
    const rawSlots = global.localStorage && global.localStorage.getItem('sanguo_saved_decks_v32');
    if (rawSlots) {
      const parsed = JSON.parse(rawSlots);
      if (Array.isArray(parsed)) {
        for (let i = 0; i < MAX_SAVED_DECK_SLOTS; i++) {
          const slot = parsed[i];
          if (slot && FACTION_LIST.includes(slot.faction) && Array.isArray(slot.cards) && validateDeck(slot.faction, slot.cards, slot.subFaction || null).valid) {
            savedDeckSlots[i] = {
              name: String(slot.name || `自訂卡組 ${i + 1}`).slice(0, 20),
              faction: slot.faction,
              subFaction: slot.subFaction || null,
              cards: slot.cards.slice()
            };
          }
        }
      }
    }
  } catch (_) {}

  function persistSavedDeckSlots() {
    try {
      if (global.localStorage) {
        global.localStorage.setItem('sanguo_saved_decks_v32', JSON.stringify(savedDeckSlots));
      }
    } catch (_) {}
  }

  function saveDeckToSlot(slotIdx, name, faction, cards, subFaction = null) {
    if (slotIdx < 0 || slotIdx >= MAX_SAVED_DECK_SLOTS) return false;
    const check = validateDeck(faction, cards, subFaction);
    if (!check.valid) return false;
    savedDeckSlots[slotIdx] = {
      name: String(name || `${FACTIONS[faction].name}自訂 ${slotIdx + 1}`).trim().slice(0, 20) || `自訂卡組 ${slotIdx + 1}`,
      faction,
      subFaction: check.subFaction,
      cards: cards.slice()
    };
    customDecks[faction] = cards.slice();
    persistSavedDeckSlots();
    try {
      if (global.localStorage) {
        global.localStorage.setItem('sanguo_custom_decks_v3', JSON.stringify(customDecks));
      }
    } catch (_) {}
    return true;
  }

  function deleteDeckSlot(slotIdx) {
    if (slotIdx < 0 || slotIdx >= MAX_SAVED_DECK_SLOTS) return false;
    savedDeckSlots[slotIdx] = null;
    persistSavedDeckSlots();
    return true;
  }

  function getDeckForFaction(faction) {
    return (customDecks[faction] || STARTER_DECKS[faction]).slice();
  }

  function saveCustomDeck(faction, cards) {
    customDecks[faction] = cards.slice();
    try {
      if (global.localStorage) {
        global.localStorage.setItem('sanguo_custom_decks_v3', JSON.stringify(customDecks));
      }
    } catch (_) {}
  }

  global.Sanguo = global.Sanguo || {};
  Object.assign(global.Sanguo, {
    CARD_DB,
    STARTER_DECKS,
    RECOMMENDED_DECKS,
    buildRandomLegalDeck,
    customDecks,
    MAX_SAVED_DECK_SLOTS,
    savedDeckSlots,
    saveDeckToSlot,
    deleteDeckSlot,
    validateDeck,
    getDeckForFaction,
    saveCustomDeck
  });
})(window);