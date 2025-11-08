# Codebase Exploration Report: Card Save/Load and State Management

## Executive Summary

The codebase implements a comprehensive card file management system with the following components:
- **IPC Handlers**: Main process handles for save/load operations
- **State Management**: Zustand store tracking card modifications
- **File Operations**: JSON-based persistence in `_input` and `_out` directories
- **Dirty State Tracking**: Per-tab `isDirty` flag indicating unsaved changes
- **UI Integration**: Save buttons, status indicators, and keyboard shortcuts

---

## 1. Card File Save/Load Functionality

### 1.1 IPC Handlers (Main Process)

**File**: `/home/katsu/work/doc2data/mdsplitter_copy_codex/src/main/main.ts`

| Handler | Location | Functionality |
|---------|----------|-----------------|
| `workspace:save` | Lines 121-133 | Saves workspace snapshot to `_out/workspace.snapshot.json` |
| `workspace:saveCardFile` | Lines 135-147 | Saves card file with explicit filename to `_out/` |
| `workspace:load` | Lines 149-155 | Loads workspace snapshot from disk |
| `workspace:listCardFiles` | Lines 157-161 | Lists available card files in `_input/` |
| `workspace:loadCardFile` | Lines 163-172 | Loads specific card file from `_input/` |
| `workspace:loadTraceFile` | Lines 174-184 | Loads traceability file matching file pair |

**Key Features**:
- Validation of payload structure (lines 122-128, 140-142)
- Path safety checks and normalization
- Comprehensive logging via `logMessage()` function
- Error handling with user-facing messages

### 1.2 File Operations (Workspace Module)

**File**: `/home/katsu/work/doc2data/mdsplitter_copy_codex/src/main/workspace.ts`

| Function | Lines | Purpose |
|----------|-------|---------|
| `saveWorkspaceSnapshot()` | 339-346 | Saves snapshot to `WORKSPACE_SNAPSHOT_FILENAME` |
| `saveCardFileSnapshot()` | 359-365 | Saves to custom filename with normalization |
| `loadWorkspaceSnapshot()` | 374-399 | Loads and validates snapshot structure |
| `loadCardFile()` | 433-466 | Loads file from `_input/` with path traversal protection |
| `listCardFiles()` | 405-426 | Lists `.json` files in `_input/` |
| `normalizeOutputFileName()` | 348-357 | Sanitizes filenames (prevents path traversal) |

**Directory Structure**:
```
[appPath]/
├── _input/      ← Source card files (loaded from)
├── _out/        ← Destination for saved files
├── _logs/       ← Log files
└── settings.json
```

**Safety Mechanisms**:
- Path traversal prevention (lines 353-354, 437)
- Case-insensitive `.json` extension enforcement
- Structured validation via `isWorkspaceSnapshot()` type guard

### 1.3 Preload/IPC API Exposure

**File**: `/home/katsu/work/doc2data/mdsplitter_copy_codex/src/main/preload.ts`

```typescript
// Line 29-60: AppAPI type definition
type AppAPI = {
  workspace: {
    save: (snapshot: WorkspaceSnapshot) => Promise<{ path: string }>;
    saveCardFile: (fileName: string, snapshot: WorkspaceSnapshot) => Promise<{ path: string }>;
    load: () => Promise<WorkspaceSnapshot | null>;
    listCardFiles: () => Promise<string[]>;
    loadCardFile: (fileName: string) => Promise<WorkspaceSnapshot | null>;
    loadTraceFile: (leftFile: string, rightFile: string) => Promise<LoadedTraceabilityFile | null>;
  };
};
```

---

## 2. Store State Management (Zustand)

### 2.1 PanelTabState Interface

**File**: `/home/katsu/work/doc2data/mdsplitter_copy_codex/src/renderer/store/workspaceStore.ts` (Lines 78-89)

