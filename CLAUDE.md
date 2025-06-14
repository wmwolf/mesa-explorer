# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mesa Explorer is a web-based visualization tool for MESA (Modules for Experiments in Stellar Astrophysics) stellar simulation data. It's built with Bootstrap 5 and D3.js v7.8.4 as a client-side web application that runs entirely in the browser.

The application allows users to upload MESA history files, profile files, or GYRE summary files and create interactive visualizations with dual y-axes, logarithmic scaling, data transformations, and SVG export capabilities.

## Architecture

### File Structure
- `index.html` - Main application page with Bootstrap UI components
- `js/file-manager.js` - File upload, parsing, validation, and selection management (651 lines)
- `js/ui-utils.js` - UI layout utilities (panel toggle, mini plot, responsive resizing) (266 lines)
- `js/style-manager.js` - Style management, theming, and color schemes (~300 lines)
- `js/data-utils.js` - Data processing, transformations, and accessor functions (173 lines)
- `js/series-manager.js` - Multi-series UI management and configuration (308 lines)
- `js/interaction-manager.js` - Mouse interactions, tool palette, pan/zoom, and inspector functionality (398 lines)
- `js/controls-manager.js` - UI controls coordination and management (~200 lines)
- `js/mesa-explorer.js` - Core D3.js visualization and rendering (~550 lines)
- `js/color-modes.js` - Bootstrap color theme switching functionality
- `data/` - Contains CSV files with known column metadata for MESA files
- `gen_columns_data.py` - Python script to generate column metadata from MESA installation

### Key Components

**File Manager** (`file_manager` object):
- Handles file uploads and parsing of MESA data files
- Detects file types (history/profile/gyre) based on content structure
- Processes header and bulk data into JavaScript objects
- Maintains list of loaded files and active file selection

**Style Manager** (`style_manager` object):
- Manages global styling settings and color schemes
- Handles persistent series styling and customizations
- Coordinates color cycling and theme management
- Provides UI controls for style panel configuration

**Data Utilities** (`data_utils` object):
- Pure data processing functions for transformations and calculations
- Handles data extent calculations and axis value collection
- Provides accessor functions for data transformations (log, absolute value, modulo, re-zeroing)
- Manages data filtering and reduction for rendering performance

**Series Manager** (`series_manager` object):
- Manages multi-series UI creation and configuration
- Handles series definitions, column selection, and labeling
- Coordinates series styling with style manager
- Provides series data creation and management functions

**Visualization Core** (`vis` object):
- Core D3.js-based plotting and rendering engine
- Manages dual y-axes support and scale creation
- Handles plot layout, axis rendering, and legend generation
- Coordinates with other managers for complete visualization system

**Interaction Manager** (`interaction_manager` object):
- Handles mouse interactions and tool palette (Inspector, Pan, Box Zoom, Reset View)
- Manages pan and zoom operations with axis limit updates
- Provides inspector tooltips and real-time visual feedback
- Coordinates with visualization system for seamless user interaction

**Data Processing**:
- MESA files have specific format: header data in lines 1-3, column names in line 6, data starting line 7
- Files are parsed into header object and bulk data array
- Column metadata is merged with known column information from CSV files

### Development vs Production Modes

The application has commented sections for development vs production JavaScript paths:

- Development: `/js/file-manager.js`, `/js/ui-utils.js`, `/js/style-manager.js`, `/js/data-utils.js`, `/js/series-manager.js`, `/js/interaction-manager.js`, `/js/controls-manager.js`, `/js/mesa-explorer.js`, `/js/color-modes.js`
- Production: `/mesa-explorer/js/file-manager.js`, `/mesa-explorer/js/ui-utils.js`, `/mesa-explorer/js/style-manager.js`, `/mesa-explorer/js/data-utils.js`, `/mesa-explorer/js/series-manager.js`, `/mesa-explorer/js/interaction-manager.js`, `/mesa-explorer/js/controls-manager.js`, `/mesa-explorer/js/mesa-explorer.js`, `/mesa-explorer/js/color-modes.js`

