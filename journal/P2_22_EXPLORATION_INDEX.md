# P2-22 Codebase Exploration - Document Index

Generated: 2025-11-08

## Overview

This directory contains a comprehensive exploration of the card save/load functionality and state management for P2-22 requirements. Three documents have been generated to support different use cases.

## Documents

### 1. CODEBASE_ANALYSIS_P2_22.md (14KB, 437 lines)

**Purpose**: Detailed technical analysis suitable for architects and senior developers

**Contents**:
- Executive summary of all components
- IPC handlers detail (6 handlers, lines 121-184)
- File operations architecture (5 functions, 339-466 lines)
- Store state management interface and mutations (85, 612, 715, 762, etc.)
- UI components and save operations
- Data flow diagrams (Save Flow, Dirty State Lifecycle, Load Flow)
- Current implementation status (6 complete, 2 partial, 2 missing)
- Gap analysis for P2-22a and P2-22b
- 7 file location summaries
- Key code references with line numbers

**When to use**:
- Planning P2-22 implementation
- Understanding full system architecture
- Making design decisions
- Identifying gaps and dependencies
- Review sessions with stakeholders

### 2. QUICK_REFERENCE_P2_22.md (6.6KB, 231 lines)

**Purpose**: Rapid lookup guide for developers implementing P2-22

**Contents**:
- Critical files with line ranges
- State flow diagram (Dirty Flag Lifecycle)
- Key function signatures
- Validation points with code examples
- Mutation paths table (8 paths documented)
- Test scenarios (P2-22a and P2-22b)
- Diagnostic commands (grep patterns)
- Common issues and solutions
- Integration checklist
- Performance notes

**When to use**:
- Quick lookups during development
- Running tests
- Debugging dirty state issues
- Setting up test environment
- Checking implementation completeness

### 3. This Index File

**Purpose**: Navigation and quick reference

**Contents**:
- Document overview
- File cross-reference
- Critical findings summary
- Phase status matrix
- Quick code lookups

---

## Critical Findings Summary

### P2-22a: Dirty State Tracking - Status: 95% COMPLETE

**What's Done**:
- isDirty field in PanelTabState (workspaceStore.ts:85)
- Set to true on all 9 card mutations
- Set to false on save (markSaved function)
- Status bar displays "● 未保存" vs "✓ 保存済み"
- Keyboard shortcuts work (Ctrl+S, Ctrl+Shift+S)
- Save handler checks isDirty flag

**What's Needed**:
- Verify tab-level dirty indicator renders
- Test all mutation paths in real app
- Confirm status updates are reactive

### P2-22b: Unsaved Changes Protection - Status: 0% IDENTIFIED

**What's Missing**:
- No confirmation dialog on tab close
- No app quit prevention
- No file reload warning
- These are likely P2-22b requirements

**Implementation Pattern**:
```
if (isDirty) {
  showConfirmDialog("Save changes?")
    ├─ Save -> saveActiveTab()
    ├─ Discard -> proceed
    └─ Cancel -> prevent action
}
```

---

## File Cross-Reference

### Backend Implementation
| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| src/main/main.ts | 121-184 | IPC handlers | ✅ Complete |
| src/main/workspace.ts | 339-466 | File I/O | ✅ Complete |
| src/main/preload.ts | 29-85 | API bridge | ✅ Complete |

### Frontend Implementation
| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| src/renderer/App.tsx | 275, 862-956, 961-976, 1335-1343, 1162-1166 | Save logic & status | ✅ Complete |
| src/renderer/store/workspaceStore.ts | 85, 612, 715, 762, 798, 840-855, 1048, 1173, 1270, 1317 | Dirty state | ✅ Complete |
| src/renderer/components/CardPanel.tsx | (tab rendering) | Tab dirty indicator | ⚠️ Verify |

### Shared Types
| File | Purpose |
|------|---------|
| src/shared/workspace.ts | Card, WorkspaceSnapshot types |
| src/renderer/global.d.ts | window.app type definitions |

---

## Key Code Locations

### Dirty State Tracking
```
Definition:  workspaceStore.ts:85
Read by:     App.tsx:275, 881, 1164
Set true:    Lines 612, 715, 762, 798, 1048, 1173, 1270, 1317
Set false:   Lines 220, 252, 831, 851
```

