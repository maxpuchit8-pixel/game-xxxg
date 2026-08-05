/**
 * =============================================================================
 * events/trait-female.js — เนื้อเรื่องที่ก่อ "คุณลักษณะติดตัว" ฝั่งสตรี
 * =============================================================================
 * อีเวนต์ในไฟล์นี้คือทางที่สตรีในตระกูลจะได้ trait จากการเลือกของผู้เล่นเอง
 * บางตัวได้ทันที บางตัวต้องเลือกแนวเดิมซ้ำหลายครั้งจึงติดเป็นนิสัยถาวร
 *
 * คู่มือการเขียนอีเวนต์อยู่หัวไฟล์ events/appearance.js
 * รายชื่อคุณลักษณะและผลของมันอยู่ใน js/trait/traits-*.js
 *
 * ของใหม่ที่ใช้ได้ในไฟล์หมวดนี้
 * ---------------------------------------------------------------------------
 *   when: { trait: 'id' | ['id', ...] }     ต้องมีคุณลักษณะนั้นก่อนจึงเจอเรื่องนี้
 *   when: { notTrait: 'id' | ['id', ...] }  ถ้ามีตัวนี้แล้วจะไม่เจอเรื่องนี้
 *
 *   effect: { trait: 'id', traitStory: 'ประโยคเล่าว่าทำอะไรจนได้มา' }
 *       ⟵ ได้คุณลักษณะทันที
 *   effect: { tally: { trait: 'id', need: 3, story: '...' } }
 *       ⟵ นับสะสม เลือกแนวนี้ครบ need ครั้งแล้วจึงเริ่มมีโอกาสติดเป็นนิสัย
 *          (ใส่ key เองได้ถ้าอยากให้หลายอีเวนต์นับรวมถังเดียวกัน)
 *
 *   when: { minDesire: 65 }  ⟵ หลอดความต้องการต้องถึงเท่านี้ก่อน (มี maxDesire ด้วย)
 *   effect: { desire: -60 }  ⟵ ลด/เพิ่มหลอดความต้องการ (ลบ = ได้ระบาย)
 * =============================================================================
 */
