// =============================================================
//  ระบบนำทาง (A*) — หาทางเดินอ้อมต้นไม้ หิน น้ำ บนตารางช่อง 32px
// =============================================================

class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(n) {
    const a = this.a; a.push(n);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
}

class NavGrid {
  // walk(tx, ty) → ยืนตรงกลางช่องนี้ได้ไหม
  constructor(width, height, tile, walk) {
    this.w = width; this.h = height; this.tile = tile;
    this.ok = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) this.ok[y * width + x] = walk(x, y) ? 1 : 0;
  }
  walkable(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h && this.ok[ty * this.w + tx] === 1; }
  center(tx, ty) { return { x: tx * this.tile + this.tile / 2, y: ty * this.tile + this.tile / 2 }; }
  tileOf(p) { return { tx: Math.floor(p.x / this.tile), ty: Math.floor(p.y / this.tile) }; }

  // ช่องเดินได้ที่ใกล้จุดนี้ที่สุด (กรณีคลิกโดนต้นไม้/น้ำ)
  nearestWalkable(tx, ty, maxR = 4) {
    if (this.walkable(tx, ty)) return { tx, ty };
    for (let r = 1; r <= maxR; r++)
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (this.walkable(tx + dx, ty + dy)) return { tx: tx + dx, ty: ty + dy };
      }
    return null;
  }

  // คืนรายการจุด (px) จาก from ไป to หรือ null ถ้าไปไม่ได้
  find(from, to, maxNodes = 5000) {
    const s = this.tileOf(from), g0 = this.tileOf(to);
    const start = this.nearestWalkable(s.tx, s.ty, 1) || s;
    const goal = this.nearestWalkable(g0.tx, g0.ty);
    if (!goal) return null;
    const W = this.w, key = (x, y) => y * W + x;
    const gk = key(goal.tx, goal.ty);
    const h = (x, y) => { const dx = Math.abs(x - goal.tx), dy = Math.abs(y - goal.ty); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
    const gScore = new Map(), came = new Map(), open = new Heap(), closed = new Set();
    const sk = key(start.tx, start.ty);
    gScore.set(sk, 0);
    open.push({ x: start.tx, y: start.ty, k: sk, f: h(start.tx, start.ty) });
    let expanded = 0;
    while (open.size) {
      const cur = open.pop();
      if (closed.has(cur.k)) continue;
      if (cur.k === gk) {
        const tiles = [];
        for (let k = gk; k !== undefined; k = came.get(k)) tiles.push(k);
        tiles.reverse();
        const pts = tiles.slice(1).map((k) => this.center(k % W, Math.floor(k / W)));
        // จุดสุดท้าย = ตำแหน่งที่คลิกจริง ถ้าเดินไปถึงได้
        if (goal.tx === g0.tx && goal.ty === g0.ty) { if (pts.length) pts[pts.length - 1] = { x: to.x, y: to.y }; else pts.push({ x: to.x, y: to.y }); }
        return pts;
      }
      closed.add(cur.k);
      if (++expanded > maxNodes) return null;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cur.x + dx, ny = cur.y + dy;
        if (!this.walkable(nx, ny)) continue;
        if (dx && dy && (!this.walkable(cur.x + dx, cur.y) || !this.walkable(cur.x, cur.y + dy))) continue; // ห้ามตัดมุมต้นไม้
        const nk = key(nx, ny);
        if (closed.has(nk)) continue;
        const g = gScore.get(cur.k) + (dx && dy ? 1.414 : 1);
        if (g < (gScore.get(nk) ?? Infinity)) {
          gScore.set(nk, g); came.set(nk, cur.k);
          open.push({ x: nx, y: ny, k: nk, f: g + h(nx, ny) });
        }
      }
    }
    return null;
  }
}

module.exports = { NavGrid };
