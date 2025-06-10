# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mesa Explorer is a web-based visualization tool for MESA (Modules for Experiments in Stellar Astrophysics) stellar simulation data. It's built with Bootstrap 5 and D3.js v7.8.4 as a client-side web application that runs entirely in the browser.

The application allows users to upload MESA history files, profile files, or GYRE summary files and create interactive visualizations with dual y-axes, logarithmic scaling, data transformations, and SVG export capabilities.

## Architecture

### File Structure
- `index.html` - Main application page with Bootstrap UI components
- `js/mesa-explorer.js` - Core application logic (file management, data processing, visualization)
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
- Development: `/js/mesa-explorer.js` and `/js/color-modes.js`
- Production: `/mesa-explorer/js/mesa-explorer.js` and `/mesa-explorer/js/color-modes.js`

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

- Dual y-axis plotting with independent scaling and transformations
- Support for logarithmic and linear axis scaling
- Data transformations: logarithmic, absolute value, modulo operations, re-zeroing
- Interactive mouseover showing data values
- SVG export functionality with proper dark/light mode handling
- Responsive design with Bootstrap breakpoints
- Color theme switching (light/dark/auto) with localStorage persistence

## Future Features

- Multiple file plotting with series-based interface and customizable styling
- Data persistence and plot configuration save/load functionality  
- Enhanced visualization types (plot templates, zoom/pan, animation)
- Performance optimizations for large datasets
- Modern JavaScript framework migration and comprehensive testing
- Export enhancements (multiple formats, publication-ready layouts)