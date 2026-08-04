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
 * "หัวหน้าตระกูล" (head) คือตัวละครที่ผู้เล่นควบคุม เหตุการณ์สำคัญของคนนี้
 * จะหยุดเวลาแล้วถามผู้เล่นก่อนเสมอ ส่วนสมาชิกคนอื่นดำเนินชีวิตไปเอง
 * เมื่อหัวหน้าตระกูลถึงแก่กรรม ตำแหน่งจะตกทอดสู่ทายาทที่อาวุโสที่สุด
 * =============================================================================
 */
(function () {
  'use strict';

  const data = window.GameData;
  const { CONFIG, CHOICE_EVENTS, ENGINE_CONTENT } = data;
  const P = window.Person;

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
  const tree = window.TreeUI.create(lineage);

  let head = null;                 // หัวหน้าตระกูลคนปัจจุบัน (ตัวที่ผู้เล่นคุม)
  let structureDirty = false;      // ผังต้องวาดใหม่ไหม
  let decisionPending = false;     // มีกล่องตัดสินใจค้างอยู่ไหม
  let resumeAfterDecision = false;
  let gameOver = false;

  /* ---------------------------------------------------------------------
   * ตัวช่วย
   * ------------------------------------------------------------------- */

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
  const bodyWord = (p) =>
    `สูง ${p.body.height} ซม. หนัก ${p.body.weight} กก. หุ่น${P.buildLabel(p.body)} พลังยุทธ์ ${p.power}`;

  /* ---------------------------------------------------------------------
   * กล่องตัดสินใจ — หยุดเวลาไว้ก่อน แล้วเดินต่อเมื่อผู้เล่นเลือกเสร็จ
   * ------------------------------------------------------------------- */
  function ask(cfg, onChoose) {
    if (decisionPending || gameOver) return false;
    decisionPending = true;
    resumeAfterDecision = clock.isRunning();
    clock.pause();
    ui.renderClockControls();

    ui.askDecision(cfg, (value) => {
      decisionPending = false;
      onChoose(value);
      tree.render();
      structureDirty = false;
      ui.renderHUD();
      if (resumeAfterDecision && !gameOver) clock.start();
      ui.renderClockControls();
    });
    return true;
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
      p.power = P.powerFor(p);   // พลังยุทธ์ขึ้นลงตามวัย
      if (p.age === CONFIG.adultAge) {
        structureDirty = true;
        ui.logEvent(`${p.name}เติบโตเป็นผู้ใหญ่เต็มตัว — ${bodyWord(p)}`, 'milestone');
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
      `${p.name}ครองคู่กับ${partner.name} ${partner.origin} — ` +
      `${genderWord(partner.gender)}วัย ${partner.age} ปี ${bodyWord(partner)}`,
      'marriage'
    );
  }

  function rollMarriages() {
    lineage.living().forEach((p) => {
      if (!p.isBlood || p.spouseId || !p.willMarry) return;
      if (p.age < CONFIG.adultAge || p.age > CONFIG.marriageMaxAge) return;
      if (Math.random() >= CONFIG.marriageChancePerMonth) return;

      const partnerGender = p.gender === 'male' ? 'female' : 'male';
      const partner = P.createOutsider(partnerGender, p.age);

      // เรื่องของหัวหน้าตระกูล ผู้เล่นเป็นคนตัดสินใจเอง
      if (p === head) {
        ask({
          kind: 'marriage',
          title: 'มีผู้มาทาบทาม',
          person: partner,
          text: `${partner.name} ${partner.origin} มาทาบทามขอครองคู่กับท่าน จะรับไว้หรือรอผู้อื่นในภายหน้า`,
          options: [
            { label: 'รับไว้เป็นคู่ครอง', value: 'yes', note: 'ชื่อเสียง +3 และเริ่มมีทายาทได้', tone: 'accept' },
            { label: 'ปฏิเสธไปก่อน', value: 'no', note: 'รอผู้ที่เหมาะสมกว่านี้', tone: 'decline' },
          ],
        }, (v) => {
          if (v === 'yes') completeMarriage(p, partner);
          else ui.logEvent(`${p.name}ปฏิเสธการทาบทามของ${partner.name}อย่างสุภาพ`, 'event');
        });
        return;
      }

      completeMarriage(p, partner);
    });
  }

  /** ให้กำเนิดบุตรและบันทึกจดหมายเหตุ */
  function completeBirth(father, mother) {
    const baby = lineage.birth(father, mother);
    if (!baby) return null;
    register(baby);
    baby.bornMonth = game.state.month;
    baby.age = 0;
    linkBlood(baby);
    game.addReputation(2);
    structureDirty = true;
    ui.logEvent(
      `${mother.name}ให้กำเนิด${genderWord(baby.gender)} ได้ชื่อว่า${baby.name} ` +
      `บุตรของ${father.name}และ${mother.name}`,
      'birth'
    );
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
      if (Math.random() >= CONFIG.birthChancePerMonth) return;

      // ครอบครัวของหัวหน้าตระกูล ผู้เล่นเลือกเองว่าจะมีบุตรตอนนี้หรือยัง
      if (p === head || spouse === head) {
        const count = mother.childIds.length;
        ask({
          kind: 'birth',
          title: 'ปรึกษาเรื่องทายาท',
          text: `${father.name}และ${mother.name}ปรึกษากันเรื่องการมีบุตร ` +
                (count ? `ขณะนี้มีบุตรแล้ว ${count} คน ` : 'ยังไม่มีบุตรด้วยกัน ') +
                'จะตกลงมีทายาทในช่วงนี้หรือไม่',
          options: [
            { label: 'ตกลงมีทายาท', value: 'yes', note: 'ชื่อเสียง +2 แต่เด็กเล็กเป็นภาระค่าใช้จ่าย', tone: 'accept' },
            { label: 'ยังไม่ใช่เวลานี้', value: 'no', note: 'เก็บกำลังทรัพย์ไว้ก่อน', tone: 'decline' },
          ],
        }, (v) => {
          if (v === 'yes') completeBirth(father, mother);
          else ui.logEvent(`${father.name}และ${mother.name}ตกลงกันว่ายังไม่ใช่เวลาที่เหมาะ`, 'event');
        });
        return;
      }

      completeBirth(father, mother);
    });
  }

  /** ยกทายาทที่อาวุโสที่สุดขึ้นเป็นหัวหน้าตระกูลคนใหม่ */
  function promoteHeir(previous) {
    const adults = lineage.living().filter((p) => p.isBlood && p.age >= CONFIG.adultAge);
    if (!adults.length) { head = null; return; }

    const ownChildren = previous
      ? previous.childIds.map(lineage.get).filter((c) => c && c.alive && c.age >= CONFIG.adultAge)
      : [];
    const pool = ownChildren.length ? ownChildren : adults;
    const heir = pool.sort((a, b) => b.age - a.age)[0];

    if (previous) previous.isPlayer = false;
    heir.isPlayer = true;
    head = heir;
    structureDirty = true;
    ui.logEvent(`${heir.name}ขึ้นเป็นหัวหน้าตระกูลคนใหม่สืบต่อจาก${previous ? previous.name : 'รุ่นก่อน'}`, 'milestone');
  }

  function rollDeaths() {
    lineage.living().forEach((p) => {
      const isElder = p.age >= CONFIG.elderAge;
      const chance = isElder
        ? CONFIG.deathChanceBase * (1 + (p.age - CONFIG.elderAge) / 8)
        : (p.age >= CONFIG.adultAge ? CONFIG.illnessChancePerMonth : 0);
      if (Math.random() >= chance) return;

      lineage.die(p);
      structureDirty = true;
      ui.logEvent(
        isElder
          ? `${p.name}ถึงแก่กรรมด้วยวัย ${p.deathAge} ปี ลูกหลานร่วมไว้อาลัย`
          : `${p.name}ล้มป่วยกะทันหันและจากไปด้วยวัยเพียง ${p.deathAge} ปี`,
        'death'
      );
      if (p === head) promoteHeir(p);
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
        // ผลแพ้ชนะขึ้นกับพลังยุทธ์ของหัวหน้าตระกูลเทียบกับคู่แข่งที่สุ่มขึ้นมา
        const rival = Math.round(P.randNormal(100, 30, 40, 200));
        const mine = head ? head.power : 0;
        const win = mine >= rival;
        gold = win ? 600 : -200;
        rep = win ? 12 : -6;
        text = win
          ? `${head.name}ขึ้นประลองและเอาชนะคู่แข่งได้ (พลังยุทธ์ ${mine} ต่อ ${rival}) ชื่อเสียงตระกูลขจรไปทั่วนคร`
          : `${head.name}ขึ้นประลองแต่พ่ายแพ้ไป (พลังยุทธ์ ${mine} ต่อ ${rival}) ตระกูลเสียหน้าไม่น้อย`;
      } else { rep = -2; text = 'ตระกูลเลี่ยงการปะทะ คู่แข่งเยาะเย้ยอยู่พักหนึ่ง'; }
    }

    game.addGold(gold);
    game.addReputation(rep);
    const suffix = [];
    if (gold) suffix.push(`ทอง ${gold > 0 ? '+' : ''}${gold}`);
    if (rep) suffix.push(`ชื่อเสียง ${rep > 0 ? '+' : ''}${rep}`);
    ui.logEvent(text + (suffix.length ? ` (${suffix.join(' · ')})` : ''), 'event');
  }

  function rollChoiceEvent() {
    if (decisionPending || !head) return;
    if (Math.random() >= CONFIG.choiceEventChance) return;

    const evt = P.pick(CHOICE_EVENTS);
    ask({
      kind: 'choice',
      title: evt.title,
      text: evt.text,
      options: evt.options,
    }, (v) => resolveChoice(evt, v));
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
    rollAmbient();
    rollChoiceEvent();

    // หัวหน้าตระกูลว่างลงเพราะทายาทเพิ่งโตพอ
    if (!head || !head.alive) promoteHeir(head);

    if (game.checkWin(lineage.maxGeneration())) {
      ui.showWin();
      ui.logEvent('ตระกูลรุ่งเรืองเป็นที่เลื่องลือทั่วแผ่นดิน — บรรลุเป้าหมายแล้ว', 'milestone');
    }

    if (structureDirty) {
      tree.render();
      structureDirty = false;
    } else {
      tree.refreshFigures();
    }
    ui.renderHUD();
    checkExtinction();
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
      isPlayer: true,
      fatherId: father.id,
      motherId: mother.id,
      body: playerBody,
      powerBase: P.inheritPowerBase(father, mother, playerBody.buildId),
    }));
    father.childIds.push(player.id);
    mother.childIds.push(player.id);
    linkBlood(player);
    head = player;

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
    ui.renderHUD();
    ui.logEvent(
      `พงศาวดารเริ่มต้นขึ้น ท่านคือ${player.name} ${genderWord(player.gender)}วัย ${player.age} ปี ` +
      `${bodyWord(player)} บุตรของ${father.name}และ${mother.name}`,
      'milestone'
    );

    clock.start();
    ui.renderClockControls();
  }

  /* ---------------------------------------------------------------------
   * ปุ่มควบคุมเวลา
   * ------------------------------------------------------------------- */
  document.getElementById('playBtn').addEventListener('click', () => {
    if (gameOver || decisionPending) return;
    clock.toggle();
    ui.renderClockControls();
  });

  document.getElementById('speedBtn').addEventListener('click', () => {
    clock.cycleSpeed();
    ui.renderClockControls();
  });

  // เว้นวรรค = เล่น/หยุด เพื่อกดหยุดดูผังได้เร็วๆ
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || gameOver || decisionPending) return;
    if (e.target.closest('button')) return;
    e.preventDefault();
    clock.toggle();
    ui.renderClockControls();
  });

  ui.showStartScreen(startGame);
})();
