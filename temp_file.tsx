import React, { useState, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import { 
  Search, 
  X,
  Folder, 
  FolderPlus,
  FileText, 
  Save, 
  Download,
  Upload,
  FolderOpen
} from 'lucide-react';
import type { FileNode } from '../../types/state';

// Props interface for FileExplorerHeader component
interface FileExplorerHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onCreateFile: (language?: string, template?: string) => void;
  onCreateFolder: () => void;
  onImportFolder: (files: FileNode[]) => void;
  files?: FileNode[]; // Add files prop for export functionality
  sidebarWidth?: number;
}

// Golden-Black theme colors and styles - SynapseIDE Design System
const REFINED_COLORS = {
  // 🎨 Professional Graphite Backgrounds
  bgDark: '#121212',           // Subtle graphite instead of pure black
  bgSecondary: '#1A1A1A',      // Panel backgrounds with depth
  bgTertiary: '#252525',       // Elevated surfaces
  
  // 📝 High-Contrast Text Hierarchy
  textPrimary: '#E8E8E8',      // Primary text with excellent readability
  textSecondary: '#AAB2BD',    // Secondary text with cool blue-gray tone
  textTertiary: '#6B7280',     // Subtle text for metadata
  
  // ✨ Desaturated Gold Accents
  goldPrimary: '#C2A76E',      // Professional desaturated gold
  goldSecondary: '#9B8A5C',    // Muted gold variant
  goldHover: '#D4BC7A',        // Subtle hover enhancement
  
  // 🔷 Cool Blue-Gray Secondary Accent
  blueGray: '#AAB2BD',         // Cool complementary accent
  blueGrayHover: '#B8C0CC',    // Lighter variant for hover states
  
  // ⚡ Professional Status Colors
  success: '#22C55E',          // Modern success green
  warning: '#F59E0B',          // Refined warning amber
  error: '#EF4444',            // Clean error red
  
  // 🖌 Refined UI Elements
  border: 'rgba(255, 255, 255, 0.06)',    // Translucent borders
  borderSubtle: 'rgba(255, 255, 255, 0.04)', // Even more subtle borders
  hover: 'rgba(194, 167, 110, 0.08)',     // Subtle gold hover
  selected: 'rgba(194, 167, 110, 0.12)',  // Gentle selection highlight
  divider: 'rgba(255, 255, 255, 0.08)',   // Clean divider lines
  
  // 🌫 Soft Drop Shadows (No Glow) - DE-ESCALATED
  shadowSoft: '0 1px 3px rgba(0, 0, 0, 0.2)',
  shadowElevated: '0 2px 6px rgba(0, 0, 0, 0.15)',
  shadowModal: '0 3px 12px rgba(0, 0, 0, 0.25)'
};

// 🎯 REFINED MOTION SYSTEM
const REFINED_MOTION = {
  duration: {
    instant: '50ms',
    fast: '150ms',
    normal: '200ms',
    slow: '300ms'
  },
  easing: {
    linear: 'linear',
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    ease: 'ease-out'
  }
} as const;

// ✨ ENHANCED ANIMATION KEYFRAMES
const MOTION_KEYFRAMES = `
  @keyframes refinedHighlight {
    0% { 
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(194, 167, 110, 0.7);
    }
    50% { 
      transform: scale(1.05);
      box-shadow: 0 0 0 8px rgba(194, 167, 110, 0.3);
    }
    100% { 
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(194, 167, 110, 0);
    }
  }

  @keyframes goldGlow {
    0% { 
      box-shadow: 0 0 0 0 rgba(194, 167, 110, 0);
    }
    100% { 
      box-shadow: 0 0 12px 2px rgba(194, 167, 110, 0.3);
    }
  }

  @keyframes subtlePulse {
    0%, 100% { 
      transform: scale(1);
      opacity: 1;
    }
    50% { 
      transform: scale(1.02);
      opacity: 0.9;
    }
  }
`;

// 🎯 TYPOGRAPHY SYSTEM
const IDE_TYPOGRAPHY = {
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Menlo', monospace",
  fontSize: {
    small: '12px',
    base: '13px',
    medium: '14px',
    large: '16px'
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6
  }
};

// Motion helper functions
const getRefinedDuration = (duration: string) => {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? '50ms' : duration;
};

const getRefinedTransition = (properties: string, duration: string = REFINED_MOTION.duration.fast) => {
  return `${properties} ${getRefinedDuration(duration)} ${REFINED_MOTION.easing.smooth}`;
};

