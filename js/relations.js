/**
 * =============================================================================
 * relations.js — ค่าความสัมพันธ์รายคู่ ความระแวง และใครรู้ความลับของใคร
 * =============================================================================
 * เดิมความสัมพันธ์ในเกมมีแค่สามแบบ: คู่สมรส / คู่ลับ / ไม่เกี่ยวกัน
 * อีเวนต์ทุกเรื่องจึงจบในตัวเอง ไม่มีอะไรค้างไว้ให้ระเบิดทีหลัง
 * โมดูลนี้เก็บ "สถานะ" ของทุกคู่ไว้ เพื่อให้ดราม่าสานต่อกันได้:
 *
 *   สายสัมพันธ์ (สมมาตร — ของคู่นั้นร่วมกัน)
 *     closeness  ความสนิทสนม        passion  ความปรารถนาต่อกัน
 *     trust      ความไว้ใจ           grudge   ความแค้นฝังใจ
 *
 *   ความระแวง (มีทิศทาง — ใครระแวงใคร)
 *     suspicion(observer → target) 0–100 ไต่ขึ้นเมื่อมีหลักฐาน
 *     ถึงขีดแล้วจะเกิดฉากเผชิญหน้า
 *
 *   ความรู้ (มีทิศทาง — ใครรู้ความลับของคู่ไหน)
 *     ใช้ทั้งเป็นเชื้อความระแวง และเป็นอาวุธของคนที่คิดจะแบล็กเมล์
 *
 * ไม่แตะ DOM — ทดสอบใน Node ได้เหมือนโมดูลตรรกะตัวอื่น
 * =============================================================================
 */
(function (root) {
  'use strict';

  function clamp(v) { return Math.max(0, Math.min(100, v)); }
  function pairKey(a, b) { return [a, b].sort().join('::'); }
  function dirKey(a, b) { return a + '>' + b; }

  function createRelations() {
    const bonds = new Map();      // "a::b"  -> { closeness, passion, trust, grudge }
    const suspicion = new Map();  // "obs>tgt" -> 0–100
    const knowledge = new Map();  // "obs>a::b" -> เดือนที่รู้

    /* ------------------- สายสัมพันธ์รายคู่ ------------------- */

    function bond(aId, bId) {
      const k = pairKey(aId, bId);
      if (!bonds.has(k)) {
        bonds.set(k, { closeness: 0, passion: 0, trust: 0, grudge: 0 });
      }
      return bonds.get(k);
    }

    /** ปรับค่าหนึ่งช่อง เช่น shift(a, b, 'passion', 12) */
    function shift(aId, bId, field, amount) {
      const rec = bond(aId, bId);
      rec[field] = clamp((rec[field] || 0) + amount);
      return rec[field];
    }

    function value(aId, bId, field) {
      const k = pairKey(aId, bId);
      const rec = bonds.get(k);
      return rec ? (rec[field] || 0) : 0;
    }

    /** คู่ทั้งหมดที่ค่าช่องหนึ่งถึงเกณฑ์ — ใช้หาสามเส้าและคู่ที่ใกล้ระเบิด */
    function pairsAbove(field, min) {
      const out = [];
      bonds.forEach((rec, k) => {
        if ((rec[field] || 0) >= min) {
          const ids = k.split('::');
          out.push({ aId: ids[0], bId: ids[1], value: rec[field], rec });
        }
      });
      return out;
    }

    /* ------------------- ความระแวง (มีทิศทาง) ------------------- */

    function suspicionOf(obsId, tgtId) { return suspicion.get(dirKey(obsId, tgtId)) || 0; }

    function addSuspicion(obsId, tgtId, amount) {
      const k = dirKey(obsId, tgtId);
      const v = clamp((suspicion.get(k) || 0) + amount);
      suspicion.set(k, v);
      return v;
    }

    function setSuspicion(obsId, tgtId, v) { suspicion.set(dirKey(obsId, tgtId), clamp(v)); }

    /** คนที่ระแวงถึงขีดแล้ว คืน [{ obsId, tgtId, level }] */
    function suspicionsAbove(min) {
      const out = [];
      suspicion.forEach((v, k) => {
        if (v >= min) {
          const ids = k.split('>');
          out.push({ obsId: ids[0], tgtId: ids[1], level: v });
        }
      });
      return out;
    }

    /* ------------------- ใครรู้ความลับของใคร ------------------- */

    /** ให้ obs รู้ว่า a กับ b มีอะไรกัน คืน true ถ้าเพิ่งรู้ครั้งแรก */
    function learn(obsId, aId, bId, month) {
      if (obsId === aId || obsId === bId) return false;
      const k = dirKey(obsId, pairKey(aId, bId));
      if (knowledge.has(k)) return false;
      knowledge.set(k, month);
      return true;
    }

    function knows(obsId, aId, bId) {
      return knowledge.has(dirKey(obsId, pairKey(aId, bId)));
    }

    /** ความลับทั้งหมดที่ obs ถืออยู่ในมือ คืน [{ aId, bId, since }] */
    function secretsKnownBy(obsId) {
      const out = [];
      knowledge.forEach((month, k) => {
        const at = k.indexOf('>');
        if (k.slice(0, at) !== obsId) return;
        const ids = k.slice(at + 1).split('::');
        out.push({ aId: ids[0], bId: ids[1], since: month });
      });
      return out;
    }

    /* ------------------- เวลาผ่านไป ------------------- */

    /**
     * เรียกเดือนละครั้ง — ความระแวงจางลงถ้าไม่มีหลักฐานใหม่
     * ส่วนความแค้นและความสนิทจางช้ากว่ามาก ใจคนไม่ลืมง่ายๆ
     */
    function decay(rate) {
      const r = rate || 1;
      suspicion.forEach((v, k) => {
        const nv = v - 0.6 * r;
        if (nv <= 0) suspicion.delete(k); else suspicion.set(k, nv);
      });
      bonds.forEach((rec) => {
        rec.passion = Math.max(0, rec.passion - 0.25 * r);
        rec.grudge = Math.max(0, rec.grudge - 0.05 * r);
      });
    }

    /** ลบทุกอย่างที่เกี่ยวกับคนคนหนึ่ง (ใช้ตอนล้างข้อมูลเท่านั้น) */
    function forget(id) {
      [...bonds.keys()].forEach((k) => { if (k.split('::').includes(id)) bonds.delete(k); });
      [...suspicion.keys()].forEach((k) => { if (k.split('>').includes(id)) suspicion.delete(k); });
      [...knowledge.keys()].forEach((k) => { if (k.startsWith(id + '>')) knowledge.delete(k); });
    }

    return {
      bond, shift, value, pairsAbove,
      suspicionOf, addSuspicion, setSuspicion, suspicionsAbove,
      learn, knows, secretsKnownBy,
      decay, forget,
      _bonds: bonds, _suspicion: suspicion, _knowledge: knowledge,
    };
  }

  root.Relations = { create: createRelations };
})(typeof self !== 'undefined' ? self : this);
