/**
 * =============================================================================
 * main.js — ตัวประสาน (entry point)
 * =============================================================================
 * ประกอบทุกโมดูลเข้าด้วยกันและคุมวงจรเวลาของเกม
 *
 *   ScenarioEngine  เหตุการณ์บรรยากาศแบบสุ่มจากคลังคำ
 *   Person          โรงงานผลิตตัวละคร + รูปร่าง + รูปหน้า
 *   Lineage         ทะเบียนคนและผังเครือญาติ
 *   GameClock       นาฬิกาที่เดินเองพร้อมตัวคูณความเร็ว
 *   GameState       คลังทอง ชื่อเสียง ปฏิทิน
 *   GameUI          แถบสถานะ จดหมายเหตุ กล่องตัดสินใจ หน้าจอเริ่มเกม
 *   TreeUI          ผังตระกูล
 *
 * วงจรหนึ่งเดือน: เดินปฏิทิน -> เก็บรายได้ -> เพิ่มอายุ -> สุ่มเหตุการณ์ชีวิต -> วาดผล
 *
 * ผู้เล่นคุม "ทั้งตระกูล" ไม่ใช่ตัวละครใดตัวหนึ่ง ทุกครั้งที่สมาชิกสายเลือด
 * มีเรื่องต้องตัดสินใจ (มีผู้มาทาบทาม จะมีทายาทไหม) เวลาจะหยุดแล้วถามผู้เล่นเสมอ
 * เรื่องที่เกิดพร้อมกันหลายเรื่องใน tick เดียวจะเข้าคิวแล้วถามทีละเรื่อง
 * ตัวละครที่เริ่มเกมเป็นเพียงจุดตั้งต้นของสาแหรก ไม่มีสิทธิพิเศษใดๆ
 * =============================================================================
 */
