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
			global_color_index: 0,  // Global color cycling counter
			manual_color_overrides: new Set(),  // Track manually changed colors
			automatic_color_assignments: new Map()  // Track series_id -> color_index for automatic assignments
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
			// Check if this is a manual color change
			if (style_updates.color) {
				style_manager.mark_color_as_manual_override(series_id, style_updates.color);
			}
			
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
		
		// Clear manual override tracking when color scheme changes - everything gets reassigned systematically
		style_manager.styles.global.manual_color_overrides.clear();
		style_manager.styles.global.automatic_color_assignments.clear();
		style_manager.reset_global_color_counter();
		
		if (vis.series && vis.series.length > 0) {
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
						
						// Track as automatic assignment
						style_manager.styles.global.automatic_color_assignments.set(series.series_id, colorIndex);
						
						// Update persistent storage
						style_manager.styles.persistent_styles[series.series_id] = { ...series.style };
					});
				});
			} else {
				// Single-file mode: Systematic color assignment (left Y top-to-bottom, then right Y top-to-bottom)
				// Sort series by axis and order for systematic assignment
				const leftYSeries = vis.series.filter(s => s.target_axis === 'y').sort((a, b) => {
					// Sort by series creation order or index
					const aIndex = parseInt(a.series_id.split('_')[2]) || 0;
					const bIndex = parseInt(b.series_id.split('_')[2]) || 0;
					return aIndex - bIndex;
				});
				
				const rightYSeries = vis.series.filter(s => s.target_axis === 'yOther').sort((a, b) => {
					// Sort by series creation order or index
					const aIndex = parseInt(a.series_id.split('_')[2]) || 0;
					const bIndex = parseInt(b.series_id.split('_')[2]) || 0;
					return aIndex - bIndex;
				});
				
				// Systematic assignment: left Y first, then right Y
				const systematicOrder = [...leftYSeries, ...rightYSeries];
				
				systematicOrder.forEach((series, index) => {
					const colorIndex = index % colors.length;
					const new_color = colors[colorIndex];
					
					// Update series style
					series.style.color = new_color;
					series.style.line_width = style_manager.styles.global.default_line_width;
					series.style.marker_size = style_manager.styles.global.default_marker_size;
					series.style.opacity = style_manager.styles.global.default_opacity;
					
					// Update legacy color for compatibility
					series.color = new_color;
					
					// Track as automatic assignment
					style_manager.styles.global.automatic_color_assignments.set(series.series_id, colorIndex);
					
					// Update persistent storage
					style_manager.styles.persistent_styles[series.series_id] = { ...series.style };
				});
				
				// Update color counter to continue from where systematic assignment left off
				style_manager.styles.global.global_color_index = systematicOrder.length % colors.length;
			}
		}
		
		// Also update any other persistent styles not currently displayed
		Object.keys(style_manager.styles.persistent_styles).forEach((series_id, index) => {
			// Skip if this series is already handled above
			if (!vis.series || !vis.series.find(s => s.series_id === series_id)) {
				const style = style_manager.styles.persistent_styles[series_id];
				const colorIndex = index % colors.length;
				const new_color = colors[colorIndex];
				
				style.color = new_color;
				style.line_width = style_manager.styles.global.default_line_width;
				style.marker_size = style_manager.styles.global.default_marker_size;
				style.opacity = style_manager.styles.global.default_opacity;
				
				// Track as automatic assignment
				style_manager.styles.global.automatic_color_assignments.set(series_id, colorIndex);
			}
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

	// Custom color scheme dropdown functions
	setup_color_scheme_dropdown: () => {
		const dropdown = d3.select('#colorSchemeDropdown');
		const currentScheme = style_manager.styles.global.color_scheme;
		
		// Clear existing options
		dropdown.selectAll('li').remove();
		
		// Create dropdown items for each color scheme
		Object.keys(style_manager.styles.color_schemes).forEach(schemeKey => {
			const colors = style_manager.styles.color_schemes[schemeKey];
			const schemeName = style_manager.get_color_scheme_display_name(schemeKey);
			
			const listItem = dropdown.append('li');
			const link = listItem.append('a')
				.attr('class', 'dropdown-item d-flex align-items-center py-2')
				.attr('href', '#')
				.style('cursor', 'pointer')
				.on('click', (event) => {
					event.preventDefault();
					style_manager.select_color_scheme(schemeKey);
				});
			
			// Color preview swatches
			const previewContainer = link.append('div')
				.attr('class', 'd-flex me-3');
			
			colors.slice(0, Math.min(colors.length, 8)).forEach(color => {
				previewContainer.append('div')
					.style('width', '12px')
					.style('height', '12px')
					.style('background-color', color)
					.style('border', '1px solid #ccc')
					.style('margin-right', '1px')
					.style('border-radius', '2px');
			});
			
			// Scheme name
			link.append('span')
				.text(schemeName);
			
			// Mark active scheme
			if (schemeKey === currentScheme) {
				link.classed('active', true);
			}
		});
		
		// Update the button display
		style_manager.update_color_scheme_button(currentScheme);
	},
	
	get_color_scheme_display_name: (schemeKey) => {
		const nameMap = {
			'tableau10': 'Tableau 10',
			'set1': 'Set 1',
			'set2': 'Set 2',
			'dark2': 'Dark 2',
			'viridis': 'Viridis',
			'magma': 'Magma',
			'plasma': 'Plasma',
			'inferno': 'Inferno'
		};
		return nameMap[schemeKey] || schemeKey.charAt(0).toUpperCase() + schemeKey.slice(1);
	},
	
	select_color_scheme: (schemeKey) => {
		// Update the global setting
		style_manager.styles.global.color_scheme = schemeKey;
		
		// Update the button display
		style_manager.update_color_scheme_button(schemeKey);
		
		// Update active state in dropdown
		d3.selectAll('#colorSchemeDropdown .dropdown-item').classed('active', false);
		d3.selectAll('#colorSchemeDropdown .dropdown-item')
			.filter(function() { 
				return d3.select(this).on('click').toString().includes(schemeKey); 
			})
			.classed('active', true);
		
		// Apply the changes
		style_manager.apply_global_style_changes();
		
		// Close the dropdown
		const dropdownToggle = document.getElementById('colorSchemeSelect');
		const dropdown = bootstrap.Dropdown.getInstance(dropdownToggle);
		if (dropdown) {
			dropdown.hide();
		}
	},
	
	update_color_scheme_button: (schemeKey) => {
		const colors = style_manager.styles.color_schemes[schemeKey];
		const schemeName = style_manager.get_color_scheme_display_name(schemeKey);
		
		// Update the scheme name
		d3.select('#colorSchemeName').text(schemeName);
		
		// Update the color preview in the button
		const previewContainer = d3.select('#colorSchemePreview');
		previewContainer.selectAll('*').remove();
		
		colors.slice(0, Math.min(colors.length, 6)).forEach(color => {
			previewContainer.append('div')
				.style('width', '14px')
				.style('height', '14px')
				.style('background-color', color)
				.style('border', '1px solid #ccc')
				.style('margin-right', '1px')
				.style('border-radius', '2px');
		});
	},

	// Style panel UI functions
	setup_style_handlers: () => {
		// Initialize custom color scheme dropdown
		style_manager.setup_color_scheme_dropdown();
		
		// Global style handlers - note: colorSchemeSelect is now handled by the custom dropdown
		
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
		
		// Update global settings - refresh the custom color scheme dropdown
		style_manager.update_color_scheme_button(style_manager.styles.global.color_scheme);
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
	
	// Global color cycling functions with cycle independence
	get_next_global_color: (series_id = null) => {
		const colors = style_manager.styles.color_schemes[style_manager.styles.global.color_scheme];
		const maxAttempts = colors.length;
		let attempts = 0;
		let colorIndex = style_manager.styles.global.global_color_index;
		
		// Find next available automatic color (skip manually overridden ones)
		while (attempts < maxAttempts) {
			const currentColor = colors[colorIndex % colors.length];
			
			// Check if this color is manually overridden by looking at persistent styles
			const isManuallyOverridden = style_manager.is_color_manually_overridden(currentColor);
			
			if (!isManuallyOverridden) {
				// Found an available automatic color
				const finalIndex = colorIndex % colors.length;
				const finalColor = colors[finalIndex];
				
				// Track this automatic assignment if series_id provided
				if (series_id) {
					style_manager.styles.global.automatic_color_assignments.set(series_id, finalIndex);
				}
				
				// Advance counter for next time
				style_manager.styles.global.global_color_index = (colorIndex + 1) % colors.length;
				
				return { color: finalColor, index: finalIndex };
			}
			
			// This color is manually overridden, try next one
			colorIndex = (colorIndex + 1) % colors.length;
			attempts++;
		}
		
		// If all colors are manually overridden (edge case), just cycle through normally
		const fallbackIndex = style_manager.styles.global.global_color_index;
		const fallbackColor = colors[fallbackIndex % colors.length];
		style_manager.styles.global.global_color_index = (fallbackIndex + 1) % colors.length;
		
		if (series_id) {
			style_manager.styles.global.automatic_color_assignments.set(series_id, fallbackIndex % colors.length);
		}
		
		return { color: fallbackColor, index: fallbackIndex % colors.length };
	},
	
	// Check if a color is manually overridden
	is_color_manually_overridden: (color) => {
		// Look through all persistent styles to see if any series has this color as a manual override
		for (const [series_id, style] of Object.entries(style_manager.styles.persistent_styles)) {
			if (style.color === color) {
				// Check if this was an automatic assignment vs manual override
				const automaticIndex = style_manager.styles.global.automatic_color_assignments.get(series_id);
				if (automaticIndex !== undefined) {
					const automaticColor = style_manager.styles.color_schemes[style_manager.styles.global.color_scheme][automaticIndex];
					// If the current color doesn't match the automatic assignment, it's a manual override
					if (style.color !== automaticColor) {
						return true;
					}
				} else {
					// No automatic assignment record means it could be manual (err on side of caution)
					return true;
				}
			}
		}
		return false;
	},
	
	// Mark a series color change as manual override
	mark_color_as_manual_override: (series_id, new_color) => {
		// Remove from automatic assignments since it's now manual
		style_manager.styles.global.automatic_color_assignments.delete(series_id);
		
		// The color will be tracked as manual override through the persistent styles
		// and detected by is_color_manually_overridden()
	},
	
	reset_global_color_counter: () => {
		style_manager.styles.global.global_color_index = 0;
	},
	
	// Get appropriate text color based on current theme (dark/light mode)
	get_theme_text_color: (force_light = false) => {
		if (force_light || document.documentElement.getAttribute('data-bs-theme') != 'dark') {
			return 'Black'; // Dark color for light mode or forced light mode
		} else {
			return 'rgb(223,226,230)'; // Light color for dark mode
		}
	},

	// Dynamic axis label coloring based on series counts
	update_axis_label_colors: (force_light = false) => {
		if (!vis.series || vis.series.length === 0) {
			// No series - use theme-appropriate color for all axis labels
			const themeColor = style_manager.get_theme_text_color(force_light);
			vis.axes.y.color = themeColor;
			vis.axes.yOther.color = themeColor;
			return;
		}
		
		// Count series per axis
		const leftSeries = vis.series.filter(s => s.target_axis === 'y');
		const rightSeries = vis.series.filter(s => s.target_axis === 'yOther');
		
		// Default to theme-appropriate color
		const themeColor = style_manager.get_theme_text_color(force_light);
		vis.axes.y.color = themeColor;
		vis.axes.yOther.color = themeColor;
		
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
		
		// Note: Plot refresh is handled by the caller (vis.update_plot())
		// to avoid circular calls between update_axis_label_colors and update_plot
	},
	
};