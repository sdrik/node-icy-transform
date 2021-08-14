/* vim: set ts=2 sts=2 sw=2 et: */

import { IcyTransform } from '../src/IcyTransform'
//import { IcyTransform, IcyTransformOptions } from '../src/IcyTransform'
import { Readable, Writable } from 'stream'

// helper functions

function randomBuffer(size: number): Buffer {
  return Buffer.from([...Array(size)].map(_ => ~~(Math.random() * 255)))
}

function writeByChunk(buf: Buffer, strm: Writable, chunk: number) {
  let pos: number
  for (pos = 0; pos < buf.length; pos += chunk)
    strm.write(buf.slice(pos, pos + chunk))
  strm.end()
  return pos
}

/*
function writeBufArray(arr: Array<Buffer>, strm: Writable) {
  let len = 0
  arr.forEach(buf => {
    strm.write(buf)
    len += buf.length
  })
  strm.end()
  return len
}
*/

function readAll(strm: Readable, buf: Buffer) {
  let pos = 0
  for (let b; (b = strm.read()); pos += b.length) b.copy(buf, pos)
  return pos
}

let RANDOM_DATA: Buffer
let METADATA0: Buffer
let METADATA1: Buffer

beforeAll(() => {
  RANDOM_DATA = randomBuffer(1024)
  METADATA0 = Buffer.from('\x00')
  METADATA1 = Buffer.from("\x01StreamTitle='A';")
})

describe('IcyTransform', () => {
  test('it should passthrough', () => {
    const transform = new IcyTransform()

    transform.write(Buffer.from('ABCDEF'))
    expect(transform.read().toString()).toBe('ABCDEF')

    for (let i = 0; i < 100; i++) {
      const len = 1 + ~~(Math.random() * 1023)
      transform.write(RANDOM_DATA.slice(0, len))
      expect(transform.read()).toEqual(RANDOM_DATA.slice(0, len))
    }
  })

  test('it should reapeat at specified interval', () => {
    const transform = new IcyTransform({
      outInterval: 32,
      repeat: true,
    })
    transform.metadata = 'A'

    const expected = new Array<Buffer>()
    for (let i = 0; i < 1024; ) {
      expected.push(RANDOM_DATA.slice(i, (i += 32)))
      if (i < 1024) expected.push(METADATA1)
    }

    let len: number
    for (let i = 0; i < 1024; i += len) {
      len = 1 + ~~(Math.random() * 63)
      transform.write(RANDOM_DATA.slice(i, i + len))
    }
    expect(transform.read()).toEqual(Buffer.concat(expected))
  })

  test('it should not reapeat if not requested', () => {
    const transform = new IcyTransform({
      outInterval: 32,
    })
    transform.metadata = 'A'

    const expected = new Array<Buffer>()
    expected.push(RANDOM_DATA.slice(0, 32))
    expected.push(METADATA1)
    for (let i = 32; i < 1024; ) {
      expected.push(RANDOM_DATA.slice(i, (i += 32)))
      if (i < 1024) expected.push(METADATA0)
    }

    let len: number
    for (let i = 0; i < 1024; i += len) {
      len = 1 + ~~(Math.random() * 63)
      transform.write(RANDOM_DATA.slice(i, i + len))
    }
    expect(transform.read()).toEqual(Buffer.concat(expected))
  })

  test('it should remember metadata', () => {
    const transform = new IcyTransform({
      outInterval: 32,
    })
    transform.metadata = 'A'
    transform.write(RANDOM_DATA.slice(0, 128))
    expect(transform.metadata).toBe('A')
    transform.repeat = true
    transform.write(RANDOM_DATA.slice(0, 128))
    expect(transform.metadata).toBe('A')
  })

  test('it should passthrough only when possible', () => {
    expect(
      new IcyTransform({ inInterval: 0, outInterval: 0, passthrough: true })
        .passthrough
    ).toBeFalsy()
    expect(
      new IcyTransform({ inInterval: 0, outInterval: 1, passthrough: true })
        .passthrough
    ).toBeFalsy()
    expect(
      new IcyTransform({ inInterval: 1, outInterval: 0, passthrough: true })
        .passthrough
    ).toBeFalsy()
    expect(
      new IcyTransform({ inInterval: 1, outInterval: 1, passthrough: true })
        .passthrough
    ).toBeTruthy()
  })

  test('it should be possible to enable/disable passthrough', () => {
    let t
    t = new IcyTransform({
      inInterval: 1,
      outInterval: 1,
      passthrough: true,
    })
    t.passthrough = false
    expect(t.passthrough).toBeFalsy()
    t = new IcyTransform({
      inInterval: 1,
      outInterval: 1,
      passthrough: true,
    })
    t.passthrough = true
    expect(t.passthrough).toBeTruthy()
    t = new IcyTransform({
      inInterval: 1,
      outInterval: 1,
      passthrough: false,
    })
    t.passthrough = true
    expect(t.passthrough).toBeTruthy()
    t = new IcyTransform({
      inInterval: 1,
      outInterval: 1,
      passthrough: false,
    })
    t.passthrough = false
    expect(t.passthrough).toBeFalsy()
  })

  test('it should preserve data when both inInterval=0 and outInterval=0', () => {
    const chunk = 1024
    const src = randomBuffer(100 * chunk)
    const dst = Buffer.alloc(100 * chunk)
    const transform = new IcyTransform({ inInterval: 0, outInterval: 0 })

    writeByChunk(src, transform, chunk)
    const pos = readAll(transform, dst)

    expect(pos).toBe(dst.length)
    expect(Buffer.compare(src, dst)).toBe(0)
  })

  test('it should be observable', done => {
    const transform = new IcyTransform({
      inInterval: 32,
    })

    let values = Array<any>()
    transform.metadata$().subscribe({
      next: x => {
        values.push(x)
      },
      complete: () => {
        try {
          expect(values.length).toBe(1024 / 32)
          for (let value of values) expect(value).toBe("StreamTitle='A';")
          done()
        } catch (error) {
          done(error)
        }
      },
    })

    for (let i = 0; i < 1024; ) {
      transform.write(RANDOM_DATA.slice(i, (i += 32)))
      transform.write(METADATA1)
      transform.read()
    }
    transform.end()
  })
})

