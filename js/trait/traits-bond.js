/**
 * =============================================================================
 * trait/traits-bond.js — คุณลักษณะว่าด้วย "รูปแบบความผูกพัน"
 * =============================================================================
 * หมวดนี้กำหนดว่าตัวละครมองความสัมพันธ์อย่างไร — ผูกใจไว้กับคนเดียว เปิดใจให้
 * คู่ครองมีผู้อื่นได้ หรือชอบเข้าหาคนที่มีเจ้าของแล้ว
 * มีผลตรงกับระบบความสัมพันธ์ลับที่มีอยู่: โอกาสเกิด โอกาสลอบพบ และความเสียหาย
 * ต่อชื่อเสียงเมื่อความลับแตก
 *
 * กติกาของเกมยังบังคับเหมือนเดิมเสมอ ไม่ว่าจะมี trait ใด:
 * ความสัมพันธ์ลับเกิดได้เฉพาะชายกับหญิงที่บรรลุนิติภาวะ ไม่ใช่สายเลือดเดียวกัน
 * และไม่ใช่ญาติสายตรง (พ่อแม่ลูกปู่ย่าตายาย) — ดู isDirectLine ใน lineage.js
 *
 * วิธีเขียน trait อยู่หัวไฟล์ traits-common.js
 * =============================================================================
 */
(function (root) {
  'use strict';

  root.TraitDefs = (root.TraitDefs || []).concat([

    {
      id: 'onlyOne', label: 'รักเดียวใจเดียว',
      desc: 'เชื่อว่าชีวิตหนึ่งมีคู่ครองได้เพียงคนเดียว และยึดถือเช่นนั้นจนวันสุดท้าย',
      heritable: 0.3,
      relates: ['devoted'],
      conflicts: ['freeHeart', 'openHeart'],
      effects: { secret: 0.1, charm: 2, exposeRep: 1.4 },
    },
    {
      id: 'freeHeart', label: 'หัวใจหลายดวง',
      desc: 'มอบใจให้ได้พร้อมกันหลายคนโดยไม่รู้สึกว่าใจใครถูกแบ่งไป',
      heritable: 0.22,
      relates: ['openHeart', 'shameless'],
      conflicts: ['onlyOne', 'devoted'],
      effects: { secret: 2.2, charm: 3 },
    },
    {
      id: 'openHeart', label: 'เปิดใจให้คู่ตน',
      desc: 'ยอมรับได้ว่าคู่ครองของตนจะมีผู้อื่นในใจ ตราบที่ยังกลับมาที่เรือนเดียวกัน',
      relates: ['freeHeart'],
      conflicts: ['jealous', 'possessive'],
      effects: { exposeRep: 0.25, secret: 1.3 },
    },
    {
      id: 'possessive', label: 'หวงแหนดั่งสมบัติ',
      desc: 'ถือว่าคู่ครองเป็นของตนผู้เดียว ใครล้ำเส้นเป็นได้เรื่องใหญ่ทุกครั้ง',
      relates: ['jealous', 'vengeful'],
      conflicts: ['openHeart'],
      effects: { secret: 0.6, power: 1.05, exposeRep: 1.5 },
    },
    {
      id: 'takenHeart', label: 'ใจที่ถูกช่วงชิง',
      desc: 'เคยรู้ทั้งรู้ว่าคู่ของตนมีผู้อื่น แล้วได้แต่มองอยู่เงียบๆ จนกลายเป็นแผลในใจ',
      relates: ['jealous', 'heartbroken'],
      effects: { charm: -3, marriagePull: 0.75 },
    },
    {
      id: 'heartThief', label: 'ผู้ช่วงชิงดวงใจ',
      desc: 'พอใจกับการเอาชนะใจคนที่มีเจ้าของแล้วมากกว่าคนที่ยังว่าง',
      relates: ['freeHeart', 'shameless'],
      conflicts: ['onlyOne'],
      effects: { secret: 2.4, charm: 4, exposeRep: 1.2 },
    },
  ]);
})(typeof self !== 'undefined' ? self : this);