## Common Commands

This is a client-side web application with no build process. To develop locally:

1. Serve the files from a local web server (required for loading CSV data files)
2. Use browser developer tools for debugging
3. Files can be edited directly and refreshed in browser

For generating column metadata (requires MESA installation):

```bash
python gen_columns_data.py
```

## Key Features

### Current Functionality
- **Multi-series plotting**: Support for multiple data series on each y-axis in single-file mode
- **Dual y-axis support**: Independent left and right y-axes with proper margin handling
- **Interactive axis labels**: Live-updating axis labels with auto-population from first series
- **Flexible styling**: Individual series styling (color, line width, markers, opacity) with global defaults
- **Data transformations**: Logarithmic, absolute value, modulo operations, re-zeroing
- **Plot interaction tools**: Inspector, pan, box zoom, and reset view modes
- **SVG export**: Publication-ready export with proper dark/light mode handling
- **Responsive design**: Bootstrap-based layout with collapsible files panel
- **Color theme switching**: Light/dark/auto modes with localStorage persistence

### File Management
- Support for MESA history, profile, and GYRE summary files
- Multi-file mode for comparing data across different files
- Single-file mode with enhanced multi-series capabilities
- Automatic file type detection and validation

## Current Architecture Status

### Completed Multi-Series Implementation
- ✅ Series management UI with add/remove capabilities
- ✅ Individual series styling controls (color, line style, markers)
- ✅ Proper axis positioning and margin handling
- ✅ Live-updating axis labels with auto-population
- ✅ Color scheme management with persistent styling
- ✅ Legend generation for multi-series plots

### Known Issues & Future Improvements

#### High Priority
1. **✅ Color cycle intelligence and axis label management** (COMPLETED):
   - ✅ Fixed: Global color cycling across both axes prevents color conflicts
   - ✅ Implemented: Dynamic axis label coloring based on series counts
   - ✅ Enhancement: Single series axes get colored labels, multiple series axes stay black
   - ✅ Architecture: Robust callback system prevents loading order issues

2. **✅ Inspector mode updates** (COMPLETED):
   - ✅ Fixed: Inspector tooltips now use axis labels instead of raw data names
   - ✅ Implemented: Consistent label cleaning and color matching with axis labels
   - ✅ Resolved: Right axis tracking bug when switching between file modes
   - ✅ Enhancement: Inspector labels match axis label content and colors exactly

3. **Multi-file mode series styling and naming**:
   - Current: All series in multi-file mode get the same default color
   - Need: Default series colors should cycle through color schemes to distinguish files
   - Current: Series names in multi-file mode may not default to file names
   - Need: Series should default to using file display names (local_name) in multi-file mode
   - Enhancement: Better visual distinction between files when plotting multiple files

4. **Series styling persistence issues**:
   - Current: Adding a new series may reset individual style changes made to existing series
   - Need: Individual series style changes should persist when new series are added
   - Issue: Style management may not properly maintain individual customizations during series creation

5. **✅ Y-axis dropdown UI inconsistency** (COMPLETED):
   - ✅ Fixed: Y-axis dropdowns now match X-axis behavior and appearance
   - ✅ Implemented: Full keyboard navigation (arrow keys, return to select, immediate search active state)
   - ✅ Resolution: Users can navigate y-axis selections entirely with keyboard

6. **✅ Multi-file mode legend labeling** (COMPLETED):
   - ✅ Fixed: Legend labels now show only file names in multi-file mode
   - ✅ Enhancement: Cleaner legend presentation for multi-file comparisons

7. **✅ Multi-file mode color cycling** (COMPLETED):
   - ✅ Fixed: Each file now gets distinct color from color cycle
   - ✅ Resolution: Multi-file mode properly assigns colors by file index

