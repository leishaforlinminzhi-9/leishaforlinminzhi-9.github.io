// 寻宝 (v2): four stops. The puppy gives a riddle; the cat rides or is sent there; at each chest there is a little question, then her words and a keepsake.
// EVERYTHING here is a SAMPLE written from what the games already say about the two of you (飞盘 · 咬人 · 小酒 · 大水, the puppy and the cat): change any line to your own words.
//   place  [x, y] on the map picture (the chest is put on the nearest free spot); the order is the order of the hunt
//   real   the clue of this stop is NOT shown in the game: it is on the printed clue card cardNo (线索卡 1 2 3, found in the hotel room); the game only says so
//   where  (real stops) where in the hotel the card is, as the game says it
//   clue   the riddle (for a `real` stop: the same words as on the printed card)      hints  two more hints (the 提示 button shows them one by one, the third press tells the name)
//   ask    a question at the chest: q, options (3), replies (what she answers to each option)
//   item   [emoji, name] the keepsake;  title / text   the card
export const TREASURES = [
  { name: '紫荆操场', place: [896, 678], exact: true, item: ['🥏', '飞盘'],
    clue: '第一件藏在会跑圈的地方。我听说那里总有人扔飞盘,总是扔到我这边。',
    hints: ['就在 34 号楼斜对面的操场里。', '走进操场,在草地上靠北的那一半。'],
    ask: { q: '飞盘在你手里。你想怎么扔?', fetch: 1, options: ['给个 dump', '抽一个,让小狗跑'], replies: ['一个短短的 dump 传回来——我稳稳接住了。(尾巴摇起来)', '你抽了个好远的,我追了好远,跳起来——接住了!'] },
    title: '第一件 · 飞盘', text: '不管你怎么扔,我都会努力接的。' },
  { name: '清芬园', place: [821, 951], real: true, cardNo: 1, where: '雨先落在你肩上,落在我想你的地方。', item: ['🍟', '薯条'],
    clue: '晚点起床没关系,我们可以一起吃薯条。',
    hints: ['食堂。从宿舍往南走,过了西大操场再往东一点。', '名字里有一个“芬”字。'],
    ask: { q: '今天吃什么?', options: ['都行', '你选', '我想吃薯条'], replies: ['“都行”是最难回答的……不过我选:薯条。', '那我选薯条。我要蘸很多。', '……我也是!(尾巴摇起来)'] },
    title: '第二件 · 薯条', text: '晚点起床没关系,我们可以一起吃薯条。' },
  { name: '自强科技楼', place: [1142, 1098], real: true, cardNo: 2, where: '你抱我最久,但我不会说话。', item: ['💋', '门廊下的吻'],
    clue: '那里,我们在躲开阳光的门廊下,有过一个无比温暖的拥抱。',
    hints: ['地图东边,靠近东三门的一栋大楼。', '名字里有“自强”两个字。'],
    ask: { q: '快到门廊了。你想站在哪里等我?', options: ['阳光里', '阳光的边缘', '门廊下面'], replies: ['那我就走出来见你。', '我就喜欢你站在边上看着我。(笑)', '……我也在那里。'] },
    title: '第三件 · 门廊', text: '我们在阳光边缘之外的门廊里接过吻。\n我也常常在这里想你。' },
  { name: '建华楼下沉广场', place: [866, 1384], exact: true, real: true, cardNo: 3, where: '在我的手里,不会白给哦。', item: ['🎁', '最后的礼物'], last: true,
    clue: '在地表以下,头顶是天空,这里发生过很多爱。',
    hints: ['经管学院的建华楼旁边,有几级台阶往下走的小广场,树下。', '名字里有“建华”两个字,在经管学院那一带。'],
    ask: { q: '一个往下走的小广场,四周很安静。你想在这里做什么?', options: ['发呆', '喝一杯小酒', '抱着我'], replies: ['我陪你发呆。', '小酒我先尝一口。', '……不松手哦。'] },
    title: '最后一件', text: '你找到我了。' },
];
export const FINALE = { title: '四件宝藏,全部找到啦', text: '飞盘、薯条、门廊下的吻,还有最后这个:我在这里等你。\n奖励是——', reward: './film.mp4' };
export const INTRO = '我在校园里藏了四件宝藏。有的线索在这张地图上,有的藏在现实里。点地图上的地方,骑车过去找吧。准备好了吗?';