### Save Function Chain
```
Keyboard:    App.tsx:1335-1343 (Ctrl+S handler)
Handler:     App.tsx:862-956 (saveActiveTab)
IPC Call:    App.tsx:927 (window.app.workspace.saveCardFile)
Main:        main.ts:135-147 (workspace:saveCardFile)
Persist:     workspace.ts:359-365 (saveCardFileSnapshot)
Update:      App.tsx:928 (markSaved call)
```

### Status Display
```
Location:    App.tsx:1162-1166
Condition:   isDirty flag
Display:     "● 未保存" (true) | "✓ 保存済み" (false)
Timestamp:   lastSavedAt formatted
```

---

## Development Workflow

### Phase 1: Verification (P2-22a)
1. Read CODEBASE_ANALYSIS_P2_22.md sections 1-3
2. Run tests: `npm test -- workspaceStore`
3. Verify tab dirty indicator renders in CardPanel
4. Test save flow manually (Ctrl+S, Ctrl+Shift+S)
5. Confirm status bar updates on all mutations

### Phase 2: Implementation (P2-22b)
1. Read QUICK_REFERENCE_P2_22.md test scenarios
2. Design confirmation dialogs per requirements
3. Add closeTab() protection with isDirty check
4. Add app quit protection checking all tabs
5. Add file reload confirmation
6. Connect dialogs to saveActiveTab()
7. Write unit tests for dialog flows

### Phase 3: Testing
1. Use diagnostic commands from QUICK_REFERENCE
2. Test all common issues listed
3. Run performance checks (isDirty is O(1))
4. Integration test with real file operations
5. Test multi-tab scenarios

---

## Quick Lookup Reference

### Find isDirty Usage
```bash
grep -n "isDirty" src/renderer/store/workspaceStore.ts | head -20
grep -n "isDirty" src/renderer/App.tsx
```

### Find Save Handler
```bash
grep -n "saveActiveTab\|handleSave" src/renderer/App.tsx
```

### Find Dirty State Mutations
```bash
grep -n "isDirty: true" src/renderer/store/workspaceStore.ts
```

### Find Status Display
```bash
grep -n "保存状態\|未保存\|保存済み" src/renderer/App.tsx
```

### Find IPC Handlers
```bash
grep -n "ipcMain.handle.*save\|ipcMain.handle.*load" src/main/main.ts
```

---

## Quality Checklist

### P2-22a Verification
- [ ] isDirty initialized to false on tab open
- [ ] isDirty set to true on all 9 mutations
- [ ] isDirty reset to false on save
- [ ] Status bar shows correct indicator
- [ ] Keyboard shortcuts (Ctrl+S, Ctrl+Shift+S) work
- [ ] Tab dirty indicator renders correctly
- [ ] Multi-tab isDirty independence verified
- [ ] Tests pass for dirty state tracking

### P2-22b Implementation
- [ ] Confirmation dialog on tab close
- [ ] Confirmation dialog on app quit
- [ ] Confirmation dialog on file reload
- [ ] Dialog connects to saveActiveTab()
- [ ] Cancel button prevents action
- [ ] Save button calls save and closes
- [ ] Discard button closes without save
- [ ] Tests for all dialog flows

---

## Integration Points

### For P2-22a (Dirty State)
- **Store**: useWorkspaceStore() provides isDirty
- **UI**: App.tsx reads and displays isDirty
- **IPC**: save handler checks isDirty flag
- **Mutations**: All mutations update isDirty

### For P2-22b (Unsaved Protection)
- **Store**: isDirty available for all tabs
- **Handlers**: closeTab(), beforeQuit, loadCardFile
- **Dialogs**: Connect to saveActiveTab() on save
- **Persist**: Use existing IPC layer

---

## Performance Notes

- **isDirty flag**: O(1) read/write, no performance impact
- **Status display**: Reactive update, no polling
- **Save operation**: Async with progress indicator
- **Mutation tracking**: Already in place, no overhead

---

## Documentation Links

- **Design Spec**: doc/software_detail_design.md
- **Requirements**: doc/software_requirement.md
- **Operations**: doc/operation_design.md (mentions "●" indicator)
- **Tests**: src/renderer/store/workspaceStore.test.ts

---

## Questions & Support

If you need clarification on:
- **Architecture**: See CODEBASE_ANALYSIS_P2_22.md sections 1-4
- **Implementation**: See QUICK_REFERENCE_P2_22.md
- **Testing**: See test scenarios in QUICK_REFERENCE_P2_22.md
- **Line references**: Check "Critical Code References" in CODEBASE_ANALYSIS

---

## Version History

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | 2025-11-08 | Initial exploration complete |

---

Generated with Claude Code

