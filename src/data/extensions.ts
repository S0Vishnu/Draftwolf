/**
 * Extension catalog for DraftWolf.
 * Each extension comes from a different repository.
 */

export type ExtensionKind = 'download' | 'install' | 'theme';

export interface Extension {
  id: string;
  name: string;
  description: string;
  kind: ExtensionKind;
  /** Short label for the kind (e.g. "Blender Plugin", "Moodboard", "Theme") */
  kindLabel: string;
  /** Repository or release URL */
  repositoryUrl: string;
  /** Direct download URL for .zip (for kind === 'download') */
  downloadUrl?: string;
  /** Optional version or tag */
  version?: string;
  /** Icon accent color (hex) for UI */
  accentColor: string;
  /** When true, show "Coming soon" and disable actions */
  comingSoon?: boolean;
}

export const extensions: Extension[] = [
  {
    id: 'blender-plugin',
    name: 'Blender Plugin',
    description: 'Sync and version your Blender projects directly from the app. Install the addon in Blender and connect to your DraftWolf workspace.',
    kind: 'download',
    kindLabel: 'Blender Plugin',
    repositoryUrl: 'https://github.com/S0Vishnu/draftwolf-blender-plugin/',
    downloadUrl: 'https://github.com/S0Vishnu/draftwolf-blender-plugin/releases/download/v1.1.0/DraftWolf_Control.zip',
    version: 'latest',
    accentColor: '#e17b34',
  },
  {
    id: 'draftboard',
    name: 'Draftboard',
    description: 'Visual moodboard and reference manager. Collect images, colors, and notes in one place and keep them in sync with your drafts.',
    kind: 'install',
    kindLabel: 'Moodboard',
    repositoryUrl: 'https://github.com/S0Vishnu/DraftBoard',
    version: 'latest',
    accentColor: '#8b5cf6',
  },
  {
    id: 'dragula',
    name: 'Dragula',
    description: 'A dark, minimal theme for DraftWolf. Easy on the eyes for long sessions.',
    kind: 'theme',
    kindLabel: 'Theme',
    repositoryUrl: 'https://github.com/draftwolf/dragula-theme',
    version: 'latest',
    accentColor: '#64748b',
    comingSoon: true,
  },
];
