/* vim: set sw=2 ts=2 sts=2 et: */

export class IcyMetadataDecoder {
  private buffer: Buffer
  private pos: number

  public constructor(size: number) {
    this.buffer = Buffer.alloc(1 + (size << 4))
    this.buffer[0] = size
    this.pos = 1
  }

  public isEmpty(): boolean {
    return this.buffer[0] == 0
  }

  public isFull(): boolean {
    return this.buffer.length == this.pos
  }

  public write(from: Buffer, offset: number): number {
    const len = from.copy(this.buffer, this.pos, offset)
    this.pos += len
    return len
  }

  public toString(encoding?: BufferEncoding): string {
    if (!this.isFull()) throw 'Buffer is incomplete'
    let end = this.buffer.length
    while (end > 1 && this.buffer[end - 1] == 0) end--
    return this.buffer.toString(encoding, 1, end)
  }
}
