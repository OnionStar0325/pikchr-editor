import { describe, it, expect } from 'vitest';
import {
  calculateZoomTransform,
  calculateFocalZoom,
  MIN_SCALE,
  MAX_SCALE,
} from '../src/lib/zoomMath';

describe('Google Maps Style Scroll & Focal Point Zoom (zoomMath)', () => {
  const containerRect = {
    left: 100,
    top: 50,
    width: 800,
    height: 600,
  };
  // Container center: (100 + 400, 50 + 300) = (500, 350)

  describe('calculateZoomTransform - Focal Point Invariance', () => {
    it('keeps the world point under cursor invariant when zooming in with wheel', () => {
      const currentScale = 1.0;
      const currentPan = { x: 0, y: 0 };
      const cursor = { x: 650, y: 400 }; // 150px right, 50px down from center

      const containerCenterX = containerRect.left + containerRect.width / 2; // 500
      const containerCenterY = containerRect.top + containerRect.height / 2; // 350

      // World coordinate before zoom
      const worldXBefore = (cursor.x - (containerCenterX + currentPan.x)) / currentScale;
      const worldYBefore = (cursor.y - (containerCenterY + currentPan.y)) / currentScale;

      // Scroll up (zoom in): deltaY = -50
      const { newScale, newPan } = calculateZoomTransform({
        currentScale,
        currentPan,
        deltaY: -50,
        cursor,
        containerRect,
      });

      expect(newScale).toBeGreaterThan(currentScale);

      // World coordinate after zoom under the exact same cursor position
      const worldXAfter = (cursor.x - (containerCenterX + newPan.x)) / newScale;
      const worldYAfter = (cursor.y - (containerCenterY + newPan.y)) / newScale;

      expect(worldXAfter).toBeCloseTo(worldXBefore, 1);
      expect(worldYAfter).toBeCloseTo(worldYBefore, 1);
    });

    it('keeps the world point under cursor invariant when zooming out with wheel', () => {
      const currentScale = 2.0;
      const currentPan = { x: -100, y: 50 };
      const cursor = { x: 400, y: 300 };

      const containerCenterX = containerRect.left + containerRect.width / 2;
      const containerCenterY = containerRect.top + containerRect.height / 2;

      const worldXBefore = (cursor.x - (containerCenterX + currentPan.x)) / currentScale;
      const worldYBefore = (cursor.y - (containerCenterY + currentPan.y)) / currentScale;

      // Scroll down (zoom out): deltaY = 60
      const { newScale, newPan } = calculateZoomTransform({
        currentScale,
        currentPan,
        deltaY: 60,
        cursor,
        containerRect,
      });

      expect(newScale).toBeLessThan(currentScale);

      const worldXAfter = (cursor.x - (containerCenterX + newPan.x)) / newScale;
      const worldYAfter = (cursor.y - (containerCenterY + newPan.y)) / newScale;

      expect(worldXAfter).toBeCloseTo(worldXBefore, 1);
      expect(worldYAfter).toBeCloseTo(worldYBefore, 1);
    });

    it('preserves center when cursor is positioned exactly at container center', () => {
      const currentScale = 1.0;
      const currentPan = { x: 0, y: 0 };
      const cursor = { x: 500, y: 350 }; // exactly at center

      const { newScale, newPan } = calculateZoomTransform({
        currentScale,
        currentPan,
        deltaY: -100,
        cursor,
        containerRect,
      });

      expect(newScale).toBeGreaterThan(1.0);
      expect(newPan.x).toBe(0);
      expect(newPan.y).toBe(0);
    });

    it('supports trackpad pinch-to-zoom (isPinch: true)', () => {
      const currentScale = 1.0;
      const currentPan = { x: 0, y: 0 };
      const cursor = { x: 500, y: 350 };

      // Pinch zoom in
      const resIn = calculateZoomTransform({
        currentScale,
        currentPan,
        deltaY: -20,
        cursor,
        containerRect,
        isPinch: true,
      });
      expect(resIn.newScale).toBeGreaterThan(currentScale);

      // Pinch zoom out
      const resOut = calculateZoomTransform({
        currentScale,
        currentPan,
        deltaY: 20,
        cursor,
        containerRect,
        isPinch: true,
      });
      expect(resOut.newScale).toBeLessThan(currentScale);
    });

    it('clamps scale within MIN_SCALE and MAX_SCALE limits', () => {
      const currentPan = { x: 0, y: 0 };
      const cursor = { x: 500, y: 350 };

      // Try zooming in way past max
      let scale = 5.8;
      for (let i = 0; i < 20; i++) {
        const res = calculateZoomTransform({
          currentScale: scale,
          currentPan,
          deltaY: -100,
          cursor,
          containerRect,
          maxScale: MAX_SCALE,
        });
        scale = res.newScale;
      }
      expect(scale).toBe(MAX_SCALE);

      // Try zooming out way past min
      scale = 0.2;
      for (let i = 0; i < 20; i++) {
        const res = calculateZoomTransform({
          currentScale: scale,
          currentPan,
          deltaY: 100,
          cursor,
          containerRect,
          minScale: MIN_SCALE,
        });
        scale = res.newScale;
      }
      expect(scale).toBe(MIN_SCALE);
    });
  });

  describe('calculateFocalZoom - Double Click and Toolbar Zoom', () => {
    it('zooms in by multiplier around clicked position on double click', () => {
      const currentScale = 1.0;
      const currentPan = { x: 0, y: 0 };
      const cursor = { x: 600, y: 350 }; // 100px right of center

      const containerCenterX = containerRect.left + containerRect.width / 2;
      const containerCenterY = containerRect.top + containerRect.height / 2;
      const worldXBefore = (cursor.x - (containerCenterX + currentPan.x)) / currentScale;

      const { newScale, newPan } = calculateFocalZoom({
        currentScale,
        currentPan,
        multiplier: 1.5,
        cursor,
        containerRect,
      });

      expect(newScale).toBe(1.5);
      const worldXAfter = (cursor.x - (containerCenterX + newPan.x)) / newScale;
      expect(worldXAfter).toBeCloseTo(worldXBefore, 1);
    });

    it('zooms out by reciprocal multiplier on Shift+double click', () => {
      const currentScale = 1.5;
      const currentPan = { x: -50, y: 0 };
      const cursor = { x: 600, y: 350 };

      const containerCenterX = containerRect.left + containerRect.width / 2;
      const worldXBefore = (cursor.x - (containerCenterX + currentPan.x)) / currentScale;

      const { newScale, newPan } = calculateFocalZoom({
        currentScale,
        currentPan,
        multiplier: 1 / 1.5,
        cursor,
        containerRect,
      });

      expect(newScale).toBeCloseTo(1.0, 2);
      const worldXAfter = (cursor.x - (containerCenterX + newPan.x)) / newScale;
      expect(worldXAfter).toBeCloseTo(worldXBefore, 1);
    });
  });
});