```typescript
export interface PanelTabState {
  id: string;
  leafId: string;
  fileName: string;
  title: string;
  cards: Card[];
  selectedCardIds: Set<string>;
  isDirty: boolean;                    // ← DIRTY STATE TRACKING
  lastSavedAt: string | null;          // ← SAVE TIMESTAMP
  expandedCardIds: Set<string>;
  editingCardId: string | null;
}
```

### 2.2 Dirty State Mutations

| Action | Lines | Changes isDirty |
|--------|-------|-----------------|
| `openTab()` | 220, 252 | Sets to `false` (fresh load) |
| `hydrateTab()` | 831 | Sets to `false` (after reload) |
| `markSaved()` | 840-855 | Sets to `false`, updates `lastSavedAt` |
| `updateCard()` | 612 | Sets to `true` (on any card update) |
| `moveCards()` | 762, 798 | Sets to `true` (on card movement) |
| `addCard()` | 715 | Sets to `true` (on card addition) |
| `deleteCards()` | 1048 | Sets to `true` (on card deletion) |
| `pasteClipboard()` | 1173 | Sets to `true` (on paste) |
| `undo()` | 1270 | Sets to `true` (restores previous state) |
| `redo()` | 1317 | Sets to `true` (restores next state) |

### 2.3 markSaved() Function

**Location**: Lines 840-855

```typescript
markSaved: (tabId, savedAt) => {
  set((state) => {
    const tab = state.tabs[tabId];
    if (!tab) {
      return state;
    }

    return {
      ...state,
      tabs: {
        ...state.tabs,
        [tabId]: { ...tab, isDirty: false, lastSavedAt: savedAt },
      },
    };
  });
}
```

---

## 3. UI Components and Save Operations

### 3.1 Save Status Display

**File**: `/home/katsu/work/doc2data/mdsplitter_copy_codex/src/renderer/App.tsx`

**Location**: Lines 1162-1166

```typescript
const saveStatusText = isSaving
  ? '保存状態: ⏳ 保存中...'
  : isDirty
    ? '保存状態: ● 未保存'      // RED indicator for unsaved
    : `保存状態: ✓ 保存済み${lastSavedAt ? ` (${lastSavedAt.toLocaleTimeString()})` : ''}`;
```

**Location**: Line 275

```typescript
const isDirty = activeTab?.isDirty ?? false;  // Reads dirty flag from active tab
```

### 3.2 Save Handlers

#### Main Save Function (Lines 862-956)

```typescript
const saveActiveTab = useCallback(
  async (options?: { explicitFileName?: string; renameTab?: boolean; force?: boolean }) => {
    // 1. Validation checks (lines 864-890)
    // 2. API availability check (lines 893-904)
    // 3. File naming prompt if needed (lines 906-918)
    // 4. Call window.app.workspace.saveCardFile (line 927)
    // 5. Mark saved state (line 928)
    // 6. Optionally rename tab (lines 929-931)
    // 7. Notification and logging
  }
);
```

**Key Details**:
- Checks `isDirty` flag before attempting save (line 881)
- With `force: true` flag, saves even if `isDirty === false`
- Updates store via `markSaved(activeTabId, snapshot.savedAt)` after success
- Updates tab filename if `renameTab: true`

#### Keyboard Shortcuts (Lines 1335-1343)

```typescript
if (key === 's') {
  event.preventDefault();
  if (event.shiftKey) {
    void handleSaveAs();        // Ctrl+Shift+S
  } else {
    void handleSave();          // Ctrl+S
  }
  return;
}
```

### 3.3 Handle Functions

**handleSave** (Lines 961-963)
- Calls `saveActiveTab()` with default options
- Simple pass-through to save with current filename

**handleSaveAs** (Lines 968-976)
- Prompts for new filename via `window.prompt()`
- Calls `saveActiveTab({ explicitFileName, renameTab: true, force: true })`
- Renames tab after save completion

### 3.4 Tab Dirty Indicator

