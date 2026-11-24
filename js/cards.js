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
    // 蜀 SHU (12 Generals + 4 Tactics = 16 cards)
    // ==========================================
    shu_liaohua: {
      id: 'shu_liaohua', name: '廖化', type: 'GENERAL', faction: 'SHU', cost: 1, atk: 2, hp: 2, armor: 0,
      keywords: [], icon: '🗡️', skillName: '先鋒',
      text: '【先鋒】登場：若相鄰格有友軍，自身 +1 攻。'
    },
    shu_guanping: {
      id: 'shu_guanping', name: '關平', type: 'GENERAL', faction: 'SHU', cost: 2, atk: 2, hp: 3, armor: 1,
      keywords: ['ARMOR', 'GUARD'], icon: '🛡️', skillName: '龍佑',
      text: '【龍佑】護衛相鄰友軍。'
    },
    shu_weiyan: {
      id: 'shu_weiyan', name: '魏延', type: 'GENERAL', faction: 'SHU', cost: 3, atk: 3, hp: 3, armor: 0,
      keywords: ['KILL'], icon: '⚔️', skillName: '狂骨',
      text: '【狂骨】斬殺：回復己方國力 2 點。'
    },
    shu_fazheng: {
      id: 'shu_fazheng', name: '法正', type: 'GENERAL', faction: 'SHU', cost: 3, atk: 2, hp: 4, armor: 0,
      keywords: [], icon: '📜', skillName: '奇謀',
      text: '【奇謀】登場：若我方手牌少於敵方，抽 2 張牌；否則抽 1 張牌。'
    },
    shu_wangping: {
      id: 'shu_wangping', name: '王平', type: 'GENERAL', faction: 'SHU', cost: 3, atk: 2, hp: 4, armor: 1,
      keywords: ['ARMOR', 'GUARD'], icon: '🏔️', skillName: '無當',
      text: '【無當】受到攻擊力 ≤ 3 的武將攻擊時，傷害 -1。'
    },
    shu_huangzhong: {
      id: 'shu_huangzhong', name: '黃忠', type: 'GENERAL', faction: 'SHU', cost: 4, atk: 3, hp: 3, armor: 0,
      keywords: ['SNIPE'], icon: '🏹', skillName: '烈弓',
      text: '【烈弓】普通攻擊無視護衛。'
    },
    shu_zhaoyun: {
      id: 'shu_zhaoyun', name: '趙雲', type: 'GENERAL', faction: 'SHU', cost: 4, atk: 3, hp: 4, armor: 1,
      keywords: ['COMBO', 'ARMOR'], icon: '🐉', skillName: '龍膽',
      activeSkill: { name: '龍膽', cost: 1, desc: '本回合 +1 攻與 +1 臨時護甲' },
      text: '【龍膽】主動(1糧)：本回合獲得 +1 攻與 +1 臨時護甲。'
    },
    shu_zhangfei: {
      id: 'shu_zhangfei', name: '張飛', type: 'GENERAL', faction: 'SHU', cost: 4, atk: 4, hp: 4, armor: 0,
      keywords: ['RUSH'], icon: '🦁', skillName: '咆哮',
      text: '【咆哮】登場：對敵方生命最高的護衛造成 3 傷（無護衛則對最高攻敵軍造成 2 傷）。'
    },
    shu_guanyu: {
      id: 'shu_guanyu', name: '關羽', type: 'GENERAL', faction: 'SHU', cost: 5, atk: 5, hp: 5, armor: 0,
      keywords: ['PIERCE', 'KILL'], icon: '🌙', skillName: '武聖',
      text: '【武聖】破甲。斬殺：抽 1 張牌，並對敵方國力造成 2 點傷害。'
    },
    shu_machao: {
      id: 'shu_machao', name: '馬超', type: 'GENERAL', faction: 'SHU', cost: 5, atk: 4, hp: 4, armor: 0,
      keywords: ['RUSH', 'COMBO'], icon: '🐎', skillName: '鐵騎',
      text: '【鐵騎】登場：本回合獲得 +1 攻擊力。'
    },
    shu_jiangwei: {
      id: 'shu_jiangwei', name: '姜維', type: 'GENERAL', faction: 'SHU', cost: 5, atk: 4, hp: 5, armor: 0,
      keywords: [], icon: '🌟', skillName: '繼志・九伐',
      text: '【繼志】登場：若我方場上有諸葛亮，獲得 +2/+2 與護衛。【九伐】攻擊國力且敵方國力 ≤ 15 時，額外 +2 傷。'
    },
    shu_zhugeliang: {
      id: 'shu_zhugeliang', name: '諸葛亮', type: 'GENERAL', faction: 'SHU', cost: 6, atk: 3, hp: 6, armor: 0,
      keywords: [], icon: '🪶', skillName: '錦囊',
      activeSkill: { name: '錦囊', cost: 1, desc: '二選一：全友軍 +1 臨時護甲／抽 1 牌並存 1 糧倉' },
      text: '【錦囊】登場抽 2 張牌。主動(1糧，二選一)：全友軍 +1 臨時護甲／抽 1 牌並存 1 糧倉。'
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
      text: '所有友方武將獲得 +2 臨時護甲（持續 2 回合），並抽 1 張牌。',
      flavor: '「西城樓上撫琴焚香，談笑退司馬十五萬大軍。」'
    },
    shu_beifa: {
      id: 'shu_beifa', name: '出師北伐', type: 'TACTIC', faction: 'SHU', cost: 4, target: 'enemy_general', icon: '📜',
      text: '指定一名敵方武將造成 4 點傷害；若擊殺目標則抽 1 張牌。',
      flavor: '「今當遠離，臨表涕零，不知所言。」'
    },

    // ==========================================
    // 魏 WEI (13 Generals + 4 Tactics = 17 cards)
    // ==========================================
    wei_yuejin: {
      id: 'wei_yuejin', name: '樂進', type: 'GENERAL', faction: 'WEI', cost: 1, atk: 1, hp: 3, armor: 1,
      keywords: ['ARMOR'], icon: '🛡️', skillName: '先登',
      text: '【先登】每次主動攻擊敵方武將時，本回合 +1 攻。'
    },
    wei_xuhuang: {
      id: 'wei_xuhuang', name: '徐晃', type: 'GENERAL', faction: 'WEI', cost: 2, atk: 2, hp: 3, armor: 0,
      keywords: [], icon: '🪓', skillName: '斷糧',
      text: '【斷糧】登場：敵方最高攻武將 -1 攻（2回合），並扣除敵方 1 點糧倉。'
    },
    wei_guojia: {
      id: 'wei_guojia', name: '郭嘉', type: 'GENERAL', faction: 'WEI', cost: 3, atk: 2, hp: 3, armor: 0,
      keywords: ['DEATHRATTLE'], icon: '🪶', skillName: '遺計',
      text: '【遺計】陣亡：抽 2 張牌，並存入 1 點糧倉。'
    },
    wei_caoren: {
      id: 'wei_caoren', name: '曹仁', type: 'GENERAL', faction: 'WEI', cost: 3, atk: 2, hp: 4, armor: 2,
      keywords: ['ARMOR', 'GUARD'], icon: '🏰', skillName: '據守',
      activeSkill: { name: '據守', cost: 0, desc: '自身 -1 攻，自己與相鄰友軍 +2 臨時護甲' },
      text: '【據守】主動(0糧)：自身 -1 攻（最低 0），自己及相鄰友軍 +2 臨時護甲（1回合）。'
    },
    wei_zhangliao: {
      id: 'wei_zhangliao', name: '張遼', type: 'GENERAL', faction: 'WEI', cost: 4, atk: 3, hp: 4, armor: 0,
      keywords: [], icon: '⚡', skillName: '止啼・威震',
      text: '【止啼】登場：指定一名敵方武將失去技能。【威震】敵方攻擊張遼時，攻擊力 -1（最低 0）。'
    },
    wei_xiahoudun: {
      id: 'wei_xiahoudun', name: '夏侯惇', type: 'GENERAL', faction: 'WEI', cost: 4, atk: 4, hp: 4, armor: 1,
      keywords: ['ARMOR', 'KILL'], icon: '👁️', skillName: '剛烈',
      text: '【剛烈】斬殺：自身回復 2 點生命。'
    },
    wei_dianwei: {
      id: 'wei_dianwei', name: '典韋', type: 'GENERAL', faction: 'WEI', cost: 4, atk: 3, hp: 5, armor: 2,
      keywords: ['ARMOR', 'GUARD'], icon: '🔱', skillName: '惡來',
      text: '【惡來】每次受到傷害時，攻擊力 +1。'
    },
    wei_dengai: {
      id: 'wei_dengai', name: '鄧艾', type: 'GENERAL', faction: 'WEI', cost: 4, atk: 3, hp: 3, armor: 0,
      keywords: ['RUSH'], icon: '🏔️', skillName: '急襲',
      text: '【急襲】可無視敵方場上武將，直接攻擊敵方國力。'
    },
    wei_zhanghe: {
      id: 'wei_zhanghe', name: '張郃', type: 'GENERAL', faction: 'WEI', cost: 4, atk: 3, hp: 4, armor: 0,
      keywords: [], icon: '🎯', skillName: '料敵',
      text: '【料敵】登場：查看敵方最高費手牌，若為謀略牌則費用 +1，若為武將則 -1/-1。'
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
      id: 'wei_simayi', name: '司馬懿', type: 'GENERAL', faction: 'WEI', cost: 5, atk: 3, hp: 5, armor: 0,
      keywords: [], icon: '🐺', skillName: '鷹視',
      activeSkill: { name: '鷹視', cost: 1, desc: '敵方最高攻武將 -2 攻（1回合）' },
      text: '【鷹視】登場：敵全體 1 傷並灼燒（2回合）。主動(1糧)：敵方最高攻武將 -2 攻（1回合）。'
    },
    wei_caocao: {
      id: 'wei_caocao', name: '曹操', type: 'GENERAL', faction: 'WEI', cost: 6, atk: 4, hp: 6, armor: 1,
      keywords: ['ARMOR'], icon: '👑', skillName: '奸雄',
      text: '【奸雄】登場（二選一）：全友軍本回合 +2 攻／抽 2 張牌並存入 1 點糧倉。'
    },
    wei_xietianzi: {
      id: 'wei_xietianzi', name: '挾天子令諸侯', type: 'TACTIC', faction: 'WEI', cost: 2, target: 'none', icon: '👑',
      text: '抽 2 張牌，己方國力 -1。',
      flavor: '「迎漢獻帝都許昌，奉天子以令不臣。」'
    },
    wei_duanliang: {
      id: 'wei_duanliang', name: '斷糧奇兵', type: 'TACTIC', faction: 'WEI', cost: 2, target: 'none', icon: '🔥',
      text: '掠奪敵方最多 2 點糧倉轉為己方臨時糧草，並使敵方最高攻武將 -1 攻（2回合）。',
      flavor: '「兵馬未動，糧草先行；斷其輜重，敵陣自潰。」'
    },
    wei_quhu: {
      id: 'wei_quhu', name: '驅虎吞狼', type: 'TACTIC', faction: 'WEI', cost: 3, target: 'enemy_general', icon: '🐯',
      text: '指定一名敵方武將造成 3 點傷害，並使其攻擊力 -1（持續 2 回合）。',
      flavor: '「荀彧獻二虎競食、驅虎吞狼之計，令劉備呂布自相殘殺。」'
    },
    wei_guandu: {
      id: 'wei_guandu', name: '奇襲烏巢', type: 'TACTIC', faction: 'WEI', cost: 4, target: 'none', icon: '🔥',
      text: '敵方糧草上限 -1（最低 1），己方本回合獲得 +2 臨時糧草。',
      flavor: '「官渡夜襲烏巢，盡焚袁軍萬車軍糧，一戰定北方。」'
    },

    // ==========================================
    // 吳 WU (12 Generals + 4 Tactics = 16 cards)
    // ==========================================
    wu_lingtong: {
      id: 'wu_lingtong', name: '凌統', type: 'GENERAL', faction: 'WU', cost: 1, atk: 2, hp: 1, armor: 0,
      keywords: ['COMBO'], icon: '🌊', skillName: '先登',
      text: '【先登】若凌統是本場第一位登場的武將，獲得 +1/+0。'
    },
    wu_huanggai: {
      id: 'wu_huanggai', name: '黃蓋', type: 'GENERAL', faction: 'WU', cost: 2, atk: 3, hp: 3, armor: 0,
      keywords: [], icon: '🔥', skillName: '苦肉',
      activeSkill: { name: '苦肉', cost: 0, desc: '己方國力 -2，抽 1 牌並獲得 +1 臨時糧草' },
      text: '【苦肉】主動(0糧)：己方國力 -2，抽 1 張牌並獲得 +1 臨時糧草。'
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
      keywords: [], icon: '🕊️', skillName: '緩兵',
      text: '【緩兵】登場：指定一名敵方武將下回合無法攻擊。'
    },
    wu_zhanghong: {
      id: 'wu_zhanghong', name: '張紘', type: 'GENERAL', faction: 'WU', cost: 3, atk: 2, hp: 4, armor: 0,
      keywords: [], icon: '✒️', skillName: '文采',
      text: '【文采】每當我方打出謀略牌時，張紘獲得 +1/+1。'
    },
    wu_lumeng: {
      id: 'wu_lumeng', name: '呂蒙', type: 'GENERAL', faction: 'WU', cost: 4, atk: 3, hp: 4, armor: 1,
      keywords: ['ARMOR'], icon: '⛵', skillName: '攻心',
      text: '【攻心】登場：移除指定敵方武將的技能。'
    },
    wu_sunce: {
      id: 'wu_sunce', name: '孫策', type: 'GENERAL', faction: 'WU', cost: 4, atk: 4, hp: 3, armor: 0,
      keywords: ['COMBO', 'KILL'], icon: '🦅', skillName: '激昂',
      text: '【激昂】斬殺：自身獲得 +1/+1。'
    },
    wu_zhouyu: {
      id: 'wu_zhouyu', name: '周瑜', type: 'GENERAL', faction: 'WU', cost: 5, atk: 3, hp: 5, armor: 0,
      keywords: [], icon: '🏮', skillName: '火攻',
      text: '【火攻】登場：對敵全體造成 2 傷並施加灼燒（每回合扣 1 血，持續 2 回合）。'
    },
    wu_sunquan: {
      id: 'wu_sunquan', name: '孫權', type: 'GENERAL', faction: 'WU', cost: 5, atk: 3, hp: 5, armor: 1,
      keywords: ['ARMOR'], icon: '👑', skillName: '制衡',
      activeSkill: { name: '制衡', cost: 0, desc: '選棄 1～3 張手牌並摸等量牌（棄 >1 張需耗 1 糧）' },
      text: '【制衡】主動：每回合限 1 次，選棄 X 張手牌並摸 X 張牌（X ≤ 3；X > 1 需耗 1 糧）。'
    },
    wu_zhoutai: {
      id: 'wu_zhoutai', name: '周泰', type: 'GENERAL', faction: 'WU', cost: 5, atk: 3, hp: 8, armor: 0,
      keywords: ['GUARD'], icon: '🛡️', skillName: '不屈',
      text: '【不屈】周泰的生命值不會低於 1（每場遊戲觸發一次）。'
    },
    wu_luxun: {
      id: 'wu_luxun', name: '陸遜', type: 'GENERAL', faction: 'WU', cost: 6, atk: 4, hp: 5, armor: 1,
      keywords: ['ARMOR'], icon: '🔥', skillName: '連營',
      text: '【連營】回合結束：對敵全體造成 1 傷；若目標已灼燒則額外再造 1 傷。'
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
    wu_huogong: {
      id: 'wu_huogong', name: '火燒赤壁', type: 'TACTIC', faction: 'WU', cost: 4, target: 'none', icon: '🔥',
      text: '對敵方所有武將造成 2 點傷害，並施加灼燒（每回合扣 1 血，持續 2 回合）。',
      flavor: '「東風夜放花千樹，赤壁烈焰照徹長江。」'
    },
    wu_jiangdong: {
      id: 'wu_jiangdong', name: '江東水師', type: 'TACTIC', faction: 'WU', cost: 4, target: 'none', icon: '⛵',
      text: '對敵方國力造成 3 點傷害，並使所有友方武將獲得 +1 攻擊力（持續 2 回合）。',
      flavor: '「樓船千艘列江岸，江東精銳莫敢當。」'
    },

    // ==========================================
    // 群 QUN (13 Generals + 3 Tactics = 16 cards)
    // ==========================================
    qun_huaxiong: {
      id: 'qun_huaxiong', name: '華雄', type: 'GENERAL', faction: 'QUN', cost: 2, atk: 3, hp: 2, armor: 0,
      keywords: ['KILL'], icon: '🪓', skillName: '耀武',
      text: '【耀武】斬殺：自身獲得 +2/+1。'
    },
    qun_diaochan: {
      id: 'qun_diaochan', name: '貂蟬', type: 'GENERAL', faction: 'QUN', cost: 3, atk: 1, hp: 3, armor: 0,
      keywords: [], icon: '🌸', skillName: '閉月・離間',
      activeSkill: { name: '離間', cost: 1, desc: '敵方最高攻武將 -2 攻（1回合）' },
      text: '【閉月】回合結束：國力 +2、相鄰友軍回 1 血。【離間】主動(1糧)：敵最高攻 -2 攻（1回合）。'
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
      keywords: ['SHROUD'], icon: '☠️', skillName: '完殺・帷幕',
      text: '【完殺】在場時雙方增益效果無效。【帷幕】不能成為謀略牌的目標。'
    },
    qun_zhangjiao: {
      id: 'qun_zhangjiao', name: '張角', type: 'GENERAL', faction: 'QUN', cost: 4, atk: 2, hp: 4, armor: 0,
      keywords: ['DEATHRATTLE'], icon: '⚡', skillName: '黃天',
      text: '【黃天】登場：在空位召喚 1 名 1/2「黃巾力士」。遺計：對敵全體造成 1 傷。'
    },
    qun_mateng: {
      id: 'qun_mateng', name: '馬騰', type: 'GENERAL', faction: 'QUN', cost: 4, atk: 4, hp: 3, armor: 0,
      keywords: ['RUSH'], icon: '🐴', skillName: '鐵騎',
      text: '【鐵騎】攻擊護衛武將時，傷害 +2。'
    },
    qun_zhangren: {
      id: 'qun_zhangren', name: '張任', type: 'GENERAL', faction: 'QUN', cost: 4, atk: 3, hp: 4, armor: 0,
      keywords: [], icon: '🏹', skillName: '伏擊',
      text: '【伏擊】防守時若攻擊力 ≥ 攻擊者生命值，直接反殺且不受傷害。'
    },
    qun_yuanshu: {
      id: 'qun_yuanshu', name: '袁術', type: 'GENERAL', faction: 'QUN', cost: 5, atk: 5, hp: 5, armor: 0,
      keywords: [], icon: '🏺', skillName: '稱帝・眾叛',
      text: '【稱帝】登場：我方國力 -5，自身獲得 +3/+3 與護衛。【眾叛】每回合結束隨機棄 1 牌。'
    },
    qun_yuanshao: {
      id: 'qun_yuanshao', name: '袁紹', type: 'GENERAL', faction: 'QUN', cost: 5, atk: 4, hp: 5, armor: 1,
      keywords: ['ARMOR'], icon: '🚩', skillName: '亂擊',
      text: '【亂擊】登場：對敵全體造成 1 傷，友方全體 +1 攻（持續 2 回合）。'
    },
    qun_dongzhuo: {
      id: 'qun_dongzhuo', name: '董卓', type: 'GENERAL', faction: 'QUN', cost: 5, atk: 5, hp: 6, armor: 2,
      keywords: ['ARMOR'], icon: '👹', skillName: '暴政',
      text: '【暴政】登場：己方國力 -2。'
    },
    qun_lubu: {
      id: 'qun_lubu', name: '呂布', type: 'GENERAL', faction: 'QUN', cost: 7, atk: 6, hp: 6, armor: 0,
      keywords: ['COMBO', 'PIERCE', 'KILL'], icon: '🔱', skillName: '無雙',
      text: '【無雙】破甲。斬殺：對敵方國力造成 3 點傷害。'
    },
    qun_manli: {
      id: 'qun_manli', name: '鐵騎突襲', type: 'TACTIC', faction: 'QUN', cost: 2, target: 'enemy_general', icon: '🐎',
      text: '指定一名敵方武將造成 3 點傷害。',
      flavor: '「涼州鐵騎捲地而來，瞬息衝破前線陣列。」'
    },
    qun_wushuang: {
      id: 'qun_wushuang', name: '天下無雙', type: 'TACTIC', faction: 'QUN', cost: 3, target: 'ally_general', icon: '⚡',
      text: '指定一名友方武將獲得 +3 攻擊力與 +1 臨時護甲（持續 1 回合）。',
      flavor: '「虎牢關前獨戰三英，畫戟所指無人能攖其鋒。」'
    },
    qun_huoshao: {
      id: 'qun_huoshao', name: '焚城掠地', type: 'TACTIC', faction: 'QUN', cost: 4, target: 'none', icon: '🔥',
      text: '對敵方所有武將造成 2 點傷害，並對敵方國力造成 2 點傷害。',
      flavor: '「董卓遷都長安，縱火焚燒洛陽宮室，千里焦土。」'
    },

    // ==========================================
    // 中立 NEUTRAL (6 Generals + 6 Tactics = 12 cards)
    // ==========================================
    neu_bubing: {
      id: 'neu_bubing', name: '精銳步卒', type: 'GENERAL', faction: 'NEU', cost: 1, atk: 1, hp: 2, armor: 1,
      keywords: ['ARMOR'], icon: '🛡️', skillName: '列陣',
      text: '【列陣】穩健的前期基礎步兵。'
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
      id: 'neu_huatuo', name: '華佗', type: 'GENERAL', faction: 'NEU', cost: 3, atk: 1, hp: 4, armor: 0,
      keywords: [], icon: '🌿', skillName: '青囊',
      activeSkill: { name: '青囊', cost: 1, desc: '二選一：回復國力 3 點／全友軍回復 2 血' },
      text: '【青囊】主動(1糧，二選一)：回復己方國力 3 點／回復所有友方武將 2 點生命。'
    },
    neu_tuntian: {
      id: 'neu_tuntian', name: '屯田積糧', type: 'TACTIC', faction: 'NEU', cost: 1, target: 'none', icon: '🌾',
      text: '抽 1 張牌，回復己方國力 2 點。',
      flavor: '「棗祇、任峻行屯田之制，軍糧充盈而四方漸定。」'
    },
    neu_huanwei: {
      id: 'neu_huanwei', name: '移形換位', type: 'TACTIC', faction: 'NEU', cost: 1, target: 'ally_general', icon: '🔄',
      text: '將指定友方武將與 3 號位互換（若已在 3 號位則與 2 號位互換），獲 +2 臨時護甲與護衛（1回合）。',
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
      'shu_taoyuan', 'shu_taoyuan',
      'shu_kongcheng', 'shu_beifa',
      'neu_bubing', 'neu_bubing',
      'neu_tuntian', 'neu_tuntian',
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
      'wei_duanliang', 'wei_duanliang',
      'wei_quhu', 'wei_quhu',
      'wei_guandu', 'wei_guandu',
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
      'wu_huogong', 'wu_huogong',
      'wu_jiangdong', 'wu_jiangdong',
      'neu_bubing', 'neu_tuntian',
      'neu_tuntian', 'neu_anfuminxin',
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
      'qun_wushuang', 'qun_wushuang',
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

  Object.assign(global.Sanguo, {
    CARD_DB,
    STARTER_DECKS,
    customDecks,
    validateDeck,
    getDeckForFaction,
    saveCustomDeck
  });
})(window);