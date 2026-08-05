/**
 * =============================================================================
 * map-ui.js — แผนที่นคร: ดูว่าใครอยู่ที่ไหน และย้ายคนไปเองได้
 * =============================================================================
 * เปิดจากปุ่มบนแถบสถานะ แล้วกดกลับมาหน้าผังได้ตลอด
 * ลากการ์ดคนไปวางที่ใหม่ หรือกดคนแล้วกดสถานที่ก็ได้ (ใช้ได้ทั้งเมาส์และนิ้ว)
 *
 * ที่อยู่มีผลจริงต่อเกม (คิดใน main.js):
 *   - อีเวนต์ของสถานที่นั้นเท่านั้นที่จะเกิดกับคนที่อยู่ที่นั่น
 *   - ความสัมพันธ์ลับเกิดกับ "คนที่อยู่ที่เดียวกัน" เป็นหลัก
 *   - บางแห่งเพิ่มพลังยุทธ์ รายได้ หรือชื่อเสียง และบางแห่งเสี่ยงถูกจับได้น้อยกว่า
 * =============================================================================
 */
(function (root) {
  'use strict';

  const Places = root.Places;
  const P = root.Person;
  const { CONFIG } = root.GameData;

  function createMapUI(ctx) {
    const lineage = ctx.lineage;
    const onOpenPerson = ctx.onOpenPerson || function () {};
    let selectedId = null;

    let host = document.getElementById('cityMap');
    if (!host) {
      host = document.createElement('div');
      host.id = 'cityMap';
      host.className = 'map-overlay';
      document.body.appendChild(host);
    }

    function personChip(p) {
      const tags = [];
      if (p.pregnancy) tags.push('<i class="pin-preg" title="ตั้งครรภ์">🤰</i>');
      if (p.age < CONFIG.adultAge) tags.push('<i class="pin-child" title="ยังเยาว์">•</i>');
      return `<button class="person-pin ${p.gender} ${selectedId === p.id ? 'picked' : ''}"
        draggable="true" data-pid="${p.id}" title="${p.name} · อายุ ${p.age} ปี">
        <span class="pin-face">${P.avatarSVG(p)}</span>
        <span class="pin-name">${p.name}</span>
        ${tags.join('')}
      </button>`;
    }

    function render() {
      const living = lineage.living();
      host.innerHTML = `
        <div class="map-page">
          <div class="map-bar">
            <button class="map-close">✕ กลับสู่ผังตระกูล</button>
            <span class="map-hint">${selectedId
              ? 'เลือกคนแล้ว — กดสถานที่ที่ต้องการให้ไปอยู่'
              : 'กดที่ตัวคนเพื่อเลือก แล้วกดสถานที่ปลายทาง (หรือลากไปวางก็ได้)'}</span>
          </div>
          <div class="map-grid">
            ${Places.all.map((pl) => {
              const here = Places.peopleAt(living, pl.id);
              return `
              <section class="place-card" data-place="${pl.id}">
                <header>
                  <span class="place-icon">${pl.icon}</span>
                  <span class="place-name">${pl.name}</span>
                  <span class="place-count">${here.length} คน</span>
                </header>
                <p class="place-desc">${pl.desc}</p>
                <div class="place-stats">
                  <span title="โอกาสเกิดเรื่องราว">เรื่องราว ×${pl.heat}</span>
                  <span title="โอกาสเกิดความสัมพันธ์ลับ">ลับ ×${pl.secret}</span>
                  <span title="โอกาสถูกคนเห็น">สายตา ×${pl.witness}</span>
                  ${pl.income ? `<span title="รายได้ต่อเดือน">+${pl.income} เครดิต</span>` : ''}
                  ${pl.power ? `<span title="พลังยุทธ์ที่เพิ่มต่อเดือน">+พลังยุทธ์</span>` : ''}
                  ${pl.rep ? '<span title="ชื่อเสียงที่ได้ต่อเดือน">+ชื่อเสียง</span>' : ''}
                </div>
                <div class="place-people">${here.map(personChip).join('') ||
                  '<span class="kin-none">ไม่มีใครอยู่ที่นี่</span>'}</div>
              </section>`;
            }).join('')}
          </div>
        </div>`;

      host.querySelector('.map-close').addEventListener('click', hide);

      host.querySelectorAll('.person-pin').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.dataset.pid;
          if (e.shiftKey) { onOpenPerson(id); return; }
          selectedId = selectedId === id ? null : id;
          render();
        });
        btn.addEventListener('dragstart', (e) => {
          selectedId = btn.dataset.pid;
          e.dataTransfer.setData('text/plain', btn.dataset.pid);
        });
      });

      host.querySelectorAll('.place-card').forEach((card) => {
        card.addEventListener('click', () => {
          if (!selectedId) return;
          const p = lineage.get(selectedId);
          if (p) Places.movePerson(p, card.dataset.place);
          selectedId = null;
          render();
        });
        card.addEventListener('dragover', (e) => { e.preventDefault(); card.classList.add('over'); });
        card.addEventListener('dragleave', () => card.classList.remove('over'));
        card.addEventListener('drop', (e) => {
          e.preventDefault();
          card.classList.remove('over');
          const p = lineage.get(e.dataTransfer.getData('text/plain'));
          if (p) Places.movePerson(p, card.dataset.place);
          selectedId = null;
          render();
        });
      });
    }

    function show() { host.classList.add('show'); selectedId = null; render(); }
    function hide() { host.classList.remove('show'); host.innerHTML = ''; }
    function isOpen() { return host.classList.contains('show'); }
    function refresh() { if (isOpen()) render(); }

    return { show, hide, isOpen, refresh };
  }

  root.MapUI = { create: createMapUI };
})(typeof self !== 'undefined' ? self : this);
