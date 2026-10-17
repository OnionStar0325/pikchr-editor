/**
 * Pikchr Lexer / Tokenizer
 * 
 * Tokenizes Pikchr source code into a stream of tokens with accurate line, column, and offset tracking.
 * Supports line continuation backslashes (\), string escapes, hex colors, ordinals, and full Pikchr keywords.
 */

export type TokenType =
  | 'LABEL_DEF'      // e.g. "In:", "Box1:"
  | 'SHAPE'          // "box", "circle", "arrow", "line", etc.
  | 'DIRECTION'      // "right", "down", "left", "up", "heading"
  | 'KEYWORD'        // other keywords like "fill", "wid", "at", "from", etc.
  | 'ORDINAL'        // "1st", "2nd", "3rd", "nth", etc.
  | 'IDENTIFIER'     // variable or object name, e.g. "$margin", "lineht", "Tokenizer"
  | 'NUMBER'         // 10, 0.5, .25 with optional units in, cm, mm, px, pt, %
  | 'HEX_COLOR'      // 0xd8ecd0, 0xffffff
  | 'STRING'         // "Hello"
  | 'ARROW'          // "->", "<-", "<->"
  | 'OPERATOR'       // "=", "+=", "-=", "*=", "/=", "+", "-", "*", "/", "%", "==", "!=", "<", ">", "<=", ">="
  | 'PUNCTUATION'    // "(", ")", "[", "]", "{", "}", ",", ".", ";"
  | 'SEMICOLON'      // ";"
  | 'NEWLINE'        // "\n" outside continuation
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
  offset: number;
  unit?: string; // for numbers with units
}

export const SHAPE_KEYWORDS = new Set([
  'box',
  'circle',
  'arrow',
  'line',
  'arc',
  'spline',
  'oval',
  'ellipse',
  'cylinder',
  'diamond',
  'file',
  'dot',
  'text',
  'move',
]);

export const DIRECTION_KEYWORDS = new Set([
  'right',
  'down',
  'left',
  'up',
  'heading',
  'north',
  'south',
  'east',
  'west',
  'ne',
  'nw',
  'se',
  'sw',
]);

export const COLOR_KEYWORDS = new Set([
  'white',
  'black',
  'red',
  'green',
  'blue',
  'gray',
  'grey',
  'yellow',
  'orange',
  'purple',
  'cyan',
  'magenta',
  'brown',
]);

export const ALL_KEYWORDS = new Set([
  ...SHAPE_KEYWORDS,
  ...DIRECTION_KEYWORDS,
  ...COLOR_KEYWORDS,
  // Dimensions
  'width', 'wid',
  'height', 'ht',
  'radius', 'rad',
  'diameter', 'diam',
  'thickness', 'thick',
  // Styles
  'fill', 'color', 'dashed', 'dotted', 'thin', 'invis', 'invisible', 'behind',
  // Positions & Paths
  'at', 'from', 'to', 'with', 'go', 'chop', 'then', 'until', 'even', 'between', 'and', 'of', 'way',
  // Flags & Modifiers
  'same', 'as', 'fit', 'cw', 'clockwise', 'ccw', 'counterclockwise',
  // Text Modifiers
  'big', 'small', 'bold', 'italic', 'mono', 'monospace', 'aligned', 'above', 'below', 'center', 'centre', 'ljust', 'rjust',
  // Anchors / Targets
  'first', 'last', 'previous', 'prev', 'start', 'end', 'vertex', 'top', 'bottom', 'bot',
  // Control
  'define', 'print', 'assert',
]);

export class Lexer {
  private input: string;
  private pos = 0;
  private line = 1;
  private column = 1;
  private length: number;

