import { getPasswordStrength } from '../features/auth/passwordStrength';

describe('getPasswordStrength', () => {
  it('is baja for an empty password', () => {
    const result = getPasswordStrength('');
    expect(result.score).toBe(0);
    expect(result.level).toBe('baja');
    expect(result.checks).toEqual({
      minLength: false,
      hasUppercase: false,
      hasNumber: false,
      hasSpecialChar: false,
    });
  });

  it('is baja with only one check passing', () => {
    const result = getPasswordStrength('abcdefgh');
    expect(result.checks.minLength).toBe(true);
    expect(result.score).toBe(1);
    expect(result.level).toBe('baja');
  });

  it('is media with two or three checks passing', () => {
    const result = getPasswordStrength('Abcdefgh');
    expect(result.checks).toEqual({
      minLength: true,
      hasUppercase: true,
      hasNumber: false,
      hasSpecialChar: false,
    });
    expect(result.score).toBe(2);
    expect(result.level).toBe('media');
  });

  it('is alta when all four checks pass', () => {
    const result = getPasswordStrength('Abcdefg1!');
    expect(result.checks).toEqual({
      minLength: true,
      hasUppercase: true,
      hasNumber: true,
      hasSpecialChar: true,
    });
    expect(result.score).toBe(4);
    expect(result.level).toBe('alta');
  });

  it('detects each special character in the allowed set', () => {
    for (const char of ['!', '@', '#', '$', '%', '^', '&', '*', '.', ',']) {
      expect(getPasswordStrength(`a${char}`).checks.hasSpecialChar).toBe(true);
    }
  });

  it('does not count length toward hasNumber/hasUppercase/hasSpecialChar', () => {
    const result = getPasswordStrength('aaaaaaaa');
    expect(result.checks.hasUppercase).toBe(false);
    expect(result.checks.hasNumber).toBe(false);
    expect(result.checks.hasSpecialChar).toBe(false);
  });
});
