import { getInitials } from '../features/profile/initials';

describe('getInitials', () => {
  it('takes the first letter of the first two words', () => {
    expect(getInitials('Bastian Guzmán', null)).toBe('BG');
  });

  it('uses a single letter for a one-word name', () => {
    expect(getInitials('Bastian', null)).toBe('B');
  });

  it('ignores extra whitespace between words', () => {
    expect(getInitials('  Bastian   Guzmán  ', null)).toBe('BG');
  });

  it('falls back to the email initial when there is no name', () => {
    expect(getInitials(null, 'basti@example.com')).toBe('B');
  });

  it('falls back to "?" when there is neither a name nor an email', () => {
    expect(getInitials(null, null)).toBe('?');
  });
});
