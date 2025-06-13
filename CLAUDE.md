# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mesa Explorer is a web-based visualization tool for MESA (Modules for Experiments in Stellar Astrophysics) stellar simulation data. It's built with Bootstrap 5 and D3.js v7.8.4 as a client-side web application that runs entirely in the browser.

The application allows users to upload MESA history files, profile files, or GYRE summary files and create interactive visualizations with dual y-axes, logarithmic scaling, data transformations, and SVG export capabilities.

## Architecture

### File Structure
- `index.html` - Main application page with Bootstrap UI components
- `js/file-manager.js` - File upload, parsing, validation, and selection management
- `js/ui-utils.js` - UI layout utilities (panel toggle, mini plot, responsive resizing)
- `js/mesa-explorer.js` - Core visualization logic and D3.js plotting
- `js/color-modes.js` - Bootstrap color theme switching functionality
- `data/` - Contains CSV files with known column metadata for MESA files
- `gen_columns_data.py` - Python script to generate column metadata from MESA installation

### Key Components

**File Manager** (`file_manager` object):
- Handles file uploads and parsing of MESA data files
- Detects file types (history/profile/gyre) based on content structure
- Processes header and bulk data into JavaScript objects
- Maintains list of loaded files and active file selection

**Visualization** (`vis` object):
- Manages D3.js-based plotting with dual y-axes support
- Handles data transformations (log, absolute value, modulo, re-zeroing)
- Provides interactive features (mouseover values, zoom controls)
- Supports both line plots and scatter plots with customizable markers

**Data Processing**:
- MESA files have specific format: header data in lines 1-3, column names in line 6, data starting line 7
- Files are parsed into header object and bulk data array
- Column metadata is merged with known column information from CSV files

### Development vs Production Modes
The application has commented sections for development vs production JavaScript paths:
- Development: `/js/file-manager.js`, `/js/ui-utils.js`, `/js/mesa-explorer.js`, `/js/color-modes.js`
- Production: `/mesa-explorer/js/file-manager.js`, `/mesa-explorer/js/ui-utils.js`, `/mesa-explorer/js/mesa-explorer.js`, `/mesa-explorer/js/color-modes.js`

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

#### Code Architecture
5. **File modularity** (in progress - reduced from ~3500 to ~2600 lines):
   - ✅ Completed: `file-manager.js` - File upload, parsing, validation (651 lines)
   - ✅ Completed: `ui-utils.js` - UI layout utilities, panel toggle, mini plot (266 lines)
   - 🔄 Remaining: Break down `mesa-explorer.js` further:
     - `visualization-core.js` - Core D3.js plotting and rendering
     - `series-manager.js` - Multi-series logic and styling
     - `interaction.js` - Mouse tools and user controls
     - `data-utils.js` - Data processing and transformations
   - Benefits: Easier maintenance, better separation of concerns, improved AI/human collaboration

#### Future Enhancements
- Data persistence and plot configuration save/load functionality
- Enhanced visualization types (plot templates, animation)
- Performance optimizations for large datasets
- Modern JavaScript framework migration
- Export enhancements (multiple formats, publication-ready layouts)
- Comprehensive testing suite

## Planned Development: Enhanced Mouse Controls (Tool Palette Approach)

### Overview
Implement a tool palette system for enhanced plot interaction with four tools: Inspector, Pan, Box Zoom, and Reset View. This will replace the current always-on mouseover behavior with user-controlled modes.

### Design Decisions
- **Tool Palette Location**: Below main plot container in visualization column, remains visible when files panel is collapsed
- **Axis Limits Integration**: Zoom/pan operations will update the axis limit input fields, leveraging existing infrastructure
- **Cross-File Persistence**: Axis limits remain active when switching files (current behavior), easily reset with Reset View button
- **Universal Actions**: Mouse wheel zoom and legend dragging work in all modes

### Implementation Plan

