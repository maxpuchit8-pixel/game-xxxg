/**
 * =============================================================================
 * ui.js — แถบสถานะด้านบน จดหมายเหตุ และหน้าจอเลือกเพศตอนเริ่มเกม
 * =============================================================================
 * รับผิดชอบทุกอย่างที่ไม่ใช่ผังตระกูล (ผังอยู่ใน tree-ui.js):
 *   - HUD: วันเวลา คลังทอง รายได้ต่อเดือน ชื่อเสียง จำนวนสมาชิก รุ่น
 *   - ปุ่มเล่น/หยุด และปุ่มเร่งความเร็ว
 *   - จดหมายเหตุ: บันทึกเหตุการณ์ที่เกิดขึ้นตามเวลา
 *   - หน้าจอเริ่มเกมให้เลือกว่าจะเล่นเป็นชายหรือหญิง
 *
 * ไม่มี game logic — อ่านสถานะมาวาดอย่างเดียว
 * =============================================================================
 */
(function (root) {
  'use strict';

  const P = root.Person;
  const { CONFIG } = root.GameData;

  function createUI(game, lineage, clock) {
    const els = {
      date: document.getElementById('dateLabel'),
      gold: document.getElementById('goldLabel'),
      income: document.getElementById('incomeLabel'),
      rep: document.getElementById('repLabel'),
      members: document.getElementById('membersLabel'),
      gens: document.getElementById('gensLabel'),
      power: document.getElementById('powerLabel'),
      playBtn: document.getElementById('playBtn'),
      speedBtn: document.getElementById('speedBtn'),
      log: document.getElementById('log'),
      winBanner: document.getElementById('winBanner'),
      startScreen: document.getElementById('startScreen'),
    };

    const MAX_LOG = 120;

    /* ------------------- HUD ------------------- */

    function renderHUD() {
      const s = game.state;
      const st = lineage.stats();
      els.date.textContent = game.dateLabel();
      els.gold.textContent = Math.round(s.gold).toLocaleString('th-TH');
      const inc = Math.round(st.income * 10) / 10;
      els.income.textContent = (inc >= 0 ? '+' : '') + inc.toFixed(1);
      els.income.className = 'income ' + (inc >= 0 ? 'pos' : 'neg');
      els.rep.textContent = s.reputation;
      els.members.textContent = st.living;
      els.gens.textContent = st.generations;
      if (els.power) els.power.textContent = st.power.toLocaleString('th-TH');
    }

    function renderClockControls() {
      els.playBtn.textContent = clock.isRunning() ? '❚❚' : '▶';
      els.playBtn.setAttribute('aria-label', clock.isRunning() ? 'หยุดเวลา' : 'เดินเวลา');
      els.speedBtn.textContent = '×' + clock.speed();
    }

    /* ------------------- จดหมายเหตุ ------------------- */

    /**
     * บันทึกหนึ่งบรรทัด
     * kind: 'birth' | 'marriage' | 'death' | 'event' | 'milestone'
     */
    function logEvent(text, kind) {
      const empty = els.log.querySelector('.empty-note');
      if (empty) empty.remove();

      const row = document.createElement('div');
      row.className = 'entry fresh ' + (kind || 'event');
      row.innerHTML =
        `<span class="entry-date">${game.dateLabel()}</span>` +
        `<span class="entry-text">${text}</span>`;
      els.log.prepend(row);

      while (els.log.children.length > MAX_LOG) {
        els.log.removeChild(els.log.lastChild);
      }
    }

    function showWin() {
      els.winBanner.classList.add('show');
    }

    /* ------------------- แผ่นข้อมูลตัวละคร ------------------- */

    /** แถวข้อมูลหนึ่งบรรทัด */
    function row(label, value) {
      return `<div class="detail-row"><span>${label}</span><b>${value}</b></div>`;
    }

    /** ชื่อพร้อมจุดสีบอกเพศ ใช้ในรายการเครือญาติ */
    function nameChip(p) {
      if (!p) return '<span class="kin-none">—</span>';
      return `<button class="kin" data-goto="${p.id}">` +
        `<i class="kin-dot ${p.gender}"></i>${p.name}` +
        `<span class="kin-age">${p.alive ? p.age + ' ปี' : 'ล่วงลับ'}</span></button>`;
    }

    /**
     * เปิดแผ่นข้อมูลของตัวละคร
     * onGoto(id) ถูกเรียกเมื่อผู้เล่นกดชื่อญาติ เพื่อสลับไปดูคนนั้นแทน
     */
    function showPersonDetail(p, onGoto) {
      const host = document.getElementById('detail');
      const father = p.fatherId ? lineage.get(p.fatherId) : null;
      const mother = p.motherId ? lineage.get(p.motherId) : null;
      const spouse = p.spouseId ? lineage.get(p.spouseId) : null;
      const kids = p.childIds.map(lineage.get).filter(Boolean);
      const secrets = lineage.secretsOf(p.id);
      const adult = p.age >= CONFIG.adultAge;

      const bodyBlock = adult
        ? row('ส่วนสูง', p.body.height + ' ซม.') +
          row('น้ำหนัก', p.body.weight + ' กก.') +
          row('ประเภทหุ่น', P.buildLabel(p.body)) +
          row('ดัชนีมวลกาย', p.body.bmi) +
          (P.measureLabel(p)
            ? row('สัดส่วน อก-เอว-สะโพก', P.measureLabel(p) + ' ซม.') +
              (p.gender === 'female' ? row('คัพหน้าอก', P.cupLetter(p.body.measure)) : '')
            : '')
        : `<p class="detail-note">ค่าร่างกายจะเปิดเผยเมื่ออายุครบ ${CONFIG.adultAge} ปี</p>`;

      const charmBlock = adult
        ? row('คะแนนเสน่ห์', `${p.charm} / 100`) +
          row('ระดับ', `<span class="charm-tier">${P.charmTier(p.charm, p.gender)}</span>`) +
          row('ทุนเดิมติดตัว', p.charmBase) +
          row('ผลจากสัดส่วน', (P.shapeAdjust(p.gender, p.body) >= 0 ? '+' : '') + P.shapeAdjust(p.gender, p.body))
        : '';

      host.innerHTML = `
        <div class="detail-panel ${p.gender}" role="dialog" aria-modal="true" aria-label="ข้อมูล${p.name}">
          <button class="detail-close" aria-label="ปิด">✕</button>

          <div class="detail-head">
            <div class="detail-portrait ${p.gender}">${P.avatarSVG(p)}</div>
            <div class="detail-id">
              <div class="detail-name">${p.name}</div>
              <div class="detail-tags">
                <span class="chip ${p.gender}">${p.gender === 'male' ? 'บุรุษ' : 'สตรี'}</span>
                <span class="chip">${p.alive ? 'อายุ ' + p.age + ' ปี' : 'ถึงแก่กรรม อายุ ' + p.deathAge}</span>
                <span class="chip">${p.isBlood ? 'สายเลือดตระกูล' : 'แต่งเข้าตระกูล'}</span>
                ${p.isFounder ? '<span class="chip founder">ผู้เริ่มต้น</span>' : ''}
              </div>
              ${p.origin ? `<div class="detail-origin">${p.origin}</div>` : ''}
            </div>
          </div>

          <div class="detail-grid">
            <section>
              <h4>พลังยุทธ์</h4>
              ${row('พลังปัจจุบัน', p.alive ? p.power : '—')}
              ${row('ศักยภาพติดตัว', p.powerBase)}
              ${row('รายได้', (p.income >= 0 ? '+' : '') + (Math.round(p.income * 10) / 10) + ' เครดิต/เดือน')}
            </section>
            <section>
              <h4>ร่างกาย</h4>
              ${bodyBlock}
            </section>
          </div>

          ${charmBlock ? `
          <section class="detail-charm">
            <h4>เสน่ห์</h4>
            ${charmBlock}
            <p class="detail-note">เสน่ห์สูงทำให้มีผู้มาทาบทามบ่อยขึ้น
              และดึงดูดคู่ครองที่พลังยุทธ์สูงกว่า หาเครดิตได้ดีกว่า และมีเสน่ห์มากกว่า</p>
          </section>` : ''}

          <section class="detail-kin">
            <h4>เครือญาติ</h4>
            ${row('บิดา', nameChip(father))}
            ${row('มารดา', nameChip(mother))}
            ${row('คู่ครอง', spouse ? nameChip(spouse) : (adult ? '<span class="kin-none">ยังไม่มีคู่</span>' : '<span class="kin-none">—</span>'))}
            <div class="detail-row kids"><span>บุตร (${kids.length})</span>
              <div class="kin-list">${kids.length ? kids.map(nameChip).join('') : '<span class="kin-none">ยังไม่มีบุตร</span>'}</div>
            </div>
          </section>

          ${secrets.length ? `
          <section class="detail-secret">
            <h4>ความสัมพันธ์ลับ</h4>
            <div class="kin-list">${secrets.map(nameChip).join('')}</div>
            <p class="detail-note">ผลต่อเกม — ยังคิดไม่ออก</p>
          </section>` : ''}
        </div>`;

      host.classList.add('show');
      host.querySelector('.detail-close').addEventListener('click', hidePersonDetail);
      host.querySelectorAll('.kin[data-goto]').forEach((btn) => {
        btn.addEventListener('click', () => onGoto(btn.dataset.goto));
      });
    }

    function hidePersonDetail() {
      const host = document.getElementById('detail');
      host.classList.remove('show');
      host.innerHTML = '';
    }

    /* ------------------- กล่องตัดสินใจ ------------------- */

    /**
     * แสดงกล่องให้ผู้เล่นเลือกว่าจะทำหรือไม่ทำ
     * cfg: { kind, title, text, person, options: [{ label, value, note, tone }] }
     * เรียก onChoose(value) เมื่อเลือกเสร็จ แล้วปิดกล่องเอง
     *
     * ปุ่มแรกจะได้โฟกัสทันที เพื่อให้กด Enter ตอบรับได้เลยโดยไม่ต้องใช้เมาส์
     */
    function askDecision(cfg, onChoose) {
      const host = document.getElementById('decision');
      const portrait = cfg.person ? P.avatarSVG(cfg.person) : '';
      const facts = cfg.person && cfg.person.age >= CONFIG.adultAge
        ? `<div class="decision-facts">
             <span>อายุ ${cfg.person.age} ปี</span>
             <span>${cfg.person.body.height} ซม.</span>
             <span>${cfg.person.body.weight} กก.</span>
             <span>${P.buildLabel(cfg.person.body)}</span>
             ${P.measureLabel(cfg.person) ? `<span>${P.measureLabel(cfg.person)}</span>` : ''}
           </div>`
        : '';

      const queueNote = cfg.queued
        ? `<span class="decision-queue">อีก ${cfg.queued} เรื่องรออยู่</span>` : '';

      host.innerHTML = `
        <div class="decision-panel ${cfg.kind || ''}" role="dialog" aria-modal="true" aria-label="${cfg.title}">
          ${queueNote}
          <h3 class="decision-title display">${cfg.title}</h3>
          ${cfg.subject ? `<div class="decision-subject">เรื่องของ ${cfg.subject}</div>` : ''}
          ${portrait ? `<div class="decision-portrait ${cfg.person.gender}">${portrait}</div>` : ''}
          ${cfg.person ? `<div class="decision-name">${cfg.person.name}</div>` : ''}
          ${facts}
          <p class="decision-text">${cfg.text}</p>
          <div class="decision-options">
            ${cfg.options.map((o, i) => `
              <button class="decision-btn ${o.tone || ''}" data-i="${i}">
                <span class="decision-label">${o.label}</span>
                ${o.note ? `<span class="decision-note">${o.note}</span>` : ''}
              </button>`).join('')}
          </div>
        </div>`;

      host.classList.add('show');
      const buttons = host.querySelectorAll('.decision-btn');
      buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
          host.classList.remove('show');
          host.innerHTML = '';
          onChoose(cfg.options[+btn.dataset.i].value);
        });
      });
      if (buttons[0]) buttons[0].focus();
    }

    /* ------------------- หน้าจอเริ่มเกม ------------------- */

    /** แสดงหน้าเลือกเพศ แล้วเรียก onChoose('male'|'female') เมื่อผู้เล่นตัดสินใจ */
    function showStartScreen(onChoose) {
      const preview = (gender) => P.avatarSVG({
        id: 'preview-' + gender, gender, age: 22, name: gender === 'male' ? 'ชาย' : 'หญิง',
      });

      els.startScreen.innerHTML = `
        <div class="start-panel">
          <div class="logo">
            <span class="logo-face male">${preview('male')}</span>
            <span class="logo-text">
              <span class="logo-title display">สายใยตระกูล</span>
              <span class="logo-sub">พงศาวดารตระกูล${root.GameData.CLAN_NAME}</span>
            </span>
            <span class="logo-face female">${preview('female')}</span>
          </div>

          <p class="start-lead">
            ในนครอนาคตที่พลังยุทธ์สืบทอดกันทางสายเลือด ท่านคือผู้สืบทอดรุ่นใหม่ของตระกูล
            เวลาจะเดินไปเอง — ท่านจะได้พบคู่ครอง มีทายาท และเฝ้าดูสายเลือดแตกกิ่งก้าน
            ข้ามรุ่น เลือกก่อนว่าจะเริ่มต้นในร่างใด
          </p>

          <div class="gender-choice">
            <button class="gender-btn male" data-gender="male">
              <span class="gender-portrait">${preview('male')}</span>
              <span class="gender-name">บุรุษ</span>
              <span class="gender-note">ส่วนสูงเฉลี่ย ${root.GameData.BODY.male.height.mean} ซม.</span>
            </button>
            <button class="gender-btn female" data-gender="female">
              <span class="gender-portrait">${preview('female')}</span>
              <span class="gender-name">สตรี</span>
              <span class="gender-note">ส่วนสูงเฉลี่ย ${root.GameData.BODY.female.height.mean} ซม.</span>
            </button>
          </div>

          <p class="start-foot">
            เป้าหมาย — สืบทอดให้ถึงรุ่นที่ ${CONFIG.goalGenerations},
            สะสมทอง ${CONFIG.goalGold.toLocaleString('th-TH')} ตำลึง
            และชื่อเสียง ${CONFIG.goalReputation}
          </p>
        </div>`;

      els.startScreen.querySelectorAll('.gender-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          els.startScreen.classList.add('hidden');
          onChoose(btn.dataset.gender);
        });
      });
    }

    /** อัปเดตหน้าตาปุ่มโหมดตัดสินใจอัตโนมัติ */
    function renderAutoButton(on) {
      const btn = document.getElementById('autoBtn');
      if (!btn) return;
      btn.classList.toggle('on', on);
      btn.textContent = on ? 'อัตโนมัติ' : 'ถามทุกครั้ง';
      btn.title = on
        ? 'ระบบกำลังตัดสินใจแทนท่าน — กดเพื่อกลับมาเลือกเอง'
        : 'ท่านเลือกเองทุกเรื่อง — กดเพื่อให้ระบบตัดสินใจแทน';
    }

    return {
      renderHUD, renderClockControls, logEvent, showWin, showStartScreen,
      askDecision, showPersonDetail, hidePersonDetail, renderAutoButton,
    };
  }

  root.GameUI = { create: createUI };
})(typeof self !== 'undefined' ? self : this);
