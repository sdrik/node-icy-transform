/* vim: set sw=2 ts=2 sts=2 et: */

import { Readable } from 'stream'

export class IcyMetadata {
  private buffer: Buffer
  private filled: number

  public constructor(size: number)
  public constructor(value?: string | object, encoding?: BufferEncoding)
  public constructor(p1?: number | string | object, p2?: BufferEncoding) {
    if (typeof p1 === 'number') {
      this.buffer = Buffer.alloc(1 + (p1 << 4))
      this.buffer[0] = p1
      this.filled = 1
    } else {
      let value: object
      if (p1 === undefined || p1 === '') value = {}
      else if (typeof p1 !== 'object') value = { StreamTitle: p1.toString() }
      else value = p1
      const str = Object.entries(value)
        .map(x => `${x[0]}='${x[1]}';`)
        .join('')
      const blen = (Buffer.byteLength(str, p2) + 15) >> 4
      this.buffer = Buffer.alloc(1 + (blen << 4))
      this.buffer[0] = blen
      this.buffer.write(str, 1, p2)
      this.filled = this.buffer.length
    }
  }

  public isEmpty(): boolean {
    return this.buffer[0] == 0
  }

  public isFull(): boolean {
    return this.buffer.length == this.filled
  }

  public fill(from: Buffer, at: number = 0): number {
    if (from.length - at > this.buffer.length - this.filled)
      throw 'The metadata buffer is too small'
    const len = from.copy(this.buffer, this.filled, at)
    this.filled += len
    return len
  }

  public pushTo(strm: Readable): boolean {
    if (!this.isFull()) throw 'The metadata buffer is not complete'
    return strm.push(this.buffer)
  }

  public toString(encoding?: BufferEncoding): string {
    let end: number
    for (end = this.buffer.length; end > 1 && this.buffer[end - 1] == 0; end--);
    return this.buffer.toString(encoding, 1, end)
  }
}

export const ICY_NONE = new IcyMetadata()
