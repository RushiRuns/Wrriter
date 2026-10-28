import React from 'react';

export interface IconProps {
  className?: string;
  style?: React.CSSProperties;
}

// 1. Sidebar toggle (toolbar)
export const SidebarToggleIcon: React.FC<IconProps> = ({ className = 'ic', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="M9.5 4v16" />
  </svg>
);

// 2. Back
export const BackIcon: React.FC<IconProps> = ({ className = 'ic', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

// 3. Forward and folder expand (chevron right)
export const ForwardIcon: React.FC<IconProps> = ({ className = 'ic', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 5l7 7-7 7" />
  </svg>
);
export const ChevronRightIcon = ForwardIcon;

// 4. New note (compose)
export const NewNoteIcon: React.FC<IconProps> = ({ className = 'ic', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V12" />
    <path d="M17.6 3.9a1.9 1.9 0 0 1 2.7 2.7l-8 8-3.6.9.9-3.6z" />
  </svg>
);

// 5. Minimise (10 px grid)
export const MinimiseIcon: React.FC<IconProps> = ({ className, style }) => (
  <svg className={className} style={style} viewBox="0 0 10 10" aria-hidden="true">
    <path d="M0.5 5h9" />
  </svg>
);

// 6. Maximise (10 px grid)
export const MaximiseIcon: React.FC<IconProps> = ({ className, style }) => (
  <svg className={className} style={style} viewBox="0 0 10 10" aria-hidden="true">
    <rect x=".5" y=".5" width="9" height="9" rx="2" />
  </svg>
);

// 7. Close (10 px grid)
export const CloseIcon: React.FC<IconProps> = ({ className, style }) => (
  <svg className={className} style={style} viewBox="0 0 10 10" aria-hidden="true">
    <path d="M.5 .5l9 9M9.5 .5l-9 9" />
  </svg>
);

// 8. Notes tile
export const NotesTileIcon: React.FC<IconProps> = ({ className = 'ic xl', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6M9 17h4" />
  </svg>
);

// 9. Inbox tile
export const InboxTileIcon: React.FC<IconProps> = ({ className = 'ic xl', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);

// 10. Tags tile
export const TagsTileIcon: React.FC<IconProps> = ({ className = 'ic xl', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
    <circle cx="7.5" cy="7.5" r="1.2" />
  </svg>
);

export const TagItemIcon: React.FC<IconProps> = ({ className = 'ic sm', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
    <circle cx="7.5" cy="7.5" r="1.2" />
  </svg>
);

// 11. Search tile
export const SearchTileIcon: React.FC<IconProps> = ({ className = 'ic xl', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.6-3.6" />
  </svg>
);

// 12. Archive tile
export const ArchiveTileIcon: React.FC<IconProps> = ({ className = 'ic xl', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="4" width="18" height="5" rx="1.5" />
    <path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" />
    <path d="M10 13h4" />
  </svg>
);

// 13. Trash tile
export const TrashTileIcon: React.FC<IconProps> = ({ className = 'ic xl', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M6 6l1 14h10l1-14" />
    <path d="M10 10.5v6M14 10.5v6" />
  </svg>
);

// 14. Folder, closed (tinted)
export const FolderClosedIcon: React.FC<IconProps> = ({ className = 'ic fi fshut', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path className="fbk" d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.4a2 2 0 0 1 1.5.7l1.1 1.3h7A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z" />
    <path className="ffr" d="M3 11h18v6.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" />
    <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.4a2 2 0 0 1 1.5.7l1.1 1.3h7A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z" />
    <path d="M3 11h18" />
  </svg>
);

// 15. Folder, open (tinted)
export const FolderOpenIcon: React.FC<IconProps> = ({ className = 'ic fi fopen', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path className="fbk" d="M3 17.5v-10A2.5 2.5 0 0 1 5.5 5h3.4a2 2 0 0 1 1.5.7l1.1 1.3h6.5A2.5 2.5 0 0 1 20.5 9.5V11H7.2a2 2 0 0 0-1.9 1.4z" />
    <path d="M3 17.5v-10A2.5 2.5 0 0 1 5.5 5h3.4a2 2 0 0 1 1.5.7l1.1 1.3h6.5A2.5 2.5 0 0 1 20.5 9.5V11" />
    <path className="ffr" d="M5.3 12.4A2 2 0 0 1 7.2 11h13.9a1.5 1.5 0 0 1 1.45 1.9l-1.7 6A2.5 2.5 0 0 1 18.4 20H5.5A2.5 2.5 0 0 1 3 17.5z" />
    <path d="M5.3 12.4A2 2 0 0 1 7.2 11h13.9a1.5 1.5 0 0 1 1.45 1.9l-1.7 6A2.5 2.5 0 0 1 18.4 20H5.5A2.5 2.5 0 0 1 3 17.5" />
  </svg>
);

// 16. Switch vault (small)
export const SwitchVaultIcon: React.FC<IconProps> = ({ className = 'ic xs', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 15l5 5 5-5M7 9l5-5 5 5" />
  </svg>
);

// 17. Settings
export const SettingsIcon: React.FC<IconProps> = ({ className = 'ic', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

// 18. Check mark in menus
export const CheckIcon: React.FC<IconProps> = ({ className = 'ic m ck', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12.5l4.2 4.2L19 7" />
  </svg>
);

// 19. Plus (add vault)
export const PlusIcon: React.FC<IconProps> = ({ className = 'ic xs', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

// 20. Pane toggle with chevron
export const PaneToggleIcon: React.FC<IconProps> = ({ className = 'ic', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="M9 4v16" />
    <path className="cho" d="M16 9l-3 3 3 3" />
    <path className="chs" d="M13 9l3 3-3 3" />
  </svg>
);

// 21. Sort
export const SortIcon: React.FC<IconProps> = ({ className = 'ic', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" />
  </svg>
);

// 22. Three dots horizontal
export const ThreeDotsHorizontalIcon: React.FC<IconProps> = ({ className = 'ic', style }) => (
  <svg className={className} style={{ fill: 'currentColor', stroke: 'none', ...style }} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="5" cy="12" r="2.1" />
    <circle cx="12" cy="12" r="2.1" />
    <circle cx="19" cy="12" r="2.1" />
  </svg>
);

// 23. Pin (small)
export const PinIcon: React.FC<IconProps> = ({ className = 'ic xs', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 17v5M8 3h8l-1 6 3 3v2H6v-2l3-3z" />
  </svg>
);

// 24. Duplicate
export const DuplicateIcon: React.FC<IconProps> = ({ className = 'ic m', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h8" />
  </svg>
);

// 25. Move to folder
export const MoveToFolderIcon: React.FC<IconProps> = ({ className = 'ic m', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M9 13h6M12.5 10.5L15 13l-2.5 2.5" />
  </svg>
);

// 26. Pop out
export const PopOutIcon: React.FC<IconProps> = ({ className = 'ic m', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M14 4h6v6" />
    <path d="M20 4l-8 8" />
    <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  </svg>
);

// 27. Share
export const ShareIcon: React.FC<IconProps> = ({ className = 'ic m', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 15V3" />
    <path d="M8 7l4-4 4 4" />
    <path d="M8 11H6.5A1.5 1.5 0 0 0 5 12.5v6A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-6a1.5 1.5 0 0 0-1.5-1.5H16" />
  </svg>
);

// 28. Export as
export const ExportIcon: React.FC<IconProps> = ({ className = 'ic m', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 4v11" />
    <path d="M8 11l4 4 4-4" />
    <path d="M5 20h14" />
  </svg>
);

// 29. Show in File Explorer
export const ShowInExplorerIcon: React.FC<IconProps> = ({ className = 'ic m', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 10h18" />
  </svg>
);

// 30. Chevron down (small)
export const ChevronDownIcon: React.FC<IconProps> = ({ className = 'ic xs', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

// 31. Bullet list
export const BulletListIcon: React.FC<IconProps> = ({ className = 'ic m', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1" />
    <circle cx="4.5" cy="12" r="1" />
    <circle cx="4.5" cy="18" r="1" />
  </svg>
);

// 32. Link
export const LinkIcon: React.FC<IconProps> = ({ className = 'ic m', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </svg>
);

// 33. More floating toolbar (three dots)
export const MoreFloatingIcon: React.FC<IconProps> = ({ className = 'ic m', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="5" cy="12" r="1.3" />
    <circle cx="12" cy="12" r="1.3" />
    <circle cx="19" cy="12" r="1.3" />
  </svg>
);

// 34. Block grip (six dots)
export const BlockGripIcon: React.FC<IconProps> = ({ className = 'ic m', style }) => (
  <svg className={className} style={{ fill: 'currentColor', stroke: 'none', ...style }} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="9" cy="6" r="1.9" />
    <circle cx="15" cy="6" r="1.9" />
    <circle cx="9" cy="12" r="1.9" />
    <circle cx="15" cy="12" r="1.9" />
    <circle cx="9" cy="18" r="1.9" />
    <circle cx="15" cy="18" r="1.9" />
  </svg>
);

// 35. Callout: tip
export const CalloutTipIcon: React.FC<IconProps> = ({ className = 'ic m', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
    <path d="M9 18h6" />
    <path d="M10 22h4" />
  </svg>
);

// 36. Callout: warning
export const CalloutWarnIcon: React.FC<IconProps> = ({ className = 'ic m', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

// 37. Callout: danger
export const CalloutDangerIcon: React.FC<IconProps> = ({ className = 'ic m', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 16h.01" />
    <path d="M12 8v4" />
    <path d="M15.312 2a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586l-4.688-4.688A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2z" />
  </svg>
);

// 38. Align left
export const AlignLeftIcon: React.FC<IconProps> = ({ className = 'ic m', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 6h16M4 12h10M4 18h14" />
  </svg>
);

// 39. Centre
export const AlignCenterIcon: React.FC<IconProps> = ({ className = 'ic m', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 6h16M7 12h10M5 18h14" />
  </svg>
);

// 40. Align right
export const AlignRightIcon: React.FC<IconProps> = ({ className = 'ic m', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 6h16M10 12h10M6 18h14" />
  </svg>
);

// 41. Remove from note
export const RemoveFromNoteIcon: React.FC<IconProps> = ({ className = 'ic m', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M6 6l1 14h10l1-14" />
  </svg>
);

// 42. Web link globe
export const WebLinkGlobeIcon: React.FC<IconProps> = ({ className = 'ic m', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z" />
  </svg>
);

// 43. Slash menu: Heading
export const SlashHeadingIcon: React.FC<IconProps> = ({ className = 'ic', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 12h8" />
    <path d="M4 18V6" />
    <path d="M12 18V6" />
    <path d="M17 12l3-2v8" />
  </svg>
);

// 44. Slash menu: Subheading
export const SlashSubheadingIcon: React.FC<IconProps> = ({ className = 'ic', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 12h8" />
    <path d="M4 18V6" />
    <path d="M12 18V6" />
    <path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1" />
  </svg>
);

// 45. Slash menu: Quote
export const SlashQuoteIcon: React.FC<IconProps> = ({ className = 'ic', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 5v14" />
    <path d="M10 8h9" />
    <path d="M10 12h9" />
    <path d="M10 16h5" />
  </svg>
);

// 46. Slash menu: Numbered list
export const SlashNumberedListIcon: React.FC<IconProps> = ({ className = 'ic', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M10 6h11M10 12h11M10 18h11" />
    <path d="M4 6h1v4" />
    <path d="M4 10h2" />
    <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
  </svg>
);

// 47. Slash menu: Task list
export const SlashTaskListIcon: React.FC<IconProps> = ({ className = 'ic', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 17l2 2 4-4" />
    <path d="M3 7l2 2 4-4" />
    <path d="M13 6h8" />
    <path d="M13 12h8" />
    <path d="M13 18h8" />
  </svg>
);

// 48. Slash menu: Table
export const SlashTableIcon: React.FC<IconProps> = ({ className = 'ic', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 10h18" />
    <path d="M10 4v16" />
  </svg>
);

// 49. Slash menu: Code block
export const SlashCodeIcon: React.FC<IconProps> = ({ className = 'ic', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M18 16l4-4-4-4" />
    <path d="M6 8l-4 4 4 4" />
    <path d="M14.5 4l-5 16" />
  </svg>
);

// 50. Slash menu: Callout (also info callout icon)
export const SlashCalloutIcon: React.FC<IconProps> = ({ className = 'ic', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5" />
    <path d="M12 8h.01" />
  </svg>
);

// 51. Slash menu: Divider
export const SlashDividerIcon: React.FC<IconProps> = ({ className = 'ic', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 12h3" />
    <path d="M10.5 12h3" />
    <path d="M18 12h3" />
  </svg>
);

// 52. Slash menu: Image
export const SlashImageIcon: React.FC<IconProps> = ({ className = 'ic', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="M21 15l-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
  </svg>
);

// 53. Close mark (tabs, small)
export const TabCloseIcon: React.FC<IconProps> = ({ className = 'ic xs', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

// 54. Checkmark
export const CheckmarkIcon: React.FC<IconProps> = ({ className = 'ic sm', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// 55. Chevron Up/Down (selector)
export const ChevronUpDownIcon: React.FC<IconProps> = ({ className = 'ic sm', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 15l5 5 5-5M7 9l5-5 5-5" />
  </svg>
);

// 56. Folder Add
export const FolderAddIcon: React.FC<IconProps> = ({ className = 'ic', style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z" />
    <line x1="12" y1="10" x2="12" y2="16" />
    <line x1="9" y1="13" x2="15" y2="13" />
  </svg>
);

// 57. MoreDotsIcon alias
export const MoreDotsIcon = ThreeDotsHorizontalIcon;


