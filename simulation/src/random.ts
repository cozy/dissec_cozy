// Copied from https://stackoverflow.com/a/47593316

function xmur3(str: string) {
  for (var i = 0, h = 1779033703 ^ str.length; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return (h ^= h >>> 16) >>> 0
  }
}

function mulberry32(a: number) {
  return function () {
    var t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createGenerator(seed: string) {
  let seedFunction = xmur3(seed || '42')
  return mulberry32(seedFunction())
}

export class Generator {
  private static instances: { [seed: string]: () => number } = {}

  private constructor() {}

  static get(seed: string = '42'): () => number {
    if (!this.instances[seed]) {
      let seedFunction = xmur3(seed)
      this.instances[seed] = mulberry32(seedFunction())
    }
    return this.instances[seed]
  }
}
