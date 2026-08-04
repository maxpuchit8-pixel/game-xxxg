/**
 * =============================================================================
 * tree-layout.js — คำนวณตำแหน่งของทุกการ์ดในผังตระกูล
 * =============================================================================
 * เป็นคณิตศาสตร์ล้วน ไม่แตะ DOM ไม่วัดอะไรจากเบราว์เซอร์เลย
 *
 * ทำไมต้องคำนวณเอง
 * ----------------
 * เวอร์ชันก่อนหน้าปล่อยให้ flexbox จัดตำแหน่งการ์ด แล้วค่อยวัดด้วย
 * getBoundingClientRect เพื่อเอาพิกัดไปวาดเส้น ซึ่งพังซ้ำๆ เพราะมีหลายอย่าง
 * มาแทรกระหว่างทางได้: flex item ยุบตัวบนจอแคบจนการ์ดเหลือ 74px จาก 134px,
 * ฟอนต์โหลดช้าแล้วความสูงขยับ, การปัดพิกเซลตอนย่อด้วย scale()
 *
 * พอคำนวณเองทั้งหมด การ์ดกับเส้นมาจากตัวเลขชุดเดียวกัน จึงตรงกันเสมอ
 * ไม่ว่าจอจะกว้างแค่ไหน ย่อเท่าไร หรือฟอนต์จะโหลดเสร็จตอนไหน
 *
 * วิธีคิด (ล่างขึ้นบน)
 * -------------------
 * 1. วัดความกว้างที่แต่ละกิ่งต้องใช้ = max(ความกว้างคู่สมรส, ความกว้างลูกทั้งแถว)
 * 2. วางลูกเรียงกันให้อยู่กึ่งกลางกิ่ง แล้ววางคู่พ่อแม่กึ่งกลางกิ่งเช่นกัน
 *    ทั้งสองจึงมีจุดกึ่งกลางตรงกันเป๊ะ เส้นตั้งจึงไม่มีทางเยื้อง
 * =============================================================================
 */