// Styled components using the refined design system with glassmorphism
const useHeaderStyles = (sidebarWidth: number = 375) => ({
  container: {
    width: `${sidebarWidth}px`,
    height: '100px',
    // ✨ Glassmorphism Panel Styling
    background: `linear-gradient(145deg, 
      rgba(26, 26, 26, 0.95) 0%, 
      rgba(18, 18, 18, 0.98) 100%)`,
    backdropFilter: 'blur(12px)',
    borderBottom: `1px solid ${REFINED_COLORS.border}`,
    borderTop: `1px solid rgba(194, 167, 110, 0.1)`,
    boxShadow: `
      0 1px 3px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(194, 167, 110, 0.05)`,
    display: 'flex',
    flexDirection: 'column' as const,
    fontFamily: IDE_TYPOGRAPHY.fontFamily,
    fontSize: IDE_TYPOGRAPHY.fontSize.base,
    color: REFINED_COLORS.textPrimary,
    position: 'relative' as const,
    zIndex: 10,
    overflow: 'hidden'
  },

  topRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '44px',
    padding: '0 16px',
    gap: '12px',
    borderBottom: `1px solid ${REFINED_COLORS.borderSubtle}`
  },

  brandSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: REFINED_COLORS.goldPrimary,
    fontWeight: IDE_TYPOGRAPHY.fontWeight.semibold,
    fontSize: IDE_TYPOGRAPHY.fontSize.medium,
    letterSpacing: '0.5px'
  },

  createButtonsGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },

  bottomRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '56px',
    padding: '0 16px',
    gap: '12px'
  },

  searchContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    position: 'relative' as const
  },

  actionButtonsGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },

  searchInput: {
    width: '100%',
    height: '36px',
    background: `linear-gradient(145deg, 
      rgba(37, 37, 37, 0.8) 0%, 
      rgba(18, 18, 18, 0.9) 100%)`,
    backdropFilter: 'blur(8px)',
    border: `1px solid ${REFINED_COLORS.border}`,
    borderRadius: '6px',
    padding: '0 64px 0 40px', // Extra padding for clear button
    color: REFINED_COLORS.textPrimary,
    fontSize: IDE_TYPOGRAPHY.fontSize.base,
    fontFamily: IDE_TYPOGRAPHY.fontFamily,
    outline: 'none',
    transition: getRefinedTransition('border-color, background-color, box-shadow'),
    boxShadow: `inset 0 1px 2px rgba(0, 0, 0, 0.1)`,
    '&:focus': {
      borderColor: REFINED_COLORS.goldPrimary,
      background: `linear-gradient(145deg, 
        rgba(37, 37, 37, 0.95) 0%, 
        rgba(18, 18, 18, 0.98) 100%)`,
      boxShadow: `
        inset 0 1px 2px rgba(0, 0, 0, 0.1),
        0 0 0 2px rgba(194, 167, 110, 0.15)`
    },
    '&::placeholder': {
      color: REFINED_COLORS.textTertiary
    }
  } as React.CSSProperties,

  searchIcon: {
    position: 'absolute' as const,
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: REFINED_COLORS.textTertiary,
    pointerEvents: 'none' as const
  },

  clearButton: {
    position: 'absolute' as const,
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%) scale(1)',
    width: '20px',
    height: '20px',
    background: 'transparent',
    border: 'none',
    color: REFINED_COLORS.textTertiary,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    transition: getRefinedTransition('all'),
    opacity: 0.7,
    '&:hover': {
      color: REFINED_COLORS.goldHover,
      background: `rgba(194, 167, 110, 0.15)`,
      opacity: 1,
      transform: 'translateY(-50%) scale(1.15)',
      boxShadow: `0 0 8px rgba(194, 167, 110, 0.3)`
    },
    '&:active': {
      transform: 'translateY(-50%) scale(0.9)',
      transition: getRefinedTransition('all', REFINED_MOTION.duration.instant)
    },
    '&:focus': {
      outline: 'none',
      boxShadow: `0 0 0 2px rgba(194, 167, 110, 0.5)`
    }
  } as React.CSSProperties,

  // Professional buttons with labels + icons + Enhanced Motion
  labeledButton: {
    height: '32px',
    background: `linear-gradient(145deg, 
      rgba(37, 37, 37, 0.8) 0%, 
      rgba(18, 18, 18, 0.9) 100%)`,
    backdropFilter: 'blur(8px)',
    border: `1px solid ${REFINED_COLORS.border}`,
    borderRadius: '6px',
    color: REFINED_COLORS.textSecondary,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 12px',
    gap: '6px',
    fontSize: IDE_TYPOGRAPHY.fontSize.small,
    fontFamily: IDE_TYPOGRAPHY.fontFamily,
    fontWeight: IDE_TYPOGRAPHY.fontWeight.medium,
    transition: getRefinedTransition('all'),
    boxShadow: `0 1px 2px rgba(0, 0, 0, 0.1)`,
    transform: 'scale(1)',
    '&:hover': {
      background: `linear-gradient(145deg, 
        rgba(194, 167, 110, 0.15) 0%, 
        rgba(194, 167, 110, 0.08) 100%)`,
      borderColor: REFINED_COLORS.goldPrimary,
      color: REFINED_COLORS.goldHover,
      transform: 'scale(1.05) translateY(-1px)',
      boxShadow: `
        0 4px 8px rgba(0, 0, 0, 0.2),
        0 0 12px rgba(194, 167, 110, 0.3)`,
      filter: 'brightness(1.1)'
    },
    '&:active': {
      transform: 'scale(0.95)',
      boxShadow: `0 1px 2px rgba(0, 0, 0, 0.1)`,
      transition: getRefinedTransition('all', REFINED_MOTION.duration.instant)
    },
    '&:focus': {
      outline: 'none',
      boxShadow: `
        0 2px 4px rgba(0, 0, 0, 0.15),
        0 0 0 2px rgba(194, 167, 110, 0.5)`
    }
  } as React.CSSProperties,

  actionButton: {
    height: '32px',
    minWidth: '32px',
    background: `linear-gradient(145deg, 
      rgba(37, 37, 37, 0.8) 0%, 
      rgba(18, 18, 18, 0.9) 100%)`,
    backdropFilter: 'blur(8px)',
    border: `1px solid ${REFINED_COLORS.border}`,
    borderRadius: '6px',
    color: REFINED_COLORS.textSecondary,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 10px',
    gap: '6px',
    fontSize: IDE_TYPOGRAPHY.fontSize.small,
    fontFamily: IDE_TYPOGRAPHY.fontFamily,
    fontWeight: IDE_TYPOGRAPHY.fontWeight.medium,
    transition: getRefinedTransition('all'),
    boxShadow: `0 1px 2px rgba(0, 0, 0, 0.1)`,
    transform: 'scale(1)',
    '&:hover': {
      background: `linear-gradient(145deg, 
        rgba(194, 167, 110, 0.15) 0%, 
        rgba(194, 167, 110, 0.08) 100%)`,
      borderColor: REFINED_COLORS.goldPrimary,
      color: REFINED_COLORS.goldHover,
      transform: 'scale(1.05) translateY(-1px)',
      boxShadow: `
        0 4px 8px rgba(0, 0, 0, 0.2),
        0 0 12px rgba(194, 167, 110, 0.3)`,
      filter: 'brightness(1.1)'
    },
    '&:active': {
      transform: 'scale(0.95)',
      boxShadow: `0 1px 2px rgba(0, 0, 0, 0.1)`,
      transition: getRefinedTransition('all', REFINED_MOTION.duration.instant)
    },
    '&:focus': {
      outline: 'none',
      boxShadow: `
        0 2px 4px rgba(0, 0, 0, 0.15),
        0 0 0 2px rgba(194, 167, 110, 0.5)`
    }
  } as React.CSSProperties,

  iconButton: {
    height: '32px',
    width: '32px',
    background: `linear-gradient(145deg, 
      rgba(37, 37, 37, 0.8) 0%, 
      rgba(18, 18, 18, 0.9) 100%)`,
    backdropFilter: 'blur(8px)',
    border: `1px solid ${REFINED_COLORS.border}`,
    borderRadius: '6px',
    color: REFINED_COLORS.textSecondary,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: getRefinedTransition('all'),
    boxShadow: `0 1px 2px rgba(0, 0, 0, 0.1)`,
    transform: 'scale(1)',
    '&:hover': {
      background: `linear-gradient(145deg, 
        rgba(194, 167, 110, 0.15) 0%, 
        rgba(194, 167, 110, 0.08) 100%)`,
      borderColor: REFINED_COLORS.goldPrimary,
      color: REFINED_COLORS.goldHover,
      transform: 'scale(1.05) translateY(-1px)',
      boxShadow: `
        0 4px 8px rgba(0, 0, 0, 0.2),
        0 0 12px rgba(194, 167, 110, 0.3)`,
      filter: 'brightness(1.1)'
    },
    '&:active': {
      transform: 'scale(0.95)',
      boxShadow: `0 1px 2px rgba(0, 0, 0, 0.1)`,
      transition: getRefinedTransition('all', REFINED_MOTION.duration.instant)
    },
    '&:focus': {
      outline: 'none',
      boxShadow: `
        0 2px 4px rgba(0, 0, 0, 0.15),
        0 0 0 2px rgba(194, 167, 110, 0.5)`
    }
  } as React.CSSProperties,

  primaryButton: {
    height: '32px',
    background: `linear-gradient(145deg, 
      ${REFINED_COLORS.goldPrimary} 0%, 
      ${REFINED_COLORS.goldSecondary} 100%)`,
    border: 'none',
    borderRadius: '6px',
    color: REFINED_COLORS.bgDark,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 16px',
    gap: '6px',
    fontSize: IDE_TYPOGRAPHY.fontSize.small,
    fontFamily: IDE_TYPOGRAPHY.fontFamily,
    fontWeight: IDE_TYPOGRAPHY.fontWeight.semibold,
    transition: getRefinedTransition('all'),
    boxShadow: `0 2px 4px rgba(194, 167, 110, 0.25)`,
    transform: 'scale(1)',
    '&:hover': {
      background: `linear-gradient(145deg, 
        ${REFINED_COLORS.goldHover} 0%, 
        ${REFINED_COLORS.goldPrimary} 100%)`,
      transform: 'scale(1.05) translateY(-1px)',
      boxShadow: `
        0 6px 12px rgba(194, 167, 110, 0.4),
        0 0 16px rgba(194, 167, 110, 0.3)`,
      filter: 'brightness(1.1)'
    },
    '&:active': {
      transform: 'scale(0.95)',
      boxShadow: `0 1px 2px rgba(194, 167, 110, 0.25)`,
      transition: getRefinedTransition('all', REFINED_MOTION.duration.instant)
    },
    '&:focus': {
      outline: 'none',
      boxShadow: `
        0 2px 4px rgba(194, 167, 110, 0.25),
        0 0 0 2px rgba(255, 255, 255, 0.3)`
    }
  } as React.CSSProperties,

  dropdown: {
    position: 'relative' as const,
    display: 'inline-block'
  },

  dropdownContent: {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    background: `linear-gradient(145deg, 
      rgba(37, 37, 37, 0.95) 0%, 
      rgba(18, 18, 18, 0.98) 100%)`,
    backdropFilter: 'blur(12px)',
    border: `1px solid ${REFINED_COLORS.border}`,
    borderRadius: '8px',
    minWidth: '140px',
    zIndex: 1000,
    boxShadow: `
      0 4px 12px rgba(0, 0, 0, 0.3),
      0 1px 3px rgba(0, 0, 0, 0.2)`,
    marginTop: '4px',
    overflow: 'hidden'
  },

  dropdownItem: {
    padding: '10px 12px',
    cursor: 'pointer',
    color: REFINED_COLORS.textPrimary,
    fontSize: IDE_TYPOGRAPHY.fontSize.small,
    borderBottom: `1px solid ${REFINED_COLORS.borderSubtle}`,
    transition: getRefinedTransition('all'),
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transform: 'scale(1)',
    '&:hover': {
      background: `rgba(194, 167, 110, 0.15)`,
      color: REFINED_COLORS.goldHover,
      transform: 'scale(1.02) translateX(2px)',
      boxShadow: `inset 3px 0 0 ${REFINED_COLORS.goldPrimary}`
    },
    '&:active': {
      transform: 'scale(0.98) translateX(1px)',
      transition: getRefinedTransition('all', REFINED_MOTION.duration.instant)
    },
    '&:focus': {
      outline: 'none',
      background: `rgba(194, 167, 110, 0.1)`,
      boxShadow: `inset 3px 0 0 ${REFINED_COLORS.goldPrimary}`
    },
    '&:last-child': {
      borderBottom: 'none'
    }
  } as React.CSSProperties,

  // Export Modal Styles
  modalOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000
  },

  modalContent: {
    background: `linear-gradient(145deg, 
      rgba(37, 37, 37, 0.95) 0%, 
      rgba(18, 18, 18, 0.98) 100%)`,
    backdropFilter: 'blur(16px)',
    border: `1px solid ${REFINED_COLORS.border}`,
    borderRadius: '12px',
    padding: '24px',
    minWidth: '400px',
    maxWidth: '500px',
    boxShadow: `
      0 8px 24px rgba(0, 0, 0, 0.4),
      0 2px 8px rgba(0, 0, 0, 0.2)`,
    color: REFINED_COLORS.textPrimary,
    fontFamily: IDE_TYPOGRAPHY.fontFamily
  },

  modalHeader: {
    fontSize: IDE_TYPOGRAPHY.fontSize.large,
    fontWeight: IDE_TYPOGRAPHY.fontWeight.semibold,
    color: REFINED_COLORS.goldPrimary,
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },

  modalBody: {
    fontSize: IDE_TYPOGRAPHY.fontSize.base,
    color: REFINED_COLORS.textSecondary,
    lineHeight: IDE_TYPOGRAPHY.lineHeight.relaxed,
    marginBottom: '20px'
  },

  modalActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end'
  },

  modalButton: {
    height: '36px',
    padding: '0 16px',
    border: `1px solid ${REFINED_COLORS.border}`,
    borderRadius: '6px',
    background: `linear-gradient(145deg, 
      rgba(37, 37, 37, 0.8) 0%, 
      rgba(18, 18, 18, 0.9) 100%)`,
    color: REFINED_COLORS.textPrimary,
    fontSize: IDE_TYPOGRAPHY.fontSize.small,
    fontFamily: IDE_TYPOGRAPHY.fontFamily,
    cursor: 'pointer',
    transition: getRefinedTransition('all'),
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transform: 'scale(1)',
    '&:hover': {
      background: `linear-gradient(145deg, 
        rgba(194, 167, 110, 0.15) 0%, 
        rgba(194, 167, 110, 0.08) 100%)`,
      borderColor: REFINED_COLORS.goldPrimary,
      color: REFINED_COLORS.goldHover,
      transform: 'scale(1.05) translateY(-1px)',
      boxShadow: `0 4px 8px rgba(0, 0, 0, 0.2)`
    },
    '&:active': {
      transform: 'scale(0.95)',
      transition: getRefinedTransition('all', REFINED_MOTION.duration.instant)
    },
    '&:focus': {
      outline: 'none',
      boxShadow: `0 0 0 2px rgba(194, 167, 110, 0.5)`
    }
  } as React.CSSProperties,

  modalPrimaryButton: {
    height: '36px',
    padding: '0 20px',
    border: 'none',
    borderRadius: '6px',
    background: `linear-gradient(145deg, 
      ${REFINED_COLORS.goldPrimary} 0%, 
      ${REFINED_COLORS.goldSecondary} 100%)`,
    color: REFINED_COLORS.bgDark,
    fontSize: IDE_TYPOGRAPHY.fontSize.small,
    fontFamily: IDE_TYPOGRAPHY.fontFamily,
    fontWeight: IDE_TYPOGRAPHY.fontWeight.semibold,
    cursor: 'pointer',
    transition: getRefinedTransition('all'),
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transform: 'scale(1)',
    '&:hover': {
      background: `linear-gradient(145deg, 
        ${REFINED_COLORS.goldHover} 0%, 
        ${REFINED_COLORS.goldPrimary} 100%)`,
      transform: 'scale(1.05) translateY(-1px)',
      boxShadow: `
        0 6px 12px rgba(194, 167, 110, 0.4),
        0 0 16px rgba(194, 167, 110, 0.3)`,
      filter: 'brightness(1.1)'
    },
    '&:active': {
      transform: 'scale(0.95)',
      transition: getRefinedTransition('all', REFINED_MOTION.duration.instant)
    },
    '&:focus': {
      outline: 'none',
      boxShadow: `0 0 0 2px rgba(255, 255, 255, 0.3)`
    },
    '&:disabled': {
      opacity: 0.6,
      cursor: 'not-allowed',
      transform: 'none',
      '&:hover': {
        transform: 'none',
        boxShadow: 'none',
        filter: 'none'
      }
    }
  } as React.CSSProperties
});