**File**: `/home/katsu/work/doc2data/mdsplitter_copy_codex/src/renderer/components/CardPanel.tsx`

Currently, the dirty state is tracked but visual indicator in tabs is not explicitly shown in the explored code. However, operation design document (line 44) mentions:
> "未保存のファイルには `●` マーカーが表示"

This suggests tab rendering should include dirty state indicator (implementation may be in CardPanel component rendering section not fully explored).

---

## 4. Data Flow Summary

### 4.1 Save Flow (Ctrl+S)

```
User Input (Ctrl+S)
    ↓
handleSave() in App.tsx
    ↓
saveActiveTab() with default options
    ↓
Validation:
  - Active tab exists?
  - isDirty flag set (unless force=true)?
  - saveCardFile API available?
    ↓
window.app.workspace.saveCardFile(fileName, snapshot)
    ↓
[IPC] workspace:saveCardFile handler in main.ts
    ↓
saveCardFileSnapshot() in workspace.ts
    ↓
fs.writeFile() to _out/[fileName].json
    ↓
markSaved(tabId, savedAt) in store
    ↓
Update tab: isDirty=false, lastSavedAt=timestamp
    ↓
Notification + Log
```

### 4.2 Dirty State Lifecycle

```
Tab Opened/Loaded
    ↓ isDirty = false
    
Card Edited (any mutation)
    ↓ isDirty = true (visual: "● 未保存")
    
Save Command (Ctrl+S)
    ↓ if isDirty or force=true
    ↓ Execute save
    ↓ markSaved() called
    
isDirty = false
    ↓ Visual: "✓ 保存済み (HH:MM:SS)"
```

### 4.3 Load Flow

```
User Action (Open file / Load workspace)
    ↓
window.app.workspace.loadCardFile(fileName)
    ↓
[IPC] workspace:loadCardFile handler
    ↓
loadCardFile() in workspace.ts
    ↓
fs.readFile() + JSON.parse()
    ↓
Validation via isWorkspaceSnapshot()
    ↓
Return WorkspaceSnapshot
    ↓
openTab(leafId, fileName, cards) in store
    ↓
Initialize: isDirty=false, lastSavedAt=options?.savedAt
```

---

## 5. Current Implementation Status

### ✅ COMPLETE

1. **IPC Framework**
   - File: `src/main/main.ts` (lines 121-184)
   - All save/load/list handlers implemented
   - Full validation and error handling

2. **File Operations**
   - File: `src/main/workspace.ts`
   - Both workspace and card file snapshots
   - Path normalization and safety checks
   - JSON read/write with error handling

3. **State Management**
   - File: `src/renderer/store/workspaceStore.ts`
   - `isDirty` flag in `PanelTabState`
   - `markSaved()` function to reset dirty state
   - Dirty state mutations on all card operations

4. **Keyboard Shortcuts**
   - File: `src/renderer/App.tsx` (lines 1335-1343)
   - Ctrl+S for save
   - Ctrl+Shift+S for save-as

5. **Save Handler Logic**
   - File: `src/renderer/App.tsx` (lines 862-976)
   - Full saveActiveTab implementation
   - Dirty flag checking
   - File naming logic
   - Error handling and notifications

6. **Status Display**
   - File: `src/renderer/App.tsx` (lines 1162-1166)
   - Visual indicator: "● 未保存" vs "✓ 保存済み"
   - Timestamp display of last save

### ⚠️ PARTIAL/NEEDS VERIFICATION

1. **Tab Dirty Indicator**
   - Mentioned in operation design (line 44): "未保存のファイルには `●` マーカーが表示"
   - Need to verify implementation in CardPanel component
   - Status bar display is complete but tab-level indicator needs checking

2. **Multi-tab Dirty State**
   - Each tab tracks own isDirty independently
   - Need to verify if app-level save prevents unsaved-changes loss

### ❌ NOT YET IDENTIFIED