#### Phase 1: UI Components
1. **Add Tool Palette HTML** (in `index.html` after main plot container):
   ```html
   <div class="btn-group w-100 mt-2" role="group" aria-label="Plot interaction tools" id="plot-tools">
     <button type="button" class="btn btn-outline-secondary active" id="inspector-tool">
       <i class="bi bi-info-circle"></i> Inspector
     </button>
     <button type="button" class="btn btn-outline-secondary" id="pan-tool">
       <i class="bi bi-arrows-move"></i> Pan
     </button>
     <button type="button" class="btn btn-outline-secondary" id="box-zoom-tool">
       <i class="bi bi-zoom-in"></i> Box Zoom
     </button>
     <button type="button" class="btn btn-outline-secondary" id="reset-view-tool">
       <i class="bi bi-arrow-counterclockwise"></i> Reset View
     </button>
   </div>
   ```

2. **Add Visual State Indicators**:
   - Active tool gets `active` class (Bootstrap styling)
   - Cursor changes based on active tool
   - Optional: subtle background on axis limit fields when populated

#### Phase 2: Core JavaScript (in `mesa-explorer.js`)
1. **Add Tool State Management**:
   ```javascript
   vis.interaction = {
     current_tool: 'inspector',
     is_dragging: false,
     drag_start: null,
     drag_end: null
   };
   ```

2. **Tool Selection Handlers**:
   - Button click handlers to switch between tools
   - Update cursor styles and active button states
   - Enable/disable inspector mouseover based on tool

3. **Mouse Event Handlers**:
   - `mousedown`: Initialize drag operations for pan/zoom tools
   - `mousemove`: Handle drag preview (zoom rectangle), pan feedback, inspector values
   - `mouseup`: Execute pan/zoom operations, update axis limits
   - `wheel`: Universal zoom in/out around cursor position

#### Phase 3: Tool-Specific Functionality
1. **Inspector Tool**:
   - Current mouseover behavior showing data values
   - Toggle on/off based on tool selection
   - No change to existing implementation when active

2. **Pan Tool**:
   - Calculate view offset based on drag distance
   - Convert pixel movement to data coordinates
   - Update all axis limit fields (x-axis-left, x-axis-right, y-axis-bottom, y-axis-top, yOther-axis-bottom, yOther-axis-top)
   - Trigger redraw through existing axis limit system

3. **Box Zoom Tool**:
   - Draw temporary zoom rectangle during drag
   - Calculate new axis limits from rectangle corners
   - Update appropriate axis limit fields based on rectangle bounds
   - Clear rectangle and trigger redraw

4. **Reset View Tool**:
   - Clear all axis limit input fields
   - Trigger redraw to auto-scale all axes
   - Simple one-click reset functionality

#### Phase 4: Enhanced Features
1. **Mouse Wheel Zoom**:
   - Zoom in/out around cursor position
   - Calculate new axis limits maintaining cursor position
   - Update axis limit fields
   - Works in all tool modes

2. **Legend Dragging** (existing feature, ensure compatibility):
   - Maintain current legend dragging in all modes
   - Prevent tool actions when dragging legend

3. **Visual Feedback**:
   - Zoom rectangle preview with dashed border
   - Pan direction indicators
   - Cursor style changes per tool

#### Phase 5: Integration & Polish
1. **Responsive Behavior**:
   - Tool palette contracts/expands with files panel
   - Ensure tools work with miniature plot
   - Test with different screen sizes

2. **State Management**:
   - Tools persist across file switches
   - Axis limits behavior remains consistent
   - Reset tool clears all persistent limits

3. **Error Handling**:
   - Graceful handling of invalid zoom rectangles
   - Prevent pan/zoom beyond reasonable bounds
   - Validation for calculated axis limits

### Technical Notes
- **Coordinate Conversion**: Use existing D3 scale functions to convert between pixel and data coordinates
- **Axis Limit Updates**: Leverage existing input field update system and redraw triggers
- **Event Management**: Ensure proper event ordering and prevent conflicts between tools
- **Performance**: Minimize redraws during drag operations, only update on completion

### Testing Checklist
- [ ] All four tools function independently
- [ ] Axis limits update correctly for zoom/pan operations
- [ ] Mouse wheel zoom works in all modes
- [ ] Legend dragging unaffected by tool changes
- [ ] Reset tool clears all limits and restores auto-scaling
- [ ] Tool palette responsive behavior with files panel
- [ ] Cross-file limit persistence works as expected
- [ ] Visual feedback appropriate for each tool
- [ ] No conflicts between tool interactions