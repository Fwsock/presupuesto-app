// Metro's require() of an image returns a numeric asset id at runtime -- this
// stands in for that under plain Jest (ts-jest/Node), which has no idea how
// to load a .png at all. Only brandLogos.test.ts currently exercises this
// (via a require() of brandLogos.ts, which requires every file in
// assets/brands/) -- see jest.config.js's moduleNameMapper.
module.exports = 1;