(function (root) {
  'use strict';

  root.EventTemplates = (root.EventTemplates || []).concat([

    /* ---- สะสม: ออกงานเป็นจุดสนใจ → ผู้ปรารถนาสายตา ---- */
    {
      id: 'traitF-limelight-gown',
      when: { gender: 'female', blood: true, minCharm: 45, maxAge: 45, notTrait: 'limelight' },
      traitAffinity: ['ardent', 'freeHeart', 'charmer'],
      places: ['งานเลี้ยงสภานคร', 'ลานแสงสีกลางนคร', 'งานประดับดาวประจำปี'],
      title: 'อาภรณ์สำหรับค่ำคืนของ{name}',
      text: 'ช่างตัดอาภรณ์นำแบบมาให้{name}เลือกก่อนงานที่{place} ' +
            'แบบหนึ่งสำรวมงามสง่า อีกแบบเปิดเผยเรือนร่างจนทุกสายตาต้องหันมา',
      options: [
        { label: 'เลือกแบบที่ทุกสายตาต้องหัน', value: 'bold', note: 'ชื่อเสียง +3 · ทำบ่อยเข้าจะติดเป็นนิสัย', tone: 'accept',
          effect: { rep: 3,
            tally: { key: 'display', trait: 'limelight', need: 3,
              story: 'ออกงานเป็นศูนย์กลางสายตาครั้งแล้วครั้งเล่า' },
            text: '{name}ก้าวเข้า{place}แล้วทั้งงานก็เงียบลงชั่วอึดใจ' } },
        { label: 'เลือกแบบสำรวม', value: 'modest', note: 'ชื่อเสียง +1', tone: 'decline',
          effect: { rep: 1, text: '{name}ไปงานที่{place}ด้วยอาภรณ์สำรวมอย่างผู้ดีเก่า' } },
      ],
    },

    /* ---- สะสม: เดินกลางนครยามค่ำ → ผู้ปรารถนาสายตา ---- */
    {
      id: 'traitF-limelight-walk',
      when: { gender: 'female', blood: true, minShape: 65, maxAge: 42, notTrait: 'limelight' },
      traitAffinity: ['ardent', 'freeHeart'],
      places: ['สะพานลอยฟ้าเขตกลาง', 'ตลาดแสงจันทร์ยามดึก'],
      title: '{name}กับค่ำคืนที่{place}',
      text: 'ค่ำนี้{name}ออกเดินเล่นที่{place}ตามลำพัง ลมเย็นและแสงไฟทำให้นางอยากทดสอบ ' +
            'ว่าสายตาที่ไล่ตามมาข้างหลังนั้นจะมากแค่ไหนหากเดินช้าลงอีกนิด',
      options: [
        { label: 'เดินช้าลงและปล่อยให้มองเต็มตา', value: 'slow', note: 'ทำบ่อยเข้าจะติดเป็นนิสัย', tone: 'accept',
          effect: {
            tally: { key: 'display', trait: 'limelight', need: 3,
              story: 'เพลิดเพลินกับสายตาที่ไล่ตามจนกลายเป็นความเคยชิน' },
            text: '{name}เดินผ่าน{place}อย่างเนิบช้า รู้ดีว่าทุกสายตาอยู่ที่นาง' } },
        { label: 'รีบกลับเรือน', value: 'home', note: 'ไม่มีอะไรเกิดขึ้น', tone: 'decline',
          effect: { text: '{name}เร่งฝีเท้ากลับเรือนโดยไม่เหลียวหลัง' } },
      ],
    },

    /* ---- ผู้ปรารถนาสายตา (1): อาภรณ์บางเบากลางค่ำคืน แล้วถูกทาบทามตรงๆ ----
       เลือกตอบรับได้ ระบายหลอด เกิดสัมพันธ์ลับ และอาจตั้งครรภ์กับคนแปลกหน้า */
    {
      id: 'traitF-night-stroll',
      when: { gender: 'female', blood: true, trait: 'limelight', maxAge: 45 },
      traitAffinity: ['limelight', 'radiantOne', 'ardent', 'freeHeart'],
      partner: 'stranger',
      places: ['ตรอกโคมแดงเขตล่าง', 'สะพานลอยฟ้าเขตกลาง', 'ตลาดแสงจันทร์ยามดึก'],
      title: 'ค่ำคืนบางเบาของ{name}ที่{place}',
      text: 'ดึกแล้วที่{place} {name}เลือกอาภรณ์บางเบาที่สุดเท่าที่กล้าใส่ออกจากเรือน ' +
            'ลมพัดผ่านผิวกายทุกก้าวจนหัวใจเต้นแรง แล้ว{stranger}ก็เดินเข้ามาถามตรงๆ ' +
            'ว่าค่ำคืนนี้จะไปต่อกันที่อื่นหรือไม่',
      options: [
        { label: 'ตอบรับคำชวนนั้น', value: 'yes', note: 'ได้ระบายเต็มที่ · เกิดความสัมพันธ์ลับ · อาจตั้งครรภ์',
          effect: { desire: -95, child: 'stranger', secret: true, rep: -2,
            tally: { key: 'display', trait: 'radiantOne', need: 2,
              story: 'ออกไปทดสอบสายตาผู้คนจนได้บทสรุปทุกครั้ง' },
            text: 'ไฟที่{place}ดับลงทีละดวง และไม่มีใครเห็น{name}กลับเรือนคืนนั้น' } },
        { label: 'ปฏิเสธแต่ยังเดินต่อ', value: 'tease', note: 'หลอดลดเล็กน้อย · ทำบ่อยเข้าจะติดเป็นนิสัย', tone: 'accept',
          effect: { desire: -25,
            tally: [
              { key: 'display', trait: 'radiantOne', need: 3,
                story: 'พอใจกับการเป็นสิ่งที่ผู้คนอยากได้แต่ไม่มีวันได้' },
              { key: 'bait', trait: 'temptress', need: 3,
                story: 'ล่อให้ผู้อื่นเอ่ยขอแล้วปฏิเสธจนกลายเป็นความเคยชิน' },
            ],
            text: '{name}ส่ายหน้าให้{stranger}แล้วเดินต่ออย่างช้าๆ รู้ดีว่าเขายังมองตามอยู่' } },
        { label: 'คลุมผ้ากลับเรือนทันที', value: 'home', note: 'ไม่มีอะไรเกิดขึ้น', tone: 'decline',
          effect: { text: '{name}ดึงผ้าคลุมขึ้นปิดไหล่แล้วเร่งฝีเท้ากลับจาก{place}' } },
      ],
    },

    /* ---- ผู้ปรารถนาสายตา (2): ถูกจับจ้องทั้งงานจนแทบทรงตัวไม่อยู่ ---- */
    {
      id: 'traitF-every-eye',
      when: { gender: 'female', blood: true, trait: 'limelight', minCharm: 55, maxAge: 48 },
      traitAffinity: ['limelight', 'radiantOne', 'ardent'],
      places: ['งานเลี้ยงสภานคร', 'ลานแสงสีกลางนคร', 'งานประดับดาวประจำปี'],
      title: 'ทุกสายตาใน{place}อยู่ที่{name}',
      text: 'อาภรณ์น้อยชิ้นของ{name}ทำให้ทั้ง{place}หันมามองพร้อมกัน ' +
            'ไม่มีใครกล้าเข้าใกล้ แต่ก็ไม่มีใครละสายตา — และนางรู้สึกถึงทุกสายตานั้น ' +
            'จนความรู้สึกท่วมท้นขึ้นมาเสียจนต้องยืนพิงเสาไว้ครู่หนึ่ง',
      options: [
        { label: 'ยืนรับสายตาเหล่านั้นจนถึงที่สุด', value: 'bask', note: 'ได้ระบาย · ชื่อเสียง +2 · ทำบ่อยเข้าจะติดเป็นนิสัย', tone: 'accept',
          effect: { desire: -55, rep: 2,
            tally: [
              { key: 'display', trait: 'radiantOne', need: 2,
                story: 'ค้นพบว่าเพียงถูกจับจ้องก็เพียงพอแล้วสำหรับนาง' },
              { key: 'bait', trait: 'temptress', need: 2,
                story: 'จงใจล่อสายตาทั้งงานแล้วพอใจกับผลที่ตามมา' },
            ],
            text: '{name}ยืนอยู่กลาง{place}จนดนตรีหยุด — ค่ำคืนนั้นเป็นของนางคนเดียว' } },
        { label: 'หลบไปตั้งสติที่ระเบียง', value: 'retreat', note: 'หลอดลดเล็กน้อย', tone: 'decline',
          effect: { desire: -20,
            text: '{name}หลบออกไประเบียงของ{place} กว่าจะกลับเข้างานได้ก็ครึ่งชั่วยาม' } },
      ],
    },

    /* ---- ผู้ปรารถนาสายตา (3): มีคนเอ่ยขออนุญาตตรงๆ แล้วนางเป็นผู้ตัดสิน ---- */
    {
      id: 'traitF-asked-permission',
      when: { gender: 'female', blood: true, trait: 'limelight', maxAge: 48 },
      traitAffinity: ['limelight', 'radiantOne', 'ardent', 'freeHeart'],
      partner: 'stranger',
      places: ['ระเบียงหลังงานเลี้ยงสภานคร', 'มุมมืดของลานแสงสีกลางนคร', 'ดาดฟ้าหอคอยใต้'],
      title: 'คำขอตรงๆ ของ{stranger}',
      text: 'อาภรณ์น้อยชิ้นของ{name}ทำให้{stranger}ตามมาจนถึง{place} ' +
            'แล้วเอ่ยขออนุญาตอย่างตรงไปตรงมาว่าขอสัมผัสเรือนร่างของนางสักครั้งได้หรือไม่ ' +
            'เขายืนรออยู่ตรงนั้นโดยไม่ขยับเข้ามาแม้แต่ก้าวเดียว — คำตอบอยู่ที่นางทั้งหมด',
      options: [
        { label: 'อนุญาต', value: 'allow', note: 'ได้ระบาย · ทำบ่อยเข้าจะติดเป็นนิสัย',
          effect: { desire: -60,
            tally: [
              { key: 'display', trait: 'radiantOne', need: 2,
                story: 'ยอมให้ผู้อื่นได้ในสิ่งที่ขอ แล้วพบว่าตนพอใจกับอำนาจนั้น' },
              { key: 'bait', trait: 'temptress', need: 2,
                story: 'ล่อให้ผู้อื่นเป็นฝ่ายเอ่ยขอครั้งแล้วครั้งเล่า' },
            ],
            text: '{name}พยักหน้าให้{stranger}ที่{place} — ไม่มีใครรู้ว่าเกิดอะไรขึ้นหลังจากนั้น' } },
        { label: 'ไม่อนุญาต แต่พอใจที่เขาต้องเอ่ยขอ', value: 'refuse', note: 'ชื่อเสียง +2 · ทำบ่อยเข้าจะติดเป็นนิสัย', tone: 'decline',
          effect: { rep: 2,
            tally: { key: 'bait', trait: 'temptress', need: 2,
              story: 'สนุกกับการเป็นผู้ตัดสินคำตอบมากกว่าตัวคำตอบเสียอีก' },
            text: '{name}ปฏิเสธ{stranger}อย่างเรียบๆ แล้วเดินกลับเข้างานโดยไม่หันไปมองอีก' } },
      ],
    },

    /* ---- ผู้ปรารถนาสายตา (4): กลางวงคนแน่น โดยนางเป็นฝ่ายส่งสัญญาณเอง ---- */
    {
      id: 'traitF-in-the-crowd',
      when: { gender: 'female', blood: true, trait: ['radiantOne', 'limelight'], minDesire: 55, maxAge: 45 },
      traitAffinity: ['radiantOne', 'limelight', 'ardent', 'freeHeart'],
      partner: 'stranger',
      places: ['วงเต้นรำกลางงานสภานคร', 'ลานมหรสพที่แน่นขนัด'],
      title: 'กลางวงคนแน่นที่{place}',
      text: 'ผู้คนเบียดเสียดกันจน{place}แทบไม่มีที่ขยับ อาภรณ์น้อยชิ้นของ{name}ทำให้ ' +
            '{stranger}ยืนใกล้เกินบังเอิญ เขาไม่ทำอะไรเลยนอกจากรอสัญญาณจากนาง ' +
            'และนางก็รู้ตัวว่ากำลังคิดจะส่งสัญญาณนั้นจริงๆ',
      options: [
        { label: 'ส่งสัญญาณให้เขา', value: 'signal', note: 'ได้ระบายเต็มที่ · อาจเกิดความสัมพันธ์ลับ',
          /* มี chance แล้วระบบจะใช้เฉพาะก้อน success/fail — ค่าอื่นต้องอยู่ในสองก้อนนั้น */
          effect: { chance: 0.5,
            success: { secret: true, desire: -90, rep: -1,
              tally: [
                { key: 'display', trait: 'radiantOne', need: 2,
                  story: 'ค้นพบว่าความลับกลางฝูงชนคือสิ่งที่นางโหยหา' },
                { key: 'bait', trait: 'temptress', need: 2,
                  story: 'ส่งสัญญาณให้ผู้อื่นเป็นฝ่ายเข้ามาจนกลายเป็นความเคยชิน' },
              ],
              text: 'ท่ามกลางผู้คนทั้ง{place} {name}ต้องกัดริมฝีปากไว้ไม่ให้เสียงใดหลุดออกมา — ไม่มีใครรอบตัวรู้อะไรเลย' },
            fail: { desire: -70,
              text: 'ดนตรีที่{place}เปลี่ยนจังหวะ ฝูงชนพัดพาทั้งสองแยกจากกันก่อนสิ่งใดจะเกิดขึ้น' } } },
        { label: 'เบียดตัวออกจากวง', value: 'leave', note: 'หลอดลดเล็กน้อย', tone: 'decline',
          effect: { desire: -22,
            text: '{name}เบียดตัวออกจากวงที่{place} แล้วยืนสงบสติอยู่ริมลานจนเพลงจบ' } },
      ],
    },

    /* ---- กลุ่มคนแปลกหน้า: วงสังสรรค์ที่นางเป็นฝ่ายเลือกเข้าไปเอง ----
       ทางเลือกสุดท้ายอาจตั้งครรภ์กับคนแปลกหน้าที่ไม่มีวันปรากฏในผังตระกูล */
    {
      id: 'traitF-circle-of-eyes',
      when: { gender: 'female', blood: true, trait: 'limelight', maxAge: 45 },
      traitAffinity: ['limelight', 'radiantOne', 'freeHeart', 'ardent'],
      partner: 'stranger',
      group: [3, 5],
      places: ['คฤหาสน์ลับเขตบน', 'ห้องสังสรรค์ชั้นดาดฟ้าหอคอยใต้'],
      title: 'วงสังสรรค์ที่{place}',
      text: 'มีผู้ส่งบัตรเชิญถึง{name}ให้ไปงานสังสรรค์วงปิดที่{place} ' +
            'ในวงมีชายแปลกหน้า {count} คน ({strangers}) ที่ล้วนมาเพื่อชมนางโดยเฉพาะ ' +
            'ทุกคนรู้กติกาดีว่าใครจะเข้าใกล้ได้แค่ไหน เจ้าตัวเป็นผู้กำหนดเองทั้งหมด',
      options: [
        { label: 'เข้าไปเป็นศูนย์กลางของวง', value: 'center', note: 'เครดิต +200 · ชื่อเสียง +2 · อาจกลายเป็นดอกไม้ที่ผู้คนหมายปอง', tone: 'accept',
          effect: { gold: 200, rep: 2, desire: -45,
            tally: { key: 'display', trait: 'radiantOne', need: 2,
              story: 'ยืนกลางวงสายตาจนรู้ตัวว่าชอบการเป็นที่ปรารถนา' },
            text: 'ทั้งวงที่{place}หมุนรอบ{name}ทั้งค่ำ และนางคุมจังหวะทุกอย่างไว้ในมือ' } },
        { label: 'เลือก{stranger}ไว้เป็นคนสุดท้ายของค่ำคืน', value: 'choose', note: 'ได้ระบายเต็มที่ · อาจตั้งครรภ์กับคนแปลกหน้า · ได้คุณลักษณะใหม่',
          effect: { desire: -95, child: 'stranger', rep: -1,
            trait: 'radiantOne', traitStory: 'ค้นพบว่าตนพอใจที่จะเป็นสิ่งที่ผู้คนปรารถนา',
            text: 'เมื่อวงที่{place}สลายไป {name}เหลือไว้เพียง{stranger}คนเดียว — ไม่มีใครรู้ว่าเกิดอะไรขึ้นหลังจากนั้น' } },
        { label: 'คุมระยะไว้แค่บทสนทนา', value: 'talk', note: 'ชื่อเสียง +3', tone: 'accept',
          effect: { rep: 3, text: '{name}สนทนากับทุกคนอย่างมีชั้นเชิงแล้วกลับเรือนก่อนดึก' } },
        { label: 'ฉีกบัตรเชิญทิ้ง', value: 'skip', note: 'ไม่ไปเสียเลย', tone: 'decline',
          effect: { text: '{name}ฉีกบัตรเชิญทิ้งโดยไม่คิดจะถามว่าใครเป็นผู้ส่ง' } },
      ],
    },

    /* ---- ยั่วยวนเป็นนิสัย: วางกับดักไว้แล้วรอให้อีกฝ่ายเดินเข้ามาเอง ---- */
    {
      id: 'traitF-set-the-bait',
      when: { gender: 'female', blood: true, trait: 'temptress', maxAge: 48 },
      traitAffinity: ['temptress', 'radiantOne', 'limelight', 'ardent'],
      partner: 'stranger',
      places: ['โรงน้ำชาเขตกลาง', 'งานเลี้ยงสภานคร', 'ตลาดแสงจันทร์'],
      title: '{name}วางกับดักไว้ที่{place}',
      text: '{name}เลือกที่นั่ง เลือกมุมแสง และเลือกจังหวะหันมองไว้หมดแล้วที่{place} ' +
            'อีกไม่นาน{stranger}ก็เดินเข้ามาเอ่ยปากตามที่นางคาดไว้ทุกประการ ' +
            'ส่วนที่นางไม่ได้วางแผนไว้คือคำตอบของตัวเอง',
      options: [
        { label: 'ตอบรับ', value: 'yes', note: 'ได้ระบายเต็มที่ · เกิดความสัมพันธ์ลับ',
          effect: { desire: -85, secret: true, rep: -1,
            text: '{name}ตอบรับ{stranger}ที่{place}ราวกับตัดสินใจไว้ตั้งแต่ก่อนเขาจะเอ่ย' } },
        { label: 'ปฏิเสธหลังปล่อยให้เขาพูดจนจบ', value: 'no', note: 'ชื่อเสียง +2 · หลอดลดเล็กน้อย', tone: 'decline',
          effect: { rep: 2, desire: -22,
            text: '{name}ฟัง{stranger}พูดจนจบแล้วส่ายหน้า — นางได้สิ่งที่ต้องการไปแล้วตั้งแต่เขาเอ่ยประโยคแรก' } },
      ],
    },

    /* ---- ยั่วยวนเป็นนิสัย: กับดักที่บานปลายเกินคาด ----
       ผลไม่ได้อยู่ในมือนางทั้งหมด แต่คำตัดสินสุดท้ายยังเป็นของนางเสมอ */
    {
      id: 'traitF-bait-backfire',
      when: { gender: 'female', blood: true, trait: 'temptress', minDesire: 55, maxAge: 48 },
      traitAffinity: ['temptress', 'radiantOne', 'ardent'],
      partner: 'stranger',
      group: [2, 3],
      places: ['โรงเตี๊ยมชายขอบนคร', 'ลานมหรสพที่แน่นขนัด'],
      title: 'กับดักของ{name}ได้ผลเกินคาด',
      text: 'ที่{place} {name}เล่นบทเดิมที่เคยได้ผลมาตลอด แต่คราวนี้มีถึง {count} คน ' +
            '({strangers}) เดินเข้ามาพร้อมกัน ทุกคนพูดจาสุภาพ แต่ก็ไม่มีใครยอมถอยให้ใคร ' +
            'เป็นครั้งแรกที่นางรู้สึกว่าจังหวะไม่ได้อยู่ในมือตัวเองทั้งหมด',
      options: [
        { label: 'เลือก{stranger}แล้วให้ที่เหลือกลับไป', value: 'pick', note: 'ได้ระบาย · เกิดความสัมพันธ์ลับ · กลับมาคุมเกมได้',
          effect: { desire: -80, secret: true,
            text: '{name}ชี้ไปที่{stranger}เพียงคนเดียว ที่เหลือที่{place}ก็แยกย้ายไปโดยไม่มีใครกล้าโต้' } },
        { label: 'ถอนตัวออกมาก่อนเรื่องจะเกินคุม', value: 'out', note: 'ชื่อเสียง +1 · เข็ดจนอาจเปลี่ยนนิสัย', tone: 'decline',
          effect: { rep: 1, desire: -25,
            tally: { key: 'restrain', trait: 'ascetic', need: 4,
              story: 'เจอกับดักของตัวเองย้อนกลับมาจนเรียนรู้ที่จะข่มใจ' },
            text: '{name}เดินออกจาก{place}กลางวงสนทนา — คืนนั้นนางนอนคิดอยู่นานว่าเกือบเกินเลยไปแค่ไหน' } },
        { label: 'เรียกคนของตระกูลมารับ', value: 'guard', note: 'ปลอดภัยไว้ก่อน · ชื่อเสียง +2', tone: 'decline',
          effect: { rep: 2, desire: -15,
            text: 'คนของตระกูลมาถึง{place}ในไม่ช้า วงที่ล้อม{name}อยู่ก็สลายไปเงียบๆ' } },
      ],
    },

    /* ---- ได้ทันที: สตรีผู้กุมบังเหียน / ดวงใจที่ยอมโอนอ่อน ---- */
    {
      id: 'traitF-who-leads',
      when: { gender: 'female', blood: true, hasSpouse: true, notTrait: ['ladyOfWill', 'tenderHeart'] },
      places: ['เรือนใหญ่ประจำตระกูล', 'ห้องว่าราชการของตระกูล'],
      title: 'ใครกันที่กุมบังเหียนเรือนนี้',
      text: 'เรื่องใหญ่ของตระกูลมาถึงทางแยก {name}กับคู่ครองเห็นไม่ตรงกันที่{place} ' +
            'ค่ำนี้จะรู้กันว่าใครเป็นผู้ตัดสินใจสุดท้ายในเรือนนี้',
      options: [
        { label: 'ยืนยันตามความคิดตน', value: 'lead', note: 'ได้คุณลักษณะ สตรีผู้กุมบังเหียน', tone: 'accept',
          effect: { trait: 'ladyOfWill', traitStory: 'ยืนหยัดจนคนทั้งเรือนยอมเดินตาม',
            rep: 2, text: 'นับแต่ค่ำนั้นที่{place} ไม่มีใครในเรือนขัดคำของ{name}อีก' } },
        { label: 'ฝากการตัดสินใจไว้กับคู่ครอง', value: 'yield', note: 'ได้คุณลักษณะ ดวงใจที่ยอมโอนอ่อน', tone: 'decline',
          effect: { trait: 'tenderHeart', traitStory: 'มอบการตัดสินใจให้ผู้ที่ตนไว้วางใจ',
            rep: 1, text: '{name}วางเรื่องทั้งหมดไว้ในมือคู่ครอง แล้วนอนหลับสบายเป็นครั้งแรกในรอบเดือน' } },
      ],
    },

    /* ---- ได้ทันที: กุหลาบยามสนธยา (เสน่ห์ของผู้อาวุโส) ---- */
    {
      id: 'traitF-evening-rose',
      when: { gender: 'female', blood: true, minAge: 36, minCharm: 55, notTrait: 'eveningRose' },
      traitAffinity: ['limelight', 'charmer', 'ardent'],
      partner: 'stranger',
      places: ['หอทัศนาเขตเหนือ', 'โรงน้ำชาเขตกลาง'],
      title: 'ชายหนุ่มรุ่นหลังต้องมนต์{name}',
      text: 'ที่{place} ชายหนุ่มนาม{stranger}ที่อ่อนวัยกว่ามากเอ่ยชม{name}อย่างจริงใจ ' +
            'ว่าความงามที่กาลเวลาขัดเกลามาแล้วนั้นหาไม่ได้จากหญิงสาวรุ่นเดียวกับเขา',
      options: [
        { label: 'รับคำชมนั้นไว้อย่างภาคภูมิ', value: 'accept', note: 'ได้คุณลักษณะ กุหลาบยามสนธยา', tone: 'accept',
          effect: { trait: 'eveningRose', traitStory: 'ค้นพบว่าวัยที่ผ่านมากลับทำให้ตนงามขึ้น',
            rep: 2, text: '{name}เดินออกจาก{place}ด้วยแววตาที่ไม่เคยมีมาก่อนตั้งแต่ยังสาว' } },
        { label: 'หัวเราะแล้วบอกว่าแก่เกินไปแล้ว', value: 'skip', note: 'ไม่มีอะไรเกิดขึ้น', tone: 'decline',
          effect: { text: '{name}หัวเราะใส่{stranger}แล้วบอกให้ไปหาคนรุ่นเดียวกันเสีย' } },
      ],
    },

    /* ---- หลอดเต็ม + มีคู่ครอง: จะบอกความต้องการของตนตรงๆ ไหม ---- */
    {
      id: 'traitF-restless-night',
      when: { gender: 'female', blood: true, hasSpouse: true, minDesire: 70, maxAge: 60 },
      traitAffinity: ['ardent', 'limelight', 'radiantOne'],
      places: ['เรือนใหญ่ประจำตระกูล', 'หอชมจันทร์ประจำตระกูล'],
      title: 'ค่ำคืนที่{name}ข่มใจไม่ลง',
      text: 'หลายคืนแล้วที่{name}นอนตาค้างอยู่ที่{place} คู่ครองหลับสนิทอยู่ข้างกาย ' +
            'ความร้อนรุ่มในกายไม่ยอมสงบลงง่ายๆ อีกต่อไป',
      options: [
        { label: 'ปลุกคู่ครองแล้วบอกตรงๆ', value: 'ask', note: 'ได้ระบาย · หลอดลดลงมาก', tone: 'accept',
          effect: { desire: -70, rep: 1,
            text: 'คืนนั้นที่{place}ไม่มีใครในเรือนได้ยินอะไร แต่{name}หลับสบายที่สุดในรอบเดือน' } },
        { label: 'ข่มใจไว้เงียบๆ', value: 'endure', note: 'หลอดลดเล็กน้อย · เก็บกดไว้อาจเปลี่ยนใจคนได้', tone: 'decline',
          effect: { desire: -20,
            tally: { key: 'endure', trait: 'ardent', need: 3,
              story: 'เก็บงำความร้อนรุ่มไว้จนกลายเป็นไฟที่ไม่มีวันมอด' },
            text: '{name}นอนมองเพดานที่{place}จนฟ้าสาง โดยไม่ปลุกใครทั้งนั้น' } },
      ],
    },

    /* ---- หลอดเต็ม + ไม่มีคู่: หาทางออกด้วยตนเอง ---- */
    {
      id: 'traitF-longing',
      when: { gender: 'female', blood: true, hasSpouse: false, minDesire: 70, maxAge: 55 },
      traitAffinity: ['ardent', 'freeHeart', 'limelight'],
      partner: 'stranger',
      places: ['ตลาดแสงจันทร์', 'สวนลอยเขตตะวันออก', 'โรงน้ำชาเขตกลาง'],
      title: 'ความว้าวุ่นของ{name}ที่{place}',
      text: '{name}ยังไร้คู่ครอง แต่ร่างกายไม่เคยรอใคร ที่{place}วันนี้ ' +
            '{stranger}จ้องมองนางไม่วางตา และนางก็รู้ตัวดีว่ากำลังจ้องกลับ',
      options: [
        { label: 'เดินเข้าไปคุยด้วย', value: 'go', note: 'ได้ระบาย · อาจเกิดความสัมพันธ์ลับ', tone: 'accept',
          effect: { desire: -65, secret: true,
            text: '{name}กับ{stranger}หายไปจาก{place}ด้วยกัน และกลับมาคนละทางตอนฟ้าสาง' } },
        { label: 'กลับเรือนไปฝึกยุทธ์แทน', value: 'train', note: 'หลอดลดเล็กน้อย · อาจกลายเป็นผู้ถือกายเป็นวิหาร', tone: 'decline',
          effect: { desire: -30,
            tally: { key: 'restrain', trait: 'ascetic', need: 3,
              story: 'ฝึกข่มใจครั้งแล้วครั้งเล่าจนความต้องการไม่รบกวนอีก' },
            text: '{name}กลับเรือนไปฝึกยุทธ์จนเหนื่อยหลับไปเอง' } },
      ],
    },

    /* ---- ได้ทันที: รักเดียวใจเดียว (ทางเลือกตรงข้ามของสายหลายใจ) ---- */
    {
      id: 'traitF-one-heart',
      when: { gender: 'female', blood: true, hasSpouse: true, minAge: 22, notTrait: ['onlyOne', 'freeHeart'] },
      partner: 'stranger',
      places: ['ท่าเรือเหาะเขตตะวันตก', 'สวนลอยเขตตะวันออก'],
      title: 'คำชวนที่{name}ต้องเลือก',
      text: '{stranger}ผู้มั่งคั่งเสนอจะพา{name}ออกจาก{place}ไปเริ่มชีวิตใหม่ในนครอื่น ' +
            'พร้อมทรัพย์สินที่ทั้งตระกูลรวมกันยังเทียบไม่ได้',
      options: [
        { label: 'ปฏิเสธและกลับไปหาคู่ครอง', value: 'refuse', note: 'ได้คุณลักษณะ รักเดียวใจเดียว', tone: 'accept',
          effect: { trait: 'onlyOne', traitStory: 'ปฏิเสธข้อเสนอที่คนทั้งนครยังต้องคิดหนัก',
            rep: 5, text: '{name}เดินกลับเรือนโดยไม่หันไปมอง{stranger}อีกเลย' } },
        { label: 'ตอบรับคำชวน', value: 'accept', note: 'เครดิต +600 · ชื่อเสียง -6 · เกิดความสัมพันธ์ลับ',
          effect: { gold: 600, rep: -6, secret: true,
            text: '{name}หายไปจาก{place}หลายวัน กลับมาพร้อมทรัพย์สินที่ไม่มีใครกล้าถามที่มา' } },
      ],
    },
  ]);
})(typeof self !== 'undefined' ? self : this);
