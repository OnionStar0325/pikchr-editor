import { describe, it, expect } from 'vitest';
import { Lexer, Parser, validatePikchrStatement } from '../src/lib/parser';
import { EXAMPLES } from '../src/lib/examples';

describe('Pikchr Recursive Descent Parser & Validator', () => {
  describe('1. Lexer Tokenization', () => {
    it('tokenizes labels, shapes, and attributes', () => {
      const lexer = new Lexer('In: box "Interface" wid 150% ht 75% fill white');
      const tokens = lexer.tokenize();

      expect(tokens[0]).toMatchObject({ type: 'LABEL_DEF', value: 'In' });
      expect(tokens[1]).toMatchObject({ type: 'SHAPE', value: 'box' });
      expect(tokens[2]).toMatchObject({ type: 'STRING', value: 'Interface' });
      expect(tokens[3]).toMatchObject({ type: 'KEYWORD', value: 'wid' });
      expect(tokens[4]).toMatchObject({ type: 'NUMBER', value: '150', unit: '%' });
      expect(tokens[5]).toMatchObject({ type: 'KEYWORD', value: 'ht' });
      expect(tokens[6]).toMatchObject({ type: 'NUMBER', value: '75', unit: '%' });
      expect(tokens[7]).toMatchObject({ type: 'KEYWORD', value: 'fill' });
      expect(tokens[8]).toMatchObject({ type: 'KEYWORD', value: 'white' });
    });

    it('handles line continuation with backslash', () => {
      const code = 'box ht 100% \\\n  wid 200%';
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();

      const types = tokens.map(t => t.type);
      expect(types).not.toContain('NEWLINE');
      expect(tokens[0].value).toBe('box');
      expect(tokens[tokens.length - 2].value).toBe('200');
    });

    it('tokenizes hex colors, ordinals, and arrow symbols', () => {
      const lexer = new Lexer('fill 0xd8ecd0 1st 2nd -> <- <->');
      const tokens = lexer.tokenize();

      expect(tokens[1]).toMatchObject({ type: 'HEX_COLOR', value: '0xd8ecd0' });
      expect(tokens[2]).toMatchObject({ type: 'ORDINAL', value: '1st' });
      expect(tokens[3]).toMatchObject({ type: 'ORDINAL', value: '2nd' });
      expect(tokens[4]).toMatchObject({ type: 'ARROW', value: '->' });
      expect(tokens[5]).toMatchObject({ type: 'ARROW', value: '<-' });
      expect(tokens[6]).toMatchObject({ type: 'ARROW', value: '<->' });
    });
  });

  describe('2. Single Statement Parsing & AST Construction', () => {
    it('parses statements with complex inline positions, anchors and modifiers', () => {
      const s1 = 'line from 1st box.sw+(0.2,0) up until even with 1st box.n "Alan" above aligned';
      const r1 = Parser.parseStatement(s1);
      expect(r1.success).toBe(true);
      expect(r1.ast?.type).toBe('ShapeStatement');

      const s2 = 'box invis wid 2*boxwid "ndtable:" with .e at Start.w';
      const r2 = Parser.parseStatement(s2);
      expect(r2.success).toBe(true);
      expect(r2.ast?.type).toBe('ShapeStatement');

      const s3 = 'arrow <- from top of CPU up "input " rjust';
      const r3 = Parser.parseStatement(s3);
      expect(r3.success).toBe(true);
      expect(r3.ast?.type).toBe('ShapeStatement');
    });

    it('parses basic shape statements with text and dimensions', () => {
      const res = Parser.parseStatement('box "Process" wid 1.5 ht 0.8 fill 0xe0f2fe fit');
      expect(res.success).toBe(true);
      const stmt: any = res.ast;

      expect(stmt.type).toBe('ShapeStatement');
      expect(stmt.shapeType).toBe('box');
      expect(stmt.attributes.length).toBeGreaterThan(0);

      const textAttr = stmt.attributes.find((a: any) => a.type === 'TextAttribute');
      expect(textAttr).toBeDefined();
      expect(textAttr.text).toBe('Process');

      const fitAttr = stmt.attributes.find((a: any) => a.type === 'FitAttribute');
      expect(fitAttr).toBeDefined();
    });

    it('parses variable assignments with compound operators', () => {
      const res1 = Parser.parseStatement('lineht *= 0.4');
      expect(res1.success).toBe(true);
      expect(res1.ast).toMatchObject({
        type: 'AssignmentStatement',
        variable: 'lineht',
        operator: '*=',
      });

      const res2 = Parser.parseStatement('$margin = lineht * 2.5');
      expect(res2.success).toBe(true);
      expect(res2.ast).toMatchObject({
        type: 'AssignmentStatement',
        variable: '$margin',
        operator: '=',
      });
    });

    it('parses connector lines with natural language positions and chops', () => {
      const res = Parser.parseStatement('arrow from CP to 1/4<Tokenizer.sw,Tokenizer.nw> chop');
      expect(res.success).toBe(true);
      const stmt: any = res.ast;

      expect(stmt.shapeType).toBe('arrow');
      const fromAttr = stmt.attributes.find((a: any) => a.kind === 'from');
      expect(fromAttr).toBeDefined();

      const toAttr = stmt.attributes.find((a: any) => a.kind === 'to');
      expect(toAttr).toBeDefined();
      expect(toAttr.position.type).toBe('BetweenExpression');

      const chopAttr = stmt.attributes.find((a: any) => a.kind === 'chop');
      expect(chopAttr).toBeDefined();
    });

    it('parses complex arithmetic expressions with object component accessors', () => {
      const res = Parser.parseStatement('box ht (In.n.y - VM.s.y) + $margin wid In.wid + $margin at CP fill 0xd8ecd0 behind In');
      expect(res.success).toBe(true);
      const stmt: any = res.ast;

      expect(stmt.shapeType).toBe('box');
      const htAttr = stmt.attributes.find((a: any) => a.name === 'height');
      expect(htAttr).toBeDefined();
      expect(htAttr.value.type).toBe('BinaryExpression');

      const behindAttr = stmt.attributes.find((a: any) => a.type === 'BehindAttribute');
      expect(behindAttr).toBeDefined();
      expect(behindAttr.target.name).toBe('In');
    });

    it('parses multi-segment waypoints with until even with', () => {
      const res = Parser.parseStatement('arrow from Src chop down until even with CC1 then to Lemon.nw rad 20px');
      expect(res.success).toBe(true);
      const stmt: any = res.ast;

      expect(stmt.shapeType).toBe('arrow');
      const untilAttr = stmt.attributes.find((a: any) => a.kind === 'until_even_with');
      expect(untilAttr).toBeDefined();

      const waypoint = stmt.attributes.find((a: any) => a.type === 'WaypointAttribute');
      expect(waypoint).toBeDefined();
      expect(waypoint.to).toBeDefined();
      expect(waypoint.radius).toBeDefined();
    });

    it('parses natural language anchor references: top of LA, east of DMP, 2nd last box.s', () => {
      const res1 = Parser.parseStatement('arrow <-> up from top of LA');
      expect(res1.success).toBe(true);

      const res2 = Parser.parseStatement('line invis from 0.25*$margin east of last.sw up last.ht');
      expect(res2.success).toBe(true);

      const res3 = Parser.parseStatement('"trunk" below at 2nd last box.s');
      expect(res3.success).toBe(true);
      expect((res3.ast as any).shapeType).toBe('text');
    });

    it('parses define macro statements', () => {
      const res = Parser.parseStatement('define ndblock { box wid boxwid/2 ht boxht/2; down; box same }');
      expect(res.success).toBe(true);
      const stmt: any = res.ast;

      expect(stmt.type).toBe('DefineStatement');
      expect(stmt.name).toBe('ndblock');
      expect(stmt.body.length).toBeGreaterThan(0);
    });
  });

  describe('3. Single Statement Validator', () => {
    it('validates correct single statements with isValid: true and isComplete: true', () => {
      const validCases = [
        'box "Hello World" fill white',
        'circle rad 0.5 at (1, 2)',
        'arrow right 1.5 from previous.e',
        'lineht = 0.5',
        'scale = 1.0',
        'down',
        'right 20px',
        '// this is a comment',
        'define mymacro { circle }',
      ];

      for (const code of validCases) {
        const val = validatePikchrStatement(code);
        expect(val.isValid, `Expected valid for: ${code}`).toBe(true);
        expect(val.isComplete, `Expected complete for: ${code}`).toBe(true);
      }
    });

    it('detects incomplete statements (in progress of typing)', () => {
      const incompleteCases = [
        'box "Unclosed string',
        'box at',
        'arrow from',
        'scale =',
        'box ht 100% +',
        'arrow to 1/2<A,',
      ];

      for (const code of incompleteCases) {
        const val = validatePikchrStatement(code);
        expect(val.isComplete, `Expected incomplete for: ${code}`).toBe(false);
      }
    });

    it('warns on incompatible shape attributes', () => {
      // e.g. "cw" on box
      const val = validatePikchrStatement('box "Test" cw');
      expect(val.issues.some(i => i.severity === 'warning')).toBe(true);
      expect(val.issues.some(i => i.message.includes('incompatible'))).toBe(true);
    });

    it('reports exact line and column position for syntax errors', () => {
      const val = validatePikchrStatement('box foo @ bar');
      expect(val.isValid).toBe(false);
      expect(val.issues.length).toBeGreaterThan(0);
      expect(val.issues[0].line).toBeGreaterThanOrEqual(1);
      expect(val.issues[0].column).toBeGreaterThanOrEqual(1);
    });
  });

function splitScriptIntoStatements(code: string): string[] {
  const statements: string[] = [];
  let inString = false;
  let braceDepth = 0;
  let bracketDepth = 0;
  let current = '';

  const lines = code.split('\n');
  for (let l = 0; l < lines.length; l++) {
    const rawLine = lines[l];
    let line = rawLine;

    // Check if line ends with unescaped backslash
    const trimmed = line.trimEnd();
    const isContinuation = trimmed.endsWith('\\');
    if (isContinuation) {
      line = trimmed.slice(0, -1) + ' ';
    }

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const prevCh = i > 0 ? line[i - 1] : '';

      if (ch === '"' && prevCh !== '\\') {
        inString = !inString;
        current += ch;
        continue;
      }

      if (!inString) {
        if (ch === '{') braceDepth++;
        else if (ch === '}') braceDepth = Math.max(0, braceDepth - 1);
        else if (ch === '[') bracketDepth++;
        else if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1);

        // Comment check outside strings: if # or //, skip rest of line
        if ((ch === '#' || (ch === '/' && line[i + 1] === '/')) && braceDepth === 0 && bracketDepth === 0) {
          break; // rest of line is comment
        }

        if (braceDepth === 0 && bracketDepth === 0) {
          if (ch === ';') {
            const trimmedStmt = current.trim();
            if (trimmedStmt && !trimmedStmt.startsWith('#') && !trimmedStmt.startsWith('//')) {
              statements.push(trimmedStmt);
            }
            current = '';
            continue;
          }
        }
      }

      current += ch;
    }

    if (!isContinuation && braceDepth === 0 && bracketDepth === 0) {
      const trimmedStmt = current.trim();
      if (trimmedStmt && !trimmedStmt.startsWith('#') && !trimmedStmt.startsWith('//')) {
        statements.push(trimmedStmt);
      }
      current = '';
    } else if (isContinuation) {
      current += ' ';
    } else {
      current += '\n';
    }
  }

  const finalTrimmed = current.trim();
  if (finalTrimmed && !finalTrimmed.startsWith('#') && !finalTrimmed.startsWith('//')) {
    statements.push(finalTrimmed);
  }

  return statements;
}

  describe('4. Official Pikchr Sample Scripts Validation', () => {
    EXAMPLES.forEach((sample) => {
      it(`parses official sample [${sample.name}] (${sample.id}) as a full program AST`, () => {
        const result = Parser.parse(sample.code);
        expect(
          result.success,
          `Failed parsing sample '${sample.name}': ${result.error?.message} at line ${result.error?.line}:${result.error?.column}`
        ).toBe(true);
        expect(result.ast).toBeDefined();
        expect(result.ast!.statements.length).toBeGreaterThan(0);
      });

      it(`validates every single statement in [${sample.name}] individually`, () => {
        const rawStatements = splitScriptIntoStatements(sample.code);
        expect(rawStatements.length).toBeGreaterThan(0);

        for (const stmt of rawStatements) {
          const val = validatePikchrStatement(stmt);
          expect(
            val.isValid,
            `Statement validation failed in '${sample.name}':\nStatement: "${stmt}"\nError: ${val.issues.map(i => i.message).join(', ')}`
          ).toBe(true);
        }
      });
    });
  });
});