8. **✅ Logarithmic column detection and transformation system** (COMPLETED):
   - ✅ Implemented: Complete per-series transformation architecture
   - ✅ Fixed: Auto-detection of log columns with automatic rescaling and axis suggestions
   - ✅ Enhanced: Per-series data transformations (Linear/Log/Exp, Zero-point, Absolute Value)
   - ✅ UI Redesign: Moved transformation controls into series boxes with consistent layout
   - ✅ X-axis Integration: X-axis transformations now work properly with automatic log detection

9. **✅ UI architecture and consistency** (COMPLETED):
   - ✅ Fixed: X-axis label positioning moved above dropdown for consistency
   - ✅ Enhanced: Uniform layout across all axis controls
   - ✅ Improved: All axes have identical "Axis Settings" sections with consistent styling
   - ✅ Terminology: Clear distinction between "Rescale" (data) and "Scale" (axis display)

10. **✅ Files panel hide/minimize button not working** (COMPLETED):
   - ✅ Fixed: Button to hide files panel now functions properly
   - ✅ Resolution: Files panel can be collapsed/expanded as expected

11. **Legend responsive sizing and typography**:
   - Current: Legend width is fixed and doesn't scale with legend content size
   - Current: Legend text size may not match other UI text elements
   - Need: Legend width should auto-adjust based on legend handle size and content
   - Need: Legend text should use consistent font size with rest of interface
   - Enhancement: Better visual integration and responsive design

12. **Y-axis label and series name cleaning for log columns**:
   - Current: Y-axis labels and series names keep "log_" or "log" prefix from column names
   - Expected: Should remove "log_" or "log" prefix when generating labels, similar to X-axis behavior
   - Issue: X-axis properly cleans "log_" from column names but Y-axis does not
   - Need: Consistent label cleaning across all axes for better readability
   - Example: "log_L" should become "L" in axis labels and series names

#### Code Architecture

1. **✅ File modularity** (COMPLETED - reduced from ~3500 to ~550 lines):
   - ✅ Completed: `file-manager.js` - File upload, parsing, validation (651 lines)
   - ✅ Completed: `ui-utils.js` - UI layout utilities, panel toggle, mini plot (266 lines)
   - ✅ Completed: `style-manager.js` - Style management and theming (~300 lines)
   - ✅ Completed: `data-utils.js` - Data processing and transformations (173 lines)
   - ✅ Completed: `series-manager.js` - Multi-series logic and styling (308 lines)
   - ✅ Completed: `interaction-manager.js` - Mouse tools, tool palette, pan/zoom controls (398 lines)
   - ✅ Completed: `controls-manager.js` - UI controls coordination (~200 lines)
   - ✅ Completed: `mesa-explorer.js` - Core D3.js plotting and rendering (~550 lines)
   - **Total reduction: 58% (1304 → 550 lines for core visualization)**
   - Benefits: Excellent separation of concerns, improved maintainability, enhanced AI/human collaboration

#### Future Enhancements
- Data persistence and plot configuration save/load functionality
- Enhanced visualization types (plot templates, animation)
- Performance optimizations for large datasets
- Modern JavaScript framework migration
- Export enhancements (multiple formats, publication-ready layouts)
- Comprehensive testing suite

## ✅ Completed: Enhanced Mouse Controls (Tool Palette System)

### Implementation Status: COMPLETED

The tool palette system has been successfully implemented with all four interaction tools:

- ✅ **Inspector Tool**: Mouseover tooltips showing axis values (default mode)
- ✅ **Pan Tool**: Click-and-drag to pan plot view with real-time feedback
- ✅ **Box Zoom Tool**: Draw rectangle to zoom into specific regions
- ✅ **Reset View Tool**: One-click reset to auto-scale all axes

### Technical Implementation

**Architecture**: Extracted into `js/interaction-manager.js` (398 lines) for better modularity

**Key Features**:

