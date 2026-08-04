/**
 * =============================================================================
 * state.js — คลังสมบัติ ชื่อเสียง และปฏิทินของตระกูล
 * =============================================================================
 * ถือ "ตัวเลขส่วนกลาง" ที่ไม่ได้ผูกกับตัวละครคนใดคนหนึ่ง:
 *   - เดือน/ปีที่ดำเนินอยู่
 *   - คลังทอง (ตำลึง) และชื่อเสียง
 *   - การเดินเวลาหนึ่งเดือน (advanceMonth) พร้อมเก็บรายได้เข้าคลัง
 *   - เงื่อนไขบรรลุเป้าหมาย
 *
 * ไม่ยุ่งกับ DOM และไม่รู้จักผังตระกูลโดยตรง — รับตัวเลขรายได้เข้ามาเป็นพารามิเตอร์
 * =============================================================================
 */
(function (root) {
  'use strict';

  const { CONFIG } = root.GameData;

  const THAI_MONTHS = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
  ];

  function createState() {
    const s = {
      month: 0,                       // นับสะสมตั้งแต่เริ่มเกม
      gold: CONFIG.startGold,
      reputation: CONFIG.startReputation,
      won: false,
    };

    function year() { return CONFIG.startYear + Math.floor(s.month / 12); }
    function monthName() { return THAI_MONTHS[s.month % 12]; }
    function dateLabel() { return monthName() + ' พ.ศ. ' + year(); }

    /** เดินเวลาหนึ่งเดือน แล้วเก็บรายได้เข้าคลัง */
    function advanceMonth(income) {
      s.month += 1;
      s.gold = Math.round((s.gold + income) * 100) / 100;
      return s.month;
    }

    function addGold(v) { s.gold = Math.round((s.gold + v) * 100) / 100; }
    function addReputation(v) { s.reputation = Math.max(0, s.reputation + v); }

    /** คืน true เฉพาะครั้งแรกที่บรรลุเป้าหมาย เพื่อให้ UI โชว์ป้ายทีเดียว */
    function checkWin(generations) {
      if (s.won) return false;
      if (s.gold >= CONFIG.goalGold &&
          s.reputation >= CONFIG.goalReputation &&
          generations >= CONFIG.goalGenerations) {
        s.won = true;
        return true;
      }
      return false;
    }

    return { state: s, year, monthName, dateLabel, advanceMonth, addGold, addReputation, checkWin };
  }

  root.GameState = { create: createState, THAI_MONTHS };
})(typeof self !== 'undefined' ? self : this);
