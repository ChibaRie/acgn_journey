// @vitest-environment jsdom
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ModalDialog from './ModalDialog.jsx';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

test('opens a named native dialog and handles cancel without an extra close event', () => {
  const onClose = vi.fn();
  render(
    <ModalDialog titleId="test-title" onClose={onClose}>
      <h2 id="test-title">数据设置</h2>
    </ModalDialog>
  );
  const dialog = screen.getByRole('dialog', { name: '数据设置' });
  expect(dialog.open).toBe(true);
  const event = new Event('cancel', { cancelable: true, bubbles: true });
  fireEvent(dialog, event);
  expect(event.defaultPrevented).toBe(true);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('returns focus to its trigger when unmounted', () => {
  const trigger = document.createElement('button');
  document.body.append(trigger);
  trigger.focus();
  const view = render(
    <ModalDialog titleId="test-title" onClose={() => {}}>
      <h2 id="test-title">编辑作品</h2>
      <input aria-label="标题" />
    </ModalDialog>
  );
  screen.getByRole('textbox', { name: '标题' }).focus();
  view.unmount();
  expect(document.activeElement).toBe(trigger);
});

test('uses the main content as a focus fallback after a deleted trigger', () => {
  const main = document.createElement('main');
  main.tabIndex = -1;
  main.dataset.focusFallback = '';
  const trigger = document.createElement('button');
  document.body.append(main, trigger);
  trigger.focus();
  const view = render(
    <ModalDialog titleId="test-title" onClose={() => {}}>
      <h2 id="test-title">删除作品</h2>
    </ModalDialog>
  );
  trigger.remove();
  view.unmount();
  expect(document.activeElement).toBe(main);
});