(function () {
  'use strict';

  const data = window.GameData;
  const { CONFIG, CHOICE_EVENTS, ENGINE_CONTENT } = data;
  const P = window.Person;
  const T = window.Traits;   // ระบบคุณลักษณะติดตัว (js/trait/)

  const engine = new window.ScenarioEngine();

  /* เปลี่ยนธีมของเอนจินผ่าน public API เท่านั้น — ไม่แตะ scenario-engine.js
   * เคลียร์คลังเดิมทิ้งก่อน แล้วใส่เนื้อหาชุดใหม่จาก data.js */
  engine.locations = [];
  engine.activities = [];
  engine.wordbanks.opening = [];
  engine.wordbanks.complication = [];
  engine.wordbanks.resolution = [];
  ENGINE_CONTENT.locations.forEach((l) => engine.addLocation(l));
  ENGINE_CONTENT.activities.forEach((a) => engine.addActivity(a));
  engine.addWordBank('opening', ENGINE_CONTENT.opening);
  engine.addWordBank('complication', ENGINE_CONTENT.complication);
  engine.addWordBank('resolution', ENGINE_CONTENT.resolution);
  const lineage = window.Lineage.create();
  const game = window.GameState.create();
  const clock = window.GameClock.create(tick);
  const ui = window.GameUI.create(game, lineage, clock);

  let viewport = null;             // ตัวคุมซูม/เลื่อนผัง (สร้างหลัง DOM พร้อม)
  const tree = window.TreeUI.create(lineage, {
    onSelect: (p) => openDetail(p.id),
    // ถ้าเพิ่งลากผังอยู่ อย่าตีความว่าเป็นการกดเลือกการ์ด
    shouldIgnoreClick: () => (viewport ? viewport.wasDragged() : false),
  });

  let founder = null;              // ตัวละครที่ผู้เล่นเริ่มเกมด้วย (ไว้อ้างอิงเฉยๆ)
  let structureDirty = false;      // ผังต้องวาดใหม่ไหม
  let gameOver = false;
  let autoMode = false;            // true = ให้ระบบตัดสินใจแทนทุกเรื่อง

  /* คิวการตัดสินใจ — ทุกคนในตระกูลมีสิทธิ์ถูกถาม ไม่ใช่แค่คนใดคนหนึ่ง
   * จึงต้องเข้าคิวไว้แล้วถามทีละเรื่อง ไม่งั้นกล่องจะทับกันเองภายใน tick เดียว */
  const decisionQueue = [];
  const MAX_QUEUE = 10;            // เกินนี้ให้ระบบตัดสินใจแทนอัตโนมัติ กันคิวท่วม
  let decisionPending = false;
  let batchActive = false;
  let resumeAfterDecision = false;

  /* ---------------------------------------------------------------------
   * ตัวช่วย
   * ------------------------------------------------------------------- */

  /**
   * วาดผังใหม่ แล้วจัดมุมมองให้พอดีจออีกครั้ง
   *
   * จำเป็นเพราะผังโตขึ้นเรื่อยๆ ตลอดเกม ถ้าจัดมุมมองแค่ตอนเริ่มเกมครั้งเดียว
   * อัตราซูมจะค้างอยู่ที่ค่าของตอนตระกูลยังมีไม่กี่คน พอคนเพิ่มผังจะทะลุออก
   * นอกจอจนเห็นแค่เศษเสี้ยว (เห็นชัดมากบนมือถือที่จอแคบ)
   *
   * เคารพการซูม/เลื่อนที่ผู้เล่นตั้งเอง — ถ้าเขาปรับมุมมองแล้วจะไม่ไปยุ่ง
   */
  function renderTree() {
    tree.render();
    structureDirty = false;
    if (viewport && !viewport.isUserAdjusted()) {
      requestAnimationFrame(() => viewport.fit());
    }
  }

  function register(p) {
    p.bornMonth = game.state.month - p.age * 12 - Math.floor(Math.random() * 12);
    lineage.add(p);
    return p;
  }

  /**
   * ผูกความเป็นญาติสายเลือดเข้า ScenarioEngine
   * ผูกกับ "ทุกคนที่เป็นสายเลือด" ไม่ใช่แค่พ่อแม่พี่น้อง เพราะทั้งตระกูลสืบจาก
   * ต้นสายเดียวกัน ญาติห่างๆ ก็ต้องไม่ถูกจับคู่ในเหตุการณ์เชิงชู้สาว
   */
  function linkBlood(person) {
    lineage.all().forEach((other) => {
      if (other.id !== person.id && other.isBlood) {
        engine.setBloodRelation(person.id, other.id);
      }
    });
  }

  function engineCast() {
    return lineage.living().map((p) => ({
      id: p.id,
      name: p.name,
      age: p.age >= CONFIG.adultAge ? 'adult' : 'child',
    }));
  }

  const genderWord = (g) => (g === 'male' ? 'บุรุษ' : 'สตรี');

  /**
   * ชื่อพร้อมป้ายรุ่นสำหรับข้อความบันทึก — Gen 0 คือพ่อแม่ตั้งต้น Gen 1 คือรุ่นผู้เล่น
   * คนแต่งเข้านับรุ่นตามคู่ครองสายเลือดของตน คนนอกที่ยังไม่แต่งเข้าไม่มีป้าย
   */
  function nm(p) {
    if (!p) return '';
    const anchor = p.isBlood ? p : (p.spouseId ? lineage.get(p.spouseId) : null);
    if (!anchor) return p.name;
    return `${p.name}(Gen ${lineage.generationOf(anchor) - 1})`;
  }
  const bodyWord = (p) =>
    `สูง ${p.body.height} ซม. หนัก ${p.body.weight} กก. หุ่น${P.buildLabel(p.body)} ` +
    `สัดส่วน ${P.measureLabel(p)} นิ้ว ` +
    `พลังยุทธ์ ${p.power} เสน่ห์ ${p.charm} (${P.charmTier(p.charm, p.gender)})`;

  /* ---------------------------------------------------------------------
   * คุณลักษณะติดตัว (trait)
   * นิยามอยู่ใน js/trait/ ตรงนี้เป็นแค่จุดปล่อยและการบันทึกจดหมายเหตุ
   * ------------------------------------------------------------------- */

  /** มอบ trait พร้อมบันทึก คืน true เมื่อได้จริง */
  function gainTrait(p, id, story) {
    const def = T.give(p, id);
    if (!def) return false;
    p.charm = P.charmFor(p);
    p.power = P.powerFor(p);
    ui.logEvent(
      `${nm(p)}${story || 'เปลี่ยนไปจากเดิม'} — ได้คุณลักษณะ「${def.label}」`,
      'milestone');
    return true;
  }

  /** สุ่มมอบ trait ตามโอกาส คืน true เมื่อได้จริง */
  function rollTrait(p, id, chance, story) {
    if (!T.canGain(p, T.byId(id))) return false;
    if (Math.random() >= chance) return false;
    return gainTrait(p, id, story);
  }

  /** นับพฤติกรรมสะสม ครบเกณฑ์แล้วจึงติดเป็นนิสัยถาวร */
  function tallyTrait(p, key, id, need, story) {
    const def = T.tally(p, key, id, need);
    if (!def) return false;
    p.charm = P.charmFor(p);
    p.power = P.powerFor(p);
    ui.logEvent(
      `${nm(p)}${story || 'ทำเช่นนี้จนติดเป็นนิสัย'} — ได้คุณลักษณะ「${def.label}」`,
      'milestone');
    return true;
  }

  /** สุ่มเลือกหนึ่งคนโดยถ่วงน้ำหนัก ใช้ให้ trait มีผลต่อ "ใครจะเป็นคนเริ่มเรื่อง" */
  function pickWeighted(list, weightOf) {
    const w = list.map((x) => Math.max(0.001, weightOf(x)));
    const total = w.reduce((s, v) => s + v, 0);
    let r = Math.random() * total;
    for (let i = 0; i < list.length; i++) {
      r -= w[i];
      if (r <= 0) return list[i];
    }
    return list[list.length - 1];
  }

  /* ---------------------------------------------------------------------
   * คิวการตัดสินใจ
   * เข้าคิวไว้ก่อน แล้ว pump ทีละเรื่องตอนจบ tick — ระหว่างนั้นเวลาหยุดสนิท
   * cfg.autoValue คือคำตอบที่ระบบจะเลือกให้เมื่ออยู่ในโหมดอัตโนมัติหรือคิวท่วม
   * ------------------------------------------------------------------- */
  // คนที่มีเรื่องค้างอยู่ในคิว ใช้กันไม่ให้ถูกถามเรื่องเดิมซ้ำในเดือนถัดไป
  const pendingSubjects = new Set();

  function ask(cfg, onChoose) {
    if (gameOver) return;

    if (cfg.subjectId) {
      if (pendingSubjects.has(cfg.subjectId)) return;
      pendingSubjects.add(cfg.subjectId);
    }

    if (autoMode || decisionQueue.length >= MAX_QUEUE) {
      if (cfg.subjectId) pendingSubjects.delete(cfg.subjectId);
      onChoose(cfg.autoValue);
      return;
    }
    decisionQueue.push({ cfg, onChoose });
  }

  function pumpDecisions() {
    if (decisionPending || gameOver) return;

    if (!decisionQueue.length) {
      if (batchActive) {
        batchActive = false;
        if (resumeAfterDecision) clock.start();
        ui.renderClockControls();
      }
      return;
    }

    if (!batchActive) {
      batchActive = true;
      resumeAfterDecision = clock.isRunning();
      clock.pause();
      ui.renderClockControls();
    }

    const item = decisionQueue.shift();
    decisionPending = true;
    ui.askDecision(
      Object.assign({}, item.cfg, { queued: decisionQueue.length }),
      (value) => {
        decisionPending = false;
        if (item.cfg.subjectId) pendingSubjects.delete(item.cfg.subjectId);
        item.onChoose(value);
        renderTree();
        ui.renderHUD();
        pumpDecisions();
      }
    );
  }

  /* ---------------------------------------------------------------------
   * เหตุการณ์ชีวิตประจำเดือน
   * ------------------------------------------------------------------- */

  function ageEveryone() {
    lineage.living().forEach((p) => {
      const newAge = Math.floor((game.state.month - p.bornMonth) / 12);
      if (newAge === p.age) return;
      p.age = newAge;
      p.income = P.incomeFor(p);
      P.refreshBust(p);          // หน้าอกสตรีโตตามวัยจนเต็มศักยภาพพันธุกรรม
      p.power = P.powerFor(p);   // พลังยุทธ์ขึ้นลงตามวัย
      p.charm = P.charmFor(p);   // เสน่ห์พีคช่วงวัยหนุ่มสาวแล้วถดถอย
      // เสาหลักของเรือน — ผู้ใหญ่ที่มีลูกหลานให้ดูแลและอยู่กับตระกูลมานาน
      if (p.age === 34 && p.childIds.length >= 2) {
        rollTrait(p, 'houseKeeper', 0.5, 'กลายเป็นที่พึ่งของคนทั้งเรือน');
      }
      if (p.age === CONFIG.adultAge) {
        structureDirty = true;
        ui.logEvent(`${nm(p)}เติบโตเป็นผู้ใหญ่เต็มตัว — ${bodyWord(p)}`, 'milestone');
      }
    });
  }

  /** สมรสให้เรียบร้อยและบันทึกจดหมายเหตุ */
  function completeMarriage(p, partner) {
    register(partner);
    lineage.marry(p, partner);
    game.addReputation(3);
    structureDirty = true;
    ui.logEvent(
      `${nm(p)}ครองคู่กับ${nm(partner)} ${partner.origin} — ` +
      `${genderWord(partner.gender)}วัย ${partner.age} ปี ${bodyWord(partner)}`,
      'marriage'
    );
  }

  function rollMarriages() {
    lineage.living().forEach((p) => {
      if (!p.isBlood || p.spouseId || !p.willMarry) return;
      if (p.age < CONFIG.adultAge || p.age > CONFIG.marriageMaxAge) return;
      // เสน่ห์สูงทำให้มีผู้มาทาบทามบ่อยขึ้น และดึงดูดคนที่ดีกว่า
      const cr = data.CHARM.marriageChanceRange;
      const pull = cr.lo + (cr.hi - cr.lo) * Math.min(1, (p.charm || 0) / 100);
      if (Math.random() >= CONFIG.marriageChancePerMonth * pull * T.mul(p, 'marriagePull')) return;

      const partnerGender = p.gender === 'male' ? 'female' : 'male';
      // trait บางตัวขยายช่วงอายุคู่ครองที่รับได้ (เช่นต้องมนต์ผู้อาวุโสกว่า)
      const skew = T.sum(p, 'partnerAge');
      const partner = P.createOutsider(
        partnerGender, p.age + (skew ? Math.round((Math.random() * 2 - 1) * skew) : 0), p.charm);

      ask({
        kind: 'marriage',
        title: 'มีผู้มาทาบทาม',
        subject: `${p.name} (อายุ ${p.age} ปี · พลังยุทธ์ ${p.power})`,
        subjectId: p.id,
        person: partner,
        autoValue: 'yes',
        text: `${partner.name} ${partner.origin} มาทาบทามขอครองคู่กับ${nm(p)} ` +
              'จะรับไว้หรือรอผู้อื่นในภายหน้า',
        options: [
          { label: 'รับไว้เป็นคู่ครอง', value: 'yes', note: 'ชื่อเสียง +3 และเริ่มมีทายาทได้', tone: 'accept' },
          { label: 'ปฏิเสธไปก่อน', value: 'no', note: 'รอผู้ที่เหมาะสมกว่านี้', tone: 'decline' },
        ],
      }, (v) => {
        if (v === 'yes') completeMarriage(p, partner);
        else ui.logEvent(`${nm(p)}ปฏิเสธการทาบทามของ${partner.name}อย่างสุภาพ`, 'event');
      });
    });
  }

  /** ให้กำเนิดบุตรและบันทึกจดหมายเหตุ — opts.secret = บุตรลับจากคู่ลับ */
  function completeBirth(father, mother, opts) {
    const secret = !!(opts && opts.secret);
    const baby = secret ? lineage.birthSecret(father, mother) : lineage.birth(father, mother);
    if (!baby) return null;
    register(baby);
    baby.bornMonth = game.state.month;
    baby.age = 0;
    linkBlood(baby);
    structureDirty = true;
    // ให้กำเนิดครบสามคน = สายเลือดอุดมสมบูรณ์จริง (trait นี้สืบทอดต่อได้)
    if (mother.childIds.length >= 3) {
      rollTrait(mother, 'fertileLine', 0.5, 'ให้กำเนิดทายาทได้ครบถ้วนสมบูรณ์');
    }
    if (secret) {
      const husband = mother.spouseId ? lineage.get(mother.spouseId) : null;
      if (husband) {
        // โลกภายนอกเห็นเป็นข่าวดีธรรมดาของสามีภรรยา — ชื่อเสียงเพิ่มตามปกติ
        game.addReputation(2);
        ui.logEvent(
          `${nm(mother)}ให้กำเนิด${genderWord(baby.gender)} ได้ชื่อว่า${nm(baby)} ` +
          `บุตรของ${nm(husband)}และ${nm(mother)}`,
          'birth'
        );
        ui.logEvent(
          `แต่มีเพียง${nm(mother)}ที่รู้ว่าบิดาแท้จริงของ${baby.name}คือ${nm(father)} ` +
          `— แม้แต่${father.name}เองก็ไม่รู้`,
          'secret'
        );
      } else {
        ui.logEvent(
          `${nm(mother)}ให้กำเนิด${genderWord(baby.gender)} ได้ชื่อว่า${nm(baby)} ` +
          `โดยไม่ยอมเปิดเผยว่าบิดาคือผู้ใด — ความจริงมีเพียงนางที่รู้ว่าคือ${nm(father)}`,
          'secret'
        );
      }
    } else {
      game.addReputation(2);
      ui.logEvent(
        `${nm(mother)}ให้กำเนิด${genderWord(baby.gender)} ได้ชื่อว่า${nm(baby)} ` +
        `บุตรของ${nm(father)}และ${nm(mother)}`,
        'birth'
      );
    }
    return baby;
  }

  function rollBirths() {
    lineage.living().forEach((p) => {
      if (!p.isBlood || !p.spouseId) return;
      const spouse = lineage.spouseOf(p);
      if (!spouse || !spouse.alive) return;

      const father = p.gender === 'male' ? p : spouse;
      const mother = p.gender === 'female' ? p : spouse;
      if (mother.age < CONFIG.fertileMin || mother.age > CONFIG.fertileMax) return;
      if (mother.childIds.length >= CONFIG.maxChildren) return;
      if (Math.random() >= CONFIG.birthChancePerMonth * T.mul(mother, 'fertility')) return;

      const count = mother.childIds.length;
      ask({
        kind: 'birth',
        title: 'ปรึกษาเรื่องทายาท',
        subject: `${father.name} และ ${mother.name}`,
        subjectId: p.id,
        autoValue: 'yes',
        text: `${nm(father)}และ${nm(mother)}ปรึกษากันเรื่องการมีบุตร ` +
              (count ? `ขณะนี้มีบุตรแล้ว ${count} คน ` : 'ยังไม่มีบุตรด้วยกัน ') +
              'จะตกลงมีทายาทในช่วงนี้หรือไม่',
        options: [
          { label: 'ตกลงมีทายาท', value: 'yes', note: 'ชื่อเสียง +2 แต่เด็กเล็กเป็นภาระค่าใช้จ่าย', tone: 'accept' },
          { label: 'ยังไม่ใช่เวลานี้', value: 'no', note: 'เก็บกำลังทรัพย์ไว้ก่อน', tone: 'decline' },
        ],
      }, (v) => {
        if (v === 'yes') completeBirth(father, mother);
        else ui.logEvent(`${nm(father)}และ${nm(mother)}ตกลงกันว่ายังไม่ใช่เวลาที่เหมาะ`, 'event');
      });
    });
  }

  /* ข้อความการตายก่อนวัย — โลกจอมยุทธ์ตายยาก แต่เภทภัยยังมีได้นานๆ ครั้ง */
  const UNTIMELY_DEATHS = [
    '{name}ประสบอุบัติเหตุยานเหาะตกและจากไปด้วยวัยเพียง {age} ปี',
    'เศษอุกกาบาตหลุดวงโคจรตกใส่เขตที่{name}พำนัก สิ้นชีพด้วยวัยเพียง {age} ปี',
    '{name}ถูกศัตรูเก่าของตระกูลลอบสังหาร ด้วยวัยเพียง {age} ปี',
    'โรคร้ายที่แม้แพทย์ชีวกลก็รักษาไม่ได้ คร่า{name}ไปด้วยวัยเพียง {age} ปี',
  ];

  function rollDeaths() {
    lineage.living().forEach((p) => {
      // จากไปอย่างสงบเริ่มได้หลัง peacefulAge เท่านั้น — ก่อนหน้านั้นมีแต่เภทภัย
      const peaceful = p.age >= CONFIG.peacefulAge;
      const chance = peaceful
        ? CONFIG.deathChanceBase * (1 + (p.age - CONFIG.peacefulAge) / 4)
        : (p.age >= CONFIG.adultAge ? CONFIG.illnessChancePerMonth : 0);
      if (Math.random() >= chance) return;

      lineage.die(p);
      structureDirty = true;
      ui.logEvent(
        peaceful
          ? `${nm(p)}ละสังขารอย่างสงบด้วยวัย ${p.deathAge} ปี ลูกหลานทั้งตระกูลร่วมไว้อาลัย`
          : P.pick(UNTIMELY_DEATHS)
              .split('{name}').join(nm(p))
              .split('{age}').join(p.deathAge),
        'death'
      );

      // คู่ครองที่เหลืออยู่บางคนไม่เหมือนเดิมอีกเลย
      const widow = p.spouseId ? lineage.get(p.spouseId) : null;
      if (widow && widow.alive) {
        rollTrait(widow, 'heartbroken', T.has(widow, 'devoted') ? 0.75 : 0.4,
          `สูญเสีย${nm(p)}ไปตลอดกาล`);
      }
    });
  }

  /**
   * สุ่มให้เกิดความสัมพันธ์ลับระหว่างชายกับหญิง
   *
   * ไม่จำกัดว่าต้องโสดหรือรุ่นเดียวกัน แต่จำกัดเฉพาะต่างเพศ และเว้นคู่ที่เป็น
   * สายเลือดเดียวกันไว้ ให้สอดคล้องกับกติกาที่ใช้กับเรื่องชู้สาวส่วนอื่นของเกม
   *
   * ผลของมันต่อเกม (ชื่อเสียง ทายาทลับ การถูกจับได้ ฯลฯ) ยังไม่ได้ออกแบบ
   * ตอนนี้จึงมีแค่การเกิดขึ้น การบันทึก และการวาดเป็นเส้นปะในผัง
   */
  function rollSecrets() {
    if (Math.random() >= CONFIG.secretChancePerMonth) return;

    const adults = lineage.living().filter((p) => p.age >= CONFIG.adultAge);
    if (adults.length < 2) return;

    // trait สายหลายใจทำให้ถูกเลือกเป็นคนเริ่มเรื่องบ่อยกว่า สายรักเดียวใจเดียวแทบไม่เลย
    const a = pickWeighted(adults, (x) => T.mul(x, 'secret'));
    const candidates = adults.filter((b) =>
      b.id !== a.id &&
      b.gender !== a.gender &&              // ความสัมพันธ์ลับมีเฉพาะชายกับหญิง
      !(a.isBlood && b.isBlood) &&          // เว้นคู่สายเลือดเดียวกัน
      !lineage.isDirectLine(a, b) &&        // เว้นพ่อแม่ลูกปู่ย่าหลานสายตรง (แม่แต่งเข้าก็คือแม่)
      b.id !== a.spouseId &&                // คู่สมรสตัวเองไม่นับว่าลับ
      !lineage.hasSecret(a.id, b.id)
    );
    if (!candidates.length) return;

    // ผู้ช่วงชิงดวงใจเล็งคนที่มีคู่แล้วเป็นพิเศษ ส่วนคนภักดีแทบไม่ถูกชวน
    const b = pickWeighted(candidates, (x) =>
      T.mul(x, 'secret') * (T.has(a, 'heartThief') && x.spouseId ? 3 : 1));
    lineage.addSecret(a.id, b.id, game.state.month);
    structureDirty = true;
    ui.logEvent(
      `มีข่าวลือว่า${nm(a)}กับ${nm(b)}สนิทสนมกันเกินปกติ แต่ยังไม่มีใครยืนยันได้`,
      'secret'
    );
  }

  /* ---------------------------------------------------------------------
   * หลอดความต้องการ — ไต่ขึ้นเองทุกเดือนตามไฟประจำตัว วัย และคุณลักษณะ
   * ถึงขีดสุดแล้วต้องหาทางระบาย ถ้าคู่ครองไม่ตอบสนองจะไปหาทางอื่น
   * จนก่อคุณลักษณะใหม่หรือความสัมพันธ์ลับได้
   * ------------------------------------------------------------------- */

  const DESIRE = data.DESIRE;

  const STRAY_TEXTS = [
    '{name}นอนไม่หลับทั้งคืน ออกไปฝึกยุทธ์กลางลานจนฟ้าสางเพื่อข่มใจตนเอง',
    '{name}ออกจากเรือนไปเดินเล่นกลางนครยามดึกโดยไม่บอกใครว่าไปไหน',
    'ผู้คนเห็น{name}ยืนมองผู้อื่นนานผิดปกติ แล้วรีบหลบสายตาเมื่อถูกจับได้',
  ];

  /** ระบายกับคู่ครองหรือคู่ลับ แล้วบันทึกเบาๆ */
  function relieveWith(p, other, kind) {
    P.relieve(p, kind);
    if (other) P.relieve(other, kind);
    if (Math.random() < 0.25) {
      ui.logEvent(kind === 'lover'
        ? `${nm(p)}กับ${nm(other)}ลอบพบกันอีกครั้ง คืนนั้นยาวนานกว่าครั้งไหน`
        : `${nm(p)}กับ${nm(other)}ใกล้ชิดกันเป็นพิเศษในเดือนนี้`,
        kind === 'lover' ? 'secret' : 'event');
    }
  }

  function rollDesire() {
    lineage.living().forEach((p) => {
      if (p.age < CONFIG.adultAge) return;
      p.desire = Math.min(120, (p.desire || 0) + P.desireRate(p));
      if (p.desire < DESIRE.peakAt) return;

      // 1) คู่ครอง — ตอบสนองไหมขึ้นกับหลอดของอีกฝ่ายเองด้วย
      const sp = p.spouseId ? lineage.get(p.spouseId) : null;
      if (sp && sp.alive && sp.age >= CONFIG.adultAge) {
        const willing = DESIRE.spouseWillingBase +
          DESIRE.spouseWillingFromDesire * Math.min(1, (sp.desire || 0) / DESIRE.peakAt);
        if (Math.random() < willing) { relieveWith(p, sp, 'spouse'); return; }
      }

      // 2) คู่ลับที่มีอยู่แล้ว
      const lovers = lineage.secretsOf(p.id)
        .filter((x) => x.alive && x.gender !== p.gender && x.age >= CONFIG.adultAge);
      if (lovers.length) {
        const lover = P.pick(lovers);
        relieveWith(p, lover, 'lover');
        tallyTrait(p, 'tryst', 'freeHeart', 4, 'พึ่งพาคนนอกเรือนจนเคยชิน');
        return;
      }

      // 3) ไม่มีใครตอบสนอง — หาทางอื่นเอง แล้วอาจเปลี่ยนไปทั้งชีวิต
      P.relieve(p, 'alone');
      if (Math.random() < 0.4) {
        ui.logEvent(P.pick(STRAY_TEXTS).split('{name}').join(nm(p)), 'event');
      }
      if (Math.random() < DESIRE.straySecretChance) {
        const lover = makeSecretFor(p);
        if (lover) {
          ui.logEvent(
            `${nm(p)}ทนความว้าวุ่นไม่ไหวจนไปหา${nm(lover)} — มีข่าวลือตามมาในเวลาไม่นาน`,
            'secret');
        }
      }
      if (Math.random() < DESIRE.strayTraitChance) {
        const pool = p.gender === 'female'
          ? ['limelight', 'freeHeart', 'radiantOne', 'ladyOfWill']
          : ['wanderingBee', 'freeHeart', 'heartThief', 'lordOfWill'];
        for (const id of pool) {
          if (gainTrait(p, id, 'เก็บกดความต้องการไว้นานจนใจเปลี่ยนไปจากเดิม')) break;
        }
      }
    });
  }

  /* ---------------------------------------------------------------------
   * ชีวิตของคู่ลับ — แอบคบกันจริง: ลอบพบ ตั้งครรภ์บุตรลับ และถูกจับได้
   * ------------------------------------------------------------------- */

  const SECRET_MEET_TEXTS = [
    '{a}กับ{b}หายตัวไปจากงานเลี้ยงในเวลาไล่เลี่ยกันอย่างน่าสงสัย',
    'ยามดึกมีผู้เห็นเงาคล้าย{a}ลอบเข้าพบ{b}แล้วจากไปก่อนฟ้าสาง',
    'มีจดหมายไร้ชื่อผู้ส่งวางอยู่หน้าเรือนของ{b} ลายมือนั้นคุ้นตายิ่งนัก',
    '{a}อ้างว่าไปฝึกยุทธ์ แต่ไม่มีใครพบเห็นที่หอฝึกเลยทั้งคืน',
  ];

  function rollSecretLife() {
    lineage.activeSecrets().forEach((r) => {
      const a = lineage.get(r.aId), b = lineage.get(r.bId);
      if (!a || !b || !a.alive || !b.alive) return;
      const father = a.gender === 'male' ? a : b;
      const mother = a.gender === 'female' ? a : b;
      if (father.gender === mother.gender) return;

      // ฉากลอบพบกัน — สีสันบรรยากาศ และเป็นพฤติกรรมสะสมที่ก่อ trait ได้
      const pairSecret = (T.mul(a, 'secret') + T.mul(b, 'secret')) / 2;
      if (Math.random() < CONFIG.secretMeetChance * pairSecret) {
        ui.logEvent(
          P.pick(SECRET_MEET_TEXTS).split('{a}').join(nm(a)).split('{b}').join(nm(b)),
          'secret');
        // ลอบพบกันจนชิน — ฝ่ายที่ทำซ้ำๆ ค่อยๆ กลายเป็นคนหลายใจ
        [a, b].forEach((x) => tallyTrait(x, 'tryst', 'freeHeart', 4,
          'ลอบพบผู้อื่นจนความลับกลายเป็นเรื่องคุ้นเคย'));
      }

      // ตั้งครรภ์บุตรลับ — ต้องมีฝ่ายสายเลือด (ลูกถึงมีที่ยืนในผัง) และแม่เจริญพันธุ์
      if ((father.isBlood || mother.isBlood) &&
          mother.age >= CONFIG.fertileMin && mother.age <= CONFIG.fertileMax &&
          mother.childIds.length < CONFIG.maxChildren &&
          Math.random() < CONFIG.secretBirthChancePerMonth) {
        const bloodOne = father.isBlood ? father : mother;
        ask({
          kind: 'birth',
          title: 'สายสัมพันธ์ลับผลิดอก',
          subject: `${nm(mother)} กับ ${nm(father)}`,
          subjectId: 'secretbaby:' + mother.id,
          person: bloodOne,
          autoValue: 'no',   // โหมดอัตโนมัติไม่สร้างบุตรลับเอง — เรื่องใหญ่เกินกว่าจะปล่อยสุ่ม
          text: `${nm(mother)}กับ${nm(father)}แอบคบหากันมาเนิ่นนาน ` +
                `ค่ำคืนล่าสุดร้อนแรงเกินห้ามใจ — จะปล่อยให้สายสัมพันธ์นี้ผลิดอกออกผลหรือไม่`,
          options: [
            { label: 'ปล่อยไปตามหัวใจ', value: 'yes', note: 'กำเนิดบุตรลับ', tone: 'accept' },
            { label: 'ยับยั้งชั่งใจไว้', value: 'no', note: 'ไม่มีอะไรเกิดขึ้น', tone: 'decline' },
          ],
        }, (v) => {
          if (v === 'yes') completeBirth(father, mother, { secret: true });
        });
      }

      // ความลับแตก — เสียชื่อเสียงครั้งเดียวต่อคู่ แล้วกลายเป็นเรื่องซุบซิบประจำนคร
      if (!r.exposed && Math.random() < CONFIG.secretExposeChancePerMonth) {
        r.exposed = true;
        // คนที่ไม่แคร์สายตาชาวนครทำให้เรื่องเสียหายน้อยลง คนที่ยึดชื่อเสียงยิ่งเจ็บหนัก
        const repMul = (T.mul(a, 'exposeRep') + T.mul(b, 'exposeRep')) / 2;
        const rep = Math.round(CONFIG.secretExposeRep * repMul);
        game.addReputation(rep);
        ui.logEvent(
          `ความลับแตก! ผู้คนจับได้ว่า${nm(a)}กับ${nm(b)}ลอบคบหากัน ` +
          `ตระกูลตกเป็นขี้ปากทั้งนคร (ชื่อเสียง ${rep})`,
          'secret');

        // ตัวคู่ลับเองเริ่มชาชินกับคำนินทา
        [a, b].forEach((x) => rollTrait(x, 'shameless', 0.5,
          'ตกเป็นขี้ปากชาวนครจนคำนินทาไม่ระคายอีกต่อไป'));

        // ฝ่ายที่เห็นคู่ครองตนไปมีผู้อื่น — ใจเปลี่ยนไปคนละทางตามนิสัยเดิม
        [a, b].forEach((x) => {
          const sp = x.spouseId ? lineage.get(x.spouseId) : null;
          if (!sp || !sp.alive) return;
          if (T.has(sp, 'openHeart')) {
            ui.logEvent(
              `${nm(sp)}รู้เรื่องของ${nm(x)}แต่กลับนิ่งเฉย — ใจที่เปิดกว้างไว้แต่แรกไม่สั่นไหว`,
              'secret');
            return;
          }
          if (gainTrait(sp, 'takenHeart', `รู้ว่า${nm(x)}มีผู้อื่นในใจ`)) {
            rollTrait(sp, 'jealous', 0.55, 'เฝ้าระแวงคนของตนนับแต่วันนั้น');
            rollTrait(sp, 'vengeful', 0.3, 'เก็บความแค้นครั้งนั้นไว้ไม่ลืมเลือน');
          } else {
            rollTrait(sp, 'openHeart', 0.25, 'ทำใจยอมรับได้ว่าหัวใจคนห้ามกันไม่ได้');
          }
        });
      }
    });
  }

  /** เหตุการณ์บรรยากาศจากคลังคำของ ScenarioEngine */
  function rollAmbient() {
    if (Math.random() >= CONFIG.ambientEventChance) return;
    const cast = engineCast();
    if (!cast.length) return;

    const ev = engine.generateEvent(cast);
    if (!ev) return;
    game.addGold(ev.deltas.gold);
    if (ev.tone === 'positive') game.addReputation(1);
    if (ev.tone === 'negative') game.addReputation(-1);
    ui.logEvent(ev.text, 'event');
  }

  /* ---------------------------------------------------------------------
   * สถานการณ์ที่ต้องตัดสินใจ
   * ------------------------------------------------------------------- */

  /** คำนวณผลของตัวเลือกที่ผู้เล่นกด แล้วบันทึกจดหมายเหตุ */
  function resolveChoice(evt, value) {
    let gold = 0, rep = 0, text = '';

    if (evt.id === 'merchant') {
      if (value === 'invest') {
        gold = -300;
        const profit = Math.random() < 0.6 ? 300 + Math.floor(Math.random() * 700) : -50;
        gold += profit;
        text = profit > 0
          ? `ตระกูลรับซื้อผ้าไหมไว้แล้วขายต่อได้กำไร ${profit} ตำลึง`
          : 'ผ้าไหมขายไม่ออก ตระกูลขาดทุนจากการลงทุนครั้งนี้';
        rep = profit > 0 ? 2 : -1;
      } else { text = 'ตระกูลปฏิเสธข้อเสนอของพ่อค้าเร่'; }

    } else if (evt.id === 'festival') {
      if (value === 'host') { gold = -400; rep = 8; text = 'ตระกูลรับเป็นเจ้าภาพงานบุญ ชาวบ้านกล่าวขวัญถึงไปทั่ว'; }
      else if (value === 'donate') { gold = -100; rep = 2; text = 'ตระกูลร่วมบริจาคในงานบุญแต่พอสมควร'; }
      else { rep = -3; text = 'ตระกูลปฏิเสธการเป็นเจ้าภาพ ชาวบ้านออกจะผิดหวัง'; }

    } else if (evt.id === 'kin') {
      if (value === 'help') { gold = -250; rep = 6; text = 'ตระกูลยื่นมือช่วยญาติจนตั้งตัวได้ ชื่อเสียงด้านน้ำใจขจรไกล'; }
      else { rep = -4; text = 'ตระกูลปฏิเสธคำขอของญาติ เรื่องนี้ถูกนำไปเล่าลือ'; }

    } else if (evt.id === 'breach') {
      if (value === 'fix') { gold = -500; rep = 5; text = 'ตระกูลลงทุนซ่อมแกนพลังงานได้ทันเวลา ความเสียหายถูกจำกัดไว้ทั้งหมด'; }
      else { gold = -800; text = 'แกนพลังงานรั่วไหลลุกลาม ตระกูลต้องชดใช้ความเสียหายก้อนใหญ่'; }

    } else if (evt.id === 'academy') {
      if (value === 'send') { gold = -350; rep = 7; text = 'ลูกหลานตระกูลได้เข้าฝึกในสำนักพลังยุทธ์ชั้นสูง'; }
      else { text = 'ลูกหลานฝึกวิชาเองที่หอประจำตระกูลตามเดิม'; }

    } else if (evt.id === 'duel') {
      if (value === 'accept') {
        // ส่งคนที่พลังยุทธ์สูงสุดในตระกูลขึ้นสังเวียน
        const champion = lineage.living()
          .filter((x) => x.age >= CONFIG.adultAge)
          .sort((a, b) => b.power - a.power)[0];
        const rival = Math.round(P.randNormal(110, 32, 40, 210));
        const mine = champion ? champion.power : 0;
        const win = mine >= rival;
        gold = win ? 600 : -200;
        rep = win ? 12 : -6;
        text = champion
          ? (win
            ? `${champion.name}ขึ้นประลองแทนตระกูลและเอาชนะได้ (พลังยุทธ์ ${mine} ต่อ ${rival}) ชื่อเสียงขจรไปทั่วนคร`
            : `${champion.name}ขึ้นประลองแทนตระกูลแต่พ่ายแพ้ (พลังยุทธ์ ${mine} ต่อ ${rival}) ตระกูลเสียหน้าไม่น้อย`)
          : 'ตระกูลไม่มีผู้ใดพร้อมขึ้นสังเวียน จึงต้องยอมถอย';
      } else { rep = -2; text = 'ตระกูลเลี่ยงการปะทะ คู่แข่งเยาะเย้ยอยู่พักหนึ่ง'; }
    }

    game.addGold(gold);
    game.addReputation(rep);
    const suffix = [];
    if (gold) suffix.push(`ทอง ${gold > 0 ? '+' : ''}${gold}`);
    if (rep) suffix.push(`ชื่อเสียง ${rep > 0 ? '+' : ''}${rep}`);
    ui.logEvent(text + (suffix.length ? ` (${suffix.join(' · ')})` : ''), 'event');
  }

  // pity timer — ทุกเดือนที่อีเวนต์ประเภทนั้นไม่เกิด โอกาสทบขึ้นเรื่อยๆ แล้วรีเซ็ตเมื่อเกิด
  let choiceDrought = 0;
  let appearanceDrought = 0;

  function rollChoiceEvent() {
    const chance = CONFIG.choiceEventChance * (1 + choiceDrought * CONFIG.eventRampPerMonth);
    if (Math.random() >= chance) { choiceDrought++; return; }
    if (!lineage.living().some((p) => p.isBlood)) return;
    choiceDrought = 0;

    const evt = P.pick(CHOICE_EVENTS);
    ask({
      kind: 'choice',
      title: evt.title,
      text: evt.text,
      autoValue: evt.options[0].value,
      options: evt.options,
    }, (v) => resolveChoice(evt, v));
  }

  /* ---------------------------------------------------------------------
   * อีเวนต์รูปโฉม — อีเวนต์หลักชุดที่สอง ขับด้วยเทมเพลตในโฟลเดอร์ js/events/
   * เงื่อนไข/ข้อความ/ผลลัพธ์ทั้งหมดอยู่ในไฟล์เหล่านั้น ตรงนี้เป็นแค่เครื่องประมวลผล
   * ------------------------------------------------------------------- */
  const APPEARANCE_EVENTS = window.EventTemplates || [];
  /* "evtId:personId" -> เดือนที่เจอครั้งล่าสุด — เว้นครบ eventRepeatMonths แล้ว
     จึงเจอซ้ำได้ ถ้าห้ามซ้ำถาวรอย่างเดิม คุณลักษณะแบบสะสมที่ต้องทำหลายครั้ง
     แต่มีแหล่งสะสมน้อยกว่าเกณฑ์จะไปไม่ถึงตลอดกาล */
  const appearanceSeen = new Map();

  /** แทนคำใน title/text/ข้อความผลลัพธ์ของอีเวนต์รูปโฉม */
  function fillAppearance(text, p, place, extra) {
    const tokens = Object.assign({
      '{name}': nm(p),
      '{place}': place,
      '{measure}': P.measureLabel(p),
      '{tier}': P.charmTier(p.charm, p.gender),
      '{age}': String(p.age),
    }, extra || {});
    return Object.keys(tokens).reduce((s, k) => s.split(k).join(tokens[k]), text || '');
  }

  /** ตรวจว่าคนนี้เข้าเงื่อนไขชุดหนึ่ง (ใช้ได้ทั้ง when และ partnerWhen) */
  function appearanceEligible(p, w) {
    w = w || {};
    const c = P.charmParts(p);
    const cup = p.body.measure && p.body.measure.cup != null ? p.body.measure.cup : null;
    if (w.gender && p.gender !== w.gender) return false;
    if (w.blood != null && p.isBlood !== w.blood) return false;
    if (p.age < (w.minAge != null ? w.minAge : CONFIG.adultAge)) return false;
    if (w.maxAge != null && p.age > w.maxAge) return false;
    if (w.minCharm != null && p.charm < w.minCharm) return false;
    if (w.maxCharm != null && p.charm > w.maxCharm) return false;
    if (w.minFace != null && c.face < w.minFace) return false;
    if (w.minShape != null && c.shape < w.minShape) return false;
    if (w.minCup != null && (cup == null || cup < w.minCup)) return false;
    if (w.hasSpouse === true && !p.spouseId) return false;
    if (w.hasSpouse === false && p.spouseId) return false;
    if (w.minDesire != null && (p.desire || 0) < w.minDesire) return false;
    if (w.maxDesire != null && (p.desire || 0) > w.maxDesire) return false;
    // เงื่อนไขคุณลักษณะติดตัว — รับได้ทั้งชื่อเดียวและรายการ (ต้องมีอย่างน้อยหนึ่ง)
    const need = w.trait ? [].concat(w.trait) : null;
    if (need && !need.some((id) => T.has(p, id))) return false;
    const ban = w.notTrait ? [].concat(w.notTrait) : null;
    if (ban && ban.some((id) => T.has(p, id))) return false;
    return true;
  }

  /** หาเขย/สะใภ้ที่จับคู่กับ p ในอีเวนต์ inlaw ได้ — ต่างเพศ แต่งเข้า ไม่ใช่คู่ตัวเอง */
  function inlawCandidates(p, evt) {
    return lineage.living().filter((b) =>
      b.age >= CONFIG.adultAge &&
      b.id !== p.id &&
      !b.isBlood &&
      b.gender !== p.gender &&
      b.id !== p.spouseId &&
      !lineage.isDirectLine(p, b) &&   // สะใภ้/เขยที่แท้จริงคือแม่/พ่อของตน — ห้ามเด็ดขาด
      !lineage.hasSecret(p.id, b.id) &&
      appearanceEligible(b, evt.partnerWhen)
    );
  }

  /** สุ่มชื่อคนแปลกหน้า (ต่างเพศกับตัวหลัก) ตามจำนวนใน group — ไม่เข้าผังตระกูล */
  function makeStrangers(evt, p) {
    const range = evt.group || [1, 1];
    const n = range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1));
    const gender = p.gender === 'male' ? 'female' : 'male';
    const names = [];
    for (let guard = 0; names.length < n && guard < 50; guard++) {
      const nm = P.pick(data.NAMES[gender]);
      if (!names.includes(nm)) names.push(nm);
    }
    return names;
  }

  /** สุ่มสร้างคู่ลับให้คนนี้ตามกติกาเดียวกับ rollSecrets คืนคนที่จับคู่ได้ */
  function makeSecretFor(p) {
    const candidates = lineage.living().filter((b) =>
      b.age >= CONFIG.adultAge &&
      b.id !== p.id &&
      b.gender !== p.gender &&
      !(p.isBlood && b.isBlood) &&
      !lineage.isDirectLine(p, b) &&
      b.id !== p.spouseId &&
      !lineage.hasSecret(p.id, b.id)
    );
    if (!candidates.length) return null;
    const b = P.pick(candidates);
    lineage.addSecret(p.id, b.id, game.state.month);
    structureDirty = true;
    return b;
  }

  /** มีบุตรจากอีเวนต์ — กับคู่สมรส คู่ลับ คู่กรณี หรือคนแปลกหน้าที่ไม่มีวันรู้จัก */
  function eventChild(p, source, eventPartner, tokens) {
    let partner = null;
    if (source === 'spouse') {
      partner = p.spouseId ? lineage.get(p.spouseId) : null;
    } else if (source === 'partner') {
      partner = eventPartner || null;
    } else if (source === 'stranger') {
      // บิดาเป็นคนแปลกหน้าที่ไม่เคยเข้าตระกูล — สร้างไว้เพื่อสืบพันธุกรรมเท่านั้น
      // ไม่ลงทะเบียนเข้าผัง จึงไม่กินที่ ไม่แก่ ไม่ถูกจับคู่ และไม่มีเส้นในผัง
      if (p.gender !== 'female') return null;
      partner = P.createOutsider('male', p.age, p.charm);
      if (tokens && tokens['{stranger}']) partner.name = tokens['{stranger}'];
      partner.strangerFather = true;
    } else {
      const lovers = lineage.secretsOf(p.id).filter((x) => x.gender !== p.gender);
      partner = lovers.length ? P.pick(lovers) : makeSecretFor(p);
    }
    if (!partner) return null;
    const father = p.gender === 'male' ? p : partner;
    const mother = p.gender === 'female' ? p : partner;
    if (father.gender !== 'male' || mother.gender !== 'female') return null;
    // เคารพกติกาการมีบุตรปกติ — แม่ต้องอยู่ในวัยเจริญพันธุ์ (เพดานบุตรเช็คใน birth)
    if (mother.age < CONFIG.fertileMin || mother.age > CONFIG.fertileMax) return null;
    // บุตรจากชู้รัก/คู่กรณีเป็นบุตรลับเสมอ — โลกรู้แค่ตามทะเบียน
    return completeBirth(father, mother, { secret: source !== 'spouse' });
  }

  /** ประมวลผลตัวเลือกที่ผู้เล่นกดในอีเวนต์รูปโฉม */
  function resolveAppearance(evt, value, p, place, partner, tokens) {
    const opt = evt.options.find((o) => o.value === value) || evt.options[0];
    let eff = opt.effect || {};
    if (eff.chance != null) eff = (Math.random() < eff.chance ? eff.success : eff.fail) || {};

    const gold = eff.gold || 0;
    const rep = eff.rep || 0;
    game.addGold(gold);
    game.addReputation(rep);

    const suffix = [];
    if (gold) suffix.push(`เครดิต ${gold > 0 ? '+' : ''}${gold}`);
    if (rep) suffix.push(`ชื่อเสียง ${rep > 0 ? '+' : ''}${rep}`);
    if (eff.text) {
      ui.logEvent(fillAppearance(eff.text, p, place, tokens) +
        (suffix.length ? ` (${suffix.join(' · ')})` : ''), 'event');
    }

    // หลอดความต้องการ: ค่าลบคือได้ระบาย ค่าบวกคือยิ่งถูกเร้า
    if (eff.desire) p.desire = Math.max(0, Math.min(120, (p.desire || 0) + eff.desire));

    // คุณลักษณะติดตัว: ได้ทันที (trait) หรือสะสมพฤติกรรมจนติดเป็นนิสัย (tally)
    if (eff.trait) {
      [].concat(eff.trait).forEach((id) => gainTrait(p, id, eff.traitStory));
    }
    if (eff.tally) {
      [].concat(eff.tally).forEach((t) =>
        tallyTrait(p, t.key || t.trait, t.trait, t.need, t.story));
    }

    if (eff.secretWithPartner && partner) {
      lineage.addSecret(p.id, partner.id, game.state.month);
      structureDirty = true;
      ui.logEvent(`มีข่าวลือว่า${nm(p)}กับ${nm(partner)}สนิทสนมกันเกินปกติ`, 'secret');
    }
    if (eff.secret && !eff.child) {
      const lover = makeSecretFor(p);
      if (lover) {
        ui.logEvent(`มีข่าวลือว่า${nm(p)}กับ${nm(lover)}สนิทสนมกันเกินปกติ`, 'secret');
      }
    }
    // 'lover' สร้างคู่ลับให้เองถ้ายังไม่มี · 'stranger' บิดาไม่เคยเข้าผังตระกูล
    if (eff.child) eventChild(p, eff.child, partner, tokens);
  }

  /** หลอดความต้องการที่สูงที่สุดในตระกูล ใช้เร่งความถี่ของอีเวนต์แนวนี้ */
  function desirePressure() {
    const top = lineage.living().reduce(
      (m, p) => (p.age >= CONFIG.adultAge ? Math.max(m, p.desire || 0) : m), 0);
    return 1 + (DESIRE.eventBoostMax - 1) * Math.min(1, top / DESIRE.peakAt);
  }

  /**
   * สุ่มอีเวนต์รูปโฉม — สุ่ม "รายคน" ไม่ใช่ครั้งเดียวทั้งตระกูล
   * ถ้าสุ่มทีละเรื่องต่อทั้งตระกูล คนหนึ่งจะเจออีเวนต์หนึ่งครั้งทุกหลายสิบปี
   * แล้วคุณลักษณะแบบสะสม (ต้องทำซ้ำหลายครั้ง) จะไม่มีวันครบเกณฑ์
   * จำกัดไม่เกิน maxPerMonth เรื่องต่อเดือน กันคิวการตัดสินใจท่วม
   */
  function rollAppearanceEvent() {
    if (!lineage.living().some((p) => p.isBlood)) return;

    const matches = [];
    lineage.living().forEach((p) => {
      if (p.age < CONFIG.adultAge) return;
      // หลอดความต้องการของ "คนคนนั้นเอง" เป็นตัวเร่งโอกาสของเขา
      const heat = 1 + (DESIRE.eventBoostMax - 1) * Math.min(1, (p.desire || 0) / DESIRE.peakAt);
      const chance = CONFIG.appearanceEventChance * heat
        * (1 + appearanceDrought * CONFIG.eventRampPerMonth);
      if (Math.random() >= chance) return;

      APPEARANCE_EVENTS.forEach((evt) => {
        /* เคยเจอแล้วต้องเว้นช่วงก่อน แต่ถ้าเรื่องนั้นเข้าทางคุณลักษณะที่ตนมีอยู่
           จะ "โหยหาสิ่งที่ตัวเองเคยทำ" แล้ววนกลับไปทำซ้ำเร็วกว่าปกติมาก */
        const last = appearanceSeen.get(evt.id + ':' + p.id);
        if (last != null) {
          const craves = (evt.traitAffinity || []).some((id) => T.has(p, id));
          const wait = CONFIG.eventRepeatMonths * (craves ? CONFIG.eventCravingFactor : 1);
          if (game.state.month - last < wait) return;
        }
        if (!appearanceEligible(p, evt.when)) return;
        if (evt.partner === 'inlaw') {
          const partners = inlawCandidates(p, evt);
          if (partners.length) matches.push({ p, evt, partner: P.pick(partners) });
        } else {
          matches.push({ p, evt });
        }
      });
    });
    if (!matches.length) { appearanceDrought++; return; }   // ยังไม่มีใครเข้าเงื่อนไข — ทบโอกาสไว้
    appearanceDrought = 0;

    /* คนหนึ่งได้เรื่องเดียวต่อเดือน — เลือกเรื่องที่ "เข้าทาง" คุณลักษณะของเขา
       บ่อยกว่าเรื่องอื่นมาก และทั้งเดือนเกิดได้ไม่เกิน maxPerMonth เรื่อง */
    const byPerson = new Map();
    matches.forEach((mt) => {
      if (!byPerson.has(mt.p.id)) byPerson.set(mt.p.id, []);
      byPerson.get(mt.p.id).push(mt);
    });
    const chosen = Array.from(byPerson.values()).map((list) =>
      pickWeighted(list, (mt) =>
        1 + (mt.evt.traitAffinity || []).filter((id) => T.has(mt.p, id)).length * 1.8));
    chosen.sort(() => Math.random() - 0.5);
    chosen.slice(0, CONFIG.appearanceMaxPerMonth).forEach(fireAppearance);
  }

  /** เปิดกล่องถามผู้เล่นสำหรับอีเวนต์รูปโฉมหนึ่งเรื่อง */
  function fireAppearance(mt) {
    const p = mt.p, evt = mt.evt, partner = mt.partner;
    const place = P.pick(evt.places || ['กลางนคร']);
    appearanceSeen.set(evt.id + ':' + p.id, game.state.month);

    // token เพิ่มเติมของคู่กรณี — คู่เขย/สะใภ้ หรือคนแปลกหน้าที่สุ่มขึ้นใหม่
    const tokens = {};
    if (partner) tokens['{partner}'] = nm(partner);
    if (evt.partner === 'stranger') {
      const strangers = makeStrangers(evt, p);
      tokens['{stranger}'] = strangers[0] || '';
      tokens['{strangers}'] = strangers.join(' ');
      tokens['{count}'] = String(strangers.length);
    }

    ask({
      kind: 'appearance',
      title: fillAppearance(evt.title, p, place, tokens),
      subject: partner ? `${p.name} กับ ${partner.name}` : p.name,
      subjectId: 'app:' + p.id,
      person: p,
      autoValue: evt.options[0].value,
      text: fillAppearance(evt.text, p, place, tokens),
      options: evt.options.map((o) => Object.assign({}, o, {
        label: fillAppearance(o.label, p, place, tokens),
        note: o.note ? fillAppearance(o.note, p, place, tokens) : o.note,
      })),
    }, (v) => resolveAppearance(evt, v, p, place, partner, tokens));
  }

  function checkExtinction() {
    if (lineage.living().some((p) => p.isBlood)) return false;
    gameOver = true;
    clock.pause();
    ui.renderClockControls();
    ui.logEvent('สิ้นสายเลือดตระกูล พงศาวดารจบลงเพียงเท่านี้', 'death');
    return true;
  }

  /* ---------------------------------------------------------------------
   * วงจรหนึ่งเดือน
   * ------------------------------------------------------------------- */
  function tick() {
    if (gameOver) return;

    game.advanceMonth(lineage.monthlyIncome());
    ageEveryone();
    rollMarriages();
    rollBirths();
    rollDeaths();
    rollDesire();
    rollSecrets();
    rollSecretLife();
    rollAmbient();
    rollChoiceEvent();
    rollAppearanceEvent();

    if (game.checkWin(lineage.maxGeneration())) {
      ui.showWin();
      ui.logEvent('ตระกูลรุ่งเรืองเป็นที่เลื่องลือทั่วแผ่นดิน — บรรลุเป้าหมายแล้ว', 'milestone');
    }

    if (structureDirty) {
      renderTree();
    } else {
      tree.refreshFigures();
    }
    ui.renderHUD();
    checkExtinction();
    pumpDecisions();   // ถามเรื่องที่ค้างอยู่ทีละเรื่อง โดยหยุดเวลารอ
  }

  /* ---------------------------------------------------------------------
   * เริ่มเกม
   * ------------------------------------------------------------------- */
  function startGame(playerGender) {
    const father = register(P.createPerson({ gender: 'male', age: 46, isBlood: true }));
    const mother = register(P.createOutsider('female', 44));
    lineage.marry(father, mother);

    const playerBody = P.inheritBody(playerGender, father, mother);
    const player = register(P.createPerson({
      gender: playerGender,
      age: 18,
      isBlood: true,
      isFounder: true,
      fatherId: father.id,
      motherId: mother.id,
      body: playerBody,
      powerBase: P.inheritPowerBase(father, mother, playerBody.buildId),
    }));
    father.childIds.push(player.id);
    mother.childIds.push(player.id);
    linkBlood(player);
    founder = player;

    // พี่น้องของผู้เล่น 1–2 คน เพื่อไม่ให้ชะตาของทั้งตระกูลแขวนอยู่กับคนเดียว
    // (ถ้าผู้เล่นคนเดียวไม่มีบุตร ตระกูลจะสูญสิ้นตั้งแต่รุ่นแรกทันที)
    const siblingCount = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < siblingCount; i++) {
      const g = Math.random() < 0.5 ? 'male' : 'female';
      const sibBody = P.inheritBody(g, father, mother);
      const sib = register(P.createPerson({
        gender: g,
        age: 12 + Math.floor(Math.random() * 11),
        isBlood: true,
        fatherId: father.id,
        motherId: mother.id,
        body: sibBody,
        powerBase: P.inheritPowerBase(father, mother, sibBody.buildId),
      }));
      father.childIds.push(sib.id);
      mother.childIds.push(sib.id);
      linkBlood(sib);
    }

    tree.render();
    // รอให้เบราว์เซอร์จัด layout เสร็จก่อนวัดขนาด ไม่งั้นบนมือถือจะวัดได้ค่าศูนย์
    // เพราะหน้าจอเริ่มเกมเพิ่งถูกซ่อนไปในเฟรมเดียวกัน
    requestAnimationFrame(() => {
      viewport.fit();
      tree.drawLinks();   // วาดเส้นซ้ำหลัง layout นิ่งแล้ว เผื่อฟอนต์เพิ่งโหลดเสร็จ
    });
    ui.renderHUD();
    ui.logEvent(
      `พงศาวดารเริ่มต้นขึ้นที่${nm(player)} ${genderWord(player.gender)}วัย ${player.age} ปี ` +
      `${bodyWord(player)} บุตรของ${nm(father)}และ${nm(mother)} — ` +
      'นับจากนี้ทุกคนในตระกูลคือคนของท่าน',
      'milestone'
    );

    clock.start();
    ui.renderClockControls();
  }

  /* ---------------------------------------------------------------------
   * แผ่นข้อมูลตัวละคร
   * ------------------------------------------------------------------- */
  function openDetail(id) {
    const p = lineage.get(id);
    if (!p) return;
    tree.highlight(id);
    ui.showPersonDetail(p, openDetail);   // กดชื่อญาติแล้วสลับไปดูคนนั้นต่อได้
  }

  /* ---------------------------------------------------------------------
   * ปุ่มควบคุม
   * ------------------------------------------------------------------- */
  viewport = window.Viewport.create(
    document.getElementById('treeViewport'),
    document.getElementById('treeCanvas'),
    { onChange: (s) => {
      const el = document.getElementById('zoomLabel');
      if (el) el.textContent = Math.round(s * 100) + '%';
    } }
  );

  document.getElementById('zoomIn').addEventListener('click', () => viewport.zoomIn());
  document.getElementById('zoomOut').addEventListener('click', () => viewport.zoomOut());
  document.getElementById('zoomFit').addEventListener('click', () => viewport.fit());

  // ลิ้นชักจดหมายเหตุ (มีผลเฉพาะจอแคบ) — พับแล้วผังได้พื้นที่คืนทันที
  const logToggle = document.getElementById('logToggle');
  const chronicle = document.getElementById('chroniclePanel');
  logToggle.addEventListener('click', () => {
    const collapsed = chronicle.classList.toggle('collapsed');
    logToggle.setAttribute('aria-expanded', String(!collapsed));
    // ขนาดกรอบผังเปลี่ยนไป ต้องจัดมุมมองใหม่ให้พอดี
    requestAnimationFrame(() => viewport.fit());
  });

  document.getElementById('playBtn').addEventListener('click', () => {
    if (gameOver || decisionPending) return;
    clock.toggle();
    ui.renderClockControls();
  });

  document.getElementById('speedBtn').addEventListener('click', () => {
    clock.cycleSpeed();
    ui.renderClockControls();
  });

  document.getElementById('autoBtn').addEventListener('click', () => {
    autoMode = !autoMode;
    ui.renderAutoButton(autoMode);
    if (autoMode) {
      // เคลียร์คิวที่ค้างอยู่ด้วยค่าอัตโนมัติ แล้วปล่อยเวลาเดินต่อ
      while (decisionQueue.length) {
        const item = decisionQueue.shift();
        if (item.cfg.subjectId) pendingSubjects.delete(item.cfg.subjectId);
        item.onChoose(item.cfg.autoValue);
      }
      renderTree();
      ui.renderHUD();
    }
  });

  document.addEventListener('keydown', (e) => {
    // Esc = ปิดแผ่นข้อมูลตัวละคร
    if (e.key === 'Escape') { ui.hidePersonDetail(); return; }
    // เว้นวรรค = เล่น/หยุด เพื่อกดหยุดดูผังได้เร็วๆ
    if (e.code !== 'Space' || gameOver || decisionPending) return;
    if (e.target.closest('button')) return;
    e.preventDefault();
    clock.toggle();
    ui.renderClockControls();
  });

  /* จัดมุมมองใหม่เมื่อขนาดจอเปลี่ยน แต่เฉพาะตอนที่ผู้เล่นยังไม่ได้ซูม/เลื่อนเอง
   * บนมือถือแถบ URL ที่ซ่อนและโผล่ทำให้เกิด resize รัวๆ ถ้าจัดใหม่ทุกครั้ง
   * มุมมองที่ผู้เล่นเพิ่งตั้งไว้จะถูกรีเซ็ตทิ้งกลางคัน */
  let resizeTimer = null;
  function onViewportResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (viewport && !viewport.isUserAdjusted()) viewport.fit();
    }, 180);
  }
  window.addEventListener('resize', onViewportResize);
  window.addEventListener('orientationchange', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (viewport) viewport.fit(); }, 320);
  });

  ui.renderAutoButton(autoMode);
  ui.showStartScreen(startGame);
})();
