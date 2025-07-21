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
			},
			data_transformations: {
				rescale: 'linear',  // linear, log, exp, logabs
				rezero: 0,
				modulo: 0,
				absval: false
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
			.attr('class', 'col-md-8');
		
		const dropdown = columnCol.append('div')
			.attr('class', 'dropdown d-grid');
		
		const dropdownButton = dropdown.append('button')
			.attr('class', 'btn btn-primary btn-lg dropdown-toggle')
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
		
		// Setup keyboard navigation for this series dropdown
		series_manager.setup_dropdown_navigation(seriesId);
		
		// Series label row
		const labelCol = columnRow.append('div')
			.attr('class', 'col-md-4');
		
		const labelDiv = labelCol.append('div')
			.attr('class', 'form-floating');
		
		labelDiv.append('input')
			.attr('type', 'text')
			.attr('class', 'form-control')
			.attr('id', `${seriesId}-label`)
			.attr('placeholder', 'Series label')
			.on('input', function() {
				seriesDefinition.label = this.value;
				file_manager.invoke_file_change_callbacks(); // Refresh plot
			});
		
		labelDiv.append('label')
			.attr('for', `${seriesId}-label`)
			.text('Series label');
		
		// Data Transformation Controls (matching X-axis style)
		const transformRow = seriesDiv.append('div')
			.attr('class', 'row mt-2');
		
		const transformCol = transformRow.append('div')
			.attr('class', 'col-12');
		
		// Single row with all controls (matching X-axis layout)
		const controlsRow = transformCol.append('div')
			.attr('class', 'row');
		
		// Scale type controls (left side)
		const scaleCol = controlsRow.append('div')
			.attr('class', 'col-md-6');
		
		scaleCol.append('h6').text('Rescale');
		
		['linear', 'log', 'exp'].forEach((transform, index) => {
			const checkDiv = scaleCol.append('div')
				.attr('class', 'form-check form-check-inline');
			
			checkDiv.append('input')
				.attr('class', 'form-check-input')
				.attr('type', 'radio')
				.attr('name', `${seriesId}-data-trans`)
				.attr('id', `${seriesId}-data-trans-${transform}`)
				.attr('value', transform)
				.property('checked', transform === 'linear')
				.on('change', function() {
					if (this.checked) {
						seriesDefinition.data_transformations.rescale = transform;
						file_manager.invoke_file_change_callbacks(); // Refresh plot
					}
				});
			
			checkDiv.append('label')
				.attr('class', 'form-check-label small')
				.attr('for', `${seriesId}-data-trans-${transform}`)
				.html(transform === 'linear' ? '<em>x</em>' : (transform === 'log' ? 'log<sub>10</sub>(<em>x</em>)' : '10<sup><em>x</em></sup>'));
		});
		
		// Additional controls (right side)
		const additionalCol = controlsRow.append('div')
			.attr('class', 'col-md-6');
		
		const additionalRow = additionalCol.append('div')
			.attr('class', 'row');
		
		// Zero point control
		const zeroCol = additionalRow.append('div')
			.attr('class', 'col-6');
		
		const zeroDiv = zeroCol.append('div')
			.attr('class', 'form-floating');
		
		zeroDiv.append('input')
			.attr('type', 'number')
			.attr('class', 'form-control form-control-sm')
			.attr('id', `${seriesId}-data-zero`)
			.attr('placeholder', '0')
			.attr('value', '0')
			.on('input', function() {
				seriesDefinition.data_transformations.rezero = parseFloat(this.value) || 0;
				file_manager.invoke_file_change_callbacks(); // Refresh plot
			});
		
		zeroDiv.append('label')
			.attr('for', `${seriesId}-data-zero`)
			.attr('class', 'small')
			.text('Zero-point');
		
		// Absolute value control
		const absCol = additionalRow.append('div')
			.attr('class', 'col-6');
		
		const absDiv = absCol.append('div')
			.attr('class', 'form-check mt-2');
		
		absDiv.append('input')
			.attr('class', 'form-check-input')
			.attr('type', 'checkbox')
			.attr('id', `${seriesId}-absval`)
			.on('change', function() {
				seriesDefinition.data_transformations.absval = this.checked;
				file_manager.invoke_file_change_callbacks(); // Refresh plot
			});
		
		absDiv.append('label')
			.attr('class', 'form-check-label small')
			.attr('for', `${seriesId}-absval`)
			.text('Absolute Value');
		
		// Style controls moved to style panel
		
		// Populate dropdown with available columns
		series_manager.update_series_choices(seriesId);
		
		// Note: Don't apply smart labeling here - series has no column yet
		// Smart labeling will be applied when user selects a column
		
		return seriesDefinition;
	},
	
	remove_series_ui: (axis, seriesIndex) => {
		// Remove from series definitions
		series_manager.series_definitions[axis].splice(seriesIndex, 1);
		
		// Remove UI element
		d3.select(`#${axis}-series-${seriesIndex}`).remove();
		
		// Update persistent styles and color assignments during renumbering
		// This preserves manual color overrides when series IDs change
		series_manager.update_persistent_styles_for_renumbering(axis);
		
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
		
		// Always update axis label after series removal (like x-axis does)
		series_manager.update_axis_label_direct(axis);
		
		// Refresh plot
		file_manager.invoke_file_change_callbacks();
	},
	
	// Update persistent styles when series are renumbered to preserve manual color overrides
	update_persistent_styles_for_renumbering: (axis) => {
		if (!vis.files || vis.files.length === 0) return;
		
		// Find all existing persistent styles for this axis
		const axisStyles = {};
		const axisAssignments = new Map();
		
		// Collect existing styles and assignments that match this axis
		Object.keys(style_manager.styles.persistent_styles).forEach(seriesId => {
			if (seriesId.includes(`_${axis}_`)) {
				// Extract the column name from the series definition this style belongs to
				const parts = seriesId.split('_');
				const seriesIndex = parseInt(parts[2]);
				
				// Find this series in current vis.series to get its column
				const existingSeries = vis.series.find(s => s.series_id === seriesId);
				if (existingSeries) {
					const column = existingSeries.data_columns.y;
					axisStyles[column] = { 
						style: { ...style_manager.styles.persistent_styles[seriesId] },
						originalId: seriesId
					};
				}
				
				// Also collect automatic assignments
				const assignment = style_manager.styles.global.automatic_color_assignments.get(seriesId);
				if (assignment !== undefined) {
					const column = existingSeries ? existingSeries.data_columns.y : null;
					if (column) {
						axisAssignments.set(column, assignment);
					}
				}
			}
		});
		
		// Clean up old entries
		Object.keys(style_manager.styles.persistent_styles).forEach(seriesId => {
			if (seriesId.includes(`_${axis}_`)) {
				delete style_manager.styles.persistent_styles[seriesId];
			}
		});
		
		vis.files.forEach(file => {
			axisAssignments.forEach((assignment, column) => {
				const oldSeriesId = Object.keys(axisStyles).includes(column) ? 
					axisStyles[column].originalId : null;
				if (oldSeriesId) {
					style_manager.styles.global.automatic_color_assignments.delete(oldSeriesId);
				}
			});
		});
		
		// Reassign styles based on the new series definitions
		series_manager.series_definitions[axis].forEach((seriesDef, newIndex) => {
			const column = seriesDef.column;
			
			if (axisStyles[column]) {
				// This series had persistent styling - restore it with new ID
				vis.files.forEach((file, fileIndex) => {
					const newSeriesId = `${file.local_name}_${axis}_${newIndex}_${fileIndex}`;
					style_manager.styles.persistent_styles[newSeriesId] = axisStyles[column].style;
					
					// Restore automatic assignment if it existed
					if (axisAssignments.has(column)) {
						style_manager.styles.global.automatic_color_assignments.set(newSeriesId, axisAssignments.get(column));
					}
				});
			}
		});
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
		// Clear all active states and highlight the first visible item (matching X-axis behavior)
		optionsContainer.selectAll('a').classed('active', false);
		optionsContainer.select('a:not(.d-none)').classed('active', true);
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
			.attr('href', 'javascript: void(0)')
			.attr('data-name', d => d.key)
			.html(d => {
				// Get metadata for this column (includes isotope auto-detection)
				const currentFileType = file_manager.active_file ? file_manager.active_file.type : null;
				const metadata = metadata_manager.get_metadata(d.key, currentFileType);
				
				// Create dual-line display: raw name + formatted name with units
				let html = `<samp>${d.key}</samp>`;
				
				// Add formatted line if different from raw name or has units
				const formattedName = metadata.series_name;
				const hasUnits = metadata.units && metadata.units.trim() !== '';
				
				if (formattedName !== d.key || hasUnits) {
					const unitsPart = hasUnits ? ` [${text_markup.markup_to_html(metadata.units)}]` : '';
					const formattedNameHtml = text_markup.markup_to_html(formattedName);
					html += `<br><small class="opacity-75">${formattedNameHtml}${unitsPart}</small>`;
				}
				
				return html;
			})
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
		
		// Get metadata for intelligent defaults
		const currentFileType = file_manager.active_file ? file_manager.active_file.type : null;
		const metadata = metadata_manager.get_metadata(columnData.key, currentFileType);
		
		// Use metadata for series label (prefer formatted name over cleaned raw name)
		seriesDefinition.label = metadata.series_name;
		
		// Update the series label input field in the UI
		const labelInput = d3.select(`#${seriesId}-label`);
		if (!labelInput.empty()) {
			labelInput.property('value', metadata.series_name);
		}
		
		// Set axis data_name for the first series (needed for axis labels to appear)
		if (parseInt(seriesIndex) === 0) {
			vis.axes[axis].data_name = columnData.key;
			vis.axes[axis].data_type = columnData.scale || 'linear';
		}
		
		// Always update axis label when series change (like x-axis does)
		series_manager.update_axis_label_direct(axis);
		
		// Intelligent logarithmic behavior based on metadata
		// Apply 4-case logic: data_logarithmic vs display_logarithmic
		if (metadata.data_logarithmic && metadata.display_logarithmic) {
			// Case 1: Data is log, display as log → exponentiate data, use log axis
			seriesDefinition.data_transformations.rescale = 'exp';
			d3.select(`#${seriesId}-data-trans-exp`).property('checked', true);
			d3.select(`#${seriesId}-data-trans-linear`).property('checked', false);
			
			// Suggest logarithmic axis scale for the first series
			if (parseInt(seriesIndex) === 0) {
				d3.select(`#${axis}-scale-log`).property('checked', true);
				d3.select(`#${axis}-scale-linear`).property('checked', false);
				vis.axes[axis].type = 'log';
			}
		} else if (metadata.data_logarithmic && !metadata.display_logarithmic) {
			// Case 2: Data is log, display as linear → keep data as-is, use linear axis
			seriesDefinition.data_transformations.rescale = 'linear';
			d3.select(`#${seriesId}-data-trans-linear`).property('checked', true);
			d3.select(`#${seriesId}-data-trans-exp`).property('checked', false);
		} else if (!metadata.data_logarithmic && metadata.display_logarithmic) {
			// Case 3: Data is linear, display as log → raw data, use log axis
			seriesDefinition.data_transformations.rescale = 'linear';
			d3.select(`#${seriesId}-data-trans-linear`).property('checked', true);
			d3.select(`#${seriesId}-data-trans-exp`).property('checked', false);
			
			// Suggest logarithmic axis scale for the first series
			if (parseInt(seriesIndex) === 0) {
				d3.select(`#${axis}-scale-log`).property('checked', true);
				d3.select(`#${axis}-scale-linear`).property('checked', false);
				vis.axes[axis].type = 'log';
			}
		} else {
			// Case 4: Data is linear, display as linear → raw data, use linear axis (default)
			seriesDefinition.data_transformations.rescale = 'linear';
			d3.select(`#${seriesId}-data-trans-linear`).property('checked', true);
			d3.select(`#${seriesId}-data-trans-exp`).property('checked', false);
		}
		
		// Update dropdown button text
		d3.select(`#${seriesId}-dropdown`).html(d3.select(element).html());
		
		// Update the SVG label immediately if it exists (for first series)
		if (parseInt(seriesIndex) === 0 && vis.have_axis_labels) {
			vis.update_axis_labels();
		}
		
		// Refresh plot
		file_manager.invoke_file_change_callbacks();
	},
	
	create_multi_series: (file, fileIndex, targetAxis, seriesDefinition, seriesIndex) => {
		// Generate mode-appropriate series ID
		let series_id;
		if (vis.files && vis.files.length > 1) {
			// Multi-file mode: include file info to distinguish between files
			series_id = `${file.local_name}_${targetAxis}_${seriesIndex}_${fileIndex}`;
		} else {
			// Single-file mode: use only axis and series index to maintain consistent identity across files
			series_id = `single_file_${targetAxis}_${seriesIndex}`;
		}
		
		// Get style for this series (pass seriesDefinition for linestyle assignment)
		const style = series_manager.get_multi_series_style(targetAxis, seriesIndex, fileIndex, seriesDefinition);
		
		// Override style with series definition preferences
		style.show_line = seriesDefinition.style.show_line;
		style.show_markers = seriesDefinition.style.show_markers;
		style.marker_every = seriesDefinition.style.marker_every;
		
		// Determine series name - in multi-file mode, just use file name for cleaner legends
		let seriesName;
		if (vis.files.length > 1) {
			// Multi-file mode: use only the file name for cleaner legend
			seriesName = file.local_name;
		} else {
			// Single-file mode: use series label or cleaned column name
			seriesName = seriesDefinition.label || seriesDefinition.column.replace(/_/g, ' ');
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
			color: style.color,
			data_transformations: seriesDefinition.data_transformations
		};
	},
	
	get_multi_series_style: (axis, seriesIndex, fileIndex, seriesDefinition = null) => {
		const colors = style_manager.styles.color_schemes[style_manager.styles.global.color_scheme];
		// Generate mode-appropriate series ID to match create_multi_series
		let series_id;
		if (vis.files && vis.files.length > 1) {
			// Multi-file mode: include file info to distinguish between files
			series_id = `${vis.files[fileIndex].local_name}_${axis}_${seriesIndex}_${fileIndex}`;
		} else {
			// Single-file mode: use only axis and series index to maintain consistent identity across files
			series_id = `single_file_${axis}_${seriesIndex}`;
		}
		
		// Check if we have persistent styling for this series
		if (style_manager.styles.persistent_styles[series_id]) {
			return { ...style_manager.styles.persistent_styles[series_id] };
		}
		
		// Create new style with smart color assignment
		let color;
		let line_style = 'solid';  // Default linestyle
		
		// In multi-file mode, assign colors by file index (each file gets different color)
		// In single-file mode, use global color cycling across both axes
		if (vis.files && vis.files.length > 1) {
			// Multi-file mode: color by file index so each file is distinct
			const colorIndex = fileIndex % colors.length;
			color = colors[colorIndex];
			
			// Multi-file mode: linestyle by column name (data type)
			if (seriesDefinition && seriesDefinition.column) {
				const linestyleName = style_manager.get_linestyle_for_column(seriesDefinition.column);
				line_style = linestyleName;
			}
		} else {
			// Single-file mode: use global color cycling
			const colorResult = style_manager.get_next_global_color(series_id);
			color = colorResult.color;
			// Single-file mode: keep solid linestyle (existing behavior)
		}
		
		const style = {
			color: color,
			line_width: style_manager.styles.global.default_line_width,
			line_style: line_style,
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
	},
	
	// Setup keyboard navigation for series dropdowns (matching X-axis behavior)
	setup_dropdown_navigation: (seriesId) => {
		// Clicking on dropdown button should focus on the search field
		d3.select(`#${seriesId}-dropdown`).on('click', function() {
			setTimeout(() => {
				d3.select(`#${seriesId}-search`)
					.node()
					.focus();
				series_manager.apply_series_search(seriesId);
			}, 10); // Small delay to ensure dropdown is open
		});
		
		d3.select(`#${seriesId}-search`).on('keyup', function(e) {
			// ignore arrow keys; those control the active element via keydown
			if (e.code.slice(0, 3) === 'Arr' || e.code == 'Enter') {
				if (e.code === 'Enter') {
					e.preventDefault(); // Prevent default form submission behavior
					e.stopPropagation(); // Prevent event bubbling
				}
				return;
			}
			series_manager.apply_series_search(seriesId);
		});
		
		d3.select(`#${seriesId}-search`).on('keydown', function(e) {
			if (e.code === 'ArrowDown') {
				e.preventDefault();
				// if we push "down", we should highlight the next result, if it exists
				let active = d3.select(`#${seriesId}-options`).select('a.active');
				let next = null;
				// If there's nothing active yet, then we'll just highlight the first non-hidden element
				if (active.empty()) {
					d3.select(`#${seriesId}-options`)
						.select('a:not(.d-none)')
						.classed('active', true);
					return;
				}
				active = active.node();
				let sibling = active.nextElementSibling;
				while (sibling) {
					if (!sibling.classList.contains('d-none')) {
						next = d3.select(sibling);
						break;
					}
					sibling = sibling.nextElementSibling;
				}
				if (next) {
					d3.select(active).classed('active', false);
					next.classed('active', true);
				}
			} else if (e.code === 'ArrowUp') {
				e.preventDefault();
				// if we push "up", we should highlight the previous result, if it exists
				let prev = null;
				let active = d3.select(`#${seriesId}-options`).select('a.active');
				if (active.empty()) return;
				active = active.node();
				let sibling = active.previousElementSibling;
				while (sibling) {
					if (!sibling.classList.contains('d-none')) {
						prev = sibling;
						break;
					}
					sibling = sibling.previousElementSibling;
				}
				if (prev) {
					d3.select(active).classed('active', false);
					d3.select(prev).classed('active', true);
				}
			} else if (e.code === 'Enter') {
				e.preventDefault(); // Prevent page scroll to top
				e.stopPropagation(); // Prevent event bubbling
				// simulate click event on the active element if user hits enter
				const activeElement = d3.select(`#${seriesId}-options a.active`);
				if (!activeElement.empty()) {
					activeElement.dispatch('click');
					// Close the dropdown menu (matching X-axis behavior)
					const dropdownButton = document.querySelector(`#${seriesId}-dropdown`);
					if (dropdownButton) {
						// Use Bootstrap's dropdown API to close the dropdown
						const dropdown = bootstrap.Dropdown.getInstance(dropdownButton) || new bootstrap.Dropdown(dropdownButton);
						dropdown.hide();
					}
				}
			}
		});
	},
	
	// Smart Axis Labeling System
	// Calculate what the axis label should be based on current series configuration
	calculate_expected_axis_label: (axis) => {
		// Count active series with valid columns on this axis
		const activeSeries = series_manager.series_definitions[axis].filter(seriesDef => 
			seriesDef.column && seriesDef.column.trim() !== ''
		);
		
		if (activeSeries.length === 0) {
			return ''; // No active series, no label needed
		}
		
		// Get metadata from the first series to determine units and labels
		const currentFileType = file_manager.active_file ? file_manager.active_file.type : null;
		const firstSeriesMetadata = metadata_manager.get_metadata(activeSeries[0].column, currentFileType);
		
		let axisLabel;
		if (activeSeries.length === 1) {
			// Single series: use specific series_name
			axisLabel = firstSeriesMetadata.series_name;
		} else {
			// Multiple series: use generic axis_name, fallback to series_name
			axisLabel = firstSeriesMetadata.axis_name || firstSeriesMetadata.series_name;
		}
		
		// Add units if available
		if (firstSeriesMetadata.units && firstSeriesMetadata.units.trim() !== '') {
			axisLabel += ` [${firstSeriesMetadata.units}]`;
		}
		
		return axisLabel;
	},
	
	// Check if the current axis label has been customized by the user
	is_axis_label_customized: (axis) => {
		const axisLabelInput = d3.select(`#${axis}-axis-label`);
		if (axisLabelInput.empty()) {
			return false; // No input field, can't be customized
		}
		
		const currentLabel = axisLabelInput.property('value').trim();
		const expectedLabel = series_manager.calculate_expected_axis_label(axis);
		
		console.log(`Customization check: axis=${axis}, current="${currentLabel}", expected="${expectedLabel}"`);
		
		// If there are no active series (expected label is empty), 
		// don't consider the current label as "customized"
		if (expectedLabel === '') {
			return false;
		}
		
		// Compare current label with what we would auto-generate
		// If they're different, the user has customized it
		const isCustomized = currentLabel !== expectedLabel;
		console.log(`Customization check: axis=${axis}, isCustomized=${isCustomized}`);
		return isCustomized;
	},
	
	// Apply smart axis labeling if the label hasn't been customized
	update_smart_axis_label: (axis) => {
		const expectedLabel = series_manager.calculate_expected_axis_label(axis);
		console.log(`Smart labeling: axis=${axis}, expectedLabel="${expectedLabel}"`);
		
		// If there are no active series, don't clear existing labels - just return
		if (expectedLabel === '') {
			console.log(`Smart labeling: No expected label for axis ${axis}, returning`);
			return;
		}
		
		// Only update if not customized by user
		const isCustomized = series_manager.is_axis_label_customized(axis);
		console.log(`Smart labeling: axis=${axis}, isCustomized=${isCustomized}`);
		if (isCustomized) {
			return; // Preserve user's custom label
		}
		
		const axisLabelInput = d3.select(`#${axis}-axis-label`);
		console.log(`Smart labeling: axis=${axis}, input field exists=${!axisLabelInput.empty()}`);
		
		if (!axisLabelInput.empty()) {
			// Update the input field
			axisLabelInput.property('value', expectedLabel);
			console.log(`Smart labeling: Set axis ${axis} label to "${expectedLabel}"`);
			
			// Update the SVG axis label immediately if plot exists
			if (vis.have_axis_labels && expectedLabel) {
				console.log(`Smart labeling: Calling vis.update_axis_labels()`);
				vis.update_axis_labels();
			}
		}
	},
	
	// Direct axis label update (always update, like x-axis behavior)
	// Implements user's desired behavior:
	// - One series: use series_name + units
	// - Multiple series: use axis_name + units (fallback to series_name)
	update_axis_label_direct: (axis) => {
		// Count active series with valid columns on this axis
		const activeSeries = series_manager.series_definitions[axis].filter(seriesDef => 
			seriesDef.column && seriesDef.column.trim() !== ''
		);
		
		if (activeSeries.length === 0) {
			// No active series - clear the axis label
			const axisLabelInput = d3.select(`#${axis}-axis-label`);
			if (!axisLabelInput.empty()) {
				axisLabelInput.property('value', '');
			}
			return;
		}
		
		// Get metadata from the first series to determine units and labels
		const currentFileType = file_manager.active_file ? file_manager.active_file.type : null;
		const firstSeriesMetadata = metadata_manager.get_metadata(activeSeries[0].column, currentFileType);
		
		let axisLabel;
		if (activeSeries.length === 1) {
			// Single series: use specific series_name
			axisLabel = firstSeriesMetadata.series_name;
		} else {
			// Multiple series: use generic axis_name, fallback to series_name
			axisLabel = firstSeriesMetadata.axis_name || firstSeriesMetadata.series_name;
		}
		
		// Add units if available
		if (firstSeriesMetadata.units && firstSeriesMetadata.units.trim() !== '') {
			axisLabel += ` [${firstSeriesMetadata.units}]`;
		}
		
		// Always update the input field (no customization checking)
		const axisLabelInput = d3.select(`#${axis}-axis-label`);
		if (!axisLabelInput.empty()) {
			axisLabelInput.property('value', axisLabel);
		}
		
		// Update the SVG axis label immediately if plot exists
		if (vis.have_axis_labels && axisLabel) {
			vis.update_axis_labels();
		}
	},
	
	// Reset a series to default empty state when its column no longer exists
	reset_series_to_default_state: (axis, seriesIndex) => {
		const seriesDefinition = series_manager.series_definitions[axis][seriesIndex];
		if (!seriesDefinition) return;
		
		// Reset series definition
		seriesDefinition.column = null;
		seriesDefinition.label = '';
		
		// Reset UI elements
		const seriesId = `${axis}-series-${seriesIndex}`;
		
		// Reset dropdown button to default text
		const dropdownButton = d3.select(`#${seriesId}-dropdown`);
		if (!dropdownButton.empty()) {
			dropdownButton.html('Select column...');
		}
		
		// Clear series label input
		const labelInput = d3.select(`#${seriesId}-label`);
		if (!labelInput.empty()) {
			labelInput.property('value', '');
		}
		
		// Update axis label since series changed
		series_manager.update_axis_label_direct(axis);
	}
};