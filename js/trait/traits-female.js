/**
 * =============================================================================
 * trait/traits-female.js — คุณลักษณะฝั่งสตรี
 * =============================================================================
 * ส่วนใหญ่ได้จาก "พฤติกรรมสะสม" ผ่านอีเวนต์ใน js/events/trait-female.js
 * ทำเรื่องแนวเดิมซ้ำหลายครั้งแล้วจึงติดเป็นนิสัยถาวร
 *
 * วิธีเขียน trait อยู่หัวไฟล์ traits-common.js
 * =============================================================================
 */
(function (root) {
  'use strict';

  root.TraitDefs = (root.TraitDefs || []).concat([

    {
      id: 'limelight', label: 'ผู้ปรารถนาสายตา',
      desc: 'มีความสุขเมื่อได้เป็นศูนย์กลางสายตาผู้คน ยิ่งถูกจับจ้องยิ่งเปล่งประกาย',
      gender: 'female',
      heritable: 0.25,
      relates: ['radiantOne', 'freeHeart'],
      effects: { charm: 6, marriagePull: 1.3, exposeRep: 0.6 },
    },
    {
      id: 'radiantOne', label: 'ดอกไม้ที่ผู้คนหมายปอง',
      desc: 'พอใจที่ตนเป็นที่ปรารถนาของคนทั้งนคร และไม่คิดปิดบังความพอใจนั้น',
      gender: 'female',
      relates: ['limelight', 'freeHeart', 'openHeart'],
      conflicts: ['onlyOne'],
      effects: { charm: 5, secret: 2.0, exposeRep: 0.5 },
    },
    {
      id: 'eveningRose', label: 'กุหลาบยามสนธยา',
      desc: 'ยิ่งอายุมากยิ่งงามลึกซึ้ง ชายหนุ่มรุ่นหลังต่างต้องมนต์โดยไม่รู้ตัว',
      gender: 'female',
      minAge: 35,
      relates: ['limelight', 'charmer'],
      effects: { charm: 6, partnerAge: 8, marriagePull: 1.2 },
    },
    {
      id: 'ladyOfWill', label: 'สตรีผู้กุมบังเหียน',
      desc: 'เป็นฝ่ายกำหนดจังหวะในทุกความสัมพันธ์ ไม่เคยปล่อยให้ใครนำ',
      gender: 'female',
      relates: ['ironWill', 'radiantOne'],
      conflicts: ['tenderHeart'],
      effects: { charm: 4, power: 1.05, marriagePull: 1.15 },
    },
    {
      id: 'tenderHeart', label: 'ดวงใจที่ยอมโอนอ่อน',
      desc: 'สุขใจเมื่อได้ฝากชีวิตไว้กับผู้ที่ตนไว้วางใจ และเดินตามเขาโดยไม่ตั้งคำถาม',
      gender: 'female',
      relates: ['devoted'],
      conflicts: ['ladyOfWill'],
      effects: { charm: 3, fertility: 1.2, marriagePull: 1.1 },
    },
  ]);
})(typeof self !== 'undefined' ? self : this);