1. **Unsaved Changes Dialog**
   - No warning dialog detected when closing/switching tabs with unsaved changes
   - Potential gap for P2-22 implementation

2. **Auto-save Feature**
   - No periodic/debounced auto-save found in current code
   - May be planned for later phase

---

## 6. Gap Analysis for P2-22a and P2-22b

### P2-22a: Dirty State Tracking (Likely Complete)

**Current Status**: ✅ IMPLEMENTED
- `isDirty` flag exists in every tab
- Properly set to `true` on all mutations
- Reset to `false` on save
- Visual indicator in status bar

**Required for completion**:
- Verify tab-level "●" indicator is rendered
- Confirm status bar display works correctly
- Test all mutation paths update isDirty

### P2-22b: Unsaved Changes Protection (Likely Missing)

**Current Status**: ⚠️ PARTIALLY IDENTIFIED
- Save handler checks `isDirty` before saving (line 881)
- But no "discard changes?" dialog found

**Likely needed**:
1. Prevent tab close if `isDirty === true`
   - Location: CardPanel component tab close handler
   - Pattern: `if (isDirty) confirm("Discard unsaved changes?")`

2. Prevent app quit if any tab has unsaved changes
   - Location: main.ts or preload
   - Pattern: app.on('before-quit', preventIfDirty)

3. Warn on file reload
   - Pattern: Before loadCardFile, check if current tab isDirty

**Implementation hints**:
- Store currently tracks `isDirty` per tab
- App.tsx has `saveActiveTab()` that could be called from dialog
- IPC layer exists to persist state if needed

---

## 7. File Locations Summary

### Main Process (Backend)
- `/home/katsu/work/doc2data/mdsplitter_copy_codex/src/main/main.ts` - IPC handlers
- `/home/katsu/work/doc2data/mdsplitter_copy_codex/src/main/workspace.ts` - File operations
- `/home/katsu/work/doc2data/mdsplitter_copy_codex/src/main/preload.ts` - API bridge

### Renderer Process (Frontend)
- `/home/katsu/work/doc2data/mdsplitter_copy_codex/src/renderer/App.tsx` - Save logic, status display
- `/home/katsu/work/doc2data/mdsplitter_copy_codex/src/renderer/store/workspaceStore.ts` - Dirty state tracking
- `/home/katsu/work/doc2data/mdsplitter_copy_codex/src/renderer/components/CardPanel.tsx` - Tab rendering

### Shared Types
- `/home/katsu/work/doc2data/mdsplitter_copy_codex/src/shared/workspace.ts` - Card/Snapshot types
- `/home/katsu/work/doc2data/mdsplitter_copy_codex/src/renderer/global.d.ts` - window.app type definitions

---

## Key Code References

### isDirty Flag Usage
- **Definition**: workspaceStore.ts:85
- **Reads**: App.tsx:275, App.tsx:881, App.tsx:1164
- **Mutations**: workspaceStore.ts:220, 252, 612, 715, 762, 798, 831, 851, 1048, 1173, 1270, 1317

### Save Function Chain
- **Entry**: App.tsx:1335-1343 (keyboard handler)
- **Main**: App.tsx:862-956 (saveActiveTab)
- **IPC Call**: App.tsx:927 (window.app.workspace.saveCardFile)
- **Handler**: main.ts:135-147 (workspace:saveCardFile)
- **Persist**: workspace.ts:359-365 (saveCardFileSnapshot)
- **Update Store**: App.tsx:928 (markSaved)

### Dirty State Lifecycle
- **Initialization**: workspaceStore.ts:220, 252 (isDirty: false on tab open)
- **Mutation on Edit**: workspaceStore.ts:612 (updateCard sets isDirty: true)
- **Reset on Save**: workspaceStore.ts:851 (markSaved sets isDirty: false)
- **Visual Display**: App.tsx:1164 (conditional text based on isDirty)

