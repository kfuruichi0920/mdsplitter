# Quick Reference: Card Save/Load Implementation

## Critical Files

### Backend (Main Process)
```
src/main/main.ts
  └─ Lines 121-184: IPC handlers for save/load
  └─ workspace:save, workspace:saveCardFile, workspace:load, 
     workspace:listCardFiles, workspace:loadCardFile, workspace:loadTraceFile

src/main/workspace.ts
  └─ Lines 339-465: File I/O operations
  └─ saveWorkspaceSnapshot(), saveCardFileSnapshot()
  └─ loadWorkspaceSnapshot(), loadCardFile(), listCardFiles()
  └─ normalizeOutputFileName() - path traversal protection

src/main/preload.ts
  └─ Lines 29-85: API exposure via contextBridge
  └─ Exposes window.app.workspace methods to renderer
```

### Frontend (Renderer)
```
src/renderer/App.tsx
  └─ Line 275: Read isDirty from active tab
  └─ Lines 862-956: saveActiveTab() - main save logic
  └─ Lines 961-976: handleSave() and handleSaveAs()
  └─ Lines 1335-1343: Keyboard handler (Ctrl+S, Ctrl+Shift+S)
  └─ Lines 1162-1166: Status bar display (● 未保存 vs ✓ 保存済み)

src/renderer/store/workspaceStore.ts
  └─ Line 85: isDirty in PanelTabState interface
  └─ Lines 840-855: markSaved() function
  └─ Lines 612, 715, 762, 798, 1048, 1173, 1270, 1317: isDirty mutations
  └─ Lines 220, 252, 831: isDirty initialization to false

src/renderer/components/CardPanel.tsx
  └─ Tab rendering (likely contains dirty indicator)
```

## State Flow

### Dirty Flag Lifecycle
```
NEW TAB OPENED
    ↓
openTab() → isDirty: false
    ↓
USER EDITS CARD
    ↓
updateCard() → isDirty: true
    ↓
STATUS: "● 未保存"
    ↓
USER PRESSES CTRL+S
    ↓
saveActiveTab() checks isDirty
    ↓
CALLS window.app.workspace.saveCardFile()
    ↓
IPC: workspace:saveCardFile handler
    ↓
FILE WRITTEN to _out/
    ↓
markSaved(tabId, timestamp)
    ↓
isDirty: false, lastSavedAt: timestamp
    ↓
STATUS: "✓ 保存済み (HH:MM:SS)"
```

## Key Function Signatures

### Store (Zustand)
```typescript
// interface PanelTabState
{
  id: string;
  isDirty: boolean;           // <- KEY FIELD
  lastSavedAt: string | null;
  cards: Card[];
  fileName: string;
  // ... other fields
}

// in useWorkspaceStore
markSaved: (tabId: string, savedAt: string) => void;
  // Sets isDirty: false, lastSavedAt: savedAt
```

### IPC API
```typescript
// window.app.workspace (via preload)
saveCardFile(fileName: string, snapshot: WorkspaceSnapshot): Promise<{ path: string }>
loadCardFile(fileName: string): Promise<WorkspaceSnapshot | null>
listCardFiles(): Promise<string[]>
```

### Main Process
```typescript
// src/main/workspace.ts
export async function saveCardFileSnapshot(
  fileName: string,
  snapshot: WorkspaceSnapshot
): Promise<string>

export async function loadCardFile(
  fileName: string
): Promise<WorkspaceSnapshot | null>

export async function listCardFiles(): Promise<string[]>
```

## Validation Points

### Dirty State Check
```typescript
// App.tsx line 881
if (!options?.force && !isDirty) {
  notify('info', '保存対象の変更はありません。');
  return false;
}
```

### File Name Validation
```typescript
// workspace.ts line 348-356
const normalizeOutputFileName = (fileName: string): string => {
  const trimmed = fileName?.trim?.() ?? '';
  if (!trimmed) {
    throw new Error('保存ファイル名が指定されていません。');
  }
  if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('..')) {
    throw new Error('ファイル名に使用できない文字が含まれています。');
  }
  return trimmed.toLowerCase().endsWith('.json') ? trimmed : `${trimmed}.json`;
};
```

## Mutation Paths that Set isDirty: true

| Action | Code Location |
|--------|----------------|
| Update card content | workspaceStore.ts:612 |
| Move cards | workspaceStore.ts:762, 798 |
| Add card | workspaceStore.ts:715 |
| Delete card | workspaceStore.ts:1048 |
| Paste clipboard | workspaceStore.ts:1173 |
| Undo | workspaceStore.ts:1270 |
| Redo | workspaceStore.ts:1317 |

## Test Scenarios

### P2-22a: Dirty State Tracking
- [ ] Open file → isDirty should be false
- [ ] Edit card → isDirty should be true
- [ ] Save file → isDirty should be false, lastSavedAt should update
- [ ] Status bar shows "● 未保存" when isDirty: true
- [ ] Status bar shows "✓ 保存済み" when isDirty: false
- [ ] Tab indicator shows "●" marker when isDirty: true

### P2-22b: Unsaved Changes Protection (If Required)
- [ ] Close tab with unsaved changes → show confirmation dialog
- [ ] Close app with unsaved changes → show confirmation dialog
- [ ] Switch tab with unsaved changes → optionally warn (check requirements)
- [ ] Reload file with unsaved changes → show confirmation dialog

## Diagnostic Commands

```bash
# Check dirty flag propagation
grep -n "isDirty" src/renderer/store/workspaceStore.ts

# Check save handler
grep -n "saveActiveTab\|handleSave" src/renderer/App.tsx

# Check status display
grep -n "保存状態\|isDirty\|isSaving" src/renderer/App.tsx

# Check IPC handlers
grep -n "workspace:save" src/main/main.ts

# Check file operations
grep -n "saveCardFileSnapshot\|loadCardFile" src/main/workspace.ts
```

## Common Issues

### Issue: isDirty not updating after edit
- Check if mutation function calls `set()` with `isDirty: true`
- Verify the setter is in the correct branch of the reducer
- Ensure tab is in `state.tabs` before mutation

### Issue: Save not working
- Verify `window.app.workspace.saveCardFile` exists
- Check IPC handler is registered in main.ts
- Verify file path normalization passes
- Check _out/ directory exists and is writable

### Issue: Status not showing
- Verify `isDirty` value is read from store correctly
- Check string interpolation in saveStatusText
- Ensure notification system is initialized

## Integration Points for P2-22

### P2-22a (Dirty State - MOSTLY DONE)
- [ ] Ensure tab-level indicator renders properly
- [ ] Verify all mutation paths update isDirty
- [ ] Test status bar display updates in real-time

### P2-22b (Unsaved Changes Dialog - NEEDS IMPLEMENTATION)
- [ ] Add closeTab() handler with confirmation dialog
- [ ] Add app beforeQuit handler checking all tabs
- [ ] Add reload file confirmation
- [ ] Connect to saveActiveTab() from dialogs

## Performance Considerations

- isDirty is a simple boolean flag (O(1) read/write)
- All mutations already trigger store updates (no additional overhead)
- Save operation is async, shows progress indicator
- Status display updates reactively on isDirty change

## References

- Type definitions: src/shared/workspace.ts
- Store state: src/renderer/store/workspaceStore.ts
- IPC API bridge: src/main/preload.ts
- Documentation: doc/software_detail_design.md
