export const MIN_SCALE = 0.15;
export const MAX_SCALE = 6.0;

export interface ContainerRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface ZoomTransformParams {
  currentScale: number;
  currentPan: Point;
  deltaY: number;
  cursor: Point;
  containerRect: ContainerRect;
  isPinch?: boolean;
  minScale?: number;
  maxScale?: number;
}

export interface FocalZoomParams {
  currentScale: number;
  currentPan: Point;
  multiplier: number;
  cursor: Point;
  containerRect: ContainerRect;
  minScale?: number;
  maxScale?: number;
}

export interface ZoomResult {
  newScale: number;
  newPan: Point;
}

/**
 * Calculates Google Maps style focal-point zoom where the point under the mouse cursor
 * remains stationary at the cursor position after scaling.
 */
export function calculateZoomTransform(params: ZoomTransformParams): ZoomResult {
  const {
    currentScale,
    currentPan,
    deltaY,
    cursor,
    containerRect,
    isPinch = false,
    minScale = MIN_SCALE,
    maxScale = MAX_SCALE,
  } = params;

  // 구글맵 스타일 줌 감도: 핀치는 직접 비례 감도, 일반 휠/트랙패드는 부드러운 감쇠 곡선 적용
  const clampedDelta = isPinch
    ? Math.max(-100, Math.min(100, deltaY))
    : Math.max(-120, Math.min(120, deltaY));

  const factor = isPinch
    ? Math.exp(-clampedDelta * 0.01)
    : Math.exp(-clampedDelta * 0.0018);

  const targetScale = currentScale * factor;
  const newScale = Math.min(Math.max(targetScale, minScale), maxScale);
  const actualRatio = newScale / currentScale;

  // 컨테이너 중심 기준 커서의 상대 오프셋 (cx, cy)
  const containerCenterX = containerRect.left + containerRect.width / 2;
  const containerCenterY = containerRect.top + containerRect.height / 2;
  const cx = cursor.x - containerCenterX;
  const cy = cursor.y - containerCenterY;

  // 마우스 커서가 가리키는 지점이 줌 후에도 마우스 커서 위치에 고정되도록 pan 이동량 산출
  const newPanX = cx - (cx - currentPan.x) * actualRatio;
  const newPanY = cy - (cy - currentPan.y) * actualRatio;

  return {
    newScale,
    newPan: {
      x: Math.round(newPanX * 100) / 100,
      y: Math.round(newPanY * 100) / 100,
    },
  };
}

/**
 * Calculates focal-point zoom with a fixed multiplier (e.g. 1.5x on double click, 1.25x on toolbar button).
 */
export function calculateFocalZoom(params: FocalZoomParams): ZoomResult {
  const {
    currentScale,
    currentPan,
    multiplier,
    cursor,
    containerRect,
    minScale = MIN_SCALE,
    maxScale = MAX_SCALE,
  } = params;

  const targetScale = currentScale * multiplier;
  const newScale = Math.min(Math.max(targetScale, minScale), maxScale);
  const actualRatio = newScale / currentScale;

  const containerCenterX = containerRect.left + containerRect.width / 2;
  const containerCenterY = containerRect.top + containerRect.height / 2;
  const cx = cursor.x - containerCenterX;
  const cy = cursor.y - containerCenterY;

  const newPanX = cx - (cx - currentPan.x) * actualRatio;
  const newPanY = cy - (cy - currentPan.y) * actualRatio;

  return {
    newScale,
    newPan: {
      x: Math.round(newPanX * 100) / 100,
      y: Math.round(newPanY * 100) / 100,
    },
  };
}
