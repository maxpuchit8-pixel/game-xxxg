/**
 * =============================================================================
 * main.js — ตัวประสาน (entry point)
 * =============================================================================
 * ประกอบทุกโมดูลเข้าด้วยกันแล้วผูกปุ่มกับวงจรเกม:
 *   ScenarioEngine (เอนจินสุ่มเหตุการณ์)
 *     + GameData  (เนื้อหา/ค่าปรับสมดุล)
 *     + GameState (กฎกติกา ตัวเลข)
 *     + GameUI    (การวาดหน้าจอ)
 *
 * วงจรหนึ่งวัน: syncLocations -> generateEvent xN -> applyEvent -> วาดผล
 * =============================================================================
 */
(function () {
  'use strict';

  const data = window.GameData;
  const engine = new window.ScenarioEngine();
  data.BLOOD.forEach(([a, b]) => engine.setBloodRelation(a, b));

  const game = window.GameState.create(engine, data);
  const ui = window.GameUI.create(engine, data, game);
  const { CONFIG, CHARACTERS } = data;

  /** สุ่มจำนวนเหตุการณ์ต่อวันตามช่วงใน CONFIG */
  function eventsPerDay() {
    const span = CONFIG.eventsPerDayMax - CONFIG.eventsPerDayMin + 1;
    return CONFIG.eventsPerDayMin + Math.floor(Math.random() * span);
  }

  /** สร้างเหตุการณ์ชุดหนึ่งลงกลุ่มวัน แล้วปิดวัน (ตรวจสมรส + เดินวัน + วาดผล) */
  function runEvents(group, events) {
    events.filter(Boolean).forEach((ev) => {
      game.applyEvent(ev);
      ui.renderEvent(group, ev);
    });
    game.tryMarriages().forEach(({ a, b }) => {
      ui.markMarried(a.id);
      ui.markMarried(b.id);
      ui.renderEvent(group, {
        tone: 'positive',
        text: `งานมงคลสมรสระหว่าง${a.name}กับ${b.name}ถูกจัดขึ้นอย่างสมเกียรติ ` +
              `ตระกูลศรีวัฒนาออกทอง ${ui.thaiNum(CONFIG.marriageCost)} ตำลึงจัดงาน ` +
              `แขกเหรื่อชื่นชมกันทั่วเมือง (ชื่อเสียง +${CONFIG.marriageReputation})`,
      }, true);
    });
    game.state.day += 1;
    ui.renderStats();
    ui.renderRelationships();
  }

  /* ---------------- ปุ่มหลัก: ผ่านวัน ---------------- */
  document.getElementById('nextDay').addEventListener('click', () => {
    ui.syncLocations();
    const group = ui.newDayGroup();
    const events = [];
    for (let i = 0, n = eventsPerDay(); i < n; i++) {
      events.push(engine.generateEvent(CHARACTERS));
    }
    runEvents(group, events);
  });

  /* ---------------- จัดงานเทศกาล ---------------- */
  document.getElementById('festivalBtn').addEventListener('click', () => {
    if (game.state.gold < CONFIG.festivalCost) return;
    game.state.gold -= CONFIG.festivalCost;
    ui.setAllLocations('festival');
    const group = ui.newDayGroup(' · งานเทศกาลของตระกูล');
    ui.renderEvent(group, {
      tone: 'positive',
      text: `ตระกูลศรีวัฒนาออกทอง ${ui.thaiNum(CONFIG.festivalCost)} ตำลึงจัดงานเทศกาล ` +
            'เชิญทุกผู้คนมาร่วมสนุกกันทั้งเมือง',
    }, true);
    runEvents(group, [
      engine.generateEvent(CHARACTERS, { forceTag: 'romance', mode: 'duo' }),
      engine.generateEvent(CHARACTERS),
    ]);
  });

  /* ---------------- พิธีบูชาบรรพบุรุษ (ไม่เดินวัน) ---------------- */
  document.getElementById('prayBtn').addEventListener('click', () => {
    if (game.state.gold < CONFIG.prayCost) return;
    game.state.gold -= CONFIG.prayCost;
    game.state.reputation += CONFIG.prayReputation;
    const group = ui.newDayGroup(' · พิธีบูชาบรรพบุรุษ');
    ui.renderEvent(group, {
      tone: 'positive',
      text: 'ทั้งตระกูลพร้อมใจกันประกอบพิธีบูชาบรรพบุรุษ ณ ศาลประจำตระกูล ' +
            `ควันธูปลอยอ้อยอิ่ง ชื่อเสียงของตระกูลเพิ่มพูน (+${CONFIG.prayReputation})`,
    }, true);
    ui.renderStats();
  });

  /* ---------------- เริ่มเกม ---------------- */
  ui.renderRoster();
  ui.syncLocations();
  ui.renderStats();
})();
