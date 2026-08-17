import * as fs from 'fs';
import * as path from 'path';

let nlsData: Record<string, string> | null = null;
let fallbackData: Record<string, string> | null = null;

/**
 * Initializes the localization engine by loading the appropriate nls.json file
 * based on the provided locale (e.g. vscode.env.language).
 */
export function initI18n(extensionPath: string, locale: string = 'en') {
    // Load default (fallback) strings
    const defaultNlsPath = path.join(extensionPath, 'package.nls.json');
    try {
        if (fs.existsSync(defaultNlsPath)) {
            const content = fs.readFileSync(defaultNlsPath, 'utf8');
            fallbackData = JSON.parse(content);
        }
    } catch (e) {
        console.error('Failed to load fallback nls:', e);
        fallbackData = {};
    }

    // Try to load locale-specific strings
    let targetLocale = locale.toLowerCase();
    
    // Normalize ja-JP, ja-us, etc to ja
    if (targetLocale.startsWith('ja')) {
        targetLocale = 'ja';
    }

    // If English or not Japanese, fallback to default English
    // Because we only support ja right now.
    if (targetLocale === 'en' || targetLocale !== 'ja') {
        nlsData = fallbackData;
        return;
    }

    const localeNlsPath = path.join(extensionPath, `package.nls.${targetLocale}.json`);
    try {
        if (fs.existsSync(localeNlsPath)) {
            const content = fs.readFileSync(localeNlsPath, 'utf8');
            nlsData = JSON.parse(content);
        } else {
            // Fallback if not found
            nlsData = fallbackData;
        }
    } catch (e) {
        console.error(`Failed to load nls for locale ${targetLocale}:`, e);
        nlsData = fallbackData;
    }
}

/**
 * Returns the localized string for the given key.
 * Falls back to default English string, or the key itself if not found.
 */
export function localize(key: string): string {
    if (nlsData && nlsData[key]) {
        return nlsData[key];
    }
    if (fallbackData && fallbackData[key]) {
        return fallbackData[key];
    }
    return key;
}
