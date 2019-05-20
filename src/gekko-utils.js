const moment = require('moment');
const _ = require('lodash');
const IntIntervalSet = require('int-interval-set');


function toNextSegment(from, to, cachedRanges) {
  const fromS = from.unix();
  const toS = to.unix();
  const ranges = new IntIntervalSet().unionAll(_.map(cachedRanges, gekkoToRangeSetRange)).intersection(fromS, toS);

  if (ranges.isEmpty()) {
    return { from: from, to: to, cached: 0 };
  }

  let tailRange = ranges.intervals[0];
  if (tailRange.lower > fromS) {
    return { from: from, to: moment.unix(tailRange.lower), cached: 0 };
  }

  if (tailRange.lower === tailRange.upper) {
    if (ranges.intervals.length < 2) {
      return { from: from, to: to };
    }
    return { from: from, to: moment.unix(ranges.intervals[1].lower) };
  }

  return { from: from, to: moment.unix(tailRange.upper), cached: 1 };
}

function gekkoToRangeSetRange(range) {
  return {lower: range.from, upper: range.to};
}

function findNextGap(from, to, cachedRanges) {
  let fromS = from.unix();
  const toS = to.unix();
  const gaps = new IntIntervalSet()
    .unionAll(_.map(cachedRanges, gekkoToRangeSetRange))
    .complement().intersection(fromS, toS);
  
  if (!gaps.isEmpty()) {
    let gap = gaps.intervals[0];
    let gapLower = gap.lower > fromS ? gap.lower - 1 : gap.lower;
    return { from: moment.unix(gapLower), to: moment.unix(Math.min(toS, gap.upper+1)) };
  }
}

module.exports = {
  toNextSegment,
  findNextGap
};