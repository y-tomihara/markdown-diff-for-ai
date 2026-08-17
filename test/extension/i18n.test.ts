import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { initI18n, localize } from '../../src/extension/i18n';

describe('i18n', () => {
    const extensionPath = path.resolve(__dirname, '../../');

    it('should load English (fallback) for en', () => {
        initI18n(extensionPath, 'en');
        expect(localize('webview.before')).toBe('Before');
    });

    it('should load Japanese for ja', () => {
        initI18n(extensionPath, 'ja');
        expect(localize('webview.before')).toBe('変更前 (Before)');
    });

    it('should load Japanese for ja-JP', () => {
        initI18n(extensionPath, 'ja-JP');
        expect(localize('webview.before')).toBe('変更前 (Before)');
    });

    it('should fallback to English for unknown locale like fr', () => {
        initI18n(extensionPath, 'fr');
        expect(localize('webview.before')).toBe('Before');
    });

    it('should return the key if key is missing in fallback', () => {
        initI18n(extensionPath, 'en');
        expect(localize('missing.key.xyz')).toBe('missing.key.xyz');
    });
});
