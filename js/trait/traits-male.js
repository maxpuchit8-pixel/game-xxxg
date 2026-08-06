/**
 * =============================================================================
 * trait/traits-male.js — คุณลักษณะฝั่งบุรุษ
 * =============================================================================
 * ส่วนใหญ่ได้จาก "พฤติกรรมสะสม" ผ่านอีเวนต์ใน js/events/trait-male.js
 * ทำเรื่องแนวเดิมซ้ำหลายครั้งแล้วจึงติดเป็นนิสัยถาวร
 *
 * วิธีเขียน trait อยู่หัวไฟล์ traits-common.js
 * =============================================================================
 */
(function (root) {
  'use strict';

  root.TraitDefs = (root.TraitDefs || []).concat([

    {
      id: 'wanderingBee', label: 'ภมรเร่ร่อน',
      desc: 'ไม่เคยหยุดอยู่ดอกไม้ดอกเดียว มีคำหวานสำรองไว้เสมอสำหรับคนถัดไป',
      gender: 'male',
      heritable: 0.24,
      relates: ['freeHeart', 'charmer', 'heartThief'],
      conflicts: ['onlyOne', 'devoted'],
      effects: { charm: 4, secret: 2.2, marriagePull: 1.2, desire: 1.4 },
    },
    {
      id: 'harem', label: 'ฮาเร็ม',
      desc: 'เคยเป็นศูนย์กลางของวงที่มีสตรีหลายคนพร้อมกัน และพบว่านั่นคือที่ทางของตน',
      gender: 'male',
      heritable: 0.2,
      relates: ['wanderingBee', 'freeHeart', 'ardent', 'charmer'],
      conflicts: ['onlyOne', 'devoted', 'loyalShadow'],
      effects: { charm: 5, secret: 1.8, desire: 1.3, marriagePull: 1.2, exposeRep: 0.7 },
    },
    {
      id: 'ironGuard', label: 'ผู้พิทักษ์เรือน',
      desc: 'ยึดหน้าที่ปกป้องคนในตระกูลเหนือความสุขส่วนตน จนผู้คนยำเกรงและวางใจ',
      gender: 'male',
      heritable: 0.3,
      relates: ['ironWill', 'devoted', 'possessive'],
      effects: { power: 1.1, charm: 2, exposeRep: 1.2 },
    },
    {
      id: 'lordOfWill', label: 'บุรุษผู้กุมบังเหียน',
      desc: 'เป็นฝ่ายกำหนดทิศทางในทุกความสัมพันธ์ และไม่เคยลังเลที่จะตัดสินใจแทน',
      gender: 'male',
      relates: ['ironWill', 'possessive'],
      conflicts: ['loyalShadow'],
      effects: { charm: 4, power: 1.05 },
    },
    {
      id: 'loyalShadow', label: 'เงาผู้ซื่อสัตย์',
      desc: 'สุขใจที่ได้อยู่ข้างหลังคนที่ตนเทิดทูน คอยประคองโดยไม่ต้องการหน้าตา',
      gender: 'male',
      relates: ['devoted'],
      conflicts: ['lordOfWill'],
      effects: { charm: 2, exposeRep: 0.8 },
    },
    {
      id: 'youngerMoon', label: 'จันทร์ดวงหลัง',
      desc: 'ต้องมนต์สตรีที่อาวุโสกว่า เห็นความงามในสิ่งที่กาลเวลาขัดเกลามาแล้ว',
      gender: 'male',
      relates: ['charmer'],
      effects: { partnerAge: 8, charm: 2, desire: 1.15 },
    },
  ]);
})(typeof self !== 'undefined' ? self : this);
