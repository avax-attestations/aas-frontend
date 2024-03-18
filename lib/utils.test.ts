import { blockQueryRange } from "./utils"

describe("getBlockQueryRange", () => {
  let gen: ReturnType<typeof blockQueryRange>

  beforeEach(() => {
    gen = blockQueryRange(1n, 128n)
  })

  test("should return the initial range first", () => {
    expect(gen.next(false).value).toEqual([1n, 128n])
  })

  test("should end after success at the end range", () => {
    expect(gen.next(false)).toEqual({value: [1n, 128n], done: false })
    expect(gen.next(true)).toEqual({ done: true})
  })


  test("should return half the range on failure", () => {
    gen.next()
    expect(gen.next(false)).toEqual({value: [1n, 64n], done: false})
    expect(gen.next(false)).toEqual({value: [1n, 32n], done: false})
  })

  test("should return remaining the range on failure", () => {
    gen.next(false)
    gen.next(false)
    gen.next(false)
    expect(gen.next(true).value).toEqual([33n, 128n])
    expect(gen.next(false).value).toEqual([33n, 80n])
    expect(gen.next(true).value).toEqual([81n, 128n])
  })

  test("only failures", () => {
    expect(gen.next(false).value).toEqual([1n, 128n])
    expect(gen.next(false).value).toEqual([1n, 64n])
    expect(gen.next(false).value).toEqual([1n, 32n])
    expect(gen.next(false).value).toEqual([1n, 16n])
    expect(gen.next(false).value).toEqual([1n, 8n])
    expect(gen.next(false).value).toEqual([1n, 4n])
    expect(gen.next(false).value).toEqual([1n, 2n])
    expect(gen.next(false).value).toEqual([1n, 1n])
    expect(gen.next(false).value).toEqual([1n, 1n])
    expect(gen.next(false).value).toEqual([1n, 1n])
    expect(gen.next(false).value).toEqual([1n, 1n])
    expect(gen.next(false).value).toEqual([1n, 1n])
  })

  test("success after only failures", () => {
    expect(gen.next(false).value).toEqual([1n, 128n])
    expect(gen.next(false).value).toEqual([1n, 64n])
    expect(gen.next(false).value).toEqual([1n, 32n])
    expect(gen.next(false).value).toEqual([1n, 16n])
    expect(gen.next(false).value).toEqual([1n, 8n])
    expect(gen.next(false).value).toEqual([1n, 4n])
    expect(gen.next(false).value).toEqual([1n, 2n])
    expect(gen.next(false).value).toEqual([1n, 1n])
    expect(gen.next(true).value).toEqual([2n, 128n])
    expect(gen.next(false).value).toEqual([2n, 65n])
    expect(gen.next(true).value).toEqual([66n, 128n])
    expect(gen.next(false).value).toEqual([66n, 97n])
    expect(gen.next(true).value).toEqual([98n, 128n])
    expect(gen.next(false).value).toEqual([98n, 113n])
    expect(gen.next(false).value).toEqual([98n, 105n])
    expect(gen.next(true).value).toEqual([106n, 128n])
    expect(gen.next(true).done).toBe(true)
  })
})