- Tool palette located below main plot container
- Axis limits integration - zoom/pan operations update input fields
- Cross-file persistence - axis limits remain active when switching files
- Visual feedback - zoom rectangle preview, cursor changes, real-time pan
- Error handling - validates axis limits, handles edge cases for log scales

**Testing Results**:

- ✅ All four tools function independently
- ✅ Axis limits update correctly for zoom/pan operations
- ✅ Legend dragging unaffected by tool changes
- ✅ Reset tool clears all limits and restores auto-scaling
- ✅ Tool palette responsive behavior with files panel
- ✅ Cross-file limit persistence works as expected
- ✅ Visual feedback appropriate for each tool
- ✅ No conflicts between tool interactions

## ✅ Completed: Comprehensive Code Modularization

### Implementation Status: COMPLETED

The codebase has been successfully modularized into focused, manageable components with excellent separation of concerns.

### Modular Architecture Summary

| **Module** | **Lines** | **Purpose** | **Key Features** |
|------------|-----------|-------------|------------------|
| `file-manager.js` | 651 | File operations | Upload, parsing, validation, type detection |
| `ui-utils.js` | 266 | UI utilities | Panel toggle, mini plot, responsive layout |
| `style-manager.js` | ~300 | Style system | Theming, color schemes, persistent styling |
| `data-utils.js` | 173 | **Data layer** | Pure functions, transformations, accessors |
| `series-manager.js` | 308 | **Series UI** | Multi-series management, configuration |
| `interaction-manager.js` | 398 | Mouse tools | Pan, zoom, inspector, tool palette |
| `controls-manager.js` | ~200 | UI controls | Controls coordination and management |
| `mesa-explorer.js` | ~550 | **Core viz** | D3.js rendering, axes, legends, plotting |

### Key Achievements

**Massive Size Reduction**: 
- Original `mesa-explorer.js`: ~3500 lines
- Final `mesa-explorer.js`: ~550 lines
- **Total reduction: 84% (2950 lines extracted)**

**Clean Module Boundaries**:
- **Data Layer**: Pure, testable functions in `data-utils.js`
- **UI Layer**: Focused managers for series, interactions, and styling
- **Visualization Core**: Streamlined D3.js rendering engine
- **Clear Dependencies**: Proper loading order and integration points

**Enhanced Maintainability**:
- Each module has single responsibility
- Easy to locate and modify specific functionality
- Better suited for AI collaboration and human development
- Improved code organization and readability

### Loading Order and Initialization Architecture

**CRITICAL**: The application uses a centralized initialization system to resolve cross-module dependencies. This prevents the circular dependency issues that plagued earlier versions.

#### Script Loading Order
```html
<!-- Core utilities -->
<script src="/js/file-manager.js"></script>
<script src="/js/ui-utils.js"></script>
<script src="/js/style-manager.js"></script>

<!-- Data processing layer -->
<script src="/js/data-utils.js"></script>

<!-- UI management -->
<script src="/js/series-manager.js"></script>
<script src="/js/interaction-manager.js"></script>
<script src="/js/controls-manager.js"></script>

<!-- Core visualization engine -->
<script src="/js/mesa-explorer.js"></script>
```

#### Async Initialization System (`initialize_application()`)

The `initialize_application()` function in `ui-utils.js` uses async/await for robust startup guarantees:

```javascript
window.initialize_application = async function() {
    // Phase 1: Initialize core modules that don't depend on others
    await initializeModule('file_manager', () => file_manager.setup());
    await initializeModule('style_manager', () => style_manager.setup_style_handlers());
    await initializeModule('series_manager', () => series_manager.setup());
    
    // Phase 2: Initialize visualization engine  
    await initializeModule('vis', () => vis.setup());
    
    // Phase 3: Set up cross-module communication via callback system
    file_manager.register_file_change_callback(() => vis.register_new_files());
    
    // Phase 4: Setup UI utilities that depend on other modules
    await initializeModule('files_panel', () => setup_files_panel_toggle());
    await initializeModule('plot_resize', () => setup_plot_resize_observer());
}
```

