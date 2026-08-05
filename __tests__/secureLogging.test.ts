import { logSupabaseError } from '../lib/supabase';

describe('logSupabaseError', () => {
  const originalDev = (global as { __DEV__?: boolean }).__DEV__;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    (global as { __DEV__?: boolean }).__DEV__ = originalDev;
  });

  it('logs to console.error when __DEV__ is true', () => {
    (global as { __DEV__?: boolean }).__DEV__ = true;
    logSupabaseError('testContext', new Error('boom'));
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toContain('testContext');
  });

  it('does not log to console.error when __DEV__ is false (production build)', () => {
    (global as { __DEV__?: boolean }).__DEV__ = false;
    logSupabaseError('testContext', new Error('boom'));
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
