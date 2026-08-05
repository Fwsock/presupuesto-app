import { withMinDuration } from '../features/shared/withMinDuration';

describe('withMinDuration', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('waits for the minimum duration even if the promise resolves immediately', async () => {
    const spy = jest.fn();
    withMinDuration(Promise.resolve('done'), 500).then(spy);

    await jest.advanceTimersByTimeAsync(499);
    expect(spy).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    expect(spy).toHaveBeenCalledWith('done');
  });

  it('waits for the promise if it resolves after the minimum duration', async () => {
    let resolvePromise: (value: string) => void = () => {};
    const slow = new Promise<string>((resolve) => {
      resolvePromise = resolve;
    });
    const spy = jest.fn();
    withMinDuration(slow, 100).then(spy);

    await jest.advanceTimersByTimeAsync(1000);
    expect(spy).not.toHaveBeenCalled();

    resolvePromise('late');
    await jest.advanceTimersByTimeAsync(0);
    expect(spy).toHaveBeenCalledWith('late');
  });
});
