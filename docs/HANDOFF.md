# Project Novice — สรุปสำหรับเริ่มแชทใหม่ (อัปเดต 2026-10-08)

## ข้อมูลโปรเจกต์
- เกม MMORPG บนเบราว์เซอร์ "Project Novice" — เจ้าของ/แอดมิน: Sayan (สื่อสารภาษาไทย เขียนโค้ดเองได้น้อย ให้ AI เขียนให้)
- Repo: `khotcharoms-afk/novice-online` (branch `main`) · push ขึ้น main = Render deploy อัตโนมัติ
- เว็บ: https://novice-online.onrender.com · แอดมิน: `/admin` (Render แผนฟรี)
- Stack: Node 22 · Express · Colyseus 0.16 (server-authoritative) · Phaser 3.90 · Firebase/Firestore (โหมด dev = เก็บในหน่วยความจำ)
- กติกา: ตอบเป็นภาษาไทย · commit + push หลังทำงานเสร็จทุกครั้ง · ห้ามให้ใครส่ง Firebase service-account key ในแชท (ใส่ใน Render Environment เท่านั้น)

## โครงไฟล์หลัก
- `server/WorldRoom.js` — ห้องเกม (1 ห้อง/แผนที่, ดันเจี้ยน 1 ห้อง/รอบ ผ่าน filterBy `mapId`,`inst`): เข้า/ออก, ปาร์ตี้, AUTO, สกิล, มอน, ดรอป, World Boss, ดันเจี้ยนภูติ, อีเวนต์ EXP, นับถอยหลังอัปเดต
- `server/data.js` — อาชีพ, สเตตัส, สกิล (SKILLS / SKILL_TREE), มอน, World Boss, เควสอาชีพ
- `server/jobs2.js` — อาชีพขั้น 2 (10 อาชีพ) + สกิล · `server/classgear.js` — ชุดประจำอาชีพ Lv50/70/90
- `server/items.js` · `server/inventory.js` · `server/spirits.js` (ภูติ) · `server/sdungeon.js` (ดันเจี้ยนภูติ) · `server/maps.js` · `server/map.js` (สร้างแผนที่)
- `server/admin.js` (API แอดมิน) · `server/store.js` (Firestore/dev store; `DEV_STORE_FILE` เก็บลงไฟล์ตอนทดสอบ) · `server/index.js`
- Client: `public/game.js` (หลัก), `skillfx2.js` (เอฟเฟกต์สกิล), `skill-ui.js`, `items-ui.js`, `party-ui.js`, `spirit-ui.js`, `dungeon-ui.js`, `job-ui.js`, `rebirth-ui.js`, `exchange-ui.js`, `worldmap-ui.js`, `admin.js`/`admin.html`
- เครื่องมือ: `tools/power.js` (จำลองพลัง), `tools/economy.js`, `tools/job-art/skillicons2.py` (ไอคอนสกิลจาก game-icons ผ่าน npm `@iconify-json/game-icons`), `tools/spirit/dungeon_icons.py`
- ทดสอบ: Playwright (Chromium ที่ `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`), dev login ด้วย `sessionStorage.pn_dev_id`, admin API `Bearer dev:admin` → `/api/admin/char/:id` actions: level/job/item/gold/warp/heal/quest

