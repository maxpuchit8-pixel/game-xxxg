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
  const Places = window.Places;   // สถานที่ในนครและตำแหน่งของแต่ละคน

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
  const relations = window.Relations.create();   // ค่าความสัมพันธ์รายคู่และความระแวง
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

  let graceTimer = null;   // ตัวจับเวลาช่วงพักก่อนเดินเวลาต่อ

  /** ยกเลิกช่วงพัก — ใช้เมื่อผู้เล่นสั่งเล่น/หยุดเอง คำสั่งของผู้เล่นต้องชนะเสมอ */
  function cancelGrace() {
    clearTimeout(graceTimer);
    graceTimer = null;
  }

  function pumpDecisions() {
    if (decisionPending || gameOver) return;

    if (!decisionQueue.length) {
      if (batchActive) {
        batchActive = false;
        /* หน่วงก่อนปล่อยให้เวลาเดินต่อ — ถ้าเดินต่อทันทีตอนเร่งความเร็ว
           สถานการณ์ถัดไปจะเด้งขึ้นแทบจะทันที จนผู้เล่นไม่ได้ทำอย่างอื่นเลย
           ช่วงพักนี้ปลอดภัยเพราะนาฬิกายังหยุดอยู่ จึงไม่มีเรื่องใหม่เกิดระหว่างนั้น */
        if (resumeAfterDecision) {
          clearTimeout(graceTimer);
          graceTimer = setTimeout(() => {
            graceTimer = null;
            if (gameOver || decisionPending || decisionQueue.length) return;
            clock.start();          // กลับไปเดินด้วยความเร็วที่ผู้เล่นตั้งไว้เอง
            ui.renderClockControls();
          }, CONFIG.decisionGraceMs);
        }
        ui.renderClockControls();
      }
      return;
    }

    if (!batchActive) {
      batchActive = true;
      // ถ้ายังอยู่ในช่วงพัก แปลว่าผู้เล่นตั้งใจให้เวลาเดินต่ออยู่แล้ว
      resumeAfterDecision = clock.isRunning() || graceTimer != null;
      clearTimeout(graceTimer);
      graceTimer = null;
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
        // เว้นจังหวะสั้นๆ ก่อนเปิดเรื่องถัดไปในคิว กันกดพลาดใส่กล่องที่เพิ่งเด้ง
        if (decisionQueue.length) setTimeout(pumpDecisions, CONFIG.decisionGapMs);
        else pumpDecisions();
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
      // เก็บประวัติรายปีไว้วาดกราฟในหน้าโปรไฟล์ (บันทึกก่อนอัปเดตค่าใหม่ของปีนี้)
      if (p.age >= CONFIG.adultAge) {
        if (!p.history) p.history = [];
        const m = p.body.measure || {};
        p.history.push({
          age: p.age, charm: p.charm, power: p.power, desire: Math.round(p.desire || 0),
          chest: m.chest, waist: m.waist, hips: m.hips, cup: m.cup,
        });
        if (p.history.length > 90) p.history.shift();
      }
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
    // เริ่มต้นชีวิตคู่ด้วยความไว้ใจและความสนิทระดับหนึ่ง ที่เหลือแล้วแต่จะรักษาไว้
    relations.shift(p.id, partner.id, 'trust', 65);
    relations.shift(p.id, partner.id, 'closeness', 55);
    relations.shift(p.id, partner.id, 'passion', 45);
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
      if (!p.isBlood || p.spouseId || !p.willMarry || inMask(p)) return;
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

  /**
   * ตั้งครรภ์ — จากนี้ไปการมีบุตรใช้เวลาเก้าเดือน ไม่ใช่เกิดทันที
   * ระหว่างนั้นเรือนร่างเปลี่ยน สามีอาจระแวง และความจริงอาจแตกก่อนคลอด
   */
  function completeBirth(father, mother, opts) {
    const secret = !!(opts && opts.secret);
    const motherOnly = !!(opts && opts.motherOnly);
    const force = !!(opts && opts.force);
    const pg = lineage.conceive(mother, father,
      { secret, motherOnly, force, month: game.state.month });
    if (!pg) return null;
    structureDirty = true;
    ui.logEvent(
      motherOnly
        ? `${nm(mother)}เริ่มตั้งครรภ์ — บุตรในครรภ์นี้จะเป็นของนางผู้เดียว`
        : (secret
          ? `${nm(mother)}เริ่มตั้งครรภ์ — มีเพียงนางที่รู้ว่าใครคือบิดา`
          : `${nm(mother)}ตั้งครรภ์กับ${nm(father)}แล้ว ทั้งเรือนรอคอยวันนั้นอยู่`),
      secret ? 'secret' : 'birth');
    return pg;
  }

  /** เดินครรภ์ของทุกคนไปหนึ่งเดือน แล้วคลอดเมื่อครบกำหนด */
  /** ผลของสถานที่ที่แต่ละคนอยู่ — คิดเดือนละครั้ง */
  function rollPlaceEffects() {
    let rep = 0;
    lineage.living().forEach((p) => {
      if (p.age < CONFIG.adultAge) return;
      const pl = Places.placeOf(p);
      if (pl.income) game.addGold(pl.income);
      if (pl.power) {
        p.powerBase = Math.min(data.POWER.base.max, p.powerBase + pl.power);
        p.power = P.powerFor(p);
      }
      if (pl.rep) rep += pl.rep;
    });
    if (rep >= 1) game.addReputation(Math.floor(rep));
  }

  function rollPregnancies() {
    lineage.living().forEach((mother) => {
      const pg = mother.pregnancy;
      if (!pg) return;

      // แท้ง — พบได้น้อยแต่มีจริง (ครรภ์จากหอเป็นกฎใหญ่กว่า ไม่แท้ง)
      if (!pg.force && Math.random() < CONFIG.miscarriageChance) {
        lineage.endPregnancy(mother);
        structureDirty = true;
        ui.logEvent(`${nm(mother)}สูญเสียบุตรในครรภ์ไปก่อนกำหนด ทั้งเรือนเงียบงันไปทั้งเดือน`, 'death');
        P.remember(mother, { kind: 'miscarried', month: game.state.month, weight: 3,
          text: 'สูญเสียบุตรในครรภ์' });
        rollTrait(mother, 'heartbroken', 0.5, 'สูญเสียบุตรในครรภ์ไปก่อนได้เห็นหน้า');
        return;
      }

      // ครรภ์ลับกับสามีที่ยังอยู่ในเรือน — ยิ่งท้องโตยิ่งน่าสงสัย
      const husband = mother.spouseId ? lineage.get(mother.spouseId) : null;
      if (pg.secret && !inMask(mother) && husband && husband.alive && !T.has(husband, 'openHeart')) {
        relations.addSuspicion(husband.id, mother.id, CONFIG.secretPregnancySuspicion);
      }

      const due = lineage.advancePregnancy(mother);
      if (pg.month === 4 && Math.random() < 0.5) {
        ui.logEvent(`ครรภ์ของ${nm(mother)}เริ่มเป็นที่สังเกตของคนในเรือนแล้ว`, 'event');
      }
      if (!due) return;

      const twins = Math.random() < CONFIG.twinChance;
      const born = deliverBaby(mother);
      if (born && twins) deliverTwin(mother, born);
    });
  }

  /** คลอดจริงเมื่อครบกำหนด แล้วบันทึกจดหมายเหตุตามกติกาบุตรลับเดิม */
  function deliverBaby(mother) {
    const pg = mother.pregnancy;
    const secret = pg ? pg.secret : false;
    const father = pg ? (lineage.get(pg.fatherId) || pg.fatherRef) : null;
    const baby = lineage.deliver(mother);
    if (!baby || !father) return null;
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

  /** แฝด — คลอดตามมาอีกคนทันทีโดยใช้บิดาคนเดียวกัน */
  function deliverTwin(mother, firstBorn) {
    const father = firstBorn.trueFatherId
      ? (lineage.get(firstBorn.trueFatherId) || lineage.get(firstBorn.fatherId))
      : lineage.get(firstBorn.fatherId);
    if (!father || mother.childIds.length >= CONFIG.maxChildren) return null;
    const twin = firstBorn.secretChild
      ? lineage.birthSecret(father, mother)
      : lineage.birth(father, mother);
    if (!twin) return null;
    register(twin);
    twin.bornMonth = game.state.month;
    twin.age = 0;
    linkBlood(twin);
    structureDirty = true;
    ui.logEvent(`แล้ว${nm(mother)}ก็ให้กำเนิดอีกคน — ${nm(twin)}เป็นแฝดของ${firstBorn.name}`, 'birth');
    return twin;
  }

  function rollBirths() {
    lineage.living().forEach((p) => {
      if (!p.isBlood || !p.spouseId) return;
      const spouse = lineage.spouseOf(p);
      if (!spouse || !spouse.alive) return;

      const father = p.gender === 'male' ? p : spouse;
      const mother = p.gender === 'female' ? p : spouse;
      if (mother.pregnancy) return;   // ตั้งครรภ์อยู่แล้ว
      if (inMask(mother) || inMask(father)) return;   // อยู่ในหอ กฎอื่นเข้าไม่ถึง
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
    // และคนที่อยู่ในที่ลับตาคนย่อมมีโอกาสมากกว่าคนที่อยู่กลางเรือน
    const a = pickWeighted(adults, (x) => T.mul(x, 'secret') * Places.placeOf(x).secret);
    const candidates = adults.filter((b) =>
      b.id !== a.id &&
      b.gender !== a.gender &&              // ความสัมพันธ์ลับมีเฉพาะชายกับหญิง
      !(a.isBlood && b.isBlood) &&          // เว้นคู่สายเลือดเดียวกัน
      !lineage.isDirectLine(a, b) &&        // เว้นพ่อแม่ลูกปู่ย่าหลานสายตรง (แม่แต่งเข้าก็คือแม่)
      b.id !== a.spouseId &&                // คู่สมรสตัวเองไม่นับว่าลับ
      !lineage.hasSecret(a.id, b.id)
    );
    if (!candidates.length) return;

    /* คนที่อยู่ "ที่เดียวกัน" มีโอกาสมากกว่าคนที่อยู่คนละมุมนครหลายเท่า
       นี่คือจุดที่ผู้เล่นคุมได้: ย้ายใครไปอยู่กับใครก็เท่ากับจับคู่ให้เอง */
    const spotA = Places.placeOf(a);
    const b = pickWeighted(candidates, (x) =>
      T.mul(x, 'secret')
      * (Places.placeOf(x).id === spotA.id ? CONFIG.samePlaceBonus : 1)
      * (T.has(a, 'heartThief') && x.spouseId ? 3 : 1));
    lineage.addSecret(a.id, b.id, game.state.month);
    relations.shift(a.id, b.id, 'passion', 35);
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

  /* คืนหน้ากาก — ไม่มีชื่อ ไม่มีใบหน้า และไม่มีใครถามถึงวันรุ่งขึ้น */
  const MASK_TEXTS = [
    '{a}สวมหน้ากากเดินเข้าหอเริงรมย์คืนนั้น และไม่มีใครในนั้นถามว่าเป็นใคร',
    'ในหอเริงรมย์ที่ไม่มีใครรู้จักใคร {a}เลือกคู่ของค่ำคืนเองด้วยเพียงสายตา',
    '{a}กลับจากหอเริงรมย์ก่อนฟ้าสางพร้อมหน้ากากในมือ — ไม่มีใครรู้ว่าคืนนั้นเป็นของใคร',
    'ม่านชั้นในของหอเริงรมย์ปิดลงหลัง{a} และเปิดอีกทีเมื่อแสงแรกมาถึง',
  ];

  const STRAY_TEXTS = [
    '{name}นอนไม่หลับทั้งคืน ออกไปฝึกยุทธ์กลางลานจนฟ้าสางเพื่อข่มใจตนเอง',
    '{name}ออกจากเรือนไปเดินเล่นกลางนครยามดึกโดยไม่บอกใครว่าไปไหน',
    'ผู้คนเห็น{name}ยืนมองผู้อื่นนานผิดปกติ แล้วรีบหลบสายตาเมื่อถูกจับได้',
  ];

  /**
   * ฉากใกล้ชิด — ไล่ระดับตามความปรารถนาที่สะสมไว้ระหว่างคู่นั้น
   * ยิ่งผูกพันกันมานาน ฉากยิ่งเข้มขึ้น จนถึงระดับที่ตัดฉากไปเลย
   */
  function intimateLine(a, b, place) {
    const bank = DT.intimate || {};
    const heat = relations.value(a.id, b.id, 'passion');
    const tier = heat >= 65 ? bank.burning : (heat >= 30 ? bank.close : bank.warm);
    if (!tier || !tier.length) return null;
    return dramaText(P.pick(tier), a, b, null, place);
  }

  /** ระบายกับคู่ครองหรือคู่ลับ แล้วบันทึกฉากใกล้ชิดเป็นระยะ */
  function relieveWith(p, other, kind) {
    P.relieve(p, kind);
    if (other) P.relieve(other, kind);
    if (other) relations.shift(p.id, other.id, 'passion', kind === 'lover' ? 6 : 3);
    if (other && Math.random() < 0.45) {
      const place = kind === 'lover' ? P.pick(DRAMA_PLACES) : Places.placeOf(p).name;
      const line = intimateLine(p, other, place);
      if (line) ui.logEvent(line, kind === 'lover' ? 'secret' : 'event');
    }
  }

  function rollDesire() {
    lineage.living().forEach((p) => {
      if (p.age < CONFIG.adultAge) return;
      const swing = p.pregnancy ? CONFIG.pregnancyDesireSwing : 1;
      p.desire = Math.min(120, (p.desire || 0) + P.desireRate(p) * swing);
      if (p.desire < DESIRE.peakAt) return;

      // 0) อยู่ในหอเริงรมย์ — โลกข้างนอกเข้าไม่ถึง ใช้ทางของหอเท่านั้น
      if (inMask(p)) {
        P.relieve(p, 'lover');
        tallyTrait(p, 'display', p.gender === 'female' ? 'radiantOne' : 'wanderingBee', 3,
          'ไปหอเริงรมย์หน้ากากบ่อยจนกลายเป็นความเคยชิน');
        if (Math.random() < 0.45) {
          ui.logEvent(P.pick(MASK_TEXTS).split('{a}').join(nm(p)), 'secret');
        }
        return;
      }

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
   * หอเริงรมย์หน้ากาก — บทต่อเนื่องที่เดินไปเรื่อยๆ จนจบฉากสุดท้าย
   * คู่ในเรื่องคือคนที่ผู้เล่นลากเข้ามาอยู่ในหอเดียวกันเท่านั้น
   * ------------------------------------------------------------------- */

  const MASK_CHAIN = window.MaskChain || [];
  const MASK_TRIO = window.MaskChainTrio || [];
  const MASK_SPOTS = window.MaskPlaces || ['หอเริงรมย์หน้ากาก'];

  /** คนในหอที่จับคู่กับ p ได้ตามกติกาเดิมของเกม */
  function maskPartnersFor(p, hall) {
    return hall.filter((x) =>
      x.id !== p.id &&
      x.gender !== p.gender &&
      x.age >= CONFIG.adultAge &&
      !(x.mask && x.mask.partnerIds && x.mask.partnerIds.indexOf(p.id) < 0));
  }

  function rollMaskChain() {
    const hall = lineage.living().filter((x) =>
      x.age >= CONFIG.adultAge && Places.placeOf(x).anonymous);

    // ออกจากหอแล้วบทจบทันที กลับเข้ามาใหม่ก็เริ่มบทใหม่
    lineage.living().forEach((x) => {
      if (!Places.placeOf(x).anonymous) { x.mask = null; x.maskRestUntil = 0; }
    });
    if (!hall.length) return;

    /* เลือกไว้ก่อนว่าใครจะได้ฉากในเดือนนี้ แล้วจำกัดจำนวนต่อเดือน
       ถ้าปล่อยให้ทุกคนในหอสุ่มฉากของตัวเอง กล่องตัดสินใจจะเด้งไม่หยุด
       จนช่วงพักหลังตอบไม่มีความหมายและผู้เล่นทำอย่างอื่นไม่ได้เลย */
    const ready = [];
    hall.forEach((p) => {
      // เพิ่งจบบทไปหมาดๆ — พักก่อน ยังไม่เริ่มเรื่องใหม่กับใคร
      if (p.maskRestUntil && game.state.month < p.maskRestUntil) return;
      if (!p.mask) p.mask = { stage: 0, partnerIds: null, follower: false };
      if (p.mask.follower) return;             // อีกฝ่ายเป็นคนเดินเรื่องอยู่แล้ว
      if (p.mask.stage >= MASK_CHAIN.length) { p.mask = null; return; }
      if (Math.random() >= CONFIG.maskSceneChance) return;
      ready.push(p);
    });
    /* คนเริ่มเรื่องต้องเป็น "ฝ่ายที่มีคนเดียว" เสมอ
       ในหอมีชายสองหญิงหนึ่ง → หญิงคนนั้นเป็นคนเริ่มและเป็นศูนย์กลางของวง
       ถ้าปล่อยให้ฝ่ายที่มีหลายคนเริ่ม จะได้แค่คู่ธรรมดาและอีกคนถูกทิ้งไว้ข้างนอก */
    const free = hall.filter((x) =>
      !(x.maskRestUntil && game.state.month < x.maskRestUntil) &&
      (!x.mask || (!x.mask.follower && !(x.mask.partnerIds && x.mask.partnerIds.length))));
    const males = free.filter((x) => x.gender === 'male').length;
    const females = free.filter((x) => x.gender === 'female').length;
    if (males && females && males !== females) {
      const lone = males < females ? 'male' : 'female';
      const loners = ready.filter((x) => x.gender === lone);
      if (loners.length) { ready.length = 0; ready.push.apply(ready, loners); }
    }
    ready.sort(() => Math.random() - 0.5);

    ready.slice(0, CONFIG.maskMaxPerMonth).forEach((p) => {
      let mates = (p.mask.partnerIds || []).map(lineage.get)
        .filter((x) => x && x.alive && Places.placeOf(x).anonymous);
      if (!mates.length) {
        const pool = maskPartnersFor(p, hall);
        if (!pool.length) return;              // ยังไม่มีใครให้จับคู่ — รอไปก่อน
        const first = pickWeighted(pool, (x) => T.mul(x, 'secret'));
        mates = [first];
        /* องค์ประกอบในหอลงตัวเป็นสองต่อหนึ่งเมื่อไร ก็เกิดวงสามคนได้
           (ชายสองหญิงหนึ่ง หรือหญิงสองชายหนึ่ง) โดยฝ่ายที่มีคนเดียวเป็นศูนย์กลาง */
        const rest = pool.filter((x) => x.id !== first.id);
        if (rest.length && Math.random() < CONFIG.maskTrioChance) {
          mates.push(pickWeighted(rest, (x) => T.mul(x, 'secret')));
        }
        p.mask.partnerIds = mates.map((x) => x.id);
        mates.forEach((x) => {
          x.mask = { stage: p.mask.stage, partnerIds: [p.id], follower: true };
        });
      }

      const trio = mates.length > 1 && MASK_TRIO.length;
      const chain = trio ? MASK_TRIO : MASK_CHAIN;
      if (p.mask.stage >= chain.length) { endMaskChain(p, mates, true); return; }
      const scene = chain[p.mask.stage];
      const place = P.pick(MASK_SPOTS);
      const fill = (t) => (t || '').split('{a}').join(nm(p))
        .split('{b}').join(mates[0] ? nm(mates[0]) : '')
        .split('{c}').join(mates[1] ? nm(mates[1]) : '')
        .split('{place}').join(place);

      ask({
        kind: 'appearance',
        title: fill(scene.title),
        subject: `${p.name} · ฉากที่ ${p.mask.stage + 1}/${chain.length}` +
          (trio ? ' · วงสามคน' : ''),
        subjectId: 'mask:' + p.id,
        person: p,
        autoValue: scene.options[0].value,
        text: fill(scene.text),
        options: scene.options.map((o) => Object.assign({}, o, { label: fill(o.label) })),
      }, (v) => resolveMaskScene(scene, v, p, mates, place, fill, chain));
    });
  }

  /** จบบทของวง แล้วตั้งเวลาพักให้ทุกคนที่อยู่ในวงนั้น */
  function endMaskChain(p, mates, finished) {
    const rest = finished ? CONFIG.maskRestMonths : Math.round(CONFIG.maskRestMonths / 3);
    [p].concat(mates || []).forEach((x) => {
      if (!x) return;
      x.mask = null;
      x.maskRestUntil = game.state.month + rest;
    });
    if (finished) {
      ui.logEvent(
        `เรื่องของ${nm(p)}ในหอเริงรมย์จบลงเพียงเท่านี้ — ผ่านไปพักใหญ่กว่าจะมีคืนเช่นนั้นอีก`,
        'event');
    }
  }

  function resolveMaskScene(scene, value, p, mates, place, fill, chain) {
    const opt = scene.options.find((o) => o.value === value) || scene.options[0];
    const eff = opt.effect || {};
    const group = [p].concat(mates);

    // เลือกเข้าไปกับคนเดียว — อีกคนหลุดออกจากวง กลับเป็นบทสองคน
    if (eff.splitOne && mates.length > 1) {
      const dropped = mates.pop();
      if (dropped) { dropped.mask = null; dropped.maskRestUntil = game.state.month + 6; }
      p.mask.partnerIds = mates.map((x) => x.id);
    }

    if (eff.desire) {
      p.desire = Math.max(0, Math.min(120, (p.desire || 0) + eff.desire));
      mates.forEach((x) => {
        x.desire = Math.max(0, Math.min(120, (x.desire || 0) + eff.desire * 0.8));
      });
    }
    if (eff.passion) mates.forEach((x) => relations.shift(p.id, x.id, 'passion', eff.passion));
    if (eff.text) ui.logEvent(fill(eff.text), 'secret');

    if (eff.trait) [].concat(eff.trait).forEach((id) => gainTrait(p, id, eff.traitStory));
    if (eff.tally) {
      [].concat(eff.tally).forEach((t) => tallyTrait(p, t.key || t.trait, t.trait, t.need, t.story));
    }

    /* ตั้งครรภ์ — สตรีทุกคนในวงมีโอกาสของตัวเอง
       ศูนย์กลางเป็นบุรุษ: สตรีทั้งสองคนตั้งครรภ์ได้แยกกัน
       ศูนย์กลางเป็นสตรี: บิดาแท้จริงคือหนึ่งในบุรุษของวง ซึ่งไม่มีใครในเรื่องรู้ */
    if (eff.conceive) {
      const women = group.filter((x) => x.gender === 'female');
      const men = group.filter((x) => x.gender === 'male');
      women.forEach((mother) => {
        if (mother.pregnancy || mother.age < CONFIG.adultAge || !men.length) return;
        if (Math.random() >= CONFIG.maskConceiveChance) return;
        completeBirth(P.pick(men), mother, { secret: true, motherOnly: true, force: true });
      });
      // บุรุษที่เป็นศูนย์กลางของวงสตรีสองคน — ค้นพบที่ทางของตน
      if (eff.haremIfCenterMale && p.gender === 'male' && women.length >= 2) {
        gainTrait(p, 'harem', 'เป็นศูนย์กลางของวงที่มีสตรีหลายคนพร้อมกัน');
      }
    }

    // ถอดหน้ากาก — ขึ้นทะเบียนเป็นคู่ลับกับทุกคนในวง ไม่มีเงื่อนไขใดมากั้น
    if (eff.reveal) {
      mates.forEach((x) => {
        lineage.addSecret(p.id, x.id, game.state.month);
        relations.shift(p.id, x.id, 'closeness', 20);
        P.remember(p, { kind: 'unmasked', month: game.state.month, aboutId: x.id, weight: 2,
          text: `ถอดหน้ากากแล้วพบว่าคืนนั้นคือ${x.name}` });
        P.remember(x, { kind: 'unmasked', month: game.state.month, aboutId: p.id, weight: 2,
          text: `ถูก${p.name}ถอดหน้ากากดูในคืนที่หอเริงรมย์` });
      });
      structureDirty = true;
    }

    const last = chain[chain.length - 1];
    if (eff.leave) { endMaskChain(p, mates, scene === last); return; }
    p.mask.stage += 1;
    mates.forEach((x) => { if (x.mask) x.mask.stage = p.mask.stage; });
    if (p.mask.stage >= chain.length) endMaskChain(p, mates, true);
  }

  /* ---------------------------------------------------------------------
   * ดราม่า — ค่าความสัมพันธ์รายคู่ ความระแวง แบล็กเมล์ และรักสามเส้า
   * ค่าทั้งหมดอยู่ใน relations.js ส่วนบทพูดอยู่ใน events/drama.js
   * ------------------------------------------------------------------- */

  const DT = window.DramaTexts || {};

  function dramaText(tpl, a, b, c, place) {
    return (tpl || '')
      .split('{a}').join(a ? nm(a) : '')
      .split('{b}').join(b ? nm(b) : '')
      .split('{c}').join(c ? nm(c) : '')
      .split('{place}').join(place || 'ในเรือน');
  }

  const DRAMA_PLACES = ['หลังเรือนใหญ่', 'ตรอกหลังตลาดแสงจันทร์', 'หอชมจันทร์',
    'ท่าเรือเหาะเขตตะวันตก', 'สวนลอยเขตตะวันออก'];

  /**
   * อยู่ในหอเริงรมย์หน้ากากอยู่หรือไม่
   * ที่นั่นเป็นโลกปิด — กฎและเหตุการณ์อื่นทั้งหมดของเกมเข้าไม่ถึงคนที่อยู่ข้างใน
   * มีแต่บทของหอเองที่เดินอยู่ และผลของการตั้งครรภ์เท่านั้นที่ส่งออกมาข้างนอก
   * (ยกเว้นการแก่ตัวและการเสียชีวิต ซึ่งเป็นเรื่องของกาลเวลาไม่ใช่เหตุการณ์)
   */
  function inMask(p) { return !!Places.placeOf(p).anonymous; }

  /** ผู้ใหญ่ที่ยังมีชีวิตทั้งหมด ใช้บ่อยในระบบดราม่า — ไม่นับคนที่อยู่ในหอ */
  function adults() {
    return lineage.living().filter((p) => p.age >= CONFIG.adultAge && !inMask(p));
  }

  /**
   * ความระแวงไต่ขึ้นทุกเดือนจากหลักฐานที่คู่ครองทิ้งไว้
   * ยิ่งคู่ลับลอบพบกันบ่อย ยิ่งมีร่องรอย — คนที่ไว้ใจกันมากจะระแวงช้ากว่า
   */
  function feedSuspicion(cheater, lover) {
    const sp = cheater.spouseId ? lineage.get(cheater.spouseId) : null;
    if (!sp || !sp.alive) return;
    if (T.has(sp, 'openHeart')) return;            // เปิดใจไว้แต่แรก ไม่ถือสา
    const trustGuard = relations.value(sp.id, cheater.id, 'trust') / 100;
    // พบกันในที่ที่ไม่มีใครรู้จักใคร แทบไม่เหลือร่องรอยให้ระแวง
    const masked = Places.placeOf(cheater).anonymous ? 0.25 : 1;
    const gain = CONFIG.suspicionPerClue * masked
      * (T.has(sp, 'jealous') ? 1.6 : 1) * (1 - trustGuard * 0.5);
    const level = relations.addSuspicion(sp.id, cheater.id, gain);
    if (level > 22 && Math.random() < 0.4) {
      ui.logEvent(dramaText(P.pick(DT.clue), cheater, sp), 'secret');
    }
    if (lover) relations.shift(cheater.id, lover.id, 'passion', 3);
  }

  /** มีคนนอกบังเอิญเห็นคู่ลับเข้า — กลายเป็นคนถือความลับไว้ในมือ */
  function rollWitness(a, b) {
    // ที่ลับตาคนถูกเห็นยากกว่ามาก และคนที่จะเห็นได้ต้องอยู่ที่เดียวกัน
    const spot = Places.placeOf(a);
    if (spot.anonymous) return;   // ทุกคนสวมหน้ากาก ไม่มีใครระบุตัวใครได้
    if (Math.random() >= CONFIG.witnessChance * spot.witness) return;
    const pool = adults().filter((x) =>
      x.id !== a.id && x.id !== b.id && !relations.knows(x.id, a.id, b.id) &&
      Places.placeOf(x).id === spot.id);
    if (!pool.length) return;
    const c = P.pick(pool);
    const place = P.pick(DRAMA_PLACES);
    relations.learn(c.id, a.id, b.id, game.state.month);
    P.remember(c, { kind: 'witnessed', month: game.state.month, aboutId: a.id, weight: 2,
      text: `เห็น${a.name}กับ${b.name}ด้วยตาตนเองที่${place}` });
    ui.logEvent(dramaText(P.pick(DT.witness), a, b, c, place), 'secret');

    // ถ้าคนที่เห็นเป็นคู่ครองของฝ่ายใดฝ่ายหนึ่ง เท่ากับจับได้คาตา
    [a, b].forEach((x) => {
      if (x.spouseId === c.id) relations.addSuspicion(c.id, x.id, 45);
    });
  }

  /** ฉากเผชิญหน้า — เกิดเมื่อความระแวงเต็มขีด แล้วพาไปคนละจุดจบ */
  function rollConfrontation() {
    const hot = relations.suspicionsAbove(CONFIG.confrontAt)
      .map((s) => ({ obs: lineage.get(s.obsId), tgt: lineage.get(s.tgtId), level: s.level }))
      .filter((s) => s.obs && s.tgt && s.obs.alive && s.tgt.alive && s.obs.spouseId === s.tgt.id
        && !inMask(s.obs) && !inMask(s.tgt));
    if (!hot.length) return;
    const { obs, tgt } = P.pick(hot);
    const lovers = lineage.secretsOf(tgt.id).filter((x) => x.gender !== tgt.gender);
    const lover = lovers.length ? P.pick(lovers) : null;
    relations.setSuspicion(obs.id, tgt.id, 0);   // ถามออกไปแล้ว ไม่ว่าจบยังไงก็เริ่มนับใหม่

    ask({
      kind: 'confront',
      title: DT.confront.title,
      subject: `${nm(obs)} ถาม ${nm(tgt)}`,
      subjectId: 'confront:' + tgt.id,
      person: tgt,
      autoValue: 'deny',
      text: dramaText(DT.confront.text, tgt, obs),
      options: [
        { label: 'สารภาพแล้วแตกหัก', value: 'break',
          note: 'เลิกเป็นคู่ครองกัน · ชื่อเสียง -6 · ทั้งคู่ใจสลาย', tone: 'decline' },
        { label: 'สารภาพแล้วขอให้ยอมรับ', value: 'accept',
          note: 'ยังอยู่ด้วยกัน · อีกฝ่ายอาจกลายเป็นผู้เปิดใจ หรือเก็บแค้นไว้' },
        { label: 'ปฏิเสธทุกข้อกล่าวหา', value: 'deny',
          note: 'รอดได้ถ้าโชคดี · ถ้าไม่รอดความไว้ใจพังถาวร', tone: 'accept' },
      ],
    }, (v) => resolveConfront(v, obs, tgt, lover));
  }

  function resolveConfront(v, obs, tgt, lover) {
    const month = game.state.month;
    if (v === 'break') {
      lineage.divorce(tgt, obs);
      game.addReputation(-6);
      structureDirty = true;
      ui.logEvent(dramaText(DT.confront.breakUp, tgt, obs), 'secret');
      [obs, tgt].forEach((x) => rollTrait(x, 'heartbroken', 0.7, 'สูญเสียคู่ครองไปกับความจริงคืนนั้น'));
      rollTrait(obs, 'vengeful', 0.45, 'ไม่มีวันให้อภัยสิ่งที่เกิดขึ้นคืนนั้น');
      relations.shift(obs.id, tgt.id, 'grudge', 70);
      relations.shift(obs.id, tgt.id, 'trust', -100);
      P.remember(obs, { kind: 'betrayed', month, aboutId: tgt.id, weight: 3,
        text: `${tgt.name}ทรยศแล้วทั้งคู่ก็แยกจากกัน` });
      P.remember(tgt, { kind: 'lostSpouse', month, aboutId: obs.id, weight: 3,
        text: `สารภาพความจริงกับ${obs.name}แล้วเสียเขาไปตลอดกาล` });
    } else if (v === 'accept') {
      ui.logEvent(dramaText(DT.confront.accept, tgt, obs), 'secret');
      relations.shift(obs.id, tgt.id, 'trust', -25);
      if (gainTrait(obs, 'openHeart', 'เลือกที่จะยอมรับแทนการแตกหัก')) {
        relations.shift(obs.id, tgt.id, 'closeness', 10);
      } else {
        rollTrait(obs, 'jealous', 0.6, 'ยอมรับไว้ปากเดียว แต่ในใจไม่เคยวางลง');
        relations.shift(obs.id, tgt.id, 'grudge', 35);
      }
      P.remember(obs, { kind: 'forgave', month, aboutId: tgt.id, weight: 2,
        text: `รู้ความจริงเรื่อง${tgt.name}แล้วเลือกที่จะอยู่ต่อ` });
      P.remember(tgt, { kind: 'confessed', month, aboutId: obs.id, weight: 2,
        text: `สารภาพกับ${obs.name}แล้วได้รับการยอมรับ` });
    } else {
      const believed = Math.random() < (0.55 + relations.value(obs.id, tgt.id, 'trust') / 250);
      if (believed) {
        ui.logEvent(dramaText(DT.confront.denyOk, tgt, obs), 'secret');
        relations.shift(obs.id, tgt.id, 'trust', 8);
      } else {
        ui.logEvent(dramaText(DT.confront.denyFail, tgt, obs), 'secret');
        relations.shift(obs.id, tgt.id, 'trust', -60);
        relations.shift(obs.id, tgt.id, 'grudge', 45);
        relations.addSuspicion(obs.id, tgt.id, 60);
        rollTrait(obs, 'jealous', 0.7, 'จับโกหกได้แล้วไม่เชื่อคำใดอีกเลย');
        P.remember(obs, { kind: 'liedTo', month, aboutId: tgt.id, weight: 3,
          text: `จับได้ว่า${tgt.name}โกหกซึ่งหน้า` });
      }
    }
    if (lover) relations.shift(obs.id, lover.id, 'grudge', 40);
  }

  /** แบล็กเมล์ — คนที่ถือความลับไว้มาทวงค่าปิดปาก */
  function rollBlackmail() {
    /* หาเป้าก่อนแล้วค่อยสุ่ม — ถ้าสุ่มทิ้งก่อนโดยยังไม่มีใครถือความลับ
       โอกาสจะถูกเผาไปเปล่าๆ จนเรื่องนี้แทบไม่เคยเกิดเลย */
    const options = [];
    adults().forEach((c) => {
      relations.secretsKnownBy(c.id).forEach((s) => {
        const a = lineage.get(s.aId), b = lineage.get(s.bId);
        [a, b].forEach((victim) => {
          const other = victim === a ? b : a;
          if (!victim || !other || !victim.alive || !c.alive) return;
          if (victim.gender === c.gender) return;             // ผู้ข่มขู่ต้องต่างเพศกับเหยื่อ
          if (lineage.isDirectLine(victim, c)) return;        // ไม่ใช่ญาติสายตรง
          if (victim.spouseId === c.id) return;
          if (P.hasMemory(victim, 'blackmailed', c.id)) return; // คนเดิมทวงซ้ำไม่ได้
          options.push({ victim, other, c });
        });
      });
    });
    if (!options.length) return;
    // ยิ่งมีความลับอยู่ในมือคนหลายคน ยิ่งมีโอกาสที่ใครสักคนจะทวงค่าปิดปาก
    if (Math.random() >= Math.min(0.5, CONFIG.blackmailChance * options.length)) return;
    const { victim, other, c } = P.pick(options);

    ask({
      kind: 'blackmail',
      title: DT.blackmail.title,
      subject: `${nm(c)} ข่มขู่ ${nm(victim)}`,
      subjectId: 'blackmail:' + victim.id,
      person: victim,
      autoValue: 'pay',
      text: dramaText(DT.blackmail.text, victim, other, c),
      options: [
        { label: 'จ่ายค่าปิดปาก 400 เครดิต', value: 'pay', note: 'จบเรื่องด้วยเงิน', tone: 'accept' },
        { label: 'ยอมตามที่เขาเรียกร้อง', value: 'yield',
          note: 'ความลับถูกเก็บไว้ · แต่ฝังความแค้นไว้ในใจตลอดไป' },
        { label: 'ไม่ยอมแม้แต่น้อย', value: 'refuse',
          note: 'ความลับถูกแฉ · ชื่อเสียง -8 แต่ไม่ต้องก้มหัวให้ใคร', tone: 'decline' },
      ],
    }, (v) => resolveBlackmail(v, victim, other, c));
  }

  function resolveBlackmail(v, victim, other, c) {
    const month = game.state.month;
    if (v === 'pay') {
      game.addGold(-400);
      ui.logEvent(dramaText(DT.blackmail.pay, victim, other, c) + ' (เครดิต -400)', 'secret');
      relations.shift(victim.id, c.id, 'grudge', 30);
      P.remember(victim, { kind: 'blackmailed', month, aboutId: c.id, weight: 2,
        text: `จ่ายค่าปิดปากให้${c.name}` });
    } else if (v === 'yield') {
      // ยอมเพราะถูกบีบ ไม่ใช่เพราะเต็มใจ — ฝังเป็นบาดแผลและเชื้อแค้น
      ui.logEvent(dramaText(DT.blackmail.yield, victim, other, c), 'secret');
      lineage.addSecret(victim.id, c.id, month);
      structureDirty = true;
      relations.shift(victim.id, c.id, 'grudge', 85);
      relations.shift(victim.id, c.id, 'trust', -100);
      P.remember(victim, { kind: 'blackmailed', month, aboutId: c.id, weight: 3,
        text: `ถูก${c.name}บีบให้ยอมแลกกับการปิดปาก` });
      rollTrait(victim, 'vengeful', 0.6, 'จำวันที่ถูกบีบให้ยอมไว้ไม่มีวันลืม');
      rollTrait(victim, 'takenHeart', 0.4, 'ไม่เหมือนเดิมอีกเลยนับจากคืนนั้น');
    } else {
      game.addReputation(-8);
      ui.logEvent(dramaText(DT.blackmail.refuse, victim, other, c) + ' (ชื่อเสียง -8)', 'secret');
      adults().forEach((x) => relations.learn(x.id, victim.id, other.id, month));
      const sp = victim.spouseId ? lineage.get(victim.spouseId) : null;
      if (sp) relations.addSuspicion(sp.id, victim.id, 70);
      rollTrait(victim, 'shameless', 0.6, 'เลือกเสียชื่อดีกว่าก้มหัวให้ผู้ข่มขู่');
      P.remember(victim, { kind: 'defied', month, aboutId: c.id, weight: 3,
        text: `ไม่ยอมก้มหัวให้${c.name}แม้ต้องเสียชื่อเสียง` });
    }
  }

  /** รักสามเส้า — สองคนปองคนเดียวกันจนต้องมีใครสักคนถอย */
  function rollTriangle() {
    const hot = relations.pairsAbove('passion', CONFIG.triangleAt);
    const byTarget = new Map();
    hot.forEach((p) => {
      [[p.aId, p.bId], [p.bId, p.aId]].forEach(([center, other]) => {
        if (!byTarget.has(center)) byTarget.set(center, []);
        byTarget.get(center).push(other);
      });
    });
    const picks = [];
    byTarget.forEach((others, centerId) => {
      const a = lineage.get(centerId);
      if (!a || !a.alive || a.age < CONFIG.adultAge || inMask(a)) return;
      const list = others.map(lineage.get).filter((x) => x && x.alive && x.gender !== a.gender);
      if (list.length >= 2) picks.push({ a, b: list[0], c: list[1] });
    });
    if (!picks.length) return;
    if (Math.random() >= Math.min(0.4, CONFIG.triangleChance * picks.length)) return;
    const { a, b, c } = P.pick(picks);
    const place = P.pick(DRAMA_PLACES);

    ask({
      kind: 'triangle',
      title: DT.triangle.title,
      subject: `${nm(b)} และ ${nm(c)} ต่างปอง ${nm(a)}`,
      subjectId: 'triangle:' + a.id,
      person: a,
      autoValue: 'none',
      text: dramaText(DT.triangle.text, a, b, c, place),
      options: [
        { label: `เลือก${b.name}`, value: 'b', note: 'อีกฝ่ายเก็บความแค้นไว้', tone: 'accept' },
        { label: `เลือก${c.name}`, value: 'c', note: 'อีกฝ่ายเก็บความแค้นไว้', tone: 'accept' },
        { label: 'ไม่เลือกใครทั้งนั้น', value: 'none', note: 'ทั้งคู่ผิดหวัง', tone: 'decline' },
        { label: 'ไม่เลือก แต่ไม่ปล่อยใครไป', value: 'both',
          note: 'ได้ทั้งคู่ไว้ข้างกาย · อาจกลายเป็นผู้มีหัวใจหลายดวง' },
      ],
    }, (v) => resolveTriangle(v, a, b, c, place));
  }

  function resolveTriangle(v, a, b, c, place) {
    const month = game.state.month;
    const loserOf = { b: c, c: b };
    if (v === 'b' || v === 'c') {
      const win = v === 'b' ? b : c, lose = loserOf[v];
      ui.logEvent(dramaText(v === 'b' ? DT.triangle.pickB : DT.triangle.pickC, a, b, c, place), 'secret');
      if (!lineage.hasSecret(a.id, win.id) && !lineage.isDirectLine(a, win)) {
        lineage.addSecret(a.id, win.id, month);
        structureDirty = true;
      }
      relations.shift(a.id, win.id, 'closeness', 25);
      relations.shift(lose.id, a.id, 'grudge', 45);
      relations.shift(lose.id, win.id, 'grudge', 60);
      P.remember(lose, { kind: 'rejected', month, aboutId: a.id, weight: 2,
        text: `ถูก${a.name}เลือก${win.name}แทนตน` });
      rollTrait(lose, 'vengeful', 0.4, 'แพ้ให้คู่แข่งต่อหน้าคนที่ตนปอง');
    } else if (v === 'both') {
      ui.logEvent(dramaText(DT.triangle.keepBoth, a, b, c, place), 'secret');
      [b, c].forEach((x) => {
        if (!lineage.hasSecret(a.id, x.id) && !lineage.isDirectLine(a, x)) {
          lineage.addSecret(a.id, x.id, month);
        }
        relations.shift(x.id, a.id, 'passion', 20);
      });
      relations.shift(b.id, c.id, 'grudge', 55);
      structureDirty = true;
      gainTrait(a, 'freeHeart', 'ไม่ยอมปล่อยใครไปสักคน');
    } else {
      ui.logEvent(dramaText(DT.triangle.pickNone, a, b, c, place), 'secret');
      [b, c].forEach((x) => {
        relations.shift(x.id, a.id, 'grudge', 25);
        P.remember(x, { kind: 'rejected', month, aboutId: a.id, weight: 1,
          text: `ถูก${a.name}ปฏิเสธที่${place}` });
      });
      game.addReputation(2);
    }
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
      if (inMask(a) || inMask(b)) return;   // อยู่ในหอ เรื่องข้างนอกหยุดไว้ก่อน
      const father = a.gender === 'male' ? a : b;
      const mother = a.gender === 'female' ? a : b;
      if (father.gender === mother.gender) return;

      // ฉากลอบพบกัน — สีสันบรรยากาศ และเป็นพฤติกรรมสะสมที่ก่อ trait ได้
      const pairSecret = (T.mul(a, 'secret') + T.mul(b, 'secret')) / 2;
      if (Math.random() < CONFIG.secretMeetChance * pairSecret) {
        const meetPlace = Places.placeOf(a).name;
        const intimate = Math.random() < 0.5 ? intimateLine(a, b, meetPlace) : null;
        ui.logEvent(intimate ||
          P.pick(SECRET_MEET_TEXTS).split('{a}').join(nm(a)).split('{b}').join(nm(b)),
          'secret');
        // ลอบพบกันจนชิน — ฝ่ายที่ทำซ้ำๆ ค่อยๆ กลายเป็นคนหลายใจ
        [a, b].forEach((x) => tallyTrait(x, 'tryst', 'freeHeart', 4,
          'ลอบพบผู้อื่นจนความลับกลายเป็นเรื่องคุ้นเคย'));
        // ทุกครั้งที่พบกันย่อมทิ้งร่องรอย — คู่ครองเริ่มระแวง และอาจมีคนเห็น
        relations.shift(a.id, b.id, 'closeness', 4);
        relations.shift(a.id, b.id, 'passion', 8);
        feedSuspicion(a, b);
        feedSuspicion(b, a);
        rollWitness(a, b);
      }

      // ตั้งครรภ์บุตรลับ — ต้องมีฝ่ายสายเลือด (ลูกถึงมีที่ยืนในผัง) และแม่เจริญพันธุ์
      if ((father.isBlood || mother.isBlood) &&
          !mother.pregnancy &&
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
      partner.strangerFather = true;
      if (tokens && Number(tokens['{count}']) > 1) {
        // เจอกันเป็นกลุ่ม — แม้แต่มารดาเองก็ไม่รู้ว่าผู้ใดเป็นบิดา
        partner.name = 'ผู้หนึ่งใน ' + tokens['{strangers}'];
        partner.origin = null;
      } else if (tokens && tokens['{stranger}']) {
        partner.name = tokens['{stranger}'];
      }
    } else {
      const lovers = lineage.secretsOf(p.id).filter((x) => x.gender !== p.gender);
      partner = lovers.length ? P.pick(lovers) : makeSecretFor(p);
    }
    if (!partner) return null;
    const father = p.gender === 'male' ? p : partner;
    const mother = p.gender === 'female' ? p : partner;
    if (father.gender !== 'male' || mother.gender !== 'female') return null;
    // เคารพกติกาการมีบุตรปกติ — แม่ต้องอยู่ในวัยเจริญพันธุ์ (เพดานบุตรเช็คใน birth)
    if (mother.pregnancy) return null;
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
      if (p.age < CONFIG.adultAge || inMask(p)) return;
      // หลอดความต้องการของ "คนคนนั้นเอง" และบุคลิกของที่ที่เขาอยู่ เป็นตัวเร่งโอกาส
      const heat = 1 + (DESIRE.eventBoostMax - 1) * Math.min(1, (p.desire || 0) / DESIRE.peakAt);
      const spot = Places.placeOf(p);
      const chance = CONFIG.appearanceEventChance * heat * spot.heat
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
        // เรื่องต้องเกิดในที่ที่เขาอยู่จริง — ถ้าเทมเพลตไม่ระบุที่ก็เกิดที่ไหนก็ได้
        if (evt.places && !evt.places.some((tag) => {
          const pl = Places.forTag(tag);
          return !pl || pl.id === spot.id;
        })) return;
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
    const spot = Places.placeOf(p);
    const fitting = (evt.places || []).filter((tag) => {
      const pl = Places.forTag(tag);
      return !pl || pl.id === spot.id;
    });
    const place = P.pick(fitting.length ? fitting : (evt.places || [spot.name]));
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
    rollPlaceEffects();
    rollPregnancies();
    rollMarriages();
    rollBirths();
    rollDeaths();
    rollDesire();
    rollMaskChain();
    rollSecrets();
    rollSecretLife();
    relations.decay();      // ความระแวงจางลงถ้าไม่มีหลักฐานใหม่
    rollConfrontation();
    rollBlackmail();
    rollTriangle();
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
    cityMap.refresh();
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
  /* หน้าโปรไฟล์เต็มจอ — เปิดจากปุ่มในแผ่นข้อมูล ดูทั้งชีวิตของคนคนนั้นได้ */
  const profile = window.ProfileUI.create({
    lineage, relations,
    fmtMonth: (m) => {
      const y = data.CONFIG.startYear + Math.floor(m / 12);
      return `พ.ศ. ${y}`;
    },
  });

  /* แผนที่นคร — ดูว่าใครอยู่ที่ไหนและย้ายคนไปเองได้ */
  const cityMap = window.MapUI.create({
    lineage,
    onOpenPerson: (id) => { cityMap.hide(); openDetail(id); },
  });

  function openDetail(id) {
    const p = lineage.get(id);
    if (!p) return;
    tree.highlight(id);
    ui.showPersonDetail(p, openDetail, () => {   // ปุ่ม "ดูโปรไฟล์เต็มจอ"
      ui.hidePersonDetail();
      profile.show(p);
    });
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
    cancelGrace();   // ผู้เล่นสั่งเอง ให้ชนะช่วงพักหลังตอบสถานการณ์เสมอ
    clock.toggle();
    ui.renderClockControls();
  });

  document.getElementById('speedBtn').addEventListener('click', () => {
    clock.cycleSpeed();
    ui.renderClockControls();
  });

  document.getElementById('mapBtn').addEventListener('click', () => {
    if (cityMap.isOpen()) cityMap.hide(); else cityMap.show();
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
    cancelGrace();
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
