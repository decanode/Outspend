import { parsePendingLines } from '../src/services/SharedCapture'

test('parses queued lines and skips bad ones', () => {
  const raw = [
    JSON.stringify({ text: 'Rs.250 debited to SWIGGY ₹ ; @ **', at: 5 }),
    '{"text": "torn',
    '',
    JSON.stringify({ text: '   ', at: 1 }),
    JSON.stringify({ text: 'x'.repeat(2001), at: 1 }),
  ].join('\n')
  expect(parsePendingLines(raw)).toEqual([{ text: 'Rs.250 debited to SWIGGY ₹ ; @ **', at: 5 }])
  expect(parsePendingLines(null)).toEqual([])
})
