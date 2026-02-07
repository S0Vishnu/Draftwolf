import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

interface ThemeInfo {
  id: string;
  name: string;
  description?: string;
  version?: string;
  author?: string;
  accentColor?: string;
  path?: string;
}

interface ThemeContextType {
  currentTheme: string;
  installedThemes: ThemeInfo[];
  setTheme: (themeId: string) => Promise<void>;
  refreshThemes: () => Promise<void>;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const THEME_STORAGE_KEY = 'draftwolf-theme';
const THEME_STYLE_ID = 'draftwolf-theme-style';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState<string>('default');
  const [installedThemes, setInstalledThemes] = useState<ThemeInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Inject theme CSS into the document head
  const injectThemeCSS = useCallback(async (themeId: string) => {
    // Remove existing theme style
    const existingStyle = document.getElementById(THEME_STYLE_ID);
    if (existingStyle) {
      existingStyle.remove();
    }

    // Remove data-theme attribute for default theme
    if (themeId === 'default') {
      delete document.documentElement.dataset.theme;
      return;
    }

    // Load theme CSS from Electron API
    if (globalThis.api?.theme?.readCSS) {
      try {
        const result = await globalThis.api.theme.readCSS(themeId);
        if (result.success && result.css) {
          const styleElement = document.createElement('style');
          styleElement.id = THEME_STYLE_ID;
          styleElement.textContent = result.css;
          document.head.appendChild(styleElement);
          document.documentElement.dataset.theme = themeId;
        }
      } catch (error) {
        console.error('Failed to load theme CSS:', error);
      }
    }
  }, []);

  // Load installed themes
  const refreshThemes = useCallback(async () => {
    if (globalThis.api?.theme?.list) {
      try {
        const themes = await globalThis.api.theme.list();
        setInstalledThemes(themes);
      } catch (error) {
        console.error('Failed to load themes:', error);
        setInstalledThemes([]);
      }
    }
  }, []);

  // Set theme and persist
  const setTheme = useCallback(async (themeId: string) => {
    setCurrentTheme(themeId);
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
    await injectThemeCSS(themeId);
  }, [injectThemeCSS]);

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      
      // Load installed themes
      await refreshThemes();
      
      // Load saved theme preference
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'default';
      setCurrentTheme(savedTheme);
      await injectThemeCSS(savedTheme);
      
      setIsLoading(false);
    };

    init();
  }, [refreshThemes, injectThemeCSS]);

  const contextValue = useMemo(() => ({
    currentTheme,
    installedThemes,
    setTheme,
    refreshThemes,
    isLoading
  }), [currentTheme, installedThemes, setTheme, refreshThemes, isLoading]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
