import { rubberBand, phaseFor } from '../features/shared/pullToRefresh';

describe('rubberBand', () => {
  it('returns 0 for a non-positive distance', () => {
    expect(rubberBand(0, 130)).toBe(0);
    expect(rubberBand(-20, 130)).toBe(0);
  });

  it('returns 0 for a non-positive maxPull, never NaN/Infinity', () => {
    expect(rubberBand(50, 0)).toBe(0);
    expect(rubberBand(50, -10)).toBe(0);
  });

  it('is roughly linear (close to coefficient * distance) for a small pull', () => {
    const result = rubberBand(10, 130);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(10);
    expect(result).toBeCloseTo(5.5, 0); // ~= RUBBER_BAND_COEFFICIENT (0.55) * 10
  });

  it('grows monotonically with distance', () => {
    const a = rubberBand(20, 130);
    const b = rubberBand(80, 130);
    const c = rubberBand(300, 130);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it('flattens out well below maxPull even for a very large drag', () => {
    const result = rubberBand(5000, 130);
    expect(result).toBeLessThan(130);
    expect(result).toBeGreaterThan(100); // still approaches it, doesn't collapse
  });
});

describe('phaseFor', () => {
  it('is "refreshing" whenever refreshing is true, regardless of translateY', () => {
    expect(phaseFor(0, 80, true)).toBe('refreshing');
    expect(phaseFor(200, 80, true)).toBe('refreshing');
  });

  it('is "idle" at rest', () => {
    expect(phaseFor(0, 80, false)).toBe('idle');
  });

  it('is "pull" between 0 and the threshold', () => {
    expect(phaseFor(40, 80, false)).toBe('pull');
  });

  it('is "release" at or past the threshold', () => {
    expect(phaseFor(80, 80, false)).toBe('release');
    expect(phaseFor(120, 80, false)).toBe('release');
  });
});
