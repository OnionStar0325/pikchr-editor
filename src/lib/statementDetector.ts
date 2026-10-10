/**
 * Statement completion detection for Pikchr source code.
 * 
 * In Pikchr:
 * - Statements are terminated by:
 *   1. Semicolons (;) outside of strings and comments.
 *   2. Newlines (\n) EXCEPT when the line ends with a backslash (\) continuation symbol
 *      (ignoring trailing whitespace and comments).
 */

/**
 * Checks if a single line of Pikchr code ends with a backslash continuation character (\),
 * ignoring trailing whitespace, tabs, and single-line comments (// and #).
 */
export function isContinuationLine(line: string): boolean {
  // Strip trailing carriage return
  let cleaned = line.replace(/\r$/, '');

  // Strip trailing single-line comments if they are not inside strings
  let inString = false;
  let commentIndex = -1;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const nextCh = i + 1 < cleaned.length ? cleaned[i + 1] : '';

    if (inString) {
      if (ch === '\\' && nextCh === '"') {
        i++; // skip escaped quote
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if ((ch === '/' && nextCh === '/') || ch === '#') {
      commentIndex = i;
      break;
    }
  }

  if (commentIndex !== -1) {
    cleaned = cleaned.substring(0, commentIndex);
  }

  // Trim trailing whitespace
  cleaned = cleaned.trimEnd();

  if (!cleaned) return false;

  // Check if it ends with an unescaped backslash (odd number of backslashes at end)
  const match = cleaned.match(/\\+$/);
  if (!match) return false;
  return match[0].length % 2 === 1;
}

/**
 * Scans through code and checks if there is any valid statement terminator (; or \n without \)
 * within the specified character range [changeStart, changeEnd).
 */
export function containsStatementTerminator(code: string, changeStart: number, changeEnd: number): boolean {
  let inString = false;
  let inSingleComment = false;
  let inMultiComment = false;
  let currentLineStartIndex = 0;

  const len = code.length;
  for (let i = 0; i < len; i++) {
    const ch = code[i];
    const nextCh = i + 1 < len ? code[i + 1] : '';

    if (inSingleComment) {
      if (ch === '\n') {
        if (i >= changeStart && i < changeEnd) {
          const lineBeforeNewline = code.substring(currentLineStartIndex, i);
          if (!isContinuationLine(lineBeforeNewline)) {
            return true;
          }
        }
        inSingleComment = false;
        currentLineStartIndex = i + 1;
      }
      continue;
    }

    if (inMultiComment) {
      if (ch === '*' && nextCh === '/') {
        inMultiComment = false;
        i++; // skip /
      } else if (ch === '\n') {
        currentLineStartIndex = i + 1;
      }
      continue;
    }

    if (inString) {
      if (ch === '\\' && nextCh === '"') {
        i++; // skip escaped quote
      } else if (ch === '"') {
        inString = false;
      } else if (ch === '\n') {
        currentLineStartIndex = i + 1;
      }
      continue;
    }

    // Start of string
    if (ch === '"') {
      inString = true;
      continue;
    }

    // Start of single-line comment
    if ((ch === '/' && nextCh === '/') || ch === '#') {
      inSingleComment = true;
      if (ch === '/') i++;
      continue;
    }

    // Start of multi-line comment
    if (ch === '/' && nextCh === '*') {
      inMultiComment = true;
      i++;
      continue;
    }

    // Semicolon outside strings and comments
    if (ch === ';') {
      if (i >= changeStart && i < changeEnd) {
        return true;
      }
      continue;
    }

    // Newline outside strings and block comments
    if (ch === '\n') {
      if (i >= changeStart && i < changeEnd) {
        const lineBeforeNewline = code.substring(currentLineStartIndex, i);
        if (!isContinuationLine(lineBeforeNewline)) {
          return true;
        }
      }
      currentLineStartIndex = i + 1;
      continue;
    }
  }

  return false;
}

/**
 * Determines if an edit from prevCode to newCode completes a Pikchr statement.
 */
export function isStatementCompleted(prevCode: string, newCode: string, cursorOffset?: number): boolean {
  if (prevCode === newCode) return false;

  // 1. Text addition or replacement
  if (newCode.length > prevCode.length) {
    // Find common prefix length
    let start = 0;
    while (start < prevCode.length && start < newCode.length && prevCode[start] === newCode[start]) {
      start++;
    }

    // Find common suffix length
    let endPrev = prevCode.length - 1;
    let endNew = newCode.length - 1;
    while (endPrev >= start && endNew >= start && prevCode[endPrev] === newCode[endNew]) {
      endPrev--;
      endNew--;
    }

    const insertedText = newCode.slice(start, endNew + 1);

    // Quick check: if no semicolon or newline was inserted, cannot be a statement completion
    if (!insertedText.includes(';') && !insertedText.includes('\n')) {
      return false;
    }

    return containsStatementTerminator(newCode, start, endNew + 1);
  }

  // 2. Same length replacement (e.g. replacing a char with ';' or '\n')
  if (newCode.length === prevCode.length) {
    let start = 0;
    while (start < prevCode.length && prevCode[start] === newCode[start]) {
      start++;
    }
    let end = prevCode.length - 1;
    while (end >= start && prevCode[end] === newCode[end]) {
      end--;
    }

    const changedText = newCode.slice(start, end + 1);
    if (!changedText.includes(';') && !changedText.includes('\n')) {
      return false;
    }
    return containsStatementTerminator(newCode, start, end + 1);
  }

  // 3. Deletion within a line does not complete a statement
  return false;
}
