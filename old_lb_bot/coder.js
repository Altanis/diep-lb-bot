let convo = new ArrayBuffer(4)
let u8 = new Uint8Array(convo)
let i32 = new Uint32Array(convo)
let float = new Float32Array(convo)

let endianSwap = val =>
    ((val & 0xff) << 24)
  | ((val & 0xff00) << 8)
  | ((val >> 8) & 0xff00)
  | ((val >> 24) & 0xff)

const keyInput = {
    LEFT_MOUSE: 1,
    UP: 2,
    LEFT: 4,
    DOWN: 8,
    RIGHT: 16,
    GOD_MODE: 32,
    SUICIDE: 64,
    RIGHT_MOUSE: 128,
    INSTANT_UPGRADE: 256,
    USE_GAMEPAD: 512,
    SWITCH_CLASS: 1024,
    TRUE_CONST: 2048,
}


const Writer = class {
  constructor() {
    this.length = 0
    this.buffer = new Uint8Array(4096)
  }
  flags(array) {
    let bits = 0;
    array.forEach(flag => {
      bits += keyInput[flag];
    });

    this.vu(bits);
  }
  i8(num) {
    this.buffer[this.length] = num
    this.length += 1
    return this
  }
  i32(num) {
    i32[0] = num
    this.buffer.set(u8, this.length)
    this.length += 4
    return this
  }
  float(num) {
    float[0] = num
    this.buffer.set(u8, this.length)
    this.length += 4
    return this
  }
  vu(num) {
    do {
      let part = num
      num >>>= 7
      if (num) part |= 0x80
      this.buffer[this.length++] = part
    } while (num)
    return this
  }
  vi(num) {
    let sign = (num & 0x80000000) >>> 31
    if (sign) num = ~num
    let part = (num << 1) | sign
    this.vu(part)
    return this
  }
  vf(num) {
    float[0] = num
    this.vi(endianSwap(i32[0]))
    return this
  }
  string(str) {
    let bytes = new Uint8Array(Buffer.from(str))
    this.buffer.set(bytes, this.length)
    this.length += bytes.length
    this.buffer[this.length++] = 0
    return this
  }
  out() {
    return this.buffer.buffer.slice(0, this.length)
  }
  dump() {
    return Array.from(this.buffer.subarray(0, this.length)).map(r => r.toString(16).padStart(2, 0)).join(' ')
  }
  reset() {
    this.buffer = new Uint8Array(1073741823);
    this.length = 0;
  }
}
const Reader = class {
  constructor(content) {
    this.at = 0
    this.buffer = new Uint8Array(content)
  }
  entityID() {
    let hash = this.vu();
    return hash ? `<${hash}, ${this.vu()}>` : 0;
  }

  stats_names(type) {
    let stats = [];
    if (type == 'update') {
      while (this.vu() != 0x01) {
        stats.push(this.stringNT());
      }
    } else {
      for (let i = 0; i < 8; i++) {
        stats.push(this.stringNT());
      }
    }

    return stats;
  }

  stats_allocated(type) {
    let stats = [];
    if (type == 'update') {
      while (this.vu() != 0x01) {
        stats.push(this.vi());
      }
    } else {
      for (let i = 0; i < 8; i++) {
        stats.push(this.vi());
      }
    }

    return stats;
  }

  stats_max(type) {
    let stats = [];
    if (type == 'update') {
      while (this.vu() != 0x01) {
        stats.push(this.vi());
      }
    } else {
      for (let i = 0; i < 8; i++) {
        stats.push(this.vi());
      }
    }

    return stats;
  }

  score(type) {
    let scores = [];

    if (type == 'update') {
      while (this.vu() != 0x01) {
        scores.push(this.vi());
      }
    } else {
      for (let i = 0; i < 10; i++) {
        scores.push(this.f32());
      }
    }

    return scores;
  }

  suffix(type) {
    let suffixes = [];
    
    if (type == 'update') { 
      while (this.vu() != 0x01) {
        suffixes.push(this.stringNT());
      }
    } else {
      for (let i = 0; i < 10; i++) {
        suffixes.push(this.stringNT());
      }
    }

    return suffixes;
  }
  color(type) {
    let colors = [];

    if (type == 'update') {
      while (this.vu() != 0x01) {
        colors.push(this.vu());
      }
    } else {
      for (let i = 0; i < 10; i++) {
        colors.push(this.vu());
      }
    }

    return colors;
  }
  name(type) {
    let names = [];

    if (type == 'update') {
      while (this.vu() != 0x01) {
        names.push(this.stringNT());
      }
    } else {
      for (let i = 0; i < 10; i++) {
        names.push(this.stringNT());
      }
    }

    return names;
  }
  tank(type) {
    let tanks = [];

    if (type == 'update') {
      while (this.vu() != 0x01) {
        tanks.push(this.vi());
      }
    } else {
      for (let i = 0; i < 10; i++) {
        tanks.push(this.vi());
      } 
    }
    
    return tanks;
  }
  i8() {
    return this.buffer[this.at++]
  }
  i32() {
    u8.set(this.buffer.subarray(this.at, this.at += 4))
    return i32[0]
  }
  f32() {
    u8.set(this.buffer.subarray(this.at, this.at += 4))
    return float[0]
  }
  little_endian() {
    const b = this.i8();
    const g = this.i8();
    const r = this.i8();

    this.vu();

    return [r, g, b];
  }
  vu() { 
    let out = 0
    let at = 0
    while (this.buffer[this.at] & 0x80) {
      out |= (this.buffer[this.at++] & 0x7f) << at
      at += 7
    }
    out |= this.buffer[this.at++] << at
    return out
  }
  vi() {
    let out = this.vu()
    let sign = out & 1
    out >>= 1
    if (sign) out = ~out
    return out
  }
  vf() {
    i32[0] = endianSwap(this.vi())
    return float[0]
  }
  stringNT() {
    let at = this.at
    while (this.buffer[this.at]) this.at++
    return Buffer.from(this.buffer.subarray(at, this.at++)).toString()
  }
  flush() {
    let slice = this.buffer.slice(this.at)
    this.at += slice.length
    return slice
  }
}

module.exports = { Reader, Writer };