**Key Benefits of Async Approach:**
- **Guaranteed order**: Each phase waits for the previous to complete
- **Error handling**: Comprehensive try/catch with detailed logging
- **Debugging**: Console logs show exactly which module failed to initialize
- **Future-proof**: Modules can return promises if they need async initialization

#### Cross-Module Communication Pattern

**DO NOT** call other modules' functions directly during initialization or from event handlers. Instead:

**❌ Wrong (causes loading order issues):**
```javascript
// In file-manager.js
handle_file_selection: () => {
    // BAD: Direct call to vis object
    vis.register_new_files();
}
```

**✅ Correct (uses callback system):**
```javascript
// In file-manager.js
handle_file_selection: () => {
    // GOOD: Uses callback system
    file_manager.invoke_file_change_callbacks();
}

// In ui-utils.js initialize_application()
file_manager.register_file_change_callback(() => {
    if (typeof vis.register_new_files === 'function') {
        vis.register_new_files();
    }
});
```

#### Key Benefits

- **Eliminates circular dependencies**: Modules don't directly reference each other
- **Guaranteed initialization order**: Async/await ensures each phase completes before the next begins
- **Comprehensive error handling**: Try/catch blocks with detailed logging for debugging
- **Robust startup**: Modules are guaranteed to be loaded and initialized before cross-module calls
- **Easy debugging**: Console logs show exactly which module succeeded/failed during initialization
- **Future-proof**: New modules can easily integrate and can return promises if needed

#### Common Pitfalls to Avoid

1. **Never call `vis.*` functions directly from other modules during initialization**
2. **Never assume other modules are ready during your module's setup**
3. **Always use the callback system for cross-module communication**
4. **Don't modify the script loading order without updating the initialization phases**

The modularization provides a solid foundation for future development with clear separation of concerns and excellent maintainability.

## ✅ Completed: Major UI Architecture Transformation (Per-Series Data Transformations)

### Implementation Status: COMPLETED

A comprehensive architectural redesign has been successfully implemented, transforming the user interface from axis-wide to per-series data transformations.

### Key Achievements

**New UI Architecture:**
- **✅ Consistent Axis Layout**: All axes (X, Left Y, Right Y) now have identical structure
- **✅ Axis Settings Sections**: Gray-background sections at top of each axis for scale and limits
- **✅ Per-Series Controls**: Each series has individual data transformation controls
- **✅ Intuitive Workflow**: Select data → Transform data → Style series → Set axis display

**Enhanced Data Processing:**
- **✅ Per-Series Transformations**: Each Y-axis series can have independent rescaling (Linear/Log/Exp)
- **✅ Smart Log Detection**: Automatic detection of log columns with auto-rescaling and axis suggestions  
- **✅ Label Cleaning**: "log_L" → "L" with proper exponential transformation
- **✅ X-axis Integration**: X-axis transformations fully functional with existing architecture

**UI Consistency Improvements:**
- **✅ Keyboard Navigation**: Full keyboard support for all dropdown menus
- **✅ Layout Uniformity**: Consistent positioning and styling across all controls
- **✅ Clear Terminology**: "Rescale" for data transformations vs "Scale" for axis display
- **✅ Removed Complexity**: Eliminated confusing tabbed "More Details" section

**Multi-File Mode Fixes:**
- **✅ Clean Legend Labels**: Multi-file legends show only file names
- **✅ Distinct Colors**: Each file gets unique color in multi-file mode
- **✅ Proper Series Handling**: Multi-file series creation and styling works correctly

### Before vs After

**Before:**
- Axis-wide transformations affected all series equally
- Confusing tabbed interface separated from data selection
- Inconsistent dropdown behavior between X and Y axes
- Broken multi-file mode styling and labeling

