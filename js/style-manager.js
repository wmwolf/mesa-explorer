// Style Management System
// Handles all styling, theming, and appearance customization for Mesa Explorer

style_manager = {
	// Style management system
	styles: {
		// Persistent style storage by series ID
		persistent_styles: {},
		
		// Global style settings
		global: {
			color_scheme: 'tableau10',
			default_line_width: 2.0,
			default_marker_size: 4,
			default_opacity: 1.0,
			font_size: 16,
			global_color_index: 0  // Global color cycling counter
		},
		
		// Available color schemes
		color_schemes: {
			tableau10: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'],
			set1: ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33', '#a65628', '#f781bf', '#999999'],
			set2: ['#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f', '#e5c494', '#b3b3b3'],
			dark2: ['#1b9e77', '#d95f02', '#7570b3', '#e7298a', '#66a61e', '#e6ab02', '#a6761d', '#666666'],
			viridis: ['#440154', '#482777', '#3f4a8a', '#31678e', '#26838f', '#1f9d8a', '#6cce5a', '#b6de2b', '#fee825'],
			magma: ['#000004', '#180f3d', '#440f76', '#721f81', '#9f2f7f', '#cd4071', '#f1605d', '#fd9668', '#fcfdbf'],
			plasma: ['#0d0887', '#5302a3', '#8b0aa5', '#b83289', '#db5c68', '#f48849', '#febd2a', '#f0f921'],
			inferno: ['#000004', '#1b0c41', '#4a0c6b', '#781c6d', '#a52c60', '#cf4446', '#ed6925', '#fb9b06', '#fcffa4']
		},
		
		// Line style options
		line_styles: {
			solid: 'none',
			dashed: '5,5',
			dotted: '2,3',
			dashdot: '5,5,2,5'
		},
		
		// Marker shapes with D3 symbols
		marker_shapes: {
			circle: d3.symbolCircle,
			square: d3.symbolSquare,
			triangle_up: d3.symbolTriangle,
			triangle_down: d3.symbolTriangle2,
			diamond: d3.symbolDiamond,
			star: d3.symbolStar,
			cross: d3.symbolCross,
			pentagon: d3.symbolWye,
			hexagon: d3.symbolSquare // D3 doesn't have hexagon, using square as placeholder
		}
	},

	// Style management functions
	get_series_id: (file, index) => {
		return `${file.local_name}_${index}`;
	},

	get_series_style: (series_id, color_index) => {
		// Check if we have a persistent style for this series
		if (style_manager.styles.persistent_styles[series_id]) {
			return style_manager.styles.persistent_styles[series_id];
		}
		
		// Create default style from color scheme
		const colors = style_manager.styles.color_schemes[style_manager.styles.global.color_scheme];
		const color = colors[color_index % colors.length];
		
		const default_style = {
			color: color,
			show_line: true,
			show_markers: false,
			line_width: style_manager.styles.global.default_line_width,
			line_style: 'solid',
			marker_shape: 'circle',
			marker_size: style_manager.styles.global.default_marker_size,
			opacity: style_manager.styles.global.default_opacity
		};
		
		// Store it for persistence
		style_manager.styles.persistent_styles[series_id] = default_style;
		return default_style;
	},

	update_series_style: (series_id, style_updates) => {
		// Find the series and update its style
		const series = vis.series.find(s => s.series_id === series_id);
		if (series) {
			Object.assign(series.style, style_updates);
			// Update persistent styles
			if (!style_manager.styles.persistent_styles[series_id]) {
				style_manager.styles.persistent_styles[series_id] = {};
			}
			Object.assign(style_manager.styles.persistent_styles[series_id], style_updates);
			
			// Update color property for backward compatibility
			if (style_updates.color) {
				series.color = style_updates.color;
				// Update axis label colors if series color changed
				style_manager.update_axis_label_colors();
			}
			
			// Refresh plot
			vis.update_plot();
		}
	},

	apply_global_style_changes: () => {
		// Apply global settings to all currently displayed series
		const colors = style_manager.styles.color_schemes[style_manager.styles.global.color_scheme];
		
		if (vis.series && vis.series.length > 0) {
			// Reset color counter and assign colors to existing series
			style_manager.reset_global_color_counter();
			
			if (vis.files && vis.files.length > 1) {
				// Multi-file mode: Group series by file to maintain proper color relationships
				const seriesByFile = {};
				vis.series.forEach(series => {
					const fileName = series.file_reference.filename;
					if (!seriesByFile[fileName]) seriesByFile[fileName] = [];
					seriesByFile[fileName].push(series);
				});
				
				// Update series with file-based colors  
				Object.keys(seriesByFile).forEach((fileName, fileIndex) => {
					const colorIndex = fileIndex % colors.length;
					const new_color = colors[colorIndex];
					
					seriesByFile[fileName].forEach(series => {
						// Update series style
						series.style.color = new_color;
						series.style.line_width = style_manager.styles.global.default_line_width;
						series.style.marker_size = style_manager.styles.global.default_marker_size;
						series.style.opacity = style_manager.styles.global.default_opacity;
						
						// Update legacy color for compatibility
						series.color = new_color;
						
						// Update persistent storage
						style_manager.styles.persistent_styles[series.series_id] = { ...series.style };
					});
				});
			} else {
				// Single-file mode: Use global color cycling for each series
				vis.series.forEach(series => {
					const colorResult = style_manager.get_next_global_color();
					const new_color = colorResult.color;
					
					// Update series style
					series.style.color = new_color;
					series.style.line_width = style_manager.styles.global.default_line_width;
					series.style.marker_size = style_manager.styles.global.default_marker_size;
					series.style.opacity = style_manager.styles.global.default_opacity;
					
					// Update legacy color for compatibility
					series.color = new_color;
					
					// Update persistent storage
					style_manager.styles.persistent_styles[series.series_id] = { ...series.style };
				});
			}
		}
		
		// Also update any other persistent styles not currently displayed
		Object.keys(style_manager.styles.persistent_styles).forEach((series_id, index) => {
			const style = style_manager.styles.persistent_styles[series_id];
			const new_color = colors[index % colors.length];
			
			style.color = new_color;
			style.line_width = style_manager.styles.global.default_line_width;
			style.marker_size = style_manager.styles.global.default_marker_size;
			style.opacity = style_manager.styles.global.default_opacity;
		});
		
		// Update axis label colors based on new series configuration
		style_manager.update_axis_label_colors();
		
		vis.update_plot();
		style_manager.update_style_panel();
	},

	// New flexible series creation system
	create_axis_series: (file, fileIndex, targetAxis) => {
		// Generate unique series ID based on file and axis
		const series_id = `${file.filename}_${targetAxis}_${fileIndex}`;
		
		// Get axis-specific styling
		const style = style_manager.get_axis_specific_style(targetAxis, fileIndex);
		
		// Determine series name based on axis and file count
		let seriesName;
		if (vis.files.length === 1) {
			// Single file mode: differentiate by axis
			seriesName = targetAxis === 'y' ? file.local_name : `${file.local_name} (right)`;
		} else {
			// Multi-file mode: use file name
			seriesName = file.local_name;
		}
		
		return {
			series_id: series_id,
			file_reference: file,
			data: file.data.bulk,
			target_axis: targetAxis,
			name: seriesName,
			data_columns: {
				x: vis.axes.x.data_name,
				y: vis.axes[targetAxis].data_name
			},
			style: style,
			source_type: 'file',
			// Keep legacy color for compatibility
			color: style.color
		};
	},

	get_axis_specific_style: (axis, fileIndex) => {
		const colors = style_manager.styles.color_schemes[style_manager.styles.global.color_scheme];
		const series_id = `${vis.files[fileIndex]?.filename}_${axis}_${fileIndex}`;
		
		// Check if we have persistent styling for this series
		if (style_manager.styles.persistent_styles[series_id]) {
			return { ...style_manager.styles.persistent_styles[series_id] };
		}
		
		// Create new style with axis-specific color logic
		let colorIndex;
		if (axis === 'y') {
			// Left axis: use normal color cycling starting with blue
			colorIndex = fileIndex % colors.length;
		} else if (axis === 'yOther') {
			// Right axis: start with orange (second color) for better differentiation
			colorIndex = (fileIndex + 1) % colors.length;
		} else {
			// Future axes: continue cycling
			colorIndex = fileIndex % colors.length;
		}
		
		const style = {
			color: colors[colorIndex],
			line_width: style_manager.styles.global.default_line_width,
			marker_size: style_manager.styles.global.default_marker_size,
			opacity: style_manager.styles.global.default_opacity,
			show_line: true,
			show_markers: false,
			marker_shape: 'circle',
			line_style: 'solid'
		};
		
		// Save to persistent storage
		style_manager.styles.persistent_styles[series_id] = { ...style };
		
		return style;
	},

	// Style panel UI functions
	setup_style_handlers: () => {
		// Global style handlers
		d3.select('#colorSchemeSelect').on('change', function() {
			style_manager.styles.global.color_scheme = this.value;
			style_manager.apply_global_style_changes();
		});
		
		d3.select('#defaultLineWidth').on('input', function() {
			style_manager.styles.global.default_line_width = parseFloat(this.value);
			// Auto-apply to current series
			if (vis.series) {
				vis.series.forEach(series => {
					series.style.line_width = style_manager.styles.global.default_line_width;
					style_manager.styles.persistent_styles[series.series_id].line_width = style_manager.styles.global.default_line_width;
				});
				vis.update_plot();
				style_manager.update_style_panel();
			}
		});
		
		d3.select('#defaultMarkerSize').on('input', function() {
			style_manager.styles.global.default_marker_size = parseInt(this.value);
			// Auto-apply to current series
			if (vis.series) {
				vis.series.forEach(series => {
					series.style.marker_size = style_manager.styles.global.default_marker_size;
					style_manager.styles.persistent_styles[series.series_id].marker_size = style_manager.styles.global.default_marker_size;
				});
				vis.update_plot();
				style_manager.update_style_panel();
			}
		});
		
		d3.select('#defaultOpacity').on('input', function() {
			style_manager.styles.global.default_opacity = parseFloat(this.value);
			d3.select('#defaultOpacityValue').text(this.value);
			// Auto-apply to current series
			if (vis.series) {
				vis.series.forEach(series => {
					series.style.opacity = style_manager.styles.global.default_opacity;
					style_manager.styles.persistent_styles[series.series_id].opacity = style_manager.styles.global.default_opacity;
				});
				vis.update_plot();
				style_manager.update_style_panel();
			}
		});
		
		d3.select('#globalFontSize').on('input', function() {
			style_manager.styles.global.font_size = parseInt(this.value);
			d3.select('#globalFontSizeValue').text(this.value + 'px');
			// Apply immediately to plot
			vis.update_plot();
		});
		
		d3.select('#applyGlobalStyles').on('click', () => {
			style_manager.apply_global_style_changes();
		});
		
		d3.select('#resetAllStyles').on('click', () => {
			style_manager.styles.persistent_styles = {};
			style_manager.apply_global_style_changes();
		});
		
		// Preset handlers
		d3.select('#saveStylePreset').on('click', () => {
			localStorage.setItem('mesa_explorer_style_preset', JSON.stringify(style_manager.styles));
			alert('Style preset saved!');
		});
		
		d3.select('#loadStylePreset').on('click', () => {
			const saved = localStorage.getItem('mesa_explorer_style_preset');
			if (saved) {
				Object.assign(style_manager.styles, JSON.parse(saved));
				style_manager.update_style_panel();
				vis.update_plot();
				alert('Style preset loaded!');
			} else {
				alert('No saved preset found.');
			}
		});
	},

	update_style_panel: () => {
		if (!vis.series || vis.series.length === 0) return;
		
		// Update global settings
		d3.select('#colorSchemeSelect').property('value', style_manager.styles.global.color_scheme);
		d3.select('#defaultLineWidth').property('value', style_manager.styles.global.default_line_width);
		d3.select('#defaultMarkerSize').property('value', style_manager.styles.global.default_marker_size);
		d3.select('#defaultOpacity').property('value', style_manager.styles.global.default_opacity);
		d3.select('#defaultOpacityValue').text(style_manager.styles.global.default_opacity.toFixed(1));
		d3.select('#globalFontSize').property('value', style_manager.styles.global.font_size);
		d3.select('#globalFontSizeValue').text(style_manager.styles.global.font_size + 'px');
		
		// Generate individual series controls
		const container = d3.select('#seriesStylesList');
		container.selectAll('.series-style-item').remove();
		
		const seriesItems = container.selectAll('.series-style-item')
			.data(vis.series)
			.enter()
			.append('div')
			.attr('class', 'series-style-item border rounded p-3 mb-3');
		
		// Series name header
		seriesItems.append('h6')
			.style('color', d => d.style.color)
			.text(d => d.name);
		
		// Plot type controls
		const plotTypeRow = seriesItems.append('div')
			.attr('class', 'row mb-3');
		
		const lineCol = plotTypeRow.append('div')
			.attr('class', 'col-6');
		
		lineCol.append('div')
			.attr('class', 'form-check')
			.each(function(d) {
				const div = d3.select(this);
				div.append('input')
					.attr('class', 'form-check-input')
					.attr('type', 'checkbox')
					.attr('id', `line-${d.series_id}`)
					.property('checked', d.style.show_line)
					.on('change', function() {
						style_manager.update_series_style(d.series_id, { show_line: this.checked });
					});
				
				div.append('label')
					.attr('class', 'form-check-label')
					.attr('for', `line-${d.series_id}`)
					.text('Line');
			});
		
		const markerCol = plotTypeRow.append('div')
			.attr('class', 'col-6');
		
		markerCol.append('div')
			.attr('class', 'form-check')
			.each(function(d) {
				const div = d3.select(this);
				div.append('input')
					.attr('class', 'form-check-input')
					.attr('type', 'checkbox')
					.attr('id', `marker-${d.series_id}`)
					.property('checked', d.style.show_markers)
					.on('change', function() {
						style_manager.update_series_style(d.series_id, { show_markers: this.checked });
					});
				
				div.append('label')
					.attr('class', 'form-check-label')
					.attr('for', `marker-${d.series_id}`)
					.text('Markers');
			});
		
		// Color picker
		seriesItems.append('div')
			.attr('class', 'mb-3')
			.each(function(d) {
				const div = d3.select(this);
				div.append('label')
					.attr('class', 'form-label')
					.text('Color');
				
				div.append('input')
					.attr('type', 'color')
					.attr('class', 'form-control form-control-color')
					.property('value', d.style.color)
					.on('change', function() {
						style_manager.update_series_style(d.series_id, { color: this.value });
					});
			});
		
		// Line settings
		const lineSettingsRow = seriesItems.append('div')
			.attr('class', 'row mb-3');
		
		// Line width
		lineSettingsRow.append('div')
			.attr('class', 'col-4')
			.each(function(d) {
				const div = d3.select(this);
				div.append('label')
					.attr('class', 'form-label small')
					.text('Width');
				
				div.append('input')
					.attr('type', 'number')
					.attr('class', 'form-control form-control-sm')
					.attr('min', '0.5')
					.attr('max', '10')
					.attr('step', '0.5')
					.property('value', d.style.line_width)
					.on('change', function() {
						style_manager.update_series_style(d.series_id, { line_width: parseFloat(this.value) });
					});
			});
		
		// Line style
		lineSettingsRow.append('div')
			.attr('class', 'col-4')
			.each(function(d) {
				const div = d3.select(this);
				div.append('label')
					.attr('class', 'form-label small')
					.text('Style');
				
				const select = div.append('select')
					.attr('class', 'form-select form-select-sm')
					.property('value', d.style.line_style)
					.on('change', function() {
						style_manager.update_series_style(d.series_id, { line_style: this.value });
					});
				
				select.selectAll('option')
					.data(Object.keys(style_manager.styles.line_styles))
					.enter()
					.append('option')
					.attr('value', d => d)
					.property('selected', style => style === d.style.line_style)
					.text(d => d.charAt(0).toUpperCase() + d.slice(1));
			});
		
		// Opacity
		lineSettingsRow.append('div')
			.attr('class', 'col-4')
			.each(function(d) {
				const div = d3.select(this);
				div.append('label')
					.attr('class', 'form-label small')
					.text('Opacity');
				
				div.append('input')
					.attr('type', 'range')
					.attr('class', 'form-range')
					.attr('min', '0.1')
					.attr('max', '1')
					.attr('step', '0.1')
					.property('value', d.style.opacity)
					.on('input', function() {
						style_manager.update_series_style(d.series_id, { opacity: parseFloat(this.value) });
					});
			});
		
		// Marker settings
		const markerSettingsRow = seriesItems.append('div')
			.attr('class', 'row mb-3');
		
		// Marker shape
		markerSettingsRow.append('div')
			.attr('class', 'col-6')
			.each(function(d) {
				const div = d3.select(this);
				div.append('label')
					.attr('class', 'form-label small')
					.text('Shape');
				
				const select = div.append('select')
					.attr('class', 'form-select form-select-sm')
					.property('value', d.style.marker_shape)
					.on('change', function() {
						style_manager.update_series_style(d.series_id, { marker_shape: this.value });
					});
				
				select.selectAll('option')
					.data(Object.keys(style_manager.styles.marker_shapes))
					.enter()
					.append('option')
					.attr('value', d => d)
					.property('selected', shape => shape === d.style.marker_shape)
					.text(d => d.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()));
			});
		
		// Marker size
		markerSettingsRow.append('div')
			.attr('class', 'col-6')
			.each(function(d) {
				const div = d3.select(this);
				div.append('label')
					.attr('class', 'form-label small')
					.text('Size');
				
				div.append('input')
					.attr('type', 'number')
					.attr('class', 'form-control form-control-sm')
					.attr('min', '1')
					.attr('max', '20')
					.attr('step', '1')
					.property('value', d.style.marker_size)
					.on('change', function() {
						style_manager.update_series_style(d.series_id, { marker_size: parseInt(this.value) });
					});
			});
		
		// Marker frequency row
		const markerFreqRow = seriesItems.append('div')
			.attr('class', 'row mb-3');
		
		markerFreqRow.append('div')
			.attr('class', 'col-6')
			.each(function(d) {
				const div = d3.select(this);
				div.append('label')
					.attr('class', 'form-label small')
					.text('Marker every n points');
				
				div.append('input')
					.attr('type', 'number')
					.attr('class', 'form-control form-control-sm')
					.attr('min', '1')
					.attr('step', '1')
					.property('value', d.style.marker_every || 10)
					.property('disabled', !d.style.show_markers)
					.on('change', function() {
						style_manager.update_series_style(d.series_id, { marker_every: parseInt(this.value) });
					});
			});
	},
	
	// Global color cycling functions
	get_next_global_color: () => {
		const colors = style_manager.styles.color_schemes[style_manager.styles.global.color_scheme];
		const colorIndex = style_manager.styles.global.global_color_index;
		const color = colors[colorIndex % colors.length];
		
		// Increment for next time
		style_manager.styles.global.global_color_index = (colorIndex + 1) % colors.length;
		
		return { color, index: colorIndex };
	},
	
	reset_global_color_counter: () => {
		style_manager.styles.global.global_color_index = 0;
	},
	
	// Dynamic axis label coloring based on series counts
	update_axis_label_colors: () => {
		if (!vis.series || vis.series.length === 0) {
			// No series - use black for all axis labels
			vis.axes.y.color = 'Black';
			vis.axes.yOther.color = 'Black';
			return;
		}
		
		// Count series per axis
		const leftSeries = vis.series.filter(s => s.target_axis === 'y');
		const rightSeries = vis.series.filter(s => s.target_axis === 'yOther');
		
		// Default to black
		vis.axes.y.color = 'Black';
		vis.axes.yOther.color = 'Black';
		
		// Apply coloring rules:
		// - Both axes have series AND at least one axis has only one series
		// - Then any axis with only one series gets colored to match that series
		if (leftSeries.length > 0 && rightSeries.length > 0) {
			// Both axes have series
			if (leftSeries.length === 1) {
				// Left axis has only one series - color it to match
				vis.axes.y.color = leftSeries[0].style.color;
			}
			if (rightSeries.length === 1) {
				// Right axis has only one series - color it to match
				vis.axes.yOther.color = rightSeries[0].style.color;
			}
		}
		
		// Force plot refresh to apply new colors
		if (!vis.pause) {
			vis.update_plot();
		}
	},
	
};