## งานที่ทำเสร็จในรอบล่าสุด (ขึ้นเซิร์ฟแล้วทั้งหมด)
- **การเชื่อมต่อ**: เลิกใช้ WS ping ของ Colyseus (pong ไม่ผ่าน proxy ของ Render → หลุดทุก ~21 วิ) ใช้ heartbeat `hb` ทุก 5 วิ, ตัดเมื่อเงียบ 90 วิ · client watchdog ต่อใหม่เองในหน้าเดิม · log `[drop]`, `[timeout]`, `[lag]` + การ์ดสถิติในหน้าแอดมิน
- **อัปเดตเกม**: /api/version; ทั้งเซิร์ฟเก่าและหน้าเกมตรวจเวอร์ชันใหม่ → นับถอยหลัง 1 นาทีกลางจอ → บันทึก → รีโหลดเข้าเวอร์ชันใหม่ (SIGTERM ไม่ทันตรวจ = นับ 20 วิ) — *ยังไม่ได้ยืนยันบน Render จริงว่ากล่องนับถอยหลังขึ้น* ให้ดู log `[update] build=` / `[shutdown]`
- **ปาร์ตี้**: หลุด/ออกเกมยังอยู่ในปาร์ตี้ 10 นาที, บันทึกติดตัวละคร (รอดตอนรีสตาร์ท)
- **แอดมิน**: อีเวนต์ EXP x1.5/x2/x3 (เก็บใน Firestore `config/expEvent`)
- **แชทระบบ**: ตาย/เลเวลอัปเห็นเฉพาะตัวเอง; ไม่ประกาศเข้า/ออกเกม
- **ดรอป**: วัตถุดิบมอน ~28–30%/ตัว, ของที่เควสต้องใช้ ×2
- **ดันเจี้ยนภูติ** (ลูน่า): 6 ธาตุ × 4 ระดับ (Lv10/25/40/60), ตั๋ว 3,000 gold, 3 ระลอก + บอส 10 นาที, ปาร์ตี้ได้ 6 คน; รางวัลแก่นธาตุ/แก่นบริสุทธิ์/ผลึกวิญญาณ; ข้ามขีดจำกัดภูติใช้แก่นธาตุของธาตุภูติ
- **อาชีพ**: เปลี่ยนอาชีพได้อาวุธรอง Lv20 ด้วย, +10 แต้มสกิล (ขั้น 2 อีก +10), รีที่เซเลสคืนทั้งสเตตัส+สกิล
- **สกิล**: Novice +3 สกิล (ขว้างหิน/หมุนตัวฟาด/ฮึดสู้, ฟันซ้ำย้ายมาแท็บชาวบ้าน) · อาชีพขั้น 1 มีสกิลขั้นสูงเพิ่ม 10 ตัว (แถวล่างสุด ต้องมีสกิลก่อนหน้า) + Healer ได้ passive "ศรัทธาแห่งทัณฑ์" · **ไม่มีระบบล็อกสายแล้ว (free build)** · อนิเมชั่น Mage ขั้น 1 ใหม่
- **สกิลวงกว้างแบบเลือกจุด**: frostnova, meteor, inferno, glacier, blizzard, blackhole (`ground: true`) กดแล้วเล็งตามเมาส์/คลิกลง, กดซ้ำ = ลงตรงเมาส์, ตัวเลือก Quick cast ในหน้าต่างสกิล
- **AUTO**: ตัวเลือก "เลี่ยงมินิบอส/World Boss", แก้ค้างมุมแผนที่ (ไม่เข้าใกล้เป้า 2.5 วิ = ข้าม)
- **UI**: การ์ดไอเทมเทียบกับของที่ใส่อยู่ (▲เขียว/▼แดง, เตือนอาวุธสองมือถอดมือรอง), หน้าต่างแลกเปลี่ยนไม่ค้างตอนอีกฝ่ายหลุด, หน้าต่างตายไม่ค้าง

## เรื่องที่ค้าง / ควรทำต่อ
- ยืนยันว่ากล่องนับถอยหลังอัปเดตขึ้นจริงบน Render (ดู log)
- ปรับสมดุลสกิลขั้นสูงใหม่ 10 ตัว + สกิล Novice + ความยากดันเจี้ยนภูติจากการเล่นจริง
- ทดสอบสกิลเลือกจุดของ Archmage (พายุหิมะ) / Summoner (หลุมดำ) แบบร่ายจริง
- ไอเดียที่เคยเสนอ: อนิเมชั่นสกิลอาชีพขั้น 1 อื่น (Guardian/Slayer/Hunter/Healer), ทดสอบ UI มือถือ, ชดเชยวัตถุดิบเก่าที่ใช้ข้ามขีดจำกัดภูติไม่ได้แล้ว, เควสรายวัน, กิลด์, เพื่อน/กระซิบ, ชุดแฟชั่น, เสียง
- ข้อสังเกต: ระหว่างทำงานเคยมีการแก้ไฟล์จากที่อื่นพร้อมกัน — ก่อนเริ่มงานให้ `git pull` และดู `git status` เสมอ
