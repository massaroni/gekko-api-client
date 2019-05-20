var chai = require('chai');
var expect = chai.expect;
const moment = require('moment');

const utils = require('../src/gekko-utils');
const IntIntervalSet = require('int-interval-set');
const _ = require('lodash');

describe('Gekko Utils', function () {

  describe('findNextGap', function () {
    it('should skip over leading out of bounds segments', function () {
      let ranges = [
        { from: 1557600000, to: 1557600010 },
        { from: 1557600011, to: 1557600020 },
        { from: 1557600021, to: 1557600030 },
        { from: 1557600031, to: 1557600090 },
      ];
      let from = moment.unix(1557600040);
      let to = moment.unix(1557600050);
      let segment = utils.findNextGap(from, to, ranges);
      expect(segment).to.be.undefined;
    });


    it('should skip over leading out of bounds segments and find the first inner gap', function () {
      let ranges = [
        { from: 1557600000, to: 1557600010 },
        { from: 1557600011, to: 1557600020 },
        { from: 1557600021, to: 1557600030 },
        { from: 1557600050, to: 1557600090 },
      ];
      let from = moment.unix(1557600020);
      let to = moment.unix(1557600060);
      let segment = utils.findNextGap(from, to, ranges);
      expect(segment.from.unix()).to.equal(1557600030);
      expect(segment.to.unix()).to.equal(1557600050);
    });


    it('should mark a leading gap as uncached', function () {
      let ranges = [
        { from: 1557600011, to: 1557600020 },
        { from: 1557600021, to: 1557600030 }
      ];
      let from = moment.unix(1557600000);
      let to = moment.unix(1557600050);
      let segment = utils.findNextGap(from, to, ranges);
      expect(segment.from.unix()).to.equal(1557600000);
      expect(segment.to.unix()).to.equal(1557600011);
    });


    it('should mark a leading gap as uncached, ignoring out of bounds segments', function () {
      let ranges = [
        { from: 1549066680, to: 1550621880 },
        { from: 1554077880, to: 1557735480 }
      ];
      let ranges2 = _.map(ranges, (range) => {return {lower: range.from, upper: range.to}});
  
      let from = moment.utc('2019-04-01T00:00:00Z');
      let to = moment.utc('2019-05-13T00:00:00Z');
      expect(from.unix()).to.equal(1554076800);

      const fromS = from.unix();
      const toS = to.unix();
      const cached = new IntIntervalSet().unionAll(ranges2);
      const gaps = cached.complement();
      const gapsBounded = gaps.intersection(fromS, toS);

      const expectedGaps = [
        { lower: -Number.MAX_SAFE_INTEGER, upper: 1549066679 },
        { lower: 1550621881, upper: 1554077879 },
        { lower: 1557735481, upper: Number.MAX_SAFE_INTEGER }
      ];
      const expectedGapsBounded = [
        { lower: 1554076800, upper: 1554077879 }
      ];

      expect(JSON.stringify(cached.intervals)).to.equal(JSON.stringify(ranges2));
      expect(JSON.stringify(gaps.intervals)).to.equal(JSON.stringify(expectedGaps));
      expect(JSON.stringify(gapsBounded.intervals)).to.equal(JSON.stringify(expectedGapsBounded));

      let segment = utils.findNextGap(from, to, ranges);
      expect(segment.from.unix()).to.equal(1554076800);
      expect(segment.to.unix()).to.equal(1554077880);
    });


    it('should find the first inner gap', function () {
      let ranges = [
        { from: 1557600011, to: 1557600020 },
        { from: 1557600025, to: 1557600030 }
      ];
      let from = moment.unix(1557600015);
      let to = moment.unix(1557600050);
      let segment = utils.findNextGap(from, to, ranges);
      expect(segment.from.unix()).to.equal(1557600020);
      expect(segment.to.unix()).to.equal(1557600025);
    });


    it('should find the first inner gap, bounded', function () {
      let ranges = [
        { from: 1557600011, to: 1557600020 },
        { from: 1557600025, to: 1557600030 }
      ];
      let from = moment.unix(1557600015);
      let to = moment.unix(1557600023);
      let segment = utils.findNextGap(from, to, ranges);
      expect(segment.from.unix()).to.equal(1557600020);
      expect(segment.to.unix()).to.equal(1557600023);
    });

  });


  describe('toNextSegment', function () {
    it('should skip over leading out of bounds segments', function () {
      let ranges = [
        { from: 1557600000, to: 1557600010 },
        { from: 1557600011, to: 1557600020 },
        { from: 1557600021, to: 1557600030 },
        { from: 1557600031, to: 1557600090 },
      ];
      let from = moment.unix(1557600040);
      let to = moment.unix(1557600050);
      let segment = utils.toNextSegment(from, to, ranges);
      expect(segment.from.unix()).to.equal(1557600040);
      expect(segment.to.unix()).to.equal(1557600050);
      expect(!!segment.cached).to.be.true;
    });


    it('should mark a leading gap as uncached', function () {
      let ranges = [
        { from: 1557600011, to: 1557600020 },
        { from: 1557600021, to: 1557600030 }
      ];
      let from = moment.unix(1557600000);
      let to = moment.unix(1557600050);
      let segment = utils.toNextSegment(from, to, ranges);
      expect(segment.from.unix()).to.equal(1557600000);
      expect(segment.to.unix()).to.equal(1557600011);
      expect(!!segment.cached).to.be.false;
    });


    it('should merge contiguous segments', function () {
      let ranges = [
        { from: 1557600000, to: 1557600010 },
        { from: 1557600011, to: 1557600020 },
        { from: 1557600021, to: 1557600030 },
        { from: 1557600050, to: 1557600090 },
      ];
      let from = moment.unix(1557600020);
      let to = moment.unix(1557600060);
      let segment = utils.toNextSegment(from, to, ranges);
      expect(segment.from.unix()).to.equal(1557600020);
      expect(segment.to.unix()).to.equal(1557600030);
      expect(!!segment.cached).to.equal(true);
    });


    it('should mark a leading segment as cached', function () {
      let ranges = [
        { from: 1557600010, to: 1557600020 },
        { from: 1557600022, to: 1557600030 }
      ];
      let from = moment.unix(1557600011);
      let to = moment.unix(1557600050);
      let segment = utils.toNextSegment(from, to, ranges);
      expect(segment.from.unix()).to.equal(1557600011);
      expect(segment.to.unix()).to.equal(1557600020);
      expect(!!segment.cached).to.be.true;
    });


    it('should mark a flush leading segment as cached', function () {
      let ranges = [
        { from: 1557600011, to: 1557600020 },
        { from: 1557600022, to: 1557600030 }
      ];
      let from = moment.unix(1557600011);
      let to = moment.unix(1557600050);
      let segment = utils.toNextSegment(from, to, ranges);
      expect(segment.from.unix()).to.equal(1557600011);
      expect(segment.to.unix()).to.equal(1557600020);
      expect(!!segment.cached).to.be.true;
    });


    it('should mark contiguous segments as cached', function () {
      let ranges = [
        { from: 1557600011, to: 1557600020 },
        { from: 1557600021, to: 1557600030 }
      ];
      let from = moment.unix(1557600011);
      let to = moment.unix(1557600050);
      let segment = utils.toNextSegment(from, to, ranges);
      expect(segment.from.unix()).to.equal(1557600011);
      expect(segment.to.unix()).to.equal(1557600030);
      expect(!!segment.cached).to.be.true;
    });


    it('should not return a segment larger than the to/from bounds', function () {
      let ranges = [
        { from: 1557600000, to: 1557600100 }
      ];
      let from = moment.unix(1557600011);
      let to = moment.unix(1557600050);
      let segment = utils.toNextSegment(from, to, ranges);
      expect(segment.from.unix()).to.equal(1557600011);
      expect(segment.to.unix()).to.equal(1557600050);
      expect(!!segment.cached).to.be.true;
    });


    it('should find the uncached gaps', function () {
      let ranges = [
        { from: 1549066320, to: 1549149120 },
        { from: 1549199520, to: 1556885520 }
      ];

      let from = moment.utc('2019-02-01 00:00');
      const fromS = from.unix();
      let to = moment.utc('2019-02-10 00:00');
      let segment = utils.toNextSegment(from, to, ranges);
      let fromExpected = moment.utc('2019-02-01 00:00').unix();
      expect(segment.from.unix()).to.equal(fromExpected);
      expect(segment.to.unix()).to.equal(1549066320);
      expect(!!segment.cached).to.be.false;

      ranges = [
        { from: fromS, to: 1549149120 },
        { from: 1549199520, to: 1556885520 }
      ];

      from = moment.utc('2019-02-01 00:00');
      to = moment.utc('2019-02-10 00:00');
      segment = utils.toNextSegment(from, to, ranges);
      expect(segment.from.unix()).to.equal(fromS);
      expect(segment.to.unix()).to.equal(1549149120);
      expect(!!segment.cached).to.be.true;

      from = moment.unix(1549149120);
      to = moment.utc('2019-02-10 00:00');
      segment = utils.toNextSegment(from, to, ranges);
      expect(segment.from.unix()).to.equal(1549149120);
      expect(segment.to.unix()).to.equal(1549199520);
      expect(!!segment.cached).to.be.false;

      ranges = [
        { from: fromS, to: 1556885520 }
      ];

      from = moment.unix(1549149120);
      to = moment.utc('2019-02-10 00:00');
      segment = utils.toNextSegment(from, to, ranges);
      expect(segment.from.unix()).to.equal(1549149120);
      expect(segment.to.unix()).to.equal(moment.utc('2019-02-10 00:00').unix());
      expect(!!segment.cached).to.be.true;
    });
  });

});
