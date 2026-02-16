import { describe, it, expect } from 'vitest'
import { Source } from '../../src/common/source.ts'

describe('Source', () => {
  describe('positionAt', () => {
    it('returns line 1, column 1 for offset 0', () => {
      const src = new Source('test.hal', 'hello')
      const pos = src.positionAt(0)
      expect(pos.line).toBe(1)
      expect(pos.column).toBe(1)
      expect(pos.offset).toBe(0)
    })

    it('returns correct position within first line', () => {
      const src = new Source('test.hal', 'hello world')
      const pos = src.positionAt(6)
      expect(pos.line).toBe(1)
      expect(pos.column).toBe(7)
    })

    it('returns correct position on second line', () => {
      const src = new Source('test.hal', 'line1\nline2')
      const pos = src.positionAt(6)
      expect(pos.line).toBe(2)
      expect(pos.column).toBe(1)
    })

    it('handles multiple lines', () => {
      const src = new Source('test.hal', 'aaa\nbbb\nccc\n')
      // 'c' in 'ccc' is at offset 8
      const pos = src.positionAt(8)
      expect(pos.line).toBe(3)
      expect(pos.column).toBe(1)
    })

    it('handles offset at end of file', () => {
      const src = new Source('test.hal', 'ab\ncd')
      const pos = src.positionAt(5)
      expect(pos.line).toBe(2)
      expect(pos.column).toBe(3)
    })

    it('clamps negative offset to 0', () => {
      const src = new Source('test.hal', 'hello')
      const pos = src.positionAt(-5)
      expect(pos.line).toBe(1)
      expect(pos.column).toBe(1)
    })

    it('clamps offset beyond end to end', () => {
      const src = new Source('test.hal', 'hi')
      const pos = src.positionAt(100)
      expect(pos.line).toBe(1)
      expect(pos.column).toBe(3)
    })

    it('handles empty source', () => {
      const src = new Source('test.hal', '')
      const pos = src.positionAt(0)
      expect(pos.line).toBe(1)
      expect(pos.column).toBe(1)
    })

    it('handles Windows-style line endings (CRLF)', () => {
      const src = new Source('test.hal', 'line1\r\nline2')
      // \r\n counts as one line break, 'l' of 'line2' is at offset 7
      const pos = src.positionAt(7)
      expect(pos.line).toBe(2)
      expect(pos.column).toBe(1)
    })
  })

  describe('offsetAt', () => {
    it('returns 0 for line 1, column 1', () => {
      const src = new Source('test.hal', 'hello')
      expect(src.offsetAt(1, 1)).toBe(0)
    })

    it('returns correct offset for second line', () => {
      const src = new Source('test.hal', 'aaa\nbbb')
      expect(src.offsetAt(2, 1)).toBe(4)
    })

    it('returns correct offset for column > 1', () => {
      const src = new Source('test.hal', 'aaa\nbbb')
      expect(src.offsetAt(2, 3)).toBe(6)
    })
  })

  describe('lineText', () => {
    it('returns text of first line', () => {
      const src = new Source('test.hal', 'hello\nworld')
      expect(src.lineText(1)).toBe('hello')
    })

    it('returns text of last line (no trailing newline)', () => {
      const src = new Source('test.hal', 'hello\nworld')
      expect(src.lineText(2)).toBe('world')
    })

    it('returns text of middle line', () => {
      const src = new Source('test.hal', 'aaa\nbbb\nccc')
      expect(src.lineText(2)).toBe('bbb')
    })

    it('returns empty string for out-of-range line', () => {
      const src = new Source('test.hal', 'hello')
      expect(src.lineText(0)).toBe('')
      expect(src.lineText(5)).toBe('')
    })

    it('strips trailing newline', () => {
      const src = new Source('test.hal', 'hello\n')
      expect(src.lineText(1)).toBe('hello')
    })
  })

  describe('lineCount', () => {
    it('returns 1 for single line', () => {
      const src = new Source('test.hal', 'hello')
      expect(src.lineCount).toBe(1)
    })

    it('returns correct count for multi-line', () => {
      const src = new Source('test.hal', 'a\nb\nc')
      expect(src.lineCount).toBe(3)
    })

    it('counts trailing newline as extra line', () => {
      const src = new Source('test.hal', 'a\nb\n')
      expect(src.lineCount).toBe(3)
    })

    it('returns 1 for empty source', () => {
      const src = new Source('test.hal', '')
      expect(src.lineCount).toBe(1)
    })
  })
})
