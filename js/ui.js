/**
 * =============================================================================
 * ui.js — ส่วนแสดงผลทั้งหมด (DOM rendering)
 * =============================================================================
 * รับ engine + data + game (จาก state.js) แล้วรับผิดชอบการวาดหน้าจออย่างเดียว:
 *   - ทะเบียนตระกูล (การ์ดตัวละคร + เมนูเลือกสถานที่)
 *   - แถบสถิติบนหัว (วัน/ทอง/ชื่อเสียง) และป้ายชนะ/เตือน
 *   - จดหมายเหตุ (บันทึกเหตุการณ์รายวัน พร้อมตราโทนและชิป deltas)
 *   - แผงสายสัมพันธ์ (แถบสายใย/เสน่หา)
 *
 * ไม่มี game logic ในไฟล์นี้ — แค่อ่านสถานะแล้ววาด
 * =============================================================================
 */
(function (root) {
  'use strict';

  const THAI_DIGITS = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
  function thaiNum(n) {
    return String(n).split('').map((d) => (/\d/.test(d) ? THAI_DIGITS[+d] : d)).join('');
  }

  function createUI(engine, data, game) {
    const { CHARACTERS, DEFAULT_SPOT } = data;
    const els = {
      roster: document.getElementById('roster'),
      gold: document.getElementById('goldLabel'),
      rep: document.getElementById('repLabel'),
      day: document.getElementById('dayLabel'),
      log: document.getElementById('log'),
      relList: document.getElementById('relList'),
      winBanner: document.getElementById('winBanner'),
      ruinBanner: document.getElementById('ruinBanner'),
      festivalBtn: document.getElementById('festivalBtn'),
      prayBtn: document.getElementById('prayBtn'),
    };

    /* ---------------- ทะเบียนตระกูล ---------------- */

    function renderRoster() {
      CHARACTERS.forEach((c) => {
        const card = document.createElement('div');
        card.className = 'char-card';
        const options = engine.locations
          .map((l) => `<option value="${l.id}"${l.id === DEFAULT_SPOT[c.id] ? ' selected' : ''}>${l.name}</option>`)
          .join('');
        card.innerHTML =
          `<div class="char-head"><span class="char-name">${c.name}</span>` +
          `<span class="chip">${c.age === 'adult' ? 'ผู้ใหญ่' : 'เด็ก'}</span>` +
          `<span class="chip married" id="married-${c.id}" hidden>สมรสแล้ว</span></div>` +
          `<p class="char-role">${c.role}</p>` +
          `<select id="loc-${c.id}" aria-label="สถานที่ของ${c.name}">${options}</select>`;
        els.roster.appendChild(card);
      });
    }

    /** อ่านค่าจากเมนูทุกอัน แล้วส่งเข้า engine.assignLocation */
    function syncLocations() {
      CHARACTERS.forEach((c) => {
        engine.assignLocation(c.id, document.getElementById('loc-' + c.id).value);
      });
    }

    function setAllLocations(locationId) {
      CHARACTERS.forEach((c) => {
        document.getElementById('loc-' + c.id).value = locationId;
      });
      syncLocations();
    }

    function markMarried(id) {
      document.getElementById('married-' + id).hidden = false;
    }

    /* ---------------- แถบสถิติ / ป้าย ---------------- */

    function renderStats() {
      const s = game.state;
      els.gold.textContent = s.gold.toLocaleString('th-TH');
      els.rep.textContent = s.reputation;
      els.day.textContent = 'วันที่ ' + thaiNum(s.day) + ' · ' + game.seasonOf(s.day);
      els.festivalBtn.disabled = s.gold < data.CONFIG.festivalCost;
      els.prayBtn.disabled = s.gold < data.CONFIG.prayCost;
      els.ruinBanner.classList.toggle('show', s.gold <= 0);
      if (game.checkWin()) els.winBanner.classList.add('show');
    }

    /* ---------------- จดหมายเหตุ ---------------- */

    function deltaChip(label, v) {
      if (!v) return '';
      const cls = v > 0 ? 'up' : 'down';
      return `<span class="delta ${cls}">${label} ${v > 0 ? '+' : ''}${v}</span>`;
    }

    /** เปิดกลุ่มบันทึกของวันใหม่ (แสดงวันล่าสุดไว้บนสุด) */
    function newDayGroup(titleExtra) {
      const emptyNote = els.log.querySelector('.empty-note');
      if (emptyNote) emptyNote.remove();
      const group = document.createElement('div');
      group.className = 'day-group';
      const s = game.state;
      group.innerHTML =
        `<h3 class="day-title display">วันที่ ${thaiNum(s.day)} · ${game.seasonOf(s.day)}${titleExtra || ''}</h3>`;
      els.log.prepend(group);
      return group;
    }

    /**
     * วาดเหตุการณ์หนึ่งรายการลงในกลุ่มวัน
     * special = เหตุการณ์พิเศษของเกม (งานสมรส/เทศกาล/พิธี) — เน้นสีชาด ไม่มีชิป deltas
     */
    function renderEvent(container, ev, special) {
      const div = document.createElement('div');
      div.className = 'entry fresh' + (special ? ' special' : '');
      const chips = special ? '' :
        `<div class="deltas">${deltaChip('ทอง', ev.deltas.gold)}${
          ev.participants.length === 2 ? deltaChip('สายใย', ev.deltas.bond) : ''}${
          deltaChip('เสน่หา', ev.deltas.chemistry)}${deltaChip('ชื่อเสียง', ev.repDelta)}</div>`;
      div.innerHTML = `<span class="seal ${ev.tone}"></span><p class="text">${ev.text}</p>${chips}`;
      container.appendChild(div);
    }

    /* ---------------- สายสัมพันธ์ ---------------- */

    function renderRelationships() {
      const rows = [];
      game.state.relationships.forEach((r, k) => {
        if (r.bond === 0 && r.chemistry === 0 && !r.married) return;
        const [a, b] = k.split('::').map(game.charById);
        rows.push({ a, b, r });
      });
      rows.sort((x, y) => (Math.abs(y.r.bond) + y.r.chemistry) - (Math.abs(x.r.bond) + x.r.chemistry));
      if (!rows.length) {
        els.relList.innerHTML = '<p class="empty-note">ความสัมพันธ์จะปรากฏเมื่อผู้คนได้พบปะกัน</p>';
        return;
      }
      els.relList.innerHTML = rows.map(({ a, b, r }) => {
        const bondPct = Math.min(100, Math.abs(r.bond) * 2);
        const chemPct = Math.min(100, r.chemistry);
        const chemRow = engine.isRomanceEligible(a, b)
          ? `<div class="bar-row"><span class="bar-label">เสน่หา</span>` +
            `<div class="bar chem"><i style="width:${chemPct}%"></i></div>` +
            `<span class="bar-val">${r.chemistry}</span></div>`
          : '';
        return `<div class="rel"><div class="rel-names">${a.name} · ${b.name}` +
          (r.married ? ' <span class="chip married">คู่สมรส</span>' : '') + `</div>` +
          `<div class="bar-row"><span class="bar-label">สายใย</span>` +
          `<div class="bar bond${r.bond < 0 ? ' neg' : ''}"><i style="width:${bondPct}%"></i></div>` +
          `<span class="bar-val">${r.bond}</span></div>` +
          chemRow + `</div>`;
      }).join('');
    }

    return {
      thaiNum,
      renderRoster,
      syncLocations,
      setAllLocations,
      markMarried,
      renderStats,
      newDayGroup,
      renderEvent,
      renderRelationships,
    };
  }

  root.GameUI = { create: createUI };
})(typeof self !== 'undefined' ? self : this);