  constructor(input: string) {
    this.input = input;
    this.length = input.length;
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];
    while (this.pos < this.length) {
      const token = this.nextToken();
      if (!token) continue;
      tokens.push(token);
      if (token.type === 'EOF') break;
    }
    if (tokens.length === 0 || tokens[tokens.length - 1].type !== 'EOF') {
      tokens.push({
        type: 'EOF',
        value: '',
        line: this.line,
        column: this.column,
        offset: this.pos,
      });
    }
    return tokens;
  }

  private peek(offset = 0): string {
    const idx = this.pos + offset;
    return idx < this.length ? this.input[idx] : '';
  }

  private advance(): string {
    const ch = this.input[this.pos];
    this.pos++;
    if (ch === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return ch;
  }

  private nextToken(): Token | null {
    while (this.pos < this.length) {
      const startLine = this.line;
      const startCol = this.column;
      const startOffset = this.pos;
      const ch = this.peek();

      // 1. Whitespace (excluding newline)
      if (ch === ' ' || ch === '\t' || ch === '\r') {
        this.advance();
        continue;
      }

      // 2. Line continuation: backslash (\) followed by optional whitespace and newline
      if (ch === '\\') {
        let lookAhead = 1;
        while (
          this.pos + lookAhead < this.length &&
          (this.input[this.pos + lookAhead] === ' ' || this.input[this.pos + lookAhead] === '\t' || this.input[this.pos + lookAhead] === '\r')
        ) {
          lookAhead++;
        }
        if (this.pos + lookAhead < this.length && this.input[this.pos + lookAhead] === '\n') {
          // Consume backslash and subsequent whitespace up to newline
          this.advance(); // consume '\'
          while (this.peek() === ' ' || this.peek() === '\t' || this.peek() === '\r') {
            this.advance();
          }
          if (this.peek() === '\n') {
            this.advance(); // consume '\n'
          }
          continue; // continuation line ignored
        }
      }

      // 3. Comments
      if ((ch === '/' && this.peek(1) === '/') || ch === '#') {
        // Single line comment
        while (this.pos < this.length && this.peek() !== '\n') {
          this.advance();
        }
        continue;
      }
      if (ch === '/' && this.peek(1) === '*') {
        // Multi-line block comment
        this.advance(); // '/'
        this.advance(); // '*'
        while (this.pos < this.length && !(this.peek() === '*' && this.peek(1) === '/')) {
          this.advance();
        }
        if (this.pos < this.length) {
          this.advance(); // '*'
          this.advance(); // '/'
        }
        continue;
      }

      // 4. Newline (Statement terminator)
      if (ch === '\n') {
        this.advance();
        return {
          type: 'NEWLINE',
          value: '\n',
          line: startLine,
          column: startCol,
          offset: startOffset,
        };
      }

      // 5. Semicolon (Statement terminator)
      if (ch === ';') {
        this.advance();
        return {
          type: 'SEMICOLON',
          value: ';',
          line: startLine,
          column: startCol,
          offset: startOffset,
        };
      }

      // 6. Arrow heads: "->", "<-", "<->"
      if (ch === '<' && this.peek(1) === '-' && this.peek(2) === '>') {
        this.advance(); this.advance(); this.advance();
        return {
          type: 'ARROW',
          value: '<->',
          line: startLine,
          column: startCol,
          offset: startOffset,
        };
      }
      if (ch === '<' && this.peek(1) === '-') {
        this.advance(); this.advance();
        return {
          type: 'ARROW',
          value: '<-',
          line: startLine,
          column: startCol,
          offset: startOffset,
        };
      }
      if (ch === '-' && this.peek(1) === '>') {
        this.advance(); this.advance();
        return {
          type: 'ARROW',
          value: '->',
          line: startLine,
          column: startCol,
          offset: startOffset,
        };
      }

      // 7. Multi-character operators
      if (
        (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '=' || ch === '!' || ch === '<' || ch === '>') &&
        this.peek(1) === '='
      ) {
        const op = this.advance() + this.advance();
        return {
          type: 'OPERATOR',
          value: op,
          line: startLine,
          column: startCol,
          offset: startOffset,
        };
      }

      // 8. String literal
      if (ch === '"') {
        this.advance(); // consume opening quote
        let strVal = '';
        while (this.pos < this.length && this.peek() !== '"') {
          if (this.peek() === '\\') {
            this.advance(); // escape
            if (this.pos < this.length) {
              const escaped = this.advance();
              if (escaped === 'n') strVal += '\n';
              else if (escaped === 't') strVal += '\t';
              else if (escaped === '"') strVal += '"';
              else if (escaped === '\\') strVal += '\\';
              else strVal += escaped;
            }
          } else {
            strVal += this.advance();
          }
        }
        if (this.peek() === '"') {
          this.advance(); // consume closing quote
        }
        return {
          type: 'STRING',
          value: strVal,
          line: startLine,
          column: startCol,
          offset: startOffset,
        };
      }

      // 9. Hex color literal: 0x...
      if (ch === '0' && (this.peek(1) === 'x' || this.peek(1) === 'X')) {
        let hexVal = this.advance() + this.advance();
        while (this.pos < this.length && /[0-9a-fA-F]/.test(this.peek())) {
          hexVal += this.advance();
        }
        return {
          type: 'HEX_COLOR',
          value: hexVal,
          line: startLine,
          column: startCol,
          offset: startOffset,
        };
      }

      // 10. Number literal (e.g. 10, 0.5, .25) optionally with unit (in, cm, mm, px, pt, %)
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(this.peek(1)))) {
        let numVal = '';
        while (this.pos < this.length && /[0-9]/.test(this.peek())) {
          numVal += this.advance();
        }
        if (this.peek() === '.' && /[0-9]/.test(this.peek(1))) {
          numVal += this.advance(); // '.'
          while (this.pos < this.length && /[0-9]/.test(this.peek())) {
            numVal += this.advance();
          }
        }

        // Check if this is an ordinal like 1st, 2nd, 3rd, 4th
        if (this.pos < this.length && /^(st|nd|rd|th)\b/i.test(this.input.substring(this.pos))) {
          const ordSuffix = this.advance() + this.advance();
          return {
            type: 'ORDINAL',
            value: numVal + ordSuffix.toLowerCase(),
            line: startLine,
            column: startCol,
            offset: startOffset,
          };
        }

        // Check for units: in, cm, mm, px, pt, %
        let unit: string | undefined = undefined;
        if (this.peek() === '%') {
          unit = '%';
          this.advance();
        } else if (/^(in|cm|mm|px|pt)\b/i.test(this.input.substring(this.pos))) {
          unit = (this.advance() + this.advance()).toLowerCase();
        }

        return {
          type: 'NUMBER',
          value: numVal,
          unit,
          line: startLine,
          column: startCol,
          offset: startOffset,
        };
      }

      // 11. Word (Label, Keyword, Identifier, or Variable starting with $)
      if (/[a-zA-Z_$]/.test(ch)) {
        let word = '';
        while (this.pos < this.length && /[a-zA-Z0-9_$]/.test(this.peek())) {
          word += this.advance();
        }

        // Check for Label Definition: UpperCase word followed immediately by ':' (e.g. "In:", "CP:")
        if (this.peek() === ':' && /^[A-Z]/.test(word)) {
          this.advance(); // consume ':'
          return {
            type: 'LABEL_DEF',
            value: word,
            line: startLine,
            column: startCol,
            offset: startOffset,
          };
        }

        // In Pikchr, identifiers beginning with a capital letter are always object names/labels
        if (/^[A-Z]/.test(word)) {
          return {
            type: 'IDENTIFIER',
            value: word,
            line: startLine,
            column: startCol,
            offset: startOffset,
          };
        }

        // Shape Keyword
        const lowerWord = word.toLowerCase();
        if (SHAPE_KEYWORDS.has(lowerWord)) {
          return {
            type: 'SHAPE',
            value: lowerWord,
            line: startLine,
            column: startCol,
            offset: startOffset,
          };
        }

        // Direction Keyword
        if (DIRECTION_KEYWORDS.has(lowerWord)) {
          return {
            type: 'DIRECTION',
            value: lowerWord,
            line: startLine,
            column: startCol,
            offset: startOffset,
          };
        }

        // General Keyword
        if (ALL_KEYWORDS.has(lowerWord)) {
          return {
            type: 'KEYWORD',
            value: lowerWord,
            line: startLine,
            column: startCol,
            offset: startOffset,
          };
        }

        // Variable or Identifier
        return {
          type: 'IDENTIFIER',
          value: word,
          line: startLine,
          column: startCol,
          offset: startOffset,
        };
      }

      // 12. Single character punctuation or operator
      if ('+-*/%<>='.includes(ch)) {
        this.advance();
        return {
          type: 'OPERATOR',
          value: ch,
          line: startLine,
          column: startCol,
          offset: startOffset,
        };
      }

      if ('()[]{},.'.includes(ch)) {
        this.advance();
        return {
          type: 'PUNCTUATION',
          value: ch,
          line: startLine,
          column: startCol,
          offset: startOffset,
        };
      }

      // Unknown character fallback: consume and report as punctuation/operator
      const unknownChar = this.advance();
      return {
        type: 'PUNCTUATION',
        value: unknownChar,
        line: startLine,
        column: startCol,
        offset: startOffset,
      };
    }

    return {
      type: 'EOF',
      value: '',
      line: this.line,
      column: this.column,
      offset: this.pos,
    };
  }
}
