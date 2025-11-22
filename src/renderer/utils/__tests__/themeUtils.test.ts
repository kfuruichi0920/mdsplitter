/**
 * @file themeUtils.test.ts
 * @brief テーマユーティリティ関数のユニットテスト。
 * @author K.Furuichi
 * @date 2025-11-06
 * @version 0.1
 * @copyright MIT
 */

import { applyThemeColors, applySplitterWidth } from '../themeUtils';
import type { ThemeColorSettings } from '@/shared/settings';

describe('themeUtils', () => {
  let root: HTMLElement;

  beforeEach(() => {
    //! テスト用のルート要素を作成
    root = document.documentElement;
  });

  afterEach(() => {
    //! テスト後にCSS変数をクリア
    const cssVars = [
      '--theme-background',
      '--theme-foreground',
      '--theme-border',
      '--theme-primary',
      '--theme-secondary',
      '--theme-card-background',
      '--theme-card-border',
      '--theme-connector-active',
      '--theme-connector-inactive',
      '--theme-splitter-width',
    ];
    cssVars.forEach((varName) => {
      root.style.removeProperty(varName);
    });
  });

  describe('applyThemeColors', () => {
    it('should apply all theme color settings as CSS variables', () => {
      //! ダークモード色設定を適用
      const darkColors: ThemeColorSettings = {
        background: '#111827',
        foreground: '#f9fafb',
        border: '#374151',
        primary: '#60a5fa',
        secondary: '#9ca3af',
        cardBackground: '#1f2937',
        cardBorder: '#4b5563',
        connectorActive: '#3b82f6',
        connectorInactive: '#6b7280',
      };

      applyThemeColors(darkColors);

      //! 各CSS変数が正しく設定されていることを確認 (RGBチャネルに変換される)
      expect(root.style.getPropertyValue('--theme-background')).toBe('17 24 39');
      expect(root.style.getPropertyValue('--theme-foreground')).toBe('249 250 251');
      expect(root.style.getPropertyValue('--theme-border')).toBe('55 65 81');
      expect(root.style.getPropertyValue('--theme-primary')).toBe('96 165 250');
      expect(root.style.getPropertyValue('--theme-secondary')).toBe('156 163 175');
      expect(root.style.getPropertyValue('--theme-card-background')).toBe('31 41 55');
      expect(root.style.getPropertyValue('--theme-card-border')).toBe('75 85 99');
      expect(root.style.getPropertyValue('--theme-connector-active')).toBe('59 130 246');
      expect(root.style.getPropertyValue('--theme-connector-inactive')).toBe('107 114 128');
    });

    it('should update theme colors when called multiple times', () => {
      //! 最初にダークモード色を適用
      const darkColors: ThemeColorSettings = {
        background: '#111827',
        foreground: '#f9fafb',
        border: '#374151',
        primary: '#60a5fa',
        secondary: '#9ca3af',
        cardBackground: '#1f2937',
        cardBorder: '#4b5563',
        connectorActive: '#3b82f6',
        connectorInactive: '#6b7280',
      };
      applyThemeColors(darkColors);

      //! 次にライトモード色を適用
      const lightColors: ThemeColorSettings = {
        background: '#ffffff',
        foreground: '#1f2937',
        border: '#e5e7eb',
        primary: '#3b82f6',
        secondary: '#6b7280',
        cardBackground: '#f9fafb',
        cardBorder: '#d1d5db',
        connectorActive: '#60a5fa',
        connectorInactive: '#9ca3af',
      };
      applyThemeColors(lightColors);

      //! ライトモード色で上書きされていることを確認 (RGBチャネルに変換される)
      expect(root.style.getPropertyValue('--theme-background')).toBe('255 255 255');
      expect(root.style.getPropertyValue('--theme-foreground')).toBe('31 41 55');
      expect(root.style.getPropertyValue('--theme-primary')).toBe('59 130 246');
    });
  });

  describe('applySplitterWidth', () => {
    it('should apply splitter width as CSS variable with px unit', () => {
      applySplitterWidth(4);
      expect(root.style.getPropertyValue('--theme-splitter-width')).toBe('4px');
    });

    it('should update splitter width when called multiple times', () => {
      applySplitterWidth(4);
      expect(root.style.getPropertyValue('--theme-splitter-width')).toBe('4px');

      applySplitterWidth(8);
      expect(root.style.getPropertyValue('--theme-splitter-width')).toBe('8px');
    });

    it('should handle zero and large values', () => {
      applySplitterWidth(0);
      expect(root.style.getPropertyValue('--theme-splitter-width')).toBe('0px');

      applySplitterWidth(100);
      expect(root.style.getPropertyValue('--theme-splitter-width')).toBe('100px');
    });
  });
});
