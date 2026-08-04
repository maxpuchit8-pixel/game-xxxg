/**
 * =============================================================================
 * state.js — สถานะเกมและกฎกติกา (ไม่ยุ่งกับ DOM เลย)
 * =============================================================================
 * โมดูลนี้รับผิดชอบ "ตัวเลข" ทั้งหมดของเกม:
 *   - คลังทอง / ชื่อเสียง / วัน
 *   - ความสัมพันธ์รายคู่ (สายใย bond, เสน่หา chemistry, สถานะสมรส)
 *   - การนำผลเหตุการณ์ (deltas) จาก ScenarioEngine มาปรับสถานะ
 *   - เงื่อนไขงานมงคลสมรส และเงื่อนไขชนะ
 *
 * แยกจาก UI โดยสิ้นเชิง จึงทดสอบด้วย Node ได้ และเปลี่ยนหน้าตาเกมได้
 * โดยไม่ต้องแตะไฟล์นี้
 * =============================================================================
 */
(function (root) {
  'use strict';

  function createGameState(engine, data) {
    const { CONFIG, SEASONS, CHARACTERS } = data;

    const state = {
      day: 1,
      gold: CONFIG.startGold,
      reputation: CONFIG.startReputation,
      relationships: new Map(), // pairKey -> { bond, chemistry, married }
      won: false,
    };

    function pairKey(a, b) {
      return [a, b].sort().join('::');
    }

    function getRel(a, b) {
      const k = pairKey(a, b);
      if (!state.relationships.has(k)) {
        state.relationships.set(k, { bond: 0, chemistry: 0, married: false });
      }
      return state.relationships.get(k);
    }

    function charById(id) {
      return CHARACTERS.find((c) => c.id === id);
    }

    function isMarried(id) {
      for (const [k, r] of state.relationships) {
        if (r.married && k.split('::').includes(id)) return true;
      }
      return false;
    }

    function seasonOf(day) {
      return SEASONS[Math.floor((day - 1) / CONFIG.daysPerSeason) % SEASONS.length];
    }

    /**
     * นำผลของเหตุการณ์จาก engine.generateEvent มาปรับสถานะเกม
     * เติม ev.repDelta (ผลต่อชื่อเสียง) ลงใน event ด้วยเพื่อให้ UI นำไปแสดง
     */
    function applyEvent(ev) {
      state.gold += ev.deltas.gold;
      ev.repDelta = ev.tone === 'positive' ? 2 + Math.floor(Math.random() * 4)
                  : ev.tone === 'negative' ? -(2 + Math.floor(Math.random() * 4))
                  : 0;
      state.reputation = Math.max(0, state.reputation + ev.repDelta);
      if (ev.participants.length === 2) {
        const rel = getRel(ev.participants[0], ev.participants[1]);
        rel.bond += ev.deltas.bond;
        rel.chemistry = Math.max(0, rel.chemistry + ev.deltas.chemistry);
      }
    }

    /**
     * ตรวจทุกคู่ว่าเสน่หาถึงเกณฑ์สมรสหรือยัง
     * คืนรายชื่อคู่ที่เพิ่งแต่งงานในรอบนี้ [{ a, b }] (หักทอง/บวกชื่อเสียงให้แล้ว)
     */
    function tryMarriages() {
      const newlyweds = [];
      state.relationships.forEach((r, k) => {
        if (r.married || r.chemistry < CONFIG.marriageThreshold) return;
        const [a, b] = k.split('::').map(charById);
        if (!engine.isRomanceEligible(a, b) || isMarried(a.id) || isMarried(b.id)) return;
        r.married = true;
        state.gold -= CONFIG.marriageCost;
        state.reputation += CONFIG.marriageReputation;
        newlyweds.push({ a, b });
      });
      return newlyweds;
    }

    /** คืน true เฉพาะ "ครั้งแรก" ที่บรรลุเป้าหมาย เพื่อให้ UI โชว์ป้ายทีเดียว */
    function checkWin() {
      if (!state.won && state.gold >= CONFIG.goalGold && state.reputation >= CONFIG.goalReputation) {
        state.won = true;
        return true;
      }
      return false;
    }

    return { state, pairKey, getRel, charById, isMarried, seasonOf, applyEvent, tryMarriages, checkWin };
  }

  root.GameState = { create: createGameState };
})(typeof self !== 'undefined' ? self : this);
