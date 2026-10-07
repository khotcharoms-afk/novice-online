# สคริปต์สร้างภาพอุปกรณ์อาชีพ (Phase 6)

ต้องมีโฟลเดอร์ LPC generator ที่ `/home/claude/lpc/gen` (sparse clone ของ
https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator)

```
python3 build_jobs.py   # อาวุธ โล่ ชุดเกราะเบา/ผ้า ชุดพื้นฐานอาชีพ NPC ครูฝึก + ไอคอน
python3 fixicons.py     # ไอคอนถุงมือ/รองเท้าแต่ละชุด
```
ผลลัพธ์ลงที่ `public/assets/equip`, `look`, `icons` แล้วอัปเดต `manifest.json`
