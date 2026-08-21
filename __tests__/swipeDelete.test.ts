import { runSwipeToDeleteAction } from '../features/movements/swipeDelete';

describe('runSwipeToDeleteAction', () => {
  it('closes the swiped row and triggers the delete flow', () => {
    const closeRow = jest.fn();
    const onDelete = jest.fn();

    runSwipeToDeleteAction(closeRow, onDelete);

    expect(closeRow).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('closes the row before invoking onDelete, so the confirm dialog never stacks under an open panel', () => {
    const callOrder: string[] = [];
    const closeRow = jest.fn(() => callOrder.push('close'));
    const onDelete = jest.fn(() => callOrder.push('delete'));

    runSwipeToDeleteAction(closeRow, onDelete);

    expect(callOrder).toEqual(['close', 'delete']);
  });
});
