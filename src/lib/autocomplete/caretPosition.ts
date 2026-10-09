import { CaretCoordinates } from './types';

// Properties to copy from textarea to mirror element
const PROPERTIES_TO_COPY = [
  'direction',
  'boxSizing',
  'width',
  'height',
  'overflowX',
  'overflowY',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
  'MozTabSize',
  'whiteSpace',
  'wordBreak',
  'overflowWrap',
] as const;

let mirrorDiv: HTMLDivElement | null = null;

/**
 * HTML TextArea 내부의 특정 문자 인덱스(Caret Position)에 대한 픽셀 좌표(top, left)를 정밀 계산
 */
export function getCaretCoordinates(
  element: HTMLTextAreaElement,
  position: number
): CaretCoordinates {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { top: 0, left: 0, lineHeight: 20 };
  }

  // Create or reuse mirror element
  if (!mirrorDiv) {
    mirrorDiv = document.createElement('div');
    mirrorDiv.id = '__pikchr_caret_mirror_div__';
    document.body.appendChild(mirrorDiv);
  }

  const style = mirrorDiv.style;
  const computed = window.getComputedStyle(element);

  // Position mirror off-screen
  style.position = 'absolute';
  style.visibility = 'hidden';
  style.top = '-9999px';
  style.left = '-9999px';
  style.pointerEvents = 'none';
  style.whiteSpace = 'pre-wrap';
  style.wordWrap = 'break-word';

  // Copy computed styles from textarea
  PROPERTIES_TO_COPY.forEach((prop) => {
    style[prop as any] = computed[prop as any];
  });

  // Normalize lineHeight
  let lineHeight = parseFloat(computed.lineHeight);
  if (isNaN(lineHeight)) {
    lineHeight = parseFloat(computed.fontSize) * 1.4 || 20;
  }

  // Text before cursor
  const textBefore = element.value.substring(0, position);
  mirrorDiv.textContent = textBefore;

  // Append a marker span at cursor point
  const span = document.createElement('span');
  span.textContent = element.value.substring(position) || '.';
  mirrorDiv.appendChild(span);

  const spanTop = span.offsetTop + parseFloat(computed.borderTopWidth || '0');
  const spanLeft = span.offsetLeft + parseFloat(computed.borderLeftWidth || '0');

  // Compute coordinate relative to the textarea's top-left
  const top = spanTop - element.scrollTop;
  const left = spanLeft - element.scrollLeft;

  return {
    top: Math.max(0, top),
    left: Math.max(0, left),
    lineHeight,
  };
}
