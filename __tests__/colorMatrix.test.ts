import { buildGrayscaleContrastMatrix, applyColorMatrix } from '../lib/image/colorMatrix';

describe('buildGrayscaleContrastMatrix', () => {
  it('converts pure red to its Rec.601 luminance value at contrast=1', () => {
    const matrix = buildGrayscaleContrastMatrix(1);
    const { r, g, b, a } = applyColorMatrix(matrix, 1, 0, 0, 1);
    expect(r).toBeCloseTo(0.299, 5);
    expect(g).toBeCloseTo(0.299, 5);
    expect(b).toBeCloseTo(0.299, 5);
    expect(a).toBe(1);
  });

  it('converts pure white to white (luminance weights sum to 1)', () => {
    const matrix = buildGrayscaleContrastMatrix(1);
    const { r, g, b } = applyColorMatrix(matrix, 1, 1, 1, 1);
    expect(r).toBeCloseTo(1, 5);
    expect(g).toBeCloseTo(1, 5);
    expect(b).toBeCloseTo(1, 5);
  });

  it('converts pure black to black', () => {
    const matrix = buildGrayscaleContrastMatrix(1);
    const { r, g, b } = applyColorMatrix(matrix, 0, 0, 0, 1);
    expect(r).toBeCloseTo(0, 5);
    expect(g).toBeCloseTo(0, 5);
    expect(b).toBeCloseTo(0, 5);
  });

  it('leaves mid-gray exactly at 0.5 regardless of contrast (the pivot point)', () => {
    for (const contrast of [1, 1.5, 2, 0.5]) {
      const matrix = buildGrayscaleContrastMatrix(contrast);
      const { r } = applyColorMatrix(matrix, 0.5, 0.5, 0.5, 1);
      expect(r).toBeCloseTo(0.5, 5);
    }
  });

  it('stretches a light gray brighter with contrast > 1', () => {
    const matrix = buildGrayscaleContrastMatrix(2);
    const { r } = applyColorMatrix(matrix, 0.75, 0.75, 0.75, 1);
    expect(r).toBeCloseTo(1.0, 5);
  });

  it('stretches a dark gray darker with contrast > 1', () => {
    const matrix = buildGrayscaleContrastMatrix(2);
    const { r } = applyColorMatrix(matrix, 0.25, 0.25, 0.25, 1);
    expect(r).toBeCloseTo(0.0, 5);
  });

  it('compresses contrast toward mid-gray with contrast < 1', () => {
    const matrix = buildGrayscaleContrastMatrix(0.5);
    const { r } = applyColorMatrix(matrix, 1, 1, 1, 1);
    // White should move HALFWAY from 1.0 toward the 0.5 pivot.
    expect(r).toBeCloseTo(0.75, 5);
  });

  it('applies brightness as a flat additive offset on top of contrast', () => {
    const matrix = buildGrayscaleContrastMatrix(1, 0.1);
    const { r } = applyColorMatrix(matrix, 0.5, 0.5, 0.5, 1);
    expect(r).toBeCloseTo(0.6, 5);
  });

  it('passes alpha through unchanged regardless of contrast/brightness', () => {
    const matrix = buildGrayscaleContrastMatrix(1.8, 0.2);
    const { a } = applyColorMatrix(matrix, 0.4, 0.6, 0.2, 0.73);
    expect(a).toBe(0.73);
  });

  it('produces identical R, G and B output channels (true grayscale, no tint)', () => {
    const matrix = buildGrayscaleContrastMatrix(1.3, 0.05);
    const { r, g, b } = applyColorMatrix(matrix, 0.9, 0.2, 0.5, 1);
    expect(r).toBeCloseTo(g, 10);
    expect(g).toBeCloseTo(b, 10);
  });
});
