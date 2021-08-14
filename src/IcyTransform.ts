/* vim: set sw=2 ts=2 sts=2 et: */

import { Transform, TransformOptions } from 'stream'
import { NextObserver, Observable, fromEvent, takeUntil, race } from 'rxjs'
import { IcyMetadataDecoder } from './IcyMetadataDecoder'

export const ICY_DEFAULT_INTERVAL = 8192

interface IcyTransformFullOptions {
  inInterval: number
  outInterval: number
  repeat: boolean
  passthrough: boolean
  encoding: BufferEncoding
}

export type IcyTransformOptions = Partial<IcyTransformFullOptions>
export type IcyMetadataListener = (x: any) => void

type StreamHandler = (chunk: Buffer, encoding?: BufferEncoding) => void

const ICY_NONE = Buffer.alloc(1, 0)

export class IcyTransform extends Transform {
  public repeat: boolean
  public readonly inInterval: number
  public readonly outInterval: number
  public readonly encoding: BufferEncoding

  private _passthrough: IcyMetadataListener | undefined

  private _metadata: any
  private _new: boolean

  private _readNext: number
  private _writeNext: number
  private _lastBuffer: Buffer
  private _transformBottomHalf: StreamHandler
  private _transformTopHalf: StreamHandler
  private _decoder: IcyMetadataDecoder | undefined

  public constructor(
    transformOptions?: IcyTransformOptions,
    streamOptions?: TransformOptions
  ) {
    super(streamOptions)

    const options: IcyTransformFullOptions = Object.assign(
      {},
      {
        inInterval: 0,
        outInterval: 0,
        repeat: false,
        passthrough: true,
        encoding: 'utf8',
      },
      transformOptions
    )

    this.inInterval = options.inInterval
    this.outInterval = options.outInterval
    this.repeat = options.repeat
    this.passthrough = options.passthrough
    this.encoding = options.encoding

    this._transformBottomHalf = this.outInterval
      ? this.encodeMetadata
      : this.push
    this._transformTopHalf = this.inInterval
      ? this.decodeMetadata
      : this._transformBottomHalf

    this._metadata = undefined
    this._lastBuffer = ICY_NONE
    this._new = false

    this._readNext = this.inInterval
    this._writeNext = this.outInterval
  }

  public set metadata(value: any) {
    this._metadata = value
    this._new = true
  }

  public get metadata(): any {
    return this._metadata
  }

  public set passthrough(value: boolean) {
    if (!this.inInterval || !this.outInterval) return
    if (value) {
      if (!this._passthrough) {
        this._passthrough = (x: any) => {
          this.metadata = x
        }
        this.on('metadata', this._passthrough)
      }
    } else if (this._passthrough) {
      this.off('metadata', this._passthrough)
      this._passthrough = undefined
    }
  }

  public get passthrough(): boolean {
    return !!this._passthrough
  }

  public injector(): NextObserver<any> {
    return { next: (x: any) => (this.metadata = x) }
  }

  public metadata$(): Observable<unknown> {
    return fromEvent(this, 'metadata').pipe(
      takeUntil(race(fromEvent(this, 'finish'), fromEvent(this, 'error')))
    )
  }

  public override _transform(
    chunk: Buffer,
    encoding: string,
    callback: (error?: any, data?: any) => void
  ): void {
    if (encoding != 'buffer') throw 'Can only handle buffer streams'
    this._transformTopHalf(chunk, this.encoding)
    callback()
  }

  private pushMetadata(encoding?: BufferEncoding): void {
    if (this._new) {
      let value = this._metadata
      if (
        value === undefined ||
        value === null ||
        value === '' ||
        value === false
      )
        value = {}
      else if (typeof value !== 'object')
        value = { StreamTitle: value.toString() }
      const str = Object.entries(value)
        .map(x => `${x[0]}='${x[1]}';`)
        .join('')
      const blen = (Buffer.byteLength(str, encoding) + 15) >> 4
      this._lastBuffer = Buffer.alloc(1 + (blen << 4))
      this._lastBuffer[0] = blen
      this._lastBuffer.write(str, 1, encoding)
    }
    this.push(this._new || this.repeat ? this._lastBuffer : ICY_NONE)
    this._new = false
  }

  private encodeMetadata(chunk: Buffer, encoding?: BufferEncoding): void {
    let pos: number = 0
    while (pos < chunk.length) {
      if (!this._writeNext) {
        this.pushMetadata(encoding)
        this._writeNext = this.outInterval
      } else {
        const len: number = Math.min(chunk.length - pos, this._writeNext)
        this.push(chunk.slice(pos, (pos += len)), encoding)
        this._writeNext -= len
      }
    }
  }

  private decodeMetadata(chunk: Buffer, encoding?: BufferEncoding): void {
    let pos: number = 0
    while (pos < chunk.length) {
      if (!this._readNext) {
        if (!this._decoder) this._decoder = new IcyMetadataDecoder(chunk[pos++])
        pos += this._decoder.write(chunk, pos)
        if (this._decoder.isFull()) {
          if (!this._decoder.isEmpty())
            this.emit('metadata', this._decoder.toString(encoding))
          this._decoder = undefined
          this._readNext = this.inInterval
        }
      } else {
        const len: number = Math.min(chunk.length - pos, this._readNext)
        this._transformBottomHalf(chunk.slice(pos, (pos += len)), encoding)
        this._readNext -= len
      }
    }
  }
}
