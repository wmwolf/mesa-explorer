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

### Outstanding Issues

**Known Bugs:**
1. **X-axis label positioning**: In small viewports, the x-axis label is pushed up into the x-axis tick labels

## ✅ Enhanced Multi-File Visualization System

**Implementation Status: COMPLETED**

Mesa Explorer now features a sophisticated multi-file visualization system that enables powerful multi-series, multi-file plotting with intuitive visual encoding.

### Key Features

**Color-by-File, Linestyle-by-Data System:**
- **File Identity**: Each file gets a distinct color from the color scheme
- **Data Type Identity**: Each column type gets a distinct linestyle (solid, dashed, dotted, dash-dot)
- **Cross-Axis Consistency**: Linestyles apply across both left and right Y-axes

**Two-Part Legend System:**
- **Data Types Section**: Shows column names with neutral gray color + assigned linestyles
- **Files Section**: Shows file names with their assigned colors + solid lines
- **Seamless Layout**: Data types flow directly into file listings

**Always-Visible Right Y-Axis:**
- Right Y-axis panel now always visible in both single-file and multi-file modes
- Enables complex multi-series plotting across both axes

**Smart Mode Transitions:**
- **Multi-file → Single-file**: Selects top file, switches to color cycling with solid lines, clears linestyle assignments
- **Single-file → Multi-file**: Starts fresh with first file getting first color, linestyles assigned in order (left Y → right Y)

### Technical Implementation

**Linestyle Management** (`js/style-manager.js`):
- Global linestyle cycling system by column name
- Four available linestyles: solid, dashed, dotted, dash-dot
- Consistent assignment across files and axes

**Enhanced Multi-File Series** (`js/series-manager.js`):
- File color + column linestyle assignment
- Mode-aware styling (single-file: color cycling, multi-file: file+linestyle system)

**Intelligent Legend System** (`js/mesa-explorer.js`):
- Single-file mode: Traditional series legend
- Multi-file mode: Two-part legend (data types + files)
- Proper linestyle rendering with SVG stroke-dasharray
- Robust mode transition handling with linestyle reassignment

### Example Use Case

**Two profile files with Tableau color scheme:**
- **X-axis**: mass coordinate
- **Left Y-axis**: h1 (hydrogen) and he4 (helium) mass fractions  
- **Right Y-axis**: logT (temperature)

**Result**: 6 lines total:
- **Profile1** (blue): h1 (solid), he4 (dashed), logT (dotted)
- **Profile2** (orange): h1 (solid), he4 (dashed), logT (dotted)

**Legend shows**:
- h1 (gray, solid)
- he4 (gray, dashed) 
- logT (gray, dotted)
- profile1.mesa (blue, solid)
- profile2.mesa (orange, solid)

#### Future Enhancements
- Data persistence and plot configuration save/load functionality
- Enhanced visualization types (plot templates, animation)
- Performance optimizations for large datasets
- Modern JavaScript framework migration
- Export enhancements (multiple formats, publication-ready layouts)
- Comprehensive testing suite



### Loading Order and Initialization Architecture

**CRITICAL**: The application uses a centralized initialization system to resolve cross-module dependencies.

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
