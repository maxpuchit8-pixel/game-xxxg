/**
 * =============================================================================
 * tree-ui.js — ตัววาดผังตระกูล
 * =============================================================================
 * แปลงโครงต้นไม้จาก lineage.buildTree() เป็น HTML แบบ พ่อ—แม่ ลงมาเป็นลูก
 *
 * โครง HTML ที่ใช้ (เส้นเชื่อมวาดด้วย CSS ::before/::after ทั้งหมด ไม่ใช้ canvas)
 *   ul.tree > li.unit > div.couple ( .card + .knot + .card )
 *                     > ul.children > li.unit > ...
 *
 * สีกรอบการ์ด: ชาย = คราม (น้ำเงิน) / หญิง = ชาด (แดง) ตามที่กำหนดใน CSS
 * =============================================================================
 */
(function (root) {
  'use strict';

  const P = root.Person;
  const { CONFIG } = root.GameData;

  function createTreeUI(lineage, opts = {}) {
    const host = document.getElementById('tree');
    const onSelect = opts.onSelect || function () {};
    const shouldIgnoreClick = opts.shouldIgnoreClick || function () { return false; };

    // ใช้ event delegation ครั้งเดียว การ์ดถูกวาดใหม่บ่อยมากจึงไม่ผูกทีละใบ
    host.addEventListener('click', (e) => {
      const card = e.target.closest('.card');
      if (!card || shouldIgnoreClick()) return;
      const p = lineage.get(card.dataset.id);
      if (p) onSelect(p);
    });

    /** ฟอร์แมตรายได้ให้อ่านง่าย เช่น +7.0 / -5.8 */
    function incomeLabel(v) {
      const n = Math.round(v * 10) / 10;
      return (n >= 0 ? '+' : '') + n.toFixed(1) + ' ตำลึง/เดือน';
    }

    /** การ์ดตัวละครหนึ่งใบ */
    function cardHTML(p) {
      if (!p) return '';
      const cls = [
        'card',
        p.gender === 'male' ? 'male' : 'female',
        p.alive ? '' : 'dead',
        p.isFounder ? 'founder' : '',
        p.isBlood ? '' : 'married-in',
      ].filter(Boolean).join(' ');

      const ageText = p.alive ? p.age : '†';
      // ค่าร่างกายเปิดเผยเมื่อโตเต็มวัยแล้วเท่านั้น ก่อนหน้านั้นยังไม่นิ่ง
      const bodyText = p.age >= CONFIG.adultAge
        ? `${p.body.height} ซม. · ${p.body.weight} กก.<br>${P.buildLabel(p.body)}`
        : 'ยังอยู่ในวัยเยาว์';
      const originText = !p.isBlood && p.origin ? `<div class="card-origin">${p.origin}</div>` : '';
      const incomeCls = p.income >= 0 ? 'pos' : 'neg';

      return `<div class="${cls}" data-id="${p.id}" title="กดเพื่อดูข้อมูล${p.name}" role="button" tabindex="0">
        <span class="age-badge">${ageText}</span>
        ${p.isFounder ? '<span class="you-badge">ผู้เริ่มต้น</span>' : ''}
        <div class="card-name">${p.name}</div>
        <div class="portrait">${P.avatarSVG(p)}</div>
        ${p.alive ? `<div class="card-power">พลังยุทธ์ <b>${p.power}</b></div>` : ''}
        <div class="card-body">${bodyText}</div>
        ${originText}
        ${p.alive
          ? `<div class="card-income ${incomeCls}">${incomeLabel(p.income)}</div>`
          : `<div class="card-income dead-note">ถึงแก่กรรม อายุ ${p.deathAge}</div>`}
      </div>`;
    }

    /** หน่วยครอบครัวหนึ่งชุด (คู่สมรส + ลูกที่แตกลงไป) */
    function unitHTML(unit) {
      const couple = unit.spouse
        ? `<div class="couple paired">${cardHTML(unit.person)}<span class="knot"></span>${cardHTML(unit.spouse)}</div>`
        : `<div class="couple">${cardHTML(unit.person)}</div>`;

      const kids = unit.children.length
        ? `<ul class="children">${unit.children.map((c) => unitHTML(c)).join('')}</ul>`
        : '';

      return `<li class="unit">${couple}${kids}</li>`;
    }

    function render() {
      const tree = lineage.buildTree();
      if (!tree.length) {
        host.innerHTML = '<p class="empty-note">ยังไม่มีใครในผังตระกูล</p>';
        return;
      }
      host.innerHTML = `<ul class="tree">${tree.map(unitHTML).join('')}</ul>`;
    }

    /** อัปเดตเฉพาะตัวเลขบนการ์ด (อายุ/รายได้) โดยไม่วาดผังใหม่ทั้งหมด */
    function refreshFigures() {
      lineage.all().forEach((p) => {
        const el = host.querySelector(`.card[data-id="${p.id}"]`);
        if (!el) return;
        const badge = el.querySelector('.age-badge');
        if (badge) badge.textContent = p.alive ? p.age : '†';
        const inc = el.querySelector('.card-income');
        if (inc && p.alive) {
          inc.textContent = incomeLabel(p.income);
          inc.className = 'card-income ' + (p.income >= 0 ? 'pos' : 'neg');
        }
        el.classList.toggle('dead', !p.alive);
        // ผมขาวเมื่อเข้าวัยชรา — วาดรูปใหม่เฉพาะตอนข้ามเกณฑ์
        if (p.age === CONFIG.elderAge) {
          const port = el.querySelector('.portrait');
          if (port) port.innerHTML = P.avatarSVG(p);
        }
        const pw = el.querySelector('.card-power b');
        if (pw && p.alive) pw.textContent = p.power;
        // เปิดเผยค่าร่างกายในเดือนที่โตเต็มวัยพอดี
        if (p.age === CONFIG.adultAge) {
          const bodyEl = el.querySelector('.card-body');
          if (bodyEl) {
            bodyEl.innerHTML = `${p.body.height} ซม. · ${p.body.weight} กก.<br>${P.buildLabel(p.body)}`;
          }
        }
      });
    }

    /**
     * เน้นการ์ดของคนที่กำลังดูอยู่
     * ไม่ใช้ scrollIntoView เพราะผังถูกเลื่อนด้วย CSS transform ไม่ใช่ scroll
     * การเรียก scrollIntoView จะไปดันทั้งหน้าเว็บแทนที่จะเลื่อนผัง
     */
    function highlight(id) {
      host.querySelectorAll('.card.focus').forEach((el) => el.classList.remove('focus'));
      const el = host.querySelector(`.card[data-id="${id}"]`);
      if (el) el.classList.add('focus');
      return el;
    }

    return { render, refreshFigures, highlight };
  }

  root.TreeUI = { create: createTreeUI };
})(typeof self !== 'undefined' ? self : this);