**After:**  
- Per-series transformations allow complex mixed plots
- Integrated controls right where users select data
- Consistent, keyboard-navigable interface across all axes
- Clean, functional multi-file mode

### Technical Implementation

**Data Processing Updates:**
- Modified `data-utils.js` to handle per-series transformations
- Updated `series_accessor()` to use individual series transformation settings
- Enhanced `get_axis_data_values()` for proper extent calculations

**UI Architecture:**
- Redesigned series creation in `series-manager.js` with integrated transformation controls
- Added proper event handlers in `controls-manager.js` for X-axis transformations
- Implemented automatic log detection with smart defaults

**Result**: A much more powerful, intuitive, and consistent user interface that enables complex visualizations while being easier to use.

## ✅ Completed: Inspector Mode Multi-Series Enhancements

### Implementation Status: COMPLETED

The inspector tool has been successfully enhanced to work seamlessly with the multi-series architecture and handle all file mode transitions.

### Key Improvements

**Inspector Label Consistency:**
- **✅ Axis Label Integration**: Inspector now shows cleaned axis labels from input fields instead of raw column names
- **✅ Color Matching**: Inspector text colors match axis label colors exactly
- **✅ Consistent Cleaning**: Uses same log prefix removal as axis labels ("log_L" → "L")
- **✅ Fallback System**: Gracefully handles missing axis labels with cleaned data names

**Axis Tracking Reliability:**
- **✅ Mode Transition Fix**: Resolved bug where right axis was not tracked after switching from multi-file to single-file mode
- **✅ Data Name Restoration**: Automatic restoration of `vis.axes[axis].data_name` from existing series definitions
- **✅ Cross-Mode Persistence**: Inspector tracking works consistently across all file mode transitions

### Technical Implementation

**Inspector Tooltip Enhancement** (`js/interaction-manager.js`):
```javascript
// Get the cleaned axis label from the input field instead of using raw data_name
let axisLabel;
const axisLabelInput = d3.select(`#${axis}-axis-label`);
if (!axisLabelInput.empty() && axisLabelInput.property('value').trim() !== '') {
    axisLabel = axisLabelInput.property('value').trim();
} else {
    // Fallback: clean the data_name with consistent log prefix removal
    axisLabel = vis.axes[axis].data_name
        .replace(/^log[_\s]*/i, '')     // Remove "log_" or "log " prefix
        .replace(/^log(?=[A-Z])/i, '')  // Remove "log" before capitals  
        .replace(/_/g, ' ');            // Replace underscores with spaces
}
```

**Axis Tracking Restoration** (`js/mesa-explorer.js`):
```javascript
// Restore axis data_name from existing series definitions if needed
// This ensures inspector tracking works after mode transitions
['y', 'yOther'].forEach(axis => {
    const seriesDefinitions = series_manager.series_definitions[axis];
    if (seriesDefinitions && seriesDefinitions.length > 0 && seriesDefinitions[0].column) {
        // Restore data_name from first series if it's not already set
        if (!vis.axes[axis].data_name) {
            vis.axes[axis].data_name = seriesDefinitions[0].column;
            // Also restore axis label if empty
        }
    }
});
```

### Before vs After

**Before:**
- Inspector showed raw column names with inconsistent cleaning
- Right axis tracking lost when switching from multi-file to single-file mode
- Inspector colors and labels didn't match axis labels
- Axis tracking depended on unreliable data_name persistence

**After:**
- Inspector shows clean, consistent axis labels matching the UI
- All axes track properly across all file mode transitions
- Inspector colors exactly match axis label colors
- Robust data_name restoration system ensures reliable tracking

### Testing Results

- ✅ Inspector labels match axis labels in content and color
- ✅ Right axis tracking works in all file mode transitions
- ✅ Log prefix cleaning consistent across inspector and axis labels
- ✅ Fallback system handles edge cases gracefully
- ✅ No regression in existing inspector functionality