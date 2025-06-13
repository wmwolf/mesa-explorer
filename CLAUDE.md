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
1. **Color cycle intelligence** (single-file mode):
   - Current: Second series on left axis and first series on right axis both use orange
   - Need: Smart color assignment avoiding conflicts between axes
   - Solution: Implement axis-aware color cycling

2. **Axis label color management**:
   - Current: Axis labels hard-coded as blue/orange
   - Need: Dynamic color matching - single series matches axis color, multiple series use black
   - Enhancement: Better visual hierarchy for axis identification

3. **Inspector mode updates**:
   - Current: Inspector tooltips may not account for new multi-series architecture
   - Need: Update mouseover functionality to properly handle multiple series per axis
   - Enhancement: Show all relevant series data at cursor position

4. **Multi-file mode series styling and naming**:
   - Current: All series in multi-file mode get the same default color
   - Need: Default series colors should cycle through color schemes to distinguish files
   - Current: Series names in multi-file mode may not default to file names
   - Need: Series should default to using file display names (local_name) in multi-file mode
   - Enhancement: Better visual distinction between files when plotting multiple files

5. **Series styling persistence issues**:
   - Current: Adding a new series may reset individual style changes made to existing series
   - Need: Individual series style changes should persist when new series are added
   - Issue: Style management may not properly maintain individual customizations during series creation

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

### Loading Order
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

The modularization provides a solid foundation for future development with clear separation of concerns and excellent maintainability.