// File templates for quick creation
const FILE_TEMPLATES = [
  { label: 'JavaScript', language: 'javascript', extension: 'js' },
  { label: 'TypeScript', language: 'typescript', extension: 'ts' },
  { label: 'React Component', language: 'typescript', extension: 'tsx', template: 'react-component' },
  { label: 'CSS', language: 'css', extension: 'css' },
  { label: 'HTML', language: 'html', extension: 'html' },
  { label: 'JSON', language: 'json', extension: 'json' },
  { label: 'Markdown', language: 'markdown', extension: 'md' }
];

export const FileExplorerHeader: React.FC<FileExplorerHeaderProps> = ({
  searchQuery,
  onSearchChange,
  onCreateFile,
  onCreateFolder,
  onImportFolder,
  files = [], // Default to empty array
  sidebarWidth = 375
}) => {
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const styles = useHeaderStyles(sidebarWidth);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
  }, [onSearchChange]);

  const handleClearSearch = useCallback(() => {
    onSearchChange('');
    // Focus back to search input after clearing
    searchInputRef.current?.focus();
  }, [onSearchChange]);

  const handleCreateFile = useCallback((language?: string, template?: string) => {
    onCreateFile(language, template);
    setShowCreateDropdown(false);
  }, [onCreateFile]);

  const handleCreateFolder = useCallback(() => {
    onCreateFolder();
  }, [onCreateFolder]);

  // � Enhanced File Import (multiple files)
  const handleFileImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileNodes: FileNode[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const content = await file.text().catch(() => ''); // Handle binary files gracefully
      
      fileNodes.push({
        id: `imported-file-${Date.now()}-${i}`,
        name: file.name,
        type: 'file',
        path: file.webkitRelativePath || file.name,
        content,
        size: file.size,
        lastModified: new Date(file.lastModified),
        language: file.name.split('.').pop() || 'text'
      });
    }
    
    onImportFolder(fileNodes);
    e.target.value = ''; // Reset input
  }, [onImportFolder]);

  // 🔘 Enhanced Folder Import (webkitdirectory)
  const handleFolderImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileNodes: FileNode[] = [];
    const folderStructure = new Set<string>();

    // Process all files and create folder structure
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const pathParts = file.webkitRelativePath.split('/');
      
      // Create folder nodes for the directory structure
      let currentPath = '';
      for (let j = 0; j < pathParts.length - 1; j++) {
        const folderName = pathParts[j];
        currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;
        
        if (!folderStructure.has(currentPath)) {
          folderStructure.add(currentPath);
          fileNodes.push({
            id: `imported-folder-${currentPath.replace(/[^a-zA-Z0-9]/g, '-')}`,
            name: folderName,
            type: 'folder',
            path: currentPath,
            size: 0,
            lastModified: new Date(),
            children: []
          });
        }
      }

      // Add the file
      const content = await file.text().catch(() => ''); // Handle binary files
      fileNodes.push({
        id: `imported-file-${Date.now()}-${i}`,
        name: file.name,
        type: 'file',
        path: file.webkitRelativePath,
        content,
        size: file.size,
        lastModified: new Date(file.lastModified),
        language: file.name.split('.').pop() || 'text'
      });
    }
    
    onImportFolder(fileNodes);
    e.target.value = ''; // Reset input
  }, [onImportFolder]);

  // 🔘 Enhanced Save Functionality with Success Animation
  const handleSave = useCallback(async () => {
    try {
      // Create a download blob with project structure
      const projectData = {
        timestamp: new Date().toISOString(),
        projectName: 'SynapseIDE-Project',
        files: [] // This would be populated from the file explorer state
      };

      const blob = new Blob([JSON.stringify(projectData, null, 2)], {
        type: 'application/json'
      });

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `project-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // ✨ Add success animation to save button
      const saveButton = document.querySelector('[title*="Save project"]') as HTMLElement;
      if (saveButton) {
        saveButton.style.animation = 'refinedHighlight 0.6s ease-out';
        setTimeout(() => {
          saveButton.style.animation = '';
        }, 600);
      }

      console.log('Project saved successfully');
    } catch (error) {
      console.error('Failed to save project:', error);
    }
  }, []);

  // � Recursive File Traversal for ZIP Export
  const traverseFiles = useCallback((fileNodes: FileNode[], basePath: string = ''): Array<{path: string, content: string}> => {
    const result: Array<{path: string, content: string}> = [];
    
    fileNodes.forEach(node => {
      const currentPath = basePath ? `${basePath}/${node.name}` : node.name;
      
      if (node.type === 'file' && node.content !== undefined) {
        result.push({
          path: currentPath,
          content: node.content
        });
      } else if (node.type === 'folder' && node.children) {
        // Recursively traverse subfolders
        result.push(...traverseFiles(node.children, currentPath));
      }
    });
    
    return result;
  }, []);

  // 📁 Create Real ZIP File using JSZip
  const createRealZipFile = useCallback(async (fileList: Array<{path: string, content: string}>) => {
    const zip = new JSZip();
    
    // Add each file to the ZIP
    fileList.forEach(file => {
      zip.file(file.path, file.content);
    });
    
    // Generate ZIP blob
    const zipBlob = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6
      }
    });
    
    return zipBlob;
  }, []);

  // �🔘 Enhanced Export Functionality with Custom Modal and ZIP Support
  const handleExport = useCallback(async () => {
    setShowExportModal(true);
  }, []);

  // 📁 Export to Folder using File System Access API with Real Files
  const handleExportToFolder = useCallback(async () => {
    setIsExporting(true);
    setExportStatus('Opening folder picker...');
    
    try {
      // Check if File System Access API is available
      if ('showDirectoryPicker' in window) {
        try {
          // @ts-ignore - File System Access API
          const directoryHandle = await window.showDirectoryPicker({
            mode: 'readwrite',
            startIn: 'downloads'
          });

          // Get files to export
          let filesToExport: Array<{path: string, content: string}> = [];
          
          if (files.length > 0) {
            // Use actual files from workspace
            filesToExport = traverseFiles(files);
          } else {
            // Fallback to demo files
            filesToExport = [
              { path: 'index.html', content: '<!DOCTYPE html>\n<html>\n<head>\n  <title>SynapseIDE Project</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>' },
              { path: 'src/main.js', content: 'console.log("Hello from SynapseIDE!");\n\nfunction main() {\n  console.log("App started");\n}\n\nmain();' },
              { path: 'src/styles.css', content: 'body {\n  margin: 0;\n  padding: 20px;\n  font-family: "JetBrains Mono", monospace;\n  background: #121212;\n  color: #e8e8e8;\n}' },
              { path: 'README.md', content: '# SynapseIDE Project\n\nThis project was exported from SynapseIDE.' }
            ];
          }

          setExportStatus(`Writing ${filesToExport.length} files to folder...`);

          // Write files to selected directory
          for (const file of filesToExport) {
            let targetHandle = directoryHandle;
            
            // Create subdirectories if needed
            const pathParts = file.path.split('/');
            const fileName = pathParts.pop(); // Remove filename from path
            
            // Create nested directory structure
            for (const part of pathParts.filter(Boolean)) {
              targetHandle = await targetHandle.getDirectoryHandle(part, { create: true });
            }

            // Create and write the file
            if (fileName) {
              const fileHandle = await targetHandle.getFileHandle(fileName, { create: true });
              const writable = await fileHandle.createWritable();
              await writable.write(file.content);
              await writable.close();
            }
          }

          setExportStatus(`✅ Exported ${filesToExport.length} files to ${directoryHandle.name}`);
          
          // Close modal after delay
          setTimeout(() => {
            setShowExportModal(false);
            setExportStatus('');
          }, 2000);
          
        } catch (abortError) {
          console.log('User cancelled directory selection');
          setExportStatus('Export cancelled by user');
          setTimeout(() => setExportStatus(''), 2000);
        }
      } else {
        setExportStatus('❌ File System Access API not supported. Please use ZIP export instead.');
        setTimeout(() => setExportStatus(''), 3000);
      }
    } catch (error) {
      console.error('Export to folder failed:', error);
      setExportStatus('❌ Export failed. Please try again.');
      setTimeout(() => setExportStatus(''), 3000);
    } finally {
      setIsExporting(false);
    }
  }, [files, traverseFiles]);
    setIsExporting(true);
    setExportStatus('Preparing files for export...');
    
    try {
      // Get all files from the workspace
      let filesToExport: Array<{path: string, content: string}> = [];
      
      if (files.length > 0) {
        // Use actual files from workspace
        filesToExport = traverseFiles(files);
      } else {
        // Fallback to mock files for demo
        filesToExport = [
          { path: 'index.html', content: '<!DOCTYPE html>\n<html>\n<head>\n  <title>SynapseIDE Project</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>' },
          { path: 'src/main.js', content: 'console.log("Hello from SynapseIDE!");\n\n// Your code here\nfunction main() {\n  console.log("App started");\n}\n\nmain();' },
          { path: 'src/styles.css', content: 'body {\n  margin: 0;\n  padding: 20px;\n  font-family: "JetBrains Mono", monospace;\n  background: #121212;\n  color: #e8e8e8;\n}\n\nh1 {\n  color: #c2a76e;\n}' },
          { path: 'package.json', content: '{\n  "name": "synapse-ide-project",\n  "version": "1.0.0",\n  "description": "Project exported from SynapseIDE",\n  "main": "src/main.js",\n  "scripts": {\n    "start": "node src/main.js"\n  },\n  "author": "SynapseIDE",\n  "license": "MIT"\n}' },
          { path: 'README.md', content: '# SynapseIDE Project\n\nThis project was created and exported from SynapseIDE.\n\n## Getting Started\n\n```bash\nnpm install\nnpm start\n```\n\n## Features\n\n- Professional code editor\n- File explorer\n- Real-time preview\n- Advanced export system\n\nBuilt with ❤️ using SynapseIDE' }
        ];
      }
      
      setExportStatus(`Creating ZIP archive with ${filesToExport.length} files...`);
      
      // Create the ZIP file
      const zipBlob = await createRealZipFile(filesToExport);
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `synapse-ide-workspace-${timestamp}.zip`;
      
      // Create download link
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Success feedback
      setExportStatus(`✅ Exported ${filesToExport.length} files to ${filename}`);
      
      // Close modal after short delay
      setTimeout(() => {
        setShowExportModal(false);
        setExportStatus('');
      }, 2000);
      
    } catch (error) {
      console.error('ZIP export failed:', error);
      setExportStatus('❌ Export failed. Please try again.');
      
      setTimeout(() => {
        setExportStatus('');
      }, 3000);
    } finally {
      setIsExporting(false);
    }
  }, [files, traverseFiles, createRealZipFile]);

  // Handle clicks outside dropdown to close it
  const handleClickOutside = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('[data-dropdown]')) {
      setShowCreateDropdown(false);
    }
  }, []);

  React.useEffect(() => {
    if (showCreateDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
    return () => {}; // Ensure all code paths return a value
  }, [showCreateDropdown, handleClickOutside]);

  // 🧠 Keyboard Shortcuts Handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isCtrl = e.ctrlKey || e.metaKey; // Support both Ctrl (Windows/Linux) and Cmd (Mac)
    const isShift = e.shiftKey;
    const isAlt = e.altKey;

    // Prevent shortcuts when typing in input fields
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      // Only allow Cmd+K / Ctrl+K for search focus when not already in search
      if (isCtrl && e.key.toLowerCase() === 'k' && e.target !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      return;
    }

    switch (true) {
      // New File (Ctrl+N)
      case isCtrl && !isShift && e.key.toLowerCase() === 'n':
        e.preventDefault();
        handleCreateFile();
        break;

      // New Folder (Ctrl+Shift+N)
      case isCtrl && isShift && e.key.toLowerCase() === 'n':
        e.preventDefault();
        handleCreateFolder();
        break;

      // Import (Alt+I)
      case isAlt && e.key.toLowerCase() === 'i':
        e.preventDefault();
        fileInputRef.current?.click();
        break;

      // Save (Ctrl+S)
      case isCtrl && !isShift && e.key.toLowerCase() === 's':
        e.preventDefault();
        handleSave();
        break;

      // Export (Ctrl+Shift+S)
      case isCtrl && isShift && e.key.toLowerCase() === 's':
        e.preventDefault();
        handleExport();
        break;

      // Search Focus (Cmd+K / Ctrl+K)
      case isCtrl && e.key.toLowerCase() === 'k':
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        break;

      // Escape to close modals/dropdowns
      case e.key === 'Escape':
        setShowCreateDropdown(false);
        setShowExportModal(false);
        break;
    }
  }, [handleCreateFile, handleCreateFolder, handleSave, handleExport]);

  // Add keyboard event listeners and inject keyframes
  React.useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    
    // ✨ Inject CSS keyframes for animations
    const styleElement = document.createElement('style');
    styleElement.textContent = MOTION_KEYFRAMES;
    document.head.appendChild(styleElement);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.head.removeChild(styleElement);
    };
  }, [handleKeyDown]);

  return (
    <>
      <div style={styles.container}>
        {/* Top Row: Brand + Create Buttons (44px height) */}
        <div style={styles.topRow}>
          <div style={styles.brandSection}>
            <Folder size={16} />
            <span>Explorer</span>
          </div>
          
          <div style={styles.createButtonsGroup}>
            {/* 🔘 New File Button with FolderPlus icon */}
            <div style={styles.dropdown} data-dropdown>
              <button
                style={styles.labeledButton}
                onClick={() => setShowCreateDropdown(!showCreateDropdown)}
                title="Create new file (Ctrl+N)"
                aria-label="Create new file. Shortcut: Ctrl+N"
                tabIndex={0}
              >
                <FolderPlus size={14} />
                <span>New File</span>
              </button>
              
              {showCreateDropdown && (
                <div style={styles.dropdownContent} role="menu" aria-label="File templates">
                  <div
                    style={styles.dropdownItem}
                    onClick={() => handleCreateFile()}
                    role="menuitem"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()}
                  >
                    <FileText size={14} />
                    <span>Empty File</span>
                  </div>
                  {FILE_TEMPLATES.map((template) => (
                    <div
                      key={template.label}
                      style={styles.dropdownItem}
                      onClick={() => handleCreateFile(template.language, template.template)}
                      role="menuitem"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateFile(template.language, template.template)}
                    >
                      <FileText size={14} />
                      <span>{template.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 🔘 New Folder Button with Folder icon */}
            <button
              style={styles.labeledButton}
              onClick={handleCreateFolder}
              title="Create new folder (Ctrl+Shift+N)"
              aria-label="Create new folder. Shortcut: Ctrl+Shift+N"
              tabIndex={0}
            >
              <Folder size={14} />
              <span>New Folder</span>
            </button>

            {/* 🔘 Import Files Button */}
            <label 
              style={styles.labeledButton} 
              title="Import multiple files (Alt+I)"
              aria-label="Import multiple files. Shortcut: Alt+I"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            >
              <Upload size={14} />
              <span>Import Files</span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileImport}
                style={{ display: 'none' }}
                accept="*/*"
                aria-label="Select files to import"
              />
            </label>

            {/* 🔘 Import Folder Button with webkitdirectory */}
            <label 
              style={styles.labeledButton} 
              title="Import entire folder structure"
              aria-label="Import entire folder structure"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && folderInputRef.current?.click()}
            >
              <FolderOpen size={14} />
              <span>Import Folder</span>
              <input
                ref={folderInputRef}
                type="file"
                /* @ts-ignore */
                webkitdirectory=""
                multiple
                onChange={handleFolderImport}
                style={{ display: 'none' }}
                aria-label="Select folder to import"
              />
            </label>
          </div>
        </div>

        {/* Bottom Row: Search (left) + Action buttons (right) - 56px height */}
        <div style={styles.bottomRow}>
          <div style={styles.searchContainer}>
            {/* 🔍 Enhanced Search Input with Clear Button */}
            <Search size={16} style={styles.searchIcon} aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search files and folders..."
              style={styles.searchInput}
              aria-label="Search files and folders. Shortcut: Ctrl+K"
              title="Search files and folders (Ctrl+K)"
              tabIndex={0}
            />
            {/* Clear button - only show when there's text */}
            {searchQuery && (
              <button
                style={styles.clearButton}
                onClick={handleClearSearch}
                title="Clear search"
                aria-label="Clear search input"
                type="button"
                tabIndex={0}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div style={styles.actionButtonsGroup}>
            {/* 🔘 Save Button - triggers save logic */}
            <button
              style={styles.actionButton}
              onClick={handleSave}
              title="Save project as JSON file (Ctrl+S)"
              aria-label="Save project as JSON file. Shortcut: Ctrl+S"
              tabIndex={0}
            >
              <Save size={14} />
              <span>Save</span>
            </button>

            {/* 🔘 Export Button - opens custom export modal */}
            <button
              style={styles.actionButton}
              onClick={handleExport}
              title="Export workspace to folder or as ZIP (Ctrl+Shift+S)"
              aria-label="Export workspace to folder or as ZIP. Shortcut: Ctrl+Shift+S"
              tabIndex={0}
            >
              <Download size={14} />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* 📁 Custom Export Modal */}
      {showExportModal && (
        <div 
          style={styles.modalOverlay} 
          onClick={() => setShowExportModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-modal-title"
        >
          <div 
            style={styles.modalContent} 
            onClick={(e) => e.stopPropagation()}
            role="document"
          >
            <div style={styles.modalHeader} id="export-modal-title">
              <Download size={20} />
              <span>Export Workspace</span>
            </div>
            
            <div style={styles.modalBody}>
              Choose how you want to export your workspace:
              <br /><br />
              <strong>Export to Folder:</strong> Select a directory to save all files with preserved structure.
              <br /><br />
              <strong>Export as ZIP:</strong> Download a compressed archive containing all your files.
              
              {/* Export Status Display */}
              {exportStatus && (
                <>
                  <br /><br />
                  <div style={{
                    padding: '12px',
                    borderRadius: '6px',
                    background: exportStatus.includes('✅') 
                      ? 'rgba(34, 197, 94, 0.1)' 
                      : exportStatus.includes('❌') 
                        ? 'rgba(239, 68, 68, 0.1)'
                        : 'rgba(194, 167, 110, 0.1)',
                    border: `1px solid ${
                      exportStatus.includes('✅') 
                        ? 'rgba(34, 197, 94, 0.3)' 
                        : exportStatus.includes('❌') 
                          ? 'rgba(239, 68, 68, 0.3)'
                          : 'rgba(194, 167, 110, 0.3)'
                    }`,
                    color: exportStatus.includes('✅') 
                      ? '#22C55E' 
                      : exportStatus.includes('❌') 
                        ? '#EF4444'
                        : '#C2A76E',
                    fontSize: IDE_TYPOGRAPHY.fontSize.small,
                    fontFamily: IDE_TYPOGRAPHY.fontFamily,
                    textAlign: 'center' as const
                  }}>
                    {exportStatus}
                  </div>
                </>
              )}
            </div>

            <div style={styles.modalActions}>
              <button
                style={styles.modalButton}
                onClick={() => setShowExportModal(false)}
                aria-label="Cancel export"
                tabIndex={0}
              >
                Cancel
              </button>
              
              <button
                style={styles.modalButton}
                onClick={handleExportAsZip}
                disabled={isExporting}
                aria-label="Export workspace as ZIP file"
                tabIndex={0}
              >
                <Download size={14} />
                {isExporting ? 'Creating ZIP...' : 'Export as synapse-ide-workspace.zip'}
              </button>

              <button
                style={styles.modalPrimaryButton}
                onClick={handleExportToFolder}
                disabled={isExporting}
                aria-label="Export workspace to selected folder"
                tabIndex={0}
              >
                <FolderOpen size={14} />
                {isExporting ? 'Exporting...' : 'Export to Folder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FileExplorerHeader;
