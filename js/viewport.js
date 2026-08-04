/**
 * =============================================================================
 * viewport.js — ระบบซูมและเลื่อนผังตระกูล (รองรับเมาส์และนิ้วบนมือถือ)
 * =============================================================================
 * ครอบเนื้อหาไว้ในกรอบแล้วขยับด้วย CSS transform: translate() scale()
 * ซึ่งเร็วกว่าการเปลี่ยนขนาดจริงของ element มาก เพราะเบราว์เซอร์เร่งด้วย GPU ได้
 *
 * การควบคุม
 *   เมาส์  : ลูกกลิ้ง = ซูม, ลากค้าง = เลื่อน
 *   มือถือ : สองนิ้วบีบ/ถ่าง = ซูม, นิ้วเดียวลาก = เลื่อน
 *   ปุ่ม    : + / − / จัดให้พอดีจอ
 *
 * การซูมยึดจุดที่เคอร์เซอร์หรือกึ่งกลางสองนิ้วอยู่ ไม่ใช่มุมซ้ายบน
 * ภาพจึงไม่กระโดดหนีมือขณะซูม
 * =============================================================================
 */
(function (root) {
  'use strict';

  const MIN_SCALE = 0.2;
  const MAX_SCALE = 2.6;
  const TAP_SLOP = 6;   // ขยับไม่เกินกี่พิกเซลจึงยังนับเป็นการแตะเลือก ไม่ใช่ลาก

  /* เพดานการย่อของปุ่ม "พอดีจอ"
   * ถ้าปล่อยให้ย่อจนพอดีเสมอ พอตระกูลใหญ่ขึ้นผังจะกว้างมากจนตัวหนังสือเล็กอ่านไม่ออก
   * ยอมให้เห็นไม่ครบแล้วเลื่อนดูเอา ดีกว่าเห็นครบแต่อ่านไม่ออก */
  const MIN_FIT_SCALE = 0.62;

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function createViewport(hostEl, contentEl, opts = {}) {
    let scale = 1, tx = 0, ty = 0;
    let dragging = false, moved = false;
    let lastX = 0, lastY = 0;
    let pinchDist = 0;
    // true เมื่อผู้เล่นซูมหรือเลื่อนเอง — ใช้กันไม่ให้ระบบจัดมุมมองใหม่ทับ
    // สำคัญบนมือถือ เพราะแถบ URL ที่ซ่อน/โผล่ทำให้เกิด resize ตลอดเวลา
    let userAdjusted = false;
    const onChange = opts.onChange || function () {};

    function apply() {
      contentEl.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
      onChange(scale);
    }

    /** ซูมโดยตรึงจุด (cx, cy) ในพิกัดหน้าจอให้อยู่กับที่ */
    function zoomAt(factor, cx, cy) {
      const rect = hostEl.getBoundingClientRect();
      const px = cx - rect.left;
      const py = cy - rect.top;
      const next = clamp(scale * factor, MIN_SCALE, MAX_SCALE);
      const k = next / scale;
      tx = px - k * (px - tx);
      ty = py - k * (py - ty);
      scale = next;
      userAdjusted = true;
      apply();
    }

    /** ซูมจากกึ่งกลางกรอบ ใช้กับปุ่ม + / − */
    function zoomByButton(factor) {
      const rect = hostEl.getBoundingClientRect();
      zoomAt(factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
    }

    /**
     * จัดผังให้พอดีกรอบ
     * ถ้าย่อจนพอดีแล้วเล็กเกินอ่าน จะหยุดที่ MIN_FIT_SCALE แล้วเกาะขอบบน
     * ให้เห็นต้นสาแหรกก่อน ผู้เล่นค่อยลากดูส่วนที่เหลือ
     */
    function fit() {
      const hostRect = hostEl.getBoundingClientRect();
      // วัดขนาดจริงของเนื้อหาโดยไม่นับ transform ปัจจุบัน
      const prev = contentEl.style.transform;
      contentEl.style.transform = 'none';
      const w = contentEl.scrollWidth;
      const h = contentEl.scrollHeight;
      contentEl.style.transform = prev;
      if (!w || !h || !hostRect.width) return;

      const pad = 24;
      const raw = Math.min((hostRect.width - pad) / w, (hostRect.height - pad) / h);
      scale = clamp(Math.max(raw, MIN_FIT_SCALE), MIN_SCALE, 1);

      const sw = w * scale, sh = h * scale;
      // กว้าง/สูงเกินกรอบก็เกาะขอบไว้ ไม่งั้นผังจะหลุดออกไปนอกจอ
      tx = sw <= hostRect.width ? (hostRect.width - sw) / 2 : 12;
      ty = sh <= hostRect.height ? (hostRect.height - sh) / 2 : 12;
      userAdjusted = false;
      apply();
    }

    /* ------------------- เมาส์ ------------------- */

    hostEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY);
    }, { passive: false });

    hostEl.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      dragging = true; moved = false;
      lastX = e.clientX; lastY = e.clientY;
      hostEl.classList.add('grabbing');
    });

    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      if (Math.abs(dx) + Math.abs(dy) > TAP_SLOP) moved = true;
      tx += dx; ty += dy;
      lastX = e.clientX; lastY = e.clientY;
      userAdjusted = true;
      apply();
    });

    window.addEventListener('mouseup', () => {
      dragging = false;
      hostEl.classList.remove('grabbing');
    });

    /* ------------------- นิ้วบนมือถือ ------------------- */

    function midpoint(t1, t2) {
      return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
    }
    function distance(t1, t2) {
      return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    }

    hostEl.addEventListener('touchstart', (e) => {
      moved = false;
      if (e.touches.length === 1) {
        dragging = true;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        dragging = false;
        pinchDist = distance(e.touches[0], e.touches[1]);
      }
    }, { passive: true });

    hostEl.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        moved = true;
        const d = distance(e.touches[0], e.touches[1]);
        if (pinchDist > 0) {
          const mid = midpoint(e.touches[0], e.touches[1]);
          zoomAt(d / pinchDist, mid.x, mid.y);
        }
        pinchDist = d;
      } else if (e.touches.length === 1 && dragging) {
        e.preventDefault();
        const dx = e.touches[0].clientX - lastX;
        const dy = e.touches[0].clientY - lastY;
        if (Math.abs(dx) + Math.abs(dy) > TAP_SLOP) moved = true;
        tx += dx; ty += dy;
        userAdjusted = true;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        apply();
      }
    }, { passive: false });

    hostEl.addEventListener('touchend', (e) => {
      if (e.touches.length === 0) { dragging = false; pinchDist = 0; }
      else if (e.touches.length === 1) {
        // ยกนิ้วจากสองเหลือหนึ่ง — เริ่มนับตำแหน่งลากใหม่ ไม่งั้นภาพจะกระโดด
        dragging = true;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        pinchDist = 0;
      }
    }, { passive: true });

    // ดับเบิลคลิก/แตะสองครั้ง = จัดให้พอดีจอ
    hostEl.addEventListener('dblclick', (e) => { e.preventDefault(); fit(); });

    return {
      fit,
      zoomIn: () => zoomByButton(1.25),
      zoomOut: () => zoomByButton(1 / 1.25),
      reset: fit,
      scale: () => scale,
      /** true ถ้าผู้เล่นซูมหรือเลื่อนเอง — ระบบจะไม่จัดมุมมองใหม่ทับ */
      isUserAdjusted: () => userAdjusted,
      
      /** true ถ้าเพิ่งลากอยู่ ใช้กันไม่ให้การลากถูกตีความเป็นการกดเลือกการ์ด */
      wasDragged: () => moved,
    };
  }

  root.Viewport = { create: createViewport };
})(typeof self !== 'undefined' ? self : this);
