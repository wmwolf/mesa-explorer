// Series Manager - Multi-series UI management and configuration
// Handles series definitions, UI creation/removal, column selection, and styling coordination

const series_manager = {
	// Multi-series management system
	series_definitions: {
		y: [], // Array of series definitions for left y-axis
		yOther: [] // Array of series definitions for right y-axis
	},
	
	setup: () => {
		// Setup add series button handlers
		d3.select('#y-add-series').on('click', () => {
			series_manager.add_series_ui('y');
		});
		
		d3.select('#yOther-add-series').on('click', () => {
			series_manager.add_series_ui('yOther');
		});
	},
	
	add_series_ui: (axis) => {
		const container = d3.select(`#${axis}-series-container`);
		const seriesIndex = series_manager.series_definitions[axis].length;
		const seriesId = `${axis}-series-${seriesIndex}`;
		
		// Create series definition
		const seriesDefinition = {
			id: seriesId,
			axis: axis,
			column: null,
			label: '',
			style: {
				show_line: true,
				show_markers: false,
				marker_every: 10
			}
		};
		
		series_manager.series_definitions[axis].push(seriesDefinition);
		
		// Create UI for this series
		const seriesDiv = container.append('div')
			.attr('class', 'series-item border rounded p-3 mb-3')
			.attr('id', seriesId);
		
		// Series header with remove button
		const headerDiv = seriesDiv.append('div')
			.attr('class', 'd-flex justify-content-between align-items-center mb-2');
		
		headerDiv.append('h6')
			.attr('class', 'mb-0')
			.text(`Series ${seriesIndex + 1}`);
		
		if (seriesIndex > 0) { // Don't allow removing the first series
			headerDiv.append('button')
				.attr('class', 'btn btn-outline-danger btn-sm')
				.attr('type', 'button')
				.html('<i class="bi bi-trash"></i>')
				.on('click', () => {
					series_manager.remove_series_ui(axis, seriesIndex);
				});
		}
		
		// Column selection row
		const columnRow = seriesDiv.append('div')
			.attr('class', 'row mb-2');
		
		const columnCol = columnRow.append('div')
			.attr('class', 'col-md-6');
		
		const dropdown = columnCol.append('div')
			.attr('class', 'dropdown d-grid');
		
		const dropdownButton = dropdown.append('button')
			.attr('class', 'btn btn-outline-secondary dropdown-toggle')
			.attr('type', 'button')
			.attr('data-bs-toggle', 'dropdown')
			.attr('aria-expanded', 'false')
			.attr('id', `${seriesId}-dropdown`)
			.text('Select column');
		
		const dropdownMenu = dropdown.append('div')
			.attr('class', 'dropdown-menu')
			.attr('id', `${seriesId}-choices`);
		
		// Search field
		const searchDiv = dropdownMenu.append('div')
			.attr('class', 'form-floating mb-2 mx-2');
		
		searchDiv.append('input')
			.attr('class', 'form-control')
			.attr('type', 'text')
			.attr('id', `${seriesId}-search`)
			.attr('placeholder', 'Search')
			.on('input', function() {
				series_manager.apply_series_search(seriesId);
			});
		
		searchDiv.append('label')
			.attr('for', `${seriesId}-search`)
			.text('Search');
		
		dropdownMenu.append('hr')
			.attr('class', 'dropdown-divider');
		
		dropdownMenu.append('div')
			.attr('id', `${seriesId}-options`);
		
		// Series label row
		const labelCol = columnRow.append('div')
			.attr('class', 'col-md-6');
		
		const labelDiv = labelCol.append('div')
			.attr('class', 'form-floating');
		
		labelDiv.append('input')
			.attr('type', 'text')
			.attr('class', 'form-control')
			.attr('id', `${seriesId}-label`)
			.attr('placeholder', 'Series label')
			.on('input', function() {
				seriesDefinition.label = this.value;
				vis.register_new_files(); // Refresh plot
			});
		
		labelDiv.append('label')
			.attr('for', `${seriesId}-label`)
			.text('Series label');
		
		// Style controls moved to style panel
		
		// Populate dropdown with available columns
		series_manager.update_series_choices(seriesId);
		
		return seriesDefinition;
	},
	
	remove_series_ui: (axis, seriesIndex) => {
		// Remove from series definitions
		series_manager.series_definitions[axis].splice(seriesIndex, 1);
		
		// Remove UI element
		d3.select(`#${axis}-series-${seriesIndex}`).remove();
		
		// Renumber remaining series
		series_manager.series_definitions[axis].forEach((series, newIndex) => {
			const oldId = series.id;
			const newId = `${axis}-series-${newIndex}`;
			series.id = newId;
			
			// Update DOM element id and associated elements
			const element = d3.select(`#${oldId}`);
			if (!element.empty()) {
				element.attr('id', newId);
				// Update all child element ids and references
				element.select('h6').text(`Series ${newIndex + 1}`);
				// Update all input ids and labels... (this would be more complex in full implementation)
			}
		});
		
		// Refresh plot
		vis.register_new_files();
	},
	
	apply_series_search: (seriesId) => {
		const query = d3.select(`#${seriesId}-search`).property('value');
		const optionsContainer = d3.select(`#${seriesId}-options`);
		
		if (query.length === 0) {
			optionsContainer.selectAll('a').classed('d-none', false);
		} else {
			optionsContainer.selectAll('a').classed('d-none', (d, i, nodes) => {
				return !nodes[i].textContent.toLowerCase().includes(query.toLowerCase());
			});
		}
	},
	
	update_series_choices: (seriesId) => {
		if (!vis.name_data) return;
		
		const optionsContainer = d3.select(`#${seriesId}-options`);
		optionsContainer.selectAll('*').remove();
		
		const choices = optionsContainer.selectAll('a')
			.data(vis.name_data)
			.enter()
			.append('a')
			.attr('class', 'dropdown-item')
			.attr('href', '#')
			.attr('data-name', d => d.key)
			.html(d => `<samp>${d.key}</samp>`)
			.on('click', function(event, d) {
				event.preventDefault();
				series_manager.handle_series_column_selection(seriesId, d, this);
			});
	},
	
	handle_series_column_selection: (seriesId, columnData, element) => {
		// Find the series definition
		const [axis, , seriesIndex] = seriesId.split('-');
		const seriesDefinition = series_manager.series_definitions[axis][parseInt(seriesIndex)];
		
		// Update series definition
		seriesDefinition.column = columnData.key;
		
		// Set axis data_name for the first series (needed for axis labels to appear)
		if (parseInt(seriesIndex) === 0) {
			vis.axes[axis].data_name = columnData.key;
			vis.axes[axis].data_type = columnData.scale || 'linear';
		}
		
		// Update dropdown button text
		d3.select(`#${seriesId}-dropdown`).html(d3.select(element).html());
		
		// Auto-generate series label if empty
		const labelInput = d3.select(`#${seriesId}-label`);
		if (!labelInput.property('value')) {
			const cleanedName = columnData.key
				.replace(/^log\s*/, '')
				.replace(/_/g, ' ');
			labelInput.property('value', cleanedName);
			seriesDefinition.label = cleanedName;
		}
		
		// Auto-populate axis label if this is the first series and axis label is empty
		const axisLabelInput = d3.select(`#${axis}-axis-label`);
		if (parseInt(seriesIndex) === 0 && !axisLabelInput.property('value')) {
			const cleanedAxisName = columnData.key
				.replace(/^log\s*/, '')
				.replace(/_/g, ' ');
			axisLabelInput.property('value', cleanedAxisName);
			// Update the SVG label immediately if it exists
			if (vis.have_axis_labels) {
				vis.update_axis_labels();
			}
		}
		
		// Refresh plot
		vis.register_new_files();
	},
	
	create_multi_series: (file, fileIndex, targetAxis, seriesDefinition, seriesIndex) => {
		// Generate unique series ID
		const series_id = `${file.filename}_${targetAxis}_${seriesIndex}_${fileIndex}`;
		
		// Get style for this series
		const style = series_manager.get_multi_series_style(targetAxis, seriesIndex, fileIndex);
		
		// Override style with series definition preferences
		style.show_line = seriesDefinition.style.show_line;
		style.show_markers = seriesDefinition.style.show_markers;
		style.marker_every = seriesDefinition.style.marker_every;
		
		// Determine series name
		let seriesName = seriesDefinition.label || seriesDefinition.column.replace(/_/g, ' ');
		
		// Add file indicator for multi-file mode
		if (vis.files.length > 1) {
			seriesName += ` (${file.local_name})`;
		}
		
		return {
			series_id: series_id,
			file_reference: file,
			data: file.data.bulk,
			target_axis: targetAxis,
			name: seriesName,
			data_columns: {
				x: vis.axes.x.data_name,
				y: seriesDefinition.column
			},
			style: style,
			source_type: 'file',
			color: style.color
		};
	},
	
	get_multi_series_style: (axis, seriesIndex, fileIndex) => {
		const colors = style_manager.styles.color_schemes[style_manager.styles.global.color_scheme];
		const series_id = `multi_${axis}_${seriesIndex}_${fileIndex}`;
		
		// Check if we have persistent styling for this series
		if (style_manager.styles.persistent_styles[series_id]) {
			return { ...style_manager.styles.persistent_styles[series_id] };
		}
		
		// Create new style with smart color assignment
		let colorIndex;
		if (axis === 'y') {
			// Left axis: cycle through colors starting with blue
			colorIndex = seriesIndex % colors.length;
		} else {
			// Right axis: start with orange (index 1) then continue cycling
			colorIndex = (seriesIndex + 1) % colors.length;
		}
		
		const style = {
			color: colors[colorIndex],
			line_width: style_manager.styles.global.default_line_width,
			marker_size: style_manager.styles.global.default_marker_size,
			marker_shape: 'circle',
			opacity: style_manager.styles.global.default_opacity,
			show_line: true,
			show_markers: false
		};
		
		// Store in persistent styles
		style_manager.styles.persistent_styles[series_id] = { ...style };
		
		return style;
	},
	
	// Auto-create initial series if none exist
	ensure_initial_series: () => {
		if (series_manager.series_definitions.y.length === 0 && vis.files.length > 0) {
			series_manager.add_series_ui('y');
		}
		// Only auto-create yOther series if it's not hidden
		if (series_manager.series_definitions.yOther.length === 0 && vis.files.length > 0 && !d3.select('#yOther-data').classed('d-none')) {
			series_manager.add_series_ui('yOther');
		}
	},
	
	// Update series dropdown choices for all series
	refresh_all_series_choices: () => {
		['y', 'yOther'].forEach(axis => {
			series_manager.series_definitions[axis].forEach((seriesDef, index) => {
				const seriesId = `${axis}-series-${index}`;
				series_manager.update_series_choices(seriesId);
			});
		});
	}
};