/*

describe("constructor()/toString()", () => {

  test("it should emit an empty string for falsy values", () => {
    expect(new IcyMetadata().toString()).toBe('')
    expect(new IcyMetadata('').toString()).toBe('')
    expect(new IcyMetadata({}).toString()).toBe('')
  })

  test("it should emit StreamTitle for strings", () => {
    expect(new IcyMetadata('title').toString()).toBe("StreamTitle='title';")
  })

  test("it should serialize objects", () => {
    expect(new IcyMetadata({a: false, b: 'ok'}).toString()).toBe("a='false';b='ok';")
  })

})

describe("str2buf", () => {
  test("it should emit well-formed metadata buffers", () => {
    const readable = new Readable({ read(size: number): void { } })
    const data = [
      { str: '', pad: 0 },
      { str: 'Short line', pad: 6 },
      { str: 'Line with no pad', pad: 0 },
      { str: 'Very very long line which uses more than one metadata block', pad: 5 },
    ]
    for (let d of data) {
      new IcyMetadata(d.str).pushTo(readable)
      const b: Buffer = readable.read()
      console.log(b)
      expect(b[0]).toBe(Math.ceil(d.str.length / 16))
      expect(b.slice(1, 1 + d.str.length).toString()).toBe(d.str)
      let c = 0
      for (let i = 1 + d.str.length; i < b.length; i++, c++)
        expect(b[i]).toBe(0)
      expect(c).toBe(d.pad)
    }
  })

})

describe("nextMetadata / _getMetadata", () => {

  test("it should pass last feeded value as a metadata buffer", () => {
    const data = [
      "",
      "Short line",
      "Very very long line which uses more than one metadata block",
    ];

    const t = new IcyTransform();

    for (d of data) {
      t.nextMetadata(d);
      expect(Buffer.compare(t._getMetadata(), IcyTransform.str2buf(d))).toBe(0);
    }
  });

  test("it should repeat last feeded value only when requested", () => {
    const d = { txt: "Short line", buf: Buffer.from("\x01Short line\x00\x00\x00\x00\x00\x00") };
    const n = Buffer.alloc(1);
    const t = new IcyTransform({repeat: false});
    t.nextMetadata(d.txt);
    expect(Buffer.compare(t._getMetadata(), d.buf)).toBe(0);
    expect(Buffer.compare(t._getMetadata(), n)).toBe(0);
    expect(Buffer.compare(t._getMetadata(), n)).toBe(0);
    expect(Buffer.compare(t._getMetadata(), n)).toBe(0);
    t.nextMetadata(d.txt);
    expect(Buffer.compare(t._getMetadata(), d.buf)).toBe(0);
    expect(Buffer.compare(t._getMetadata(), n)).toBe(0);
    t.repeat = true;
    t.nextMetadata(d.txt);
    expect(Buffer.compare(t._getMetadata(), d.buf)).toBe(0);
    expect(Buffer.compare(t._getMetadata(), d.buf)).toBe(0);
    expect(Buffer.compare(t._getMetadata(), d.buf)).toBe(0);
    t.repeat = false;
    expect(Buffer.compare(t._getMetadata(), n)).toBe(0);
    expect(Buffer.compare(t._getMetadata(), n)).toBe(0);
    expect(Buffer.compare(t._getMetadata(), n)).toBe(0);
  });

});

describe("transform", () => {

  describe("filter (writeInterval=0) with various chunk sizes", () => {

    const data = {};

    beforeAll(() => {
      data.chunks = [
        randomBuffer(20),
        Buffer.alloc(1),
        randomBuffer(20),
        Buffer.alloc(1),
        randomBuffer(20),
        Buffer.from("\x010123456789ABCDEF"),
        randomBuffer(20),
        Buffer.alloc(1),
        randomBuffer(20),
        Buffer.from("\x020123456789ABCDEF0123456789ABCDEF"),
        randomBuffer(20),
        Buffer.alloc(1),
        randomBuffer(20),
      ];
      data.src = Buffer.concat(data.chunks);
    });

    for (let chunk = 1; chunk < 50; chunk++) {
      test(`it should remove metadata blocks (chunk=${chunk})`, () => {
        const transform = new IcyTransform({readInterval: 20, writeInterval: 0});

        const dst = Buffer.alloc(140);
        writeByChunk(data.src, transform, chunk);
        const pos = readAll(transform, dst);

        expect(pos).toBe(dst.length);
        for (let i = 0, pos = 0; i < data.chunks.length; i += 2)
          expect(Buffer.compare(data.chunks[i], dst.slice(pos, pos += data.chunks[i].length))).toBe(0);
      });
    }

    for (let chunk = 1; chunk < 50; chunk++) {
      test(`it should emit metadata events (chunk=${chunk})`, done => {
        const transform = new IcyTransform({readInterval: 20, writeInterval: 0});
        const metadata = [];
        transform.on("metadata", str => metadata.push(str));
        transform.on("end", () => {
          expect(metadata.length).toBe(2);
          done();
        });
        writeByChunk(data.src, transform, chunk);
        transform.resume();
      });
    }

  });

  describe("inject (readInterval=0) with various chunk sizes", () => {

    const data = {};

    beforeAll(() => {
      data.src = randomBuffer(1000);
      data.metadata = [
        { pos:   0, str: "0123456789ABCDEF" },
        { pos:  50, str: "0123456789ABCDEF0123456789ABCDEF" },
        { pos: 300, str: "0123456789ABCDEF" },
        { pos: 800, str: "0123456789ABCDEF0123456789ABCDEF" },
      ];
    });

    for (let chunk = 1; chunk < 50; chunk++) {
      test(`it should XXXXXX (chunk=${chunk})`, () => {
        const transform = new IcyTransform({readInterval: 0, writeInterval: 20});
        //transform.on('data', data => {});
        for (let pos = 0, i = 0; pos < data.src.length; pos += chunk) {
          transform.write(data.src.slice(pos, pos + chunk));
          if (i < data.metadata.length && pos >= data.metadata[i].pos)
            transform.nextMetadata(data.metadata[i++].str);
        }
        //transform.end();
      });
    }

  });
});
*/
