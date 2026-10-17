import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createAutocompleteInterlockManager,
  CURSOR_MOVE_KEYS,
  isCursorMoveKey,
  AUTOCOMPLETE_DEBOUNCE_MS,
} from '../src/components/CodeEditorPanel';

describe('Code Editor Autocomplete Debounce and Interlock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('defines 0.5s (500ms) debounce delay and cursor navigation keys', () => {
    expect(AUTOCOMPLETE_DEBOUNCE_MS).toBe(500);
    expect(CURSOR_MOVE_KEYS).toEqual([
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'Home',
      'End',
      'PageUp',
      'PageDown',
    ]);
    expect(isCursorMoveKey('ArrowLeft')).toBe(true);
    expect(isCursorMoveKey('ArrowRight')).toBe(true);
    expect(isCursorMoveKey('ArrowUp')).toBe(true);
    expect(isCursorMoveKey('ArrowDown')).toBe(true);
    expect(isCursorMoveKey('Home')).toBe(true);
    expect(isCursorMoveKey('End')).toBe(true);
    expect(isCursorMoveKey('PageUp')).toBe(true);
    expect(isCursorMoveKey('PageDown')).toBe(true);
    expect(isCursorMoveKey('KeyA')).toBe(false);
    expect(isCursorMoveKey('Enter')).toBe(false);
  });

  describe('Key input debounce (0.5s delay)', () => {
    it('shows autocomplete popup only after 0.5s (500ms) elapsed since key input stopped', () => {
      const onOpen = vi.fn();
      const onClose = vi.fn();
      const manager = createAutocompleteInterlockManager({
        onOpen,
        onClose,
        isEnabled: () => true,
      });

      // 1. 키 입력 발생
      manager.handleKeyInput('box ', 4);

      // 입력 중에는 즉시 닫기 호출되고 타이머가 활성화됨
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onOpen).not.toHaveBeenCalled();
      expect(manager.hasActiveTimer()).toBe(true);

      // 499ms 경과: 아직 팝업이 뜨지 않아야 함
      vi.advanceTimersByTime(499);
      expect(onOpen).not.toHaveBeenCalled();

      // 500ms (0.5초) 경과: 키 입력이 멈춘 후 0.5초 경과하여 팝업 표시
      vi.advanceTimersByTime(1);
      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(onOpen).toHaveBeenCalledWith('box ', 4);
      expect(manager.hasActiveTimer()).toBe(false);
    });

    it('resets the 0.5s timer when typing continues before 0.5s', () => {
      const onOpen = vi.fn();
      const onClose = vi.fn();
      const manager = createAutocompleteInterlockManager({
        onOpen,
        onClose,
        isEnabled: () => true,
      });

      // First keystroke
      manager.handleKeyInput('b', 1);
      vi.advanceTimersByTime(300);
      expect(onOpen).not.toHaveBeenCalled();

      // Second keystroke at +300ms (timer resets)
      manager.handleKeyInput('bo', 2);
      vi.advanceTimersByTime(300); // 300ms after 2nd keystroke (600ms total)
      expect(onOpen).not.toHaveBeenCalled();

      // Third keystroke at +300ms (timer resets)
      manager.handleKeyInput('box', 3);
      vi.advanceTimersByTime(499);
      expect(onOpen).not.toHaveBeenCalled();

      // Finally 500ms passed after typing stopped
      vi.advanceTimersByTime(1);
      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(onOpen).toHaveBeenCalledWith('box', 3);
    });
  });

  describe('Manual trigger (Ctrl+Space)', () => {
    it('shows popup immediately on Ctrl+Space without waiting for 0.5s', () => {
      const onOpen = vi.fn();
      const onClose = vi.fn();
      const manager = createAutocompleteInterlockManager({
        onOpen,
        onClose,
        isEnabled: () => true,
      });

      // Typing started (timer is active)
      manager.handleKeyInput('b', 1);
      expect(manager.hasActiveTimer()).toBe(true);

      // User presses Ctrl+Space
      manager.handleManualTrigger('b', 1);

      // Timer should be cancelled and onOpen called immediately
      expect(manager.hasActiveTimer()).toBe(false);
      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(onOpen).toHaveBeenCalledWith('b', 1);

      // Advancing time does not trigger an extra call
      vi.advanceTimersByTime(1000);
      expect(onOpen).toHaveBeenCalledTimes(1);
    });
  });

  describe('Mouse click interlock', () => {
    it('cancels scheduled popup timer and keeps popup hidden when mouse is clicked', () => {
      const onOpen = vi.fn();
      const onClose = vi.fn();
      const manager = createAutocompleteInterlockManager({
        onOpen,
        onClose,
        isEnabled: () => true,
      });

      // 1. 키 입력 후 0.5초 대기 중
      manager.handleKeyInput('box ', 4);
      expect(manager.hasActiveTimer()).toBe(true);

      // 2. 200ms 경과 시점에서 마우스 클릭 발생
      vi.advanceTimersByTime(200);
      manager.handleMouseClick();

      // 인터락: 대기 중인 타이머가 취소되고 닫기 호출
      expect(manager.hasActiveTimer()).toBe(false);
      expect(onClose).toHaveBeenCalled();

      // 0.5초(500ms) 이상 경과해도 팝업이 뜨지 않음
      vi.advanceTimersByTime(1000);
      expect(onOpen).not.toHaveBeenCalled();
    });

    it('closes an already open popup when mouse is clicked', () => {
      const onOpen = vi.fn();
      const onClose = vi.fn();
      const manager = createAutocompleteInterlockManager({
        onOpen,
        onClose,
        isEnabled: () => true,
      });

      // Open popup manually
      manager.handleManualTrigger('box', 3);
      expect(onOpen).toHaveBeenCalledTimes(1);

      // Mouse click occurs -> interlock closes popup
      onClose.mockClear();
      manager.handleMouseClick();
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cursor navigation key interlock', () => {
    CURSOR_MOVE_KEYS.forEach(key => {
      it(`cancels scheduled popup timer when cursor move key "${key}" is pressed`, () => {
        const onOpen = vi.fn();
        const onClose = vi.fn();
        const manager = createAutocompleteInterlockManager({
          onOpen,
          onClose,
          isEnabled: () => true,
        });

        // 키 입력 후 대기 중
        manager.handleKeyInput('box ', 4);
        expect(manager.hasActiveTimer()).toBe(true);

        // 250ms 시점에 커서 이동 키 입력
        vi.advanceTimersByTime(250);
        manager.handleCursorMoveKey(key);

        // 인터락: 타이머 취소됨
        expect(manager.hasActiveTimer()).toBe(false);

        // 시간 경과해도 팝업 뜨지 않음
        vi.advanceTimersByTime(1000);
        expect(onOpen).not.toHaveBeenCalled();
      });

      it(`closes open popup when cursor move key "${key}" is pressed`, () => {
        const onOpen = vi.fn();
        const onClose = vi.fn();
        const manager = createAutocompleteInterlockManager({
          onOpen,
          onClose,
          isEnabled: () => true,
        });

        manager.handleManualTrigger('box', 3);
        onClose.mockClear();

        manager.handleCursorMoveKey(key);
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('does not cancel timer for non-navigation keys in handleCursorMoveKey', () => {
      const onOpen = vi.fn();
      const onClose = vi.fn();
      const manager = createAutocompleteInterlockManager({
        onOpen,
        onClose,
        isEnabled: () => true,
      });

      manager.handleKeyInput('box', 3);
      manager.handleCursorMoveKey('Shift');
      manager.handleCursorMoveKey('KeyA');

      expect(manager.hasActiveTimer()).toBe(true);
      vi.advanceTimersByTime(500);
      expect(onOpen).toHaveBeenCalledTimes(1);
    });
  });

  describe('Disabled autocomplete setting', () => {
    it('does not schedule timer or open popup when autocomplete is disabled', () => {
      const onOpen = vi.fn();
      const onClose = vi.fn();
      const manager = createAutocompleteInterlockManager({
        onOpen,
        onClose,
        isEnabled: () => false,
      });

      manager.handleKeyInput('box', 3);
      expect(manager.hasActiveTimer()).toBe(false);
      vi.advanceTimersByTime(1000);
      expect(onOpen).not.toHaveBeenCalled();

      manager.handleManualTrigger('box', 3);
      expect(onOpen).not.toHaveBeenCalled();
    });
  });

  describe('Platform-specific Manual Trigger Shortcuts (isAutocompleteManualTrigger)', () => {
    it('triggers only on Shift+Cmd+Space for macOS', async () => {
      const { isAutocompleteManualTrigger } = await import('../src/components/CodeEditorPanel');

      // Mac: Shift + Cmd + Space -> true
      expect(isAutocompleteManualTrigger({ metaKey: true, shiftKey: true, code: 'Space' }, true)).toBe(true);
      expect(isAutocompleteManualTrigger({ metaKey: true, shiftKey: true, key: ' ' }, true)).toBe(true);

      // Mac: Cmd + Space without Shift -> false
      expect(isAutocompleteManualTrigger({ metaKey: true, shiftKey: false, code: 'Space' }, true)).toBe(false);

      // Mac: Ctrl + Space -> false
      expect(isAutocompleteManualTrigger({ ctrlKey: true, shiftKey: false, code: 'Space' }, true)).toBe(false);

      // Mac: Shift + Space -> false
      expect(isAutocompleteManualTrigger({ shiftKey: true, code: 'Space' }, true)).toBe(false);
    });

    it('triggers on Ctrl+Space for Windows/Linux non-Mac platforms', async () => {
      const { isAutocompleteManualTrigger } = await import('../src/components/CodeEditorPanel');

      // Non-Mac: Ctrl + Space -> true
      expect(isAutocompleteManualTrigger({ ctrlKey: true, shiftKey: false, code: 'Space' }, false)).toBe(true);
      expect(isAutocompleteManualTrigger({ ctrlKey: true, shiftKey: false, key: ' ' }, false)).toBe(true);

      // Non-Mac: Shift + Cmd + Space -> false
      expect(isAutocompleteManualTrigger({ metaKey: true, shiftKey: true, code: 'Space' }, false)).toBe(false);

      // Non-Mac: Ctrl + Shift + Space -> false
      expect(isAutocompleteManualTrigger({ ctrlKey: true, shiftKey: true, code: 'Space' }, false)).toBe(false);

      // Non-Mac: plain Space -> false
      expect(isAutocompleteManualTrigger({ code: 'Space' }, false)).toBe(false);
    });
  });
});