(function (root) {
  'use strict';

  /* ขนาดคงที่ทั้งหมด — การ์ดสูงเท่ากันหมดโดยตั้งใจ เพื่อให้แต่ละรุ่นอยู่ระดับ
     เดียวกันและเส้นนอนพาดตรง ไม่ต้องเผื่อว่าการ์ดใบไหนจะสูงกว่าใบอื่น */
  const M = {
    CARD_W: 134,
    CARD_H: 206,
    KNOT_W: 22,    // ช่องว่างระหว่างคู่สมรส (ที่วางปมเส้น)
    H_GAP: 22,     // ช่องว่างระหว่างพี่น้อง
    V_GAP: 52,     // ช่องว่างแนวตั้งระหว่างรุ่น (ที่วางเส้นเชื่อม)
    PAD: 20,       // ขอบรอบผัง
  };

  function coupleWidth(node) {
    return node.spouse ? M.CARD_W * 2 + M.KNOT_W : M.CARD_W;
  }

  /**
   * ขั้นที่ 1 — วัดความกว้างที่แต่ละกิ่งต้องใช้ (เรียกซ้ำจากล่างขึ้นบน)
   * คืนโครงเดิมพร้อมฟิลด์ w (ความกว้างกิ่ง) และ kidsW (ความกว้างแถวลูก)
   */
  function measure(unit) {
    const kids = unit.children.map(measure);
    const kidsW = kids.length
      ? kids.reduce((s, k) => s + k.w, 0) + M.H_GAP * (kids.length - 1)
      : 0;
    const cw = coupleWidth(unit);
    return {
      person: unit.person,
      spouse: unit.spouse,
      kids,
      coupleW: cw,
      kidsW,
      w: Math.max(cw, kidsW),
    };
  }

  /**
   * ขั้นที่ 2 — กำหนดพิกัดจริง (เรียกซ้ำจากบนลงล่าง)
   * left/top คือมุมซ้ายบนของกิ่งนี้
   */
  function place(node, left, top) {
    node.top = top;
    node.coupleX = left + (node.w - node.coupleW) / 2;  // คู่สมรสอยู่กึ่งกลางกิ่ง
    node.bottom = top + M.CARD_H;

    // การ์ดของเจ้าตัวและคู่ครอง
    node.personX = node.coupleX;
    node.spouseX = node.spouse ? node.coupleX + M.CARD_W + M.KNOT_W : null;

    /* จุดต่อเส้นมีสองแบบ และต้องแยกกันให้ชัด
     * cx      — กึ่งกลางกล่องคู่ ใช้เป็นจุด "ออก" ของเส้นที่ลงไปหาลูก
     *           เพราะลูกเป็นของทั้งคู่
     * bloodCx — กึ่งกลางการ์ดของคนที่เป็นสายเลือด ใช้เป็นจุด "เข้า" ของเส้น
     *           ที่ลงมาจากพ่อแม่ เส้นจึงชี้ตรงไปที่ตัวลูกจริงๆ
     *           ถ้าใช้ cx เป็นจุดเข้าด้วย เส้นจะไปจ่อกลางระหว่างสองคน
     *           แล้วดูไม่ออกว่าใครเป็นลูกใครแต่งเข้ามา */
    node.cx = node.coupleX + node.coupleW / 2;
    node.bloodCx = node.personX + M.CARD_W / 2;

    // วางลูกเรียงกันให้แถวลูกอยู่กึ่งกลางกิ่งเช่นกัน
    let x = left + (node.w - node.kidsW) / 2;
    const kidTop = top + M.CARD_H + M.V_GAP;
    node.kids.forEach((k) => {
      place(k, x, kidTop);
      x += k.w + M.H_GAP;
    });
  }

  /**
   * คำนวณผังทั้งหมดจากโครงต้นไม้ของ lineage.buildTree()
   * คืน { nodes, links, width, height }
   *   nodes — รายการการ์ดพร้อมพิกัด { person, x, y, isSpouse }
   *   knots — ปมเส้นระหว่างคู่สมรส { x, y }
   *   links — เส้นเชื่อม { x1, y1, x2, y2 }
   */
  function layout(tree) {
    const roots = tree.map(measure);

    let x = M.PAD;
    roots.forEach((r) => { place(r, x, M.PAD); x += r.w + M.H_GAP; });

    const nodes = [];
    const knots = [];
    const links = [];
    let maxRight = 0, maxBottom = 0;

    const posOf = {};   // id -> จุดกึ่งกลางการ์ด ใช้วาดเส้นความสัมพันธ์ลับ

    function walk(node) {
      nodes.push({ person: node.person, x: node.personX, y: node.top });
      posOf[node.person.id] = { x: node.bloodCx, y: node.top + M.CARD_H / 2 };
      maxRight = Math.max(maxRight, node.personX + M.CARD_W);
      maxBottom = Math.max(maxBottom, node.bottom);

      if (node.spouse) {
        nodes.push({ person: node.spouse, x: node.spouseX, y: node.top });
        posOf[node.spouse.id] = { x: node.spouseX + M.CARD_W / 2, y: node.top + M.CARD_H / 2 };
        knots.push({ x: node.coupleX + M.CARD_W, y: node.top + M.CARD_H / 2 });
        maxRight = Math.max(maxRight, node.spouseX + M.CARD_W);
      }

      if (!node.kids.length) return;

      const midY = node.bottom + M.V_GAP / 2;
      // เส้นตั้ง "ออก" จากกึ่งกลางคู่พ่อแม่ลงมาถึงระดับกลาง
      links.push({ x1: node.cx, y1: node.bottom, x2: node.cx, y2: midY });

      // เส้นนอน — คลุมทั้งลูกทุกคนและจุดของพ่อแม่
      // ถ้าไม่คลุมจุดพ่อแม่ด้วย กรณีลูกคนเดียวที่แต่งงานแล้ว (กิ่งกว้างขึ้น
      // จนกึ่งกลางเยื้อง) เส้นตั้งสองท่อนจะอยู่คนละแกนและลอยห่างกัน
      const xs = node.kids.map((k) => k.bloodCx).concat([node.cx]);
      const minX = Math.min.apply(null, xs);
      const maxX = Math.max.apply(null, xs);
      if (maxX - minX > 0.5) {
        links.push({ x1: minX, y1: midY, x2: maxX, y2: midY });
      }

      // เส้นตั้ง "เข้า" ที่การ์ดของลูกสายเลือดโดยตรง ไม่ใช่กึ่งกลางกล่องคู่
      node.kids.forEach((k) => {
        links.push({ x1: k.bloodCx, y1: midY, x2: k.bloodCx, y2: k.top });
        walk(k);
      });
    }

    roots.forEach(walk);

    return {
      nodes, knots, links, posOf,
      width: maxRight + M.PAD,
      height: maxBottom + M.PAD,
      metrics: M,
    };
  }

  /**
   * เส้นความสัมพันธ์ลับ — ลากตรงจากกึ่งกลางการ์ดหนึ่งไปอีกการ์ดหนึ่ง
   * เป็นเส้นเฉียงได้ เพราะคู่ลับอาจอยู่คนละรุ่นคนละกิ่ง
   * pairs: [{ aId, bId }]  posOf: ผลจาก layout()
   */
  function secretLinks(pairs, posOf) {
    return pairs.map((p) => {
      const a = posOf[p.aId], b = posOf[p.bId];
      if (!a || !b) return null;
      return { x1: a.x, y1: a.y, x2: b.x, y2: b.y, aId: p.aId, bId: p.bId };
    }).filter(Boolean);
  }

  root.TreeLayoutSecrets = secretLinks;

  root.TreeLayout = { layout, secretLinks, measure, place, metrics: M };
})(typeof self !== 'undefined' ? self : this);
