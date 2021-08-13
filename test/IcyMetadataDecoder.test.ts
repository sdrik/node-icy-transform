/* vim: set ts=2 sts=2 sw=2 et: */

import { IcyMetadataDecoder } from '../src/IcyMetadataDecoder'

describe('IcyMetadataDecoder', () => {
  test('it should handle empty metadata', () => {
    expect(new IcyMetadataDecoder(0).isFull()).toBe(true)
    expect(new IcyMetadataDecoder(0).isEmpty()).toBe(true)
    expect(new IcyMetadataDecoder(0).toString()).toBe('')
  })
  test('it should properly report fullness', () => {
    const decoder = new IcyMetadataDecoder(1)
    expect(decoder.isFull()).toBe(false)
    decoder.write(Buffer.alloc(15), 0)
    expect(decoder.isFull()).toBe(false)
    decoder.write(Buffer.alloc(1), 0)
    expect(decoder.isFull()).toBe(true)
  })
  test('it should properly report number of bytes consumed', () => {
    const decoder = new IcyMetadataDecoder(1)
    const buffer = Buffer.alloc(15)
    expect(decoder.write(buffer, 0)).toBe(15)
    expect(decoder.write(buffer, 0)).toBe(1)
  })
  test('it should properly decode strings', () => {
    const buffer = Buffer.from('àBCDéFGHÏJKLMNÔPQRSTUVWXYZ0123456789=!-$*/:;')
    let decoder = new IcyMetadataDecoder(3)
    decoder.write(buffer, 0)
    expect(decoder.toString()).toBe(
      'àBCDéFGHÏJKLMNÔPQRSTUVWXYZ0123456789=!-$*/:;'
    )
    decoder = new IcyMetadataDecoder(1)
    decoder.write(buffer, 0)
    expect(decoder.toString()).toBe('àBCDéFGHÏJKLM')
  })
  test('it should ignore trailing nulls', () => {
    const buffer = Buffer.from('ABCDEF')
    const decoder = new IcyMetadataDecoder(1)
    decoder.write(buffer, 0)
    decoder.write(Buffer.alloc(10, 0), 0)
    expect(decoder.toString()).toBe('ABCDEF')
  })
  test('it should only decode when full', () => {
    const buffer = Buffer.from('ABCDEF')
    const decoder = new IcyMetadataDecoder(1)
    decoder.write(buffer, 0)
    expect(() => decoder.toString()).toThrow()
  })
})
