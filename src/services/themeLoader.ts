/**
 * Theme Loader Service
 * Handles theme installation, removal, and loading
 */

interface ThemeInfo {
  id: string;
  name: string;
  description?: string;
  version?: string;
  author?: string;
  accentColor?: string;
  path?: string;
}

interface InstallResult {
  success: boolean;
  themeId?: string;
  theme?: ThemeInfo;
  error?: string;
}

/**
 * Get list of installed themes
 */
export const getInstalledThemes = async (): Promise<ThemeInfo[]> => {
  if (!globalThis.api?.theme?.list) {
    console.warn('Theme API not available');
    return [];
  }
  
  try {
    return await globalThis.api.theme.list();
  } catch (error) {
    console.error('Failed to get installed themes:', error);
    return [];
  }
};

/**
 * Install a theme from a GitHub repository URL
 */
export const installTheme = async (repoUrl: string, downloadUrl?: string): Promise<InstallResult> => {
  if (!globalThis.api?.theme?.install) {
    return { success: false, error: 'Theme API not available' };
  }
  
  try {
    return await globalThis.api.theme.install(repoUrl, downloadUrl);
  } catch (error) {
    console.error('Failed to install theme:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Installation failed' 
    };
  }
};

/**
 * Remove an installed theme
 */
export const removeTheme = async (themeId: string): Promise<boolean> => {
  if (!globalThis.api?.theme?.remove) {
    console.warn('Theme API not available');
    return false;
  }
  
  try {
    const result = await globalThis.api.theme.remove(themeId);
    return result.success;
  } catch (error) {
    console.error('Failed to remove theme:', error);
    return false;
  }
};

/**
 * Get theme CSS content
 */
export const getThemeCSS = async (themeId: string): Promise<string | null> => {
  if (!globalThis.api?.theme?.readCSS) {
    console.warn('Theme API not available');
    return null;
  }
  
  try {
    const result = await globalThis.api.theme.readCSS(themeId);
    return result.success ? result.css : null;
  } catch (error) {
    console.error('Failed to get theme CSS:', error);
    return null;
  }
};

/**
 * Default theme info (built-in)
 */
export const DEFAULT_THEME: ThemeInfo = {
  id: 'default',
  name: 'Default',
  description: 'The default DraftWolf dark theme',
  version: '1.0.0',
  author: 'DraftWolf',
};
