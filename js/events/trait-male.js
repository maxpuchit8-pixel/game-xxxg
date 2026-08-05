/**
 * =============================================================================
 * events/trait-male.js — เนื้อเรื่องที่ก่อ "คุณลักษณะติดตัว" ฝั่งบุรุษ
 * =============================================================================
 * อีเวนต์ในไฟล์นี้คือทางที่บุรุษในตระกูลจะได้ trait จากการเลือกของผู้เล่นเอง
 * บางตัวได้ทันที บางตัวต้องเลือกแนวเดิมซ้ำหลายครั้งจึงติดเป็นนิสัยถาวร
 *
 * คู่มือการเขียนอีเวนต์อยู่หัวไฟล์ events/appearance.js
 * ของใหม่ (when.trait / when.notTrait / effect.trait / effect.tally)
 * อธิบายไว้หัวไฟล์ events/trait-female.js
 * =============================================================================
 */
(function (root) {
  'use strict';

  root.EventTemplates = (root.EventTemplates || []).concat([

    /* ---- สะสม: ไล่ตามดอกไม้ไปเรื่อย → ภมรเร่ร่อน ---- */
    {
      id: 'traitM-wandering',
      when: { gender: 'male', blood: true, minCharm: 45, maxAge: 50, notTrait: ['wanderingBee', 'onlyOne'] },
      traitAffinity: ['charmer', 'freeHeart', 'ardent'],
      partner: 'stranger',
      places: ['โรงน้ำชาเขตกลาง', 'ตลาดแสงจันทร์', 'ลานแสงสีกลางนคร'],
      title: 'ค่ำนี้{name}พบ{stranger}อีกคน',
      text: 'ที่{place} {name}พบหญิงงามนาม{stranger} คำหวานที่เคยใช้ได้ผลมาแล้วหลายครั้ง ' +
            'ยังคาอยู่ที่ปลายลิ้น จะเอ่ยออกไปอีกสักครั้งหรือไม่',
      options: [
        { label: 'เอ่ยคำหวานนั้นอีกครั้ง', value: 'flirt', note: 'ชื่อเสียง +1 · ทำบ่อยเข้าจะติดเป็นนิสัย', tone: 'accept',
          effect: { rep: 1,
            tally: { key: 'flirt', trait: 'wanderingBee', need: 3,
              story: 'ไล่ตามดอกไม้ดอกแล้วดอกเล่าจนไม่คิดจะหยุด' },
            text: '{name}กับ{stranger}หายไปจาก{place}ด้วยกันก่อนงานเลิกเสียอีก' } },
        { label: 'ยิ้มแล้วเดินผ่านไป', value: 'skip', note: 'ไม่มีอะไรเกิดขึ้น', tone: 'decline',
          effect: { text: '{name}ยิ้มให้{stranger}แล้วเดินผ่านไปโดยไม่หยุด' } },
      ],
    },

    /* ---- สะสม: ปกป้องคนในตระกูล → ผู้พิทักษ์เรือน ---- */
    {
      id: 'traitM-guard',
      when: { gender: 'male', blood: true, minAge: 20, notTrait: 'ironGuard' },
      places: ['ประตูใหญ่ของเรือน', 'ตรอกมืดเขตตลาดล่าง', 'ท่าเรือเหาะเขตตะวันตก'],
      title: 'เงามืดที่{place}',
      text: 'มีคนแปลกหน้าติดตามคนในตระกูลมาถึง{place} {name}เห็นเข้าพอดี ' +
            'จะเข้าไปจัดการเองหรือแจ้งกองยุทธ์นครแล้วรอ',
      options: [
        { label: 'เข้าไปจัดการด้วยตนเอง', value: 'act', note: 'ชื่อเสียง +4 · ทำบ่อยเข้าจะติดเป็นนิสัย', tone: 'accept',
          effect: { rep: 4,
            tally: { key: 'guard', trait: 'ironGuard', need: 3,
              story: 'ยืนขวางหน้าคนในตระกูลมานับครั้งไม่ถ้วน' },
            text: '{name}จัดการเรื่องที่{place}จบในคืนเดียว ไม่มีใครในเรือนรู้ด้วยซ้ำ' } },
        { label: 'แจ้งกองยุทธ์นคร', value: 'report', note: 'ชื่อเสียง +1 ปลอดภัยไว้ก่อน', tone: 'decline',
          effect: { rep: 1, text: 'กองยุทธ์นครมาถึง{place}ในเช้าวันรุ่งขึ้น เงานั้นหายไปแล้ว' } },
      ],
    },

    /* ---- ได้ทันที: ผู้ช่วงชิงดวงใจ (เล็งคนที่มีคู่แล้ว) ---- */
    {
      id: 'traitM-heart-thief',
      when: { gender: 'male', blood: true, minCharm: 60, maxAge: 50, notTrait: ['heartThief', 'onlyOne', 'devoted'] },
      traitAffinity: ['wanderingBee', 'freeHeart', 'ardent'],
      partner: 'inlaw',
      places: ['งานเลี้ยงสภานคร', 'ระเบียงชมดาวของตระกูล'],
      title: '{name}กับ{partner}ที่{place}',
      text: '{partner}สะใภ้ของตระกูลมองมาที่{name}นานเกินกว่าจะเป็นความบังเอิญ ' +
            'ทั้งคู่รู้ดีว่านางมีคู่ครองแล้ว และนั่นเองที่ทำให้ค่ำคืนนี้เย้ายวนเป็นพิเศษ',
      options: [
        { label: 'ถอยห่างเสียแต่ต้นลม', value: 'walk', note: 'ชื่อเสียง +3', tone: 'decline',
          effect: { rep: 3, text: '{name}ขอตัวออกจาก{place}ก่อนที่สายตาคู่นั้นจะพาไปไกลกว่านี้' } },
        { label: 'ตอบสายตานั้นกลับไป', value: 'take', note: 'ได้คุณลักษณะ ผู้ช่วงชิงดวงใจ · เกิดความสัมพันธ์ลับ',
          effect: { trait: 'heartThief', traitStory: 'ค้นพบว่าตนพอใจกับการเอาชนะใจคนที่มีเจ้าของแล้ว',
            secretWithPartner: true, rep: -2,
            text: 'ที่{place}คืนนั้น {name}กับ{partner}เดินออกไปคนละทางแต่ถึงที่หมายเดียวกัน' } },
      ],
    },

    /* ---- ได้ทันที: เปิดใจให้คู่ตน หรือ หวงแหนดั่งสมบัติ ---- */
    {
      id: 'traitM-open-or-hold',
      when: { gender: 'male', blood: true, hasSpouse: true, minAge: 22, notTrait: ['openHeart', 'possessive'] },
      places: ['หอชมจันทร์ประจำตระกูล', 'สวนหลังเรือนใหญ่'],
      title: 'สายตาที่จับจ้องคู่ครองของ{name}',
      text: 'ในงานที่{place} {name}เห็นชายอื่นรุมล้อมคู่ครองของตนไม่ห่าง ' +
            'และเห็นด้วยว่านางเปล่งประกายกว่าครั้งไหนๆ เมื่ออยู่ท่ามกลางสายตาเหล่านั้น',
      options: [
        { label: 'พาคู่ครองออกจากวงทันที', value: 'hold', note: 'ได้คุณลักษณะ หวงแหนดั่งสมบัติ', tone: 'accept',
          effect: { trait: 'possessive', traitStory: 'ประกาศให้ทั้งงานรู้ว่าใครเป็นเจ้าของหัวใจนาง',
            text: '{name}คล้องแขนคู่ครองออกจาก{place}ต่อหน้าทุกคนอย่างไม่ต้องอธิบาย' } },
        { label: 'ยืนมองอยู่ห่างๆ อย่างพอใจ', value: 'open', note: 'ได้คุณลักษณะ เปิดใจให้คู่ตน',
          effect: { trait: 'openHeart', traitStory: 'ยอมรับได้ว่าหัวใจคนกักขังไว้ไม่ได้',
            text: '{name}ยกจอกดื่มอยู่มุมหนึ่งของ{place} แล้วปล่อยให้ค่ำคืนของนางเป็นของนาง' } },
      ],
    },

    /* ---- ได้ทันที: จันทร์ดวงหลัง (ต้องมนต์ผู้อาวุโสกว่า) ---- */
    {
      id: 'traitM-younger-moon',
      when: { gender: 'male', blood: true, minAge: 18, maxAge: 30, hasSpouse: false, notTrait: 'youngerMoon' },
      partner: 'stranger',
      places: ['หอสมุดกลางนคร', 'โรงน้ำชาเขตกลาง'],
      title: 'สตรีผู้อาวุโสที่{place}',
      text: 'ที่{place} {name}พบ{stranger} สตรีที่อาวุโสกว่ามากแต่สง่างามจนละสายตาไม่ได้ ' +
            'นางเอ่ยชวนสนทนาก่อนด้วยน้ำเสียงที่ไม่มีหญิงรุ่นเดียวกับเขาคนใดทำได้',
      options: [
        { label: 'นั่งลงสนทนาด้วย', value: 'stay', note: 'ได้คุณลักษณะ จันทร์ดวงหลัง', tone: 'accept',
          effect: { trait: 'youngerMoon', traitStory: 'ค้นพบว่าตนต้องมนต์สตรีที่อาวุโสกว่า',
            text: '{name}นั่งฟัง{stranger}เล่าเรื่องเก่าที่{place}จนร้านปิด' } },
        { label: 'โค้งคำนับแล้วขอตัว', value: 'skip', note: 'ไม่มีอะไรเกิดขึ้น', tone: 'decline',
          effect: { text: '{name}โค้งคำนับ{stranger}อย่างสุภาพแล้วเดินจากไป' } },
      ],
    },

    /* ---- หลอดเต็ม + มีคู่ครอง ---- */
    {
      id: 'traitM-restless-night',
      when: { gender: 'male', blood: true, hasSpouse: true, minDesire: 70, maxAge: 65 },
      traitAffinity: ['ardent', 'wanderingBee'],
      places: ['เรือนใหญ่ประจำตระกูล', 'ลานยุทธ์หลังเรือนใหญ่'],
      title: 'ค่ำคืนที่{name}ข่มใจไม่ลง',
      text: 'ความร้อนรุ่มในกายของ{name}ไม่ยอมสงบมาหลายคืนแล้ว ' +
            'คู่ครองหลับสนิทอยู่ในเรือน ส่วนเขาออกมายืนอยู่ที่{place}ตามลำพัง',
      options: [
        { label: 'กลับเข้าเรือนไปหาคู่ครอง', value: 'ask', note: 'ได้ระบาย · หลอดลดลงมาก', tone: 'accept',
          effect: { desire: -70, rep: 1,
            text: '{name}กลับเข้าเรือนก่อนฟ้าสาง และไม่ได้ออกมาที่{place}อีกเลยคืนนั้น' } },
        { label: 'ฝึกยุทธ์จนหมดแรง', value: 'train', note: 'หลอดลดเล็กน้อย · อาจกลายเป็นผู้ถือกายเป็นวิหาร', tone: 'decline',
          effect: { desire: -28,
            tally: { key: 'restrain', trait: 'ascetic', need: 3,
              story: 'ฝึกข่มใจครั้งแล้วครั้งเล่าจนความต้องการไม่รบกวนอีก' },
            text: '{name}ฝึกยุทธ์ที่{place}จนฟ้าสาง เหงื่อท่วมตัวและใจสงบลงในที่สุด' } },
      ],
    },

    /* ---- หลอดเต็ม + ไม่มีคู่ ---- */
    {
      id: 'traitM-longing',
      when: { gender: 'male', blood: true, hasSpouse: false, minDesire: 70, maxAge: 60 },
      traitAffinity: ['ardent', 'wanderingBee', 'freeHeart'],
      partner: 'stranger',
      places: ['โรงเตี๊ยมชายขอบนคร', 'ตลาดแสงจันทร์', 'ท่าเรือเหาะเขตตะวันตก'],
      title: 'ความว้าวุ่นของ{name}ที่{place}',
      text: '{name}ยังไร้คู่ครอง คืนนี้ที่{place} {stranger}เข้ามานั่งใกล้เกินกว่าจะเป็นความบังเอิญ ' +
            'และเขาก็รู้ตัวว่าไม่อยากขยับหนี',
      options: [
        { label: 'ตอบรับค่ำคืนนั้น', value: 'go', note: 'ได้ระบาย · อาจเกิดความสัมพันธ์ลับ', tone: 'accept',
          effect: { desire: -65, secret: true,
            text: '{name}ไม่ได้กลับเรือนคืนนั้น และไม่มีใครที่{place}เอ่ยถามสักคำ' } },
        { label: 'วางเงินค่าเหล้าแล้วเดินกลับ', value: 'leave', note: 'หลอดลดเล็กน้อย', tone: 'decline',
          effect: { desire: -30,
            tally: { key: 'restrain', trait: 'ascetic', need: 3,
              story: 'ปฏิเสธค่ำคืนเช่นนี้มานับครั้งไม่ถ้วน' },
            text: '{name}วางเงินไว้บนโต๊ะที่{place}แล้วเดินกลับเรือนคนเดียว' } },
      ],
    },

    /* ---- ได้ทันที: ภักดีต่อคู่ตน ---- */
    {
      id: 'traitM-devoted',
      when: { gender: 'male', blood: true, hasSpouse: true, minCharm: 50, notTrait: ['devoted', 'wanderingBee'] },
      partner: 'stranger',
      places: ['งานประดับดาวประจำปี', 'มหรสพประลองพลัง'],
      title: 'คำเชิญที่{name}ต้องปฏิเสธหรือรับ',
      text: '{stranger}เอ่ยชวน{name}ไปต่อกันสองคนหลังงานที่{place}เลิก ' +
            'ไม่มีใครในตระกูลรู้เรื่องนี้ และคงไม่มีวันรู้ด้วย',
      options: [
        { label: 'กลับเรือนไปหาคู่ครอง', value: 'home', note: 'ได้คุณลักษณะ ภักดีต่อคู่ตน', tone: 'accept',
          effect: { trait: 'devoted', traitStory: 'ปฏิเสธคำชวนที่ไม่มีใครรู้ว่าเคยมี',
            rep: 2, text: '{name}กลับถึงเรือนก่อนเที่ยงคืน และไม่เคยเล่าเรื่องคืนนั้นให้ใครฟัง' } },
        { label: 'ตอบรับคำชวน', value: 'go', note: 'เกิดความสัมพันธ์ลับ',
          effect: { secret: true, rep: -2,
            text: 'คืนนั้น{name}ไม่ได้กลับเรือน และ{place}ก็เงียบเกินกว่าจะมีใครสังเกต' } },
      ],
    },
  ]);
})(typeof self !== 'undefined' ? self : this);
