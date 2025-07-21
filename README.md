# mesa-explorer
Web-based visualization tool for the MESA simulations of stars. Built with Bootstrap 5 and d3 v7.8.4

Access the live app at [billwolf.space/mesa-explorer](https://billwolf.space/mesa-explorer).

## Features

### File Management
- **Multi-format Support**: Import MESA history files, profile files, and GYRE summary files
- **Multi-file Selection**: Load multiple files simultaneously using standard file selection controls
- **Automatic File Detection**: Files are automatically categorized and sorted (histories, then profiles, then GYRE files)
- **File Icons**: Visual indicators distinguish between different file types (clock for history, star for profile, broadcast for GYRE)

### Visualization Controls
- **Dual Y-Axes**: Plot data on both left and right y-axes for comparing different quantities
- **Multiple Series**: Add multiple data series to each axis for comprehensive comparisons
- **Interactive Tools**: 
  - Inspector tool for data point examination
  - Pan and zoom capabilities
  - Box zoom for precise region selection
  - One-click view reset
- **Real-time Preview**: Mini floating plot provides overview during navigation

### Data Transformation
- **Flexible Scaling**: Apply linear, logarithmic, or exponential transformations to data
- **Data Operations**: 
  - Zero-point adjustment for relative measurements
  - Absolute value transformation
  - Automatic log scale detection for known quantities
- **Axis Controls**: Independent scale settings (linear/logarithmic) for each axis with custom limits

### Styling and Export
- **Color Schemes**: Multiple predefined color palettes (Tableau, D3, ColorBrewer)
- **Style Customization**: 
  - Individual series styling (line width, marker size, opacity)
  - Global font size control
  - Line and scatter plot options
- **Export Options**: High-quality SVG download with proper light mode formatting
- **Responsive Design**: Adaptive interface that works on different screen sizes

### User Experience
- **Dark/Light Mode**: Full support for both themes with automatic color adaptation
- **Keyboard Navigation**: Arrow key support in dropdown menus, Enter key selection
- **Search Functionality**: Quick column search with real-time filtering
- **Collapsible Sections**: Organized interface with expandable settings panels
- **File Panel Toggle**: Hide/show file list to maximize plotting area

### Data Intelligence
- **Smart Defaults**: Automatic detection of logarithmic quantities (e.g., log_L, lg_mdot)
- **Model Validation**: Automatic filtering of non-monotonic model numbers in history files
- **Column Recognition**: Integration with known MESA and GYRE column definitions
- **Responsive Labels**: Automatic axis labeling with mathematical notation support

## Usage Tips

- Use **Shift** or **Ctrl/Cmd** keys when selecting files to import multiple files at once
- The search function in column dropdowns supports partial matching for quick column finding
- Collapsible axis settings help keep the interface clean while providing full control when needed
- The inspector tool provides precise coordinate readouts when hovering over the plot
- Series can be easily reordered or removed using the style controls panel

