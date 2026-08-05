import { isValidPhoneNumber, parsePhoneNumber, formatPhoneNumber } from '../features/shared/countries';

describe('isValidPhoneNumber', () => {
  it('accepts a 9-digit Chilean mobile number starting with 9', () => {
    expect(isValidPhoneNumber('CL', '912345678')).toBe(true);
  });

  it('accepts a 9-digit Chilean landline starting with 2', () => {
    expect(isValidPhoneNumber('CL', '221234567')).toBe(true);
  });

  it('rejects a Chilean number of the wrong length', () => {
    expect(isValidPhoneNumber('CL', '91234567')).toBe(false);
  });

  it('rejects a Chilean number not starting with 9 or 2', () => {
    expect(isValidPhoneNumber('CL', '312345678')).toBe(false);
  });

  it('rejects non-digit characters', () => {
    expect(isValidPhoneNumber('CL', '91234567a')).toBe(false);
  });

  it('applies the loose 6-14 digit range for other countries', () => {
    expect(isValidPhoneNumber('US', '5551234')).toBe(true);
    expect(isValidPhoneNumber('US', '123')).toBe(false);
    expect(isValidPhoneNumber('US', '1234567890123456')).toBe(false);
  });
});

describe('parsePhoneNumber', () => {
  it('splits a stored Chilean number into country + local digits', () => {
    expect(parsePhoneNumber('+56 912345678')).toEqual({ countryCode: 'CL', digits: '912345678' });
  });

  it('matches the longest dial code first (Uruguay 598, not a shorter prefix)', () => {
    expect(parsePhoneNumber('+598 91234567')).toEqual({ countryCode: 'UY', digits: '91234567' });
  });

  it('falls back to the default country for an empty value', () => {
    expect(parsePhoneNumber(null)).toEqual({ countryCode: 'CL', digits: '' });
    expect(parsePhoneNumber('')).toEqual({ countryCode: 'CL', digits: '' });
  });

  it('falls back to the default country when nothing matches a known dial code', () => {
    expect(parsePhoneNumber('999999999999999999')).toEqual({ countryCode: 'CL', digits: '999999999999999999' });
  });
});

describe('formatPhoneNumber', () => {
  it('combines a country code and digits into the stored format', () => {
    expect(formatPhoneNumber('CL', '912345678')).toBe('+56 912345678');
  });

  it('falls back to the first country when the code is unknown', () => {
    expect(formatPhoneNumber('ZZ', '912345678')).toBe('+56 912345678');
  });
});
