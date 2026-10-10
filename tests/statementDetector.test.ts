import { describe, it, expect } from 'vitest';
import { isContinuationLine, isStatementCompleted } from '../src/lib/statementDetector';

describe('statementDetector', () => {
  describe('isContinuationLine', () => {
    it('returns true when line ends with backslash', () => {
      expect(isContinuationLine('arrow right \\')).toBe(true);
      expect(isContinuationLine('box \\')).toBe(true);
    });

    it('returns true when line ends with backslash followed by spaces or tabs', () => {
      expect(isContinuationLine('arrow right \\  \t ')).toBe(true);
    });

    it('returns true when line ends with backslash followed by a comment', () => {
      expect(isContinuationLine('arrow right \\ // continuation comment')).toBe(true);
      expect(isContinuationLine('arrow right \\ # bash style comment')).toBe(true);
    });

    it('returns false when line does not end with backslash', () => {
      expect(isContinuationLine('box "Hello"')).toBe(false);
      expect(isContinuationLine('arrow right 1cm')).toBe(false);
      expect(isContinuationLine('    then down 1')).toBe(false);
    });

    it('returns false for empty line or comment-only line without backslash', () => {
      expect(isContinuationLine('')).toBe(false);
      expect(isContinuationLine('// just a comment')).toBe(false);
    });

    it('returns false when backslash is inside a string literal', () => {
      expect(isContinuationLine('box "Text with \\"')).toBe(false);
    });
  });

  describe('isStatementCompleted', () => {
    it('detects statement completion when typing semicolon', () => {
      expect(isStatementCompleted('box', 'box;')).toBe(true);
      expect(isStatementCompleted('circle "A"', 'circle "A";')).toBe(true);
    });

    it('ignores semicolon inside a string literal', () => {
      expect(isStatementCompleted('box "', 'box ";')).toBe(false);
      expect(isStatementCompleted('box "Text', 'box "Text;')).toBe(false);
      expect(isStatementCompleted('box "Text;', 'box "Text; "')).toBe(false);
    });

    it('ignores semicolon inside single-line comment', () => {
      expect(isStatementCompleted('// comment', '// comment;')).toBe(false);
      expect(isStatementCompleted('# comment', '# comment;')).toBe(false);
    });

    it('ignores semicolon inside multi-line comment', () => {
      expect(isStatementCompleted('/* note', '/* note;')).toBe(false);
    });

    it('detects statement completion on newline when line does NOT end with backslash', () => {
      expect(isStatementCompleted('box "Hello"', 'box "Hello"\n')).toBe(true);
      expect(isStatementCompleted('circle', 'circle\n')).toBe(true);
      expect(isStatementCompleted('arrow right 2cm', 'arrow right 2cm\n')).toBe(true);
    });

    it('does NOT detect statement completion on newline when line ends with backslash continuation', () => {
      expect(isStatementCompleted('arrow right \\', 'arrow right \\\n')).toBe(false);
      expect(isContinuationLine('arrow right \\')).toBe(true);
      expect(isStatementCompleted(
        'arrow from 2nd last box right to previous.e \\',
        'arrow from 2nd last box right to previous.e \\\n'
      )).toBe(false);
    });

    it('detects statement completion on second segment when multiline arrow statement completes', () => {
      const codeLine1 = 'arrow from 2nd last box right to previous.e \\\n    then down 1';
      const codeLine1Completed = 'arrow from 2nd last box right to previous.e \\\n    then down 1\n';
      expect(isStatementCompleted(codeLine1, codeLine1Completed)).toBe(true);
    });

    it('detects statement completion when 1 is modified to 1cm and newline is pressed', () => {
      const codeBeforeEnter = 'arrow from 2nd last box right to previous.e \\\n    then down 1cm';
      const codeAfterEnter = 'arrow from 2nd last box right to previous.e \\\n    then down 1cm\n';
      expect(isStatementCompleted(codeBeforeEnter, codeAfterEnter)).toBe(true);
    });

    it('does NOT trigger while user is typing incomplete characters on a line', () => {
      expect(isStatementCompleted('box "Hell', 'box "Hello')).toBe(false);
      expect(isStatementCompleted('arrow ri', 'arrow rig')).toBe(false);
      expect(isStatementCompleted('arrow right ', 'arrow right 1')).toBe(false);
      expect(isStatementCompleted('arrow right 1', 'arrow right 1c')).toBe(false);
      expect(isStatementCompleted('arrow right 1c', 'arrow right 1cm')).toBe(false);
    });

    it('detects completion when pasting multiline code', () => {
      const prev = '';
      const pasted = 'box "A"\ncircle "B"\narrow right';
      expect(isStatementCompleted(prev, pasted)).toBe(true);
    });

    it('detects completion when pasting semicolons', () => {
      const prev = '';
      const pasted = 'box; circle; arrow;';
      expect(isStatementCompleted(prev, pasted)).toBe(true);
    });

    it('detects statement completion on newline after single line comment', () => {
      expect(isStatementCompleted('box // comment', 'box // comment\n')).toBe(true);
      expect(isStatementCompleted('circle # comment', 'circle # comment\n')).toBe(true);
    });

    it('does NOT detect statement completion on newline when line ends with backslash and comment', () => {
      expect(isStatementCompleted('arrow right \\ // continue', 'arrow right \\ // continue\n')).toBe(false);
      expect(isStatementCompleted('arrow right \\ # continue', 'arrow right \\ # continue\n')).toBe(false);
    });
  });
});
