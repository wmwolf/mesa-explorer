
vis = {
	setup: () => {
		vis.svg = d3.select('#plot');
		// Note: setting style changes how things are displayed. Changing the
		// attribute will ensure that any downloaded figure will have the correct
		// height and width.
		vis.svg.attr('height', vis.svg.style('height'));
		vis.svg.attr('width', vis.width());
		vis.saved_bootstrap_size = vis.current_bootstrap_size();
		window.onresize = function() {
			if (vis.current_bootstrap_size() != vis.saved_bootstrap_size || vis.current_bootstrap_size() == 'xs') {
				vis.svg.attr('height', vis.svg.style('height'));
				vis.svg.attr('width', vis.width());
				vis.saved_bootstrap_size = vis.current_bootstrap_size();
				vis.update_plot();
			}
		};
		// load known history and profile columns
		vis.load_known_columns();
		// Set up handlers for dropdown search
		Object.keys(vis.axes).forEach(axis => {
			// Clicking on dropdown button should focus on the search field
			d3.select(`#${axis}-label`).on('click', function() {
				d3.select(`#${axis}-search`)
					.node()
					.focus();
				vis.apply_search(axis);
			});
			d3.select(`#${axis}-search`).on('keyup', function(e) {
				// ignore arrow keys; those control the active element via keydown
				if (e.code.slice(0, 3) === 'Arr' || e.code == 'Enter') return;
				vis.apply_search(axis);
			});
			d3.select(`#${axis}-search`).on('keydown', function(e) {
				if (e.code === 'ArrowDown') {
					e.preventDefault();
					// if we push "down", we should highlight the next result, if it
					// exists. ChatGPT helped with this solution, as it's difficult to
					// get the next non-hidden sibling (it may not be an immediate sibling)
					let active = d3.select(`#${axis}-choices`).select('a.active');
					let next = null;
					// If there's nothing active yet, then we'll just highlight the first
					// non-hidden element
					if (active.empty()) {
						d3.select(`#${axis}-choices`)
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
					// if we push "up", we should highlight the previous result, if it
					// exists. Finding that node is surprisingly hard since there is no
					// "previous sibling" feature in CSS. ChatGPT to the rescue with this
					// convoluted solution.
					let prev = null;
					let active = d3.select(`#${axis}-choices`).select('a.active');
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
					// now prev should be the first a before the current active tag, or it
					// null if there is no such anchor tag
					if (prev) {
						d3.select(active).classed('active', false);
						d3.select(prev).classed('active', true);
					}
				} else if (e.code === 'Enter') {
					// simulate click event on the active element if user hits enter
					d3.select(`#${axis}-choices a.active`).dispatch('click');
				}
			});
		});
		// Set up handlers for axis label fields
		d3.selectAll('.axis-label-field').on('input', () => {
			vis.update_axis_labels();
		});
		
		// Set up handlers for line/scatter controls
		d3.selectAll('input.plot-style').on('change', function() {
			const elt = d3.select(this);
			const axis = elt.attr('data-axis');
			const style = elt.attr('data-style');
			if (style == 'line') {
				vis.do_line_plot[axis] = elt.property('checked');
			}
			if (style == 'scatter') {
				vis.do_scatter_plot[axis] = elt.property('checked');
				d3.select(`input.mark-every[data-axis=${axis}]`).property('disabled', !elt.property('checked'));
			}
			vis.update_plot();
		});

		d3.selectAll('input.mark-every').on('keyup', function() {
			const elt = d3.select(this);
			const axis = elt.attr('data-axis');
			vis.marker_interval[axis] = Math.max(1, parseInt(elt.property('value')));
			vis.update_plot();
		});

		// Set up handlers for data transformations
		//   Data rescaling
		d3.selectAll('.data-rescale input').on('click', function() {
			elt = d3.select(this);
			vis.axes[elt.attr('data-axis')].data_trans.rescale = elt.property('value');
			vis.update_plot();
		});
		//   Rezeroing
		d3.selectAll('.data-rezero input').on('keyup', function(event) {
			event.preventDefault();
			elt = d3.select(this);
			vis.axes[elt.attr('data-axis')].data_trans.rezero = parseFloat(elt.property('value'));
			vis.update_plot();
			return false;
		});
		//   Modulo
		d3.selectAll('.data-modulo input').on('keyup', function(event) {
			event.preventDefault();
			elt = d3.select(this);
			vis.axes[elt.attr('data-axis')].data_trans.divisor = parseFloat(elt.property('value'));
			vis.update_plot();
			return false;
		});
		//   Absolute Value
		d3.selectAll('.data-absval input').on('click', function() {
			elt = d3.select(this);
			vis.axes[elt.attr('data-axis')].data_trans.absval = elt.property('checked');
			vis.update_plot();
		});
		//   Normalization
		d3.selectAll('.data-normalize input').on('click', function() {
			elt = d3.select(this);
			vis.axes[elt.attr('data-axis')].data_trans.normalize = elt.property('checked');
			vis.update_plot();
		});

		// Set up handlers for axis transformations
		//   linear/logarithmic radio toggles
		d3.selectAll('div.axis-rescale input').on('click', function() {
			btn = d3.select(this);
			if (btn.property('checked')) {
				vis.axes[btn.attr('data-scale')].type = btn.attr('data-scale-type');
				// if (btn.attr('data-scale') == 'x') {
				// 	vis.axes.x.type = btn.attr('data-scale-type');
				// } else if (btn.attr('data-scale') == 'y') {
				// 	vis.axes.y.type = btn.attr('data-scale-type');
				// }
				vis.update_plot();
			}
		});

		//  "min" (left/bottom) and "max" (right/top) limits
		d3.selectAll('div.limits input').on('keyup', function() {
			elt = d3.select(this);
			vis.axes[elt.attr('data-axis')][elt.attr('data-lim')] = parseFloat(elt.property('value'));
			vis.update_plot();
		});

		d3.select('#redraw').on('click', () => {
			vis.update_plot();
		});
		// Set download button handler
		d3.select('#download').on('click', () => {
			// if in dark mode, need to tweak xaxis label color before exporting to
			// svg. Kind of kludgy, but it works for now.

			// get current x-axis color, conditionally change and redraw if needed
			let dark_mode = false;
			let x_color = vis.axes.x.color;
			if (x_color != 'Black') {
				dark_mode = true;
				vis.axes.x.color = 'Black';
				vis.update_plot(force_light = true);
			}
			downloadSVG('plot');

			// restore x-axis color if needed
			if (dark_mode) {
				vis.axes.x.color = x_color;
				vis.update_plot();
			}
		});

		// Initialize interaction manager
		interaction_manager.setup();
		
	},

	breakpoints: {
		sm: 576,
		md: 768,
		lg: 992,
		xl: 1200,
		xxl: 1400,
	},
	do_line_plot: {
		y: true,
		yOther: true,
	},
	do_scatter_plot: {
		y: false,
		yOther: false,
	},
	marker_interval: {
		y: 1,
		yOther: 1,
	},
	current_bootstrap_size: () => {
		const smaller = Object.keys(vis.breakpoints).filter(key => +window.innerWidth >= vis.breakpoints[key]);
		if (smaller.length == 0) return 'xs';
		else return smaller[smaller.length - 1];
	},
	apply_search: axis => {
		let query = d3.select(`#${axis}-search`).property('value');
		if (query.length == 0) {
			d3.select(`#${axis}-choices`)
				.selectAll('a')
				.classed('d-none', false);
		} else {
			d3.select(`#${axis}-choices`)
				.selectAll('a')
				.classed('d-none', (d, i, nodes) => {
					return !nodes[i].text.includes(query);
				});
		}
		d3.selectAll(`#${axis}-choices a`).classed('active', false);
		d3.select(`#${axis}-choices a:not(.d-none)`).classed('active', true);
	},
	load_known_columns: () => {
		// Load data for known history/profile columns
		d3.csv('data/history_columns.csv').then(data => (vis.known_history_names = data));
		d3.csv('data/profile_columns.csv').then(data => (vis.known_profile_names = data));
	},
	
	// Multi-series management system
	series_definitions: {
		y: [], // Array of series definitions for left y-axis
		yOther: [] // Array of series definitions for right y-axis
	},
	
	setup_series_management: () => {
		// Setup add series button handlers
		d3.select('#y-add-series').on('click', () => {
			vis.add_series_ui('y');
		});
		
		d3.select('#yOther-add-series').on('click', () => {
			vis.add_series_ui('yOther');
		});
	},
	
	add_series_ui: (axis) => {
		const container = d3.select(`#${axis}-series-container`);
		const seriesIndex = vis.series_definitions[axis].length;
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
		
		vis.series_definitions[axis].push(seriesDefinition);
		
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
					vis.remove_series_ui(axis, seriesIndex);
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
				vis.apply_series_search(seriesId);
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
		vis.update_series_choices(seriesId);
		
		return seriesDefinition;
	},
	
	remove_series_ui: (axis, seriesIndex) => {
		// Remove from series definitions
		vis.series_definitions[axis].splice(seriesIndex, 1);
		
		// Remove UI element
		d3.select(`#${axis}-series-${seriesIndex}`).remove();
		
		// Renumber remaining series
		vis.series_definitions[axis].forEach((series, newIndex) => {
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
			.html(d => {
				let display = d.html_name || d.key.replace(/_/g, ' ');
				if (d.html_units) {
					display += ` (${d.html_units})`;
				}
				return display;
			})
			.on('click', function(event, d) {
				event.preventDefault();
				vis.handle_series_column_selection(seriesId, d, this);
			});
	},
	
	handle_series_column_selection: (seriesId, columnData, element) => {
		// Find the series definition
		const [axis, , seriesIndex] = seriesId.split('-');
		const seriesDefinition = vis.series_definitions[axis][parseInt(seriesIndex)];
		
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
		const style = vis.get_multi_series_style(targetAxis, seriesIndex, fileIndex);
		
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
	// These variables and methods deal with the plot area and axis scaling,
	// irrespective of the actual data being plotted

	// this variable allows stopping plot updates. Useful when multiple things
	// may change at once; just be sure to set it back to false when done.
	pause: false,
	height: () => parseFloat(vis.svg.style('height')),
	width: () => parseFloat(vis.svg.style('width')),
	font_size: {
		xs: 11,
		sm: 10,
		md: 14,
		lg: 14,
		xl: 16,
		xxl: 18,
	},
	tick_offset: () => {
		if (vis.width() < 500) return 12;
		else if (vis.width() < 700) return 12;
		else return 12;
	},
	axes: {
		x: {
			generic_html: '<var>x</var>',
			data_name: undefined,
			data_type: 'linear',
			data_trans: { rescale: 'linear', rezero: 0, divisor: 0,  absval: false },
			scale: undefined,
			type: 'linear',
			min: undefined,
			max: undefined,
			color: 'Black',
		},
		y: {
			generic_html: '<var>y</var>',
			data_name: undefined,
			data_type: 'linear',
			data_trans: { rescale: 'linear', rezero: 0, divisor: 0,  absval: false },
			scale: undefined,
			type: 'linear',
			min: undefined,
			max: undefined,
			color: '#1f77b4', // Tableau10 blue (first color)
		},
		yOther: {
			generic_html: 'other <var>y</var>',
			data_name: undefined,
			data_type: 'linear',
			data_trans: { rescale: 'linear', rezero: 0, divisor: 0,  absval: false },
			scale: undefined,
			type: 'linear',
			min: undefined,
			max: undefined,
			color: '#ff7f0e', // Tableau10 orange (second color)
		},
	},
	// minimum and maximum data coordinates to display on plot
	// TODO: make automatic margins work with logarithmic data/axes
	// also add some padding to make sure tick labels don't get clipped
	// Get combined data from all series for extent calculations
	get_all_data: () => {
		if (!vis.series || vis.series.length === 0) {
			// Fallback: return all file data if series aren't available yet
			if (vis.files && vis.files.length > 0) {
				return vis.files.flatMap(file => file.data ? file.data.bulk : []);
			}
			return [];
		}
		return vis.series.flatMap(series => series.data);
	},
	width_data: axis => {
		const values = vis.get_axis_data_values(axis);
		if (values.length === 0) return 1;
		
		const max = vis.axes[axis].max || d3.max(values);
		const min = vis.axes[axis].min || d3.min(values);
		return max - min;
	},
	width_log_data: axis => {
		const values = vis.get_axis_data_values(axis);
		if (values.length === 0) return 1;
		
		const max = vis.axes[axis].max || d3.max(values);
		const min = vis.axes[axis].min || d3.min(values);
		return safe_log(max) - safe_log(min);
	},
	get_axis_data_values: axis => {
		// Collect all data values for a specific axis from all relevant series
		const values = [];
		
		if (axis === 'x') {
			// X-axis: use traditional accessor if data_name is set
			if (vis.axes[axis].data_name) {
				const allData = vis.get_all_data();
				values.push(...allData.map(vis.accessor(axis)));
			}
		} else {
			// Y-axes: collect from series definitions and their corresponding data
			const seriesDefinitions = vis.series_definitions && vis.series_definitions[axis] ? vis.series_definitions[axis] : [];
			const validSeriesDefinitions = seriesDefinitions.filter(def => def.column);
			
			validSeriesDefinitions.forEach(seriesDef => {
				// Collect data from all files for this series definition
				vis.files.forEach(file => {
					if (file.data && file.data.bulk && seriesDef.column) {
						const columnData = file.data.bulk.map(row => row[seriesDef.column]);
						// Apply data transformations (similar to series_accessor logic)
						const transformedData = columnData.map(val => {
							if (val === null || val === undefined) return NaN;
							let transformedVal = parseFloat(val);
							
							// Apply transformations based on axis settings
							const axisControls = vis.axes[axis];
							
							// Apply data transformations
							switch (axisControls.data_trans.rescale) {
								case 'log':
									transformedVal = safe_log(transformedVal);
									break;
								case 'logabs':
									transformedVal = safe_log(Math.abs(transformedVal));
									break;
								case 'exp':
									transformedVal = Math.pow(10, transformedVal);
									break;
								default:
									// linear - no change
									break;
							}
							
							// Apply re-zeroing
							transformedVal -= axisControls.data_trans.rezero;
							
							// Apply modulo
							if (axisControls.data_trans.divisor != 0) {
								transformedVal = transformedVal % axisControls.data_trans.divisor;
							}
							
							// Apply absolute value
							if (axisControls.data_trans.absval) {
								transformedVal = Math.abs(transformedVal);
							}
							
							return transformedVal;
						});
						values.push(...transformedData);
					}
				});
			});
		}
		
		return values.filter(v => !isNaN(v) && isFinite(v));
	},
	
	min_data: axis => {
		if (vis.axes[axis].min) {
			return vis.axes[axis].min;
		}
		
		const values = vis.get_axis_data_values(axis);
		if (values.length === 0) return 0;
		
		const min_val = d3.min(values);
		const max_val = d3.max(values);
		const range = max_val - min_val;
		
		if (vis.axes[axis].type == 'log') {
			const log_min = safe_log(min_val);
			const log_max = safe_log(max_val);
			const log_range = log_max - log_min;
			return Math.pow(10, log_min - 0.05 * log_range);
		} else {
			return min_val - 0.05 * range;
		}
	},
	
	max_data: axis => {
		if (vis.axes[axis].max) {
			return vis.axes[axis].max;
		}
		
		const values = vis.get_axis_data_values(axis);
		if (values.length === 0) return 1;
		
		const min_val = d3.min(values);
		const max_val = d3.max(values);
		const range = max_val - min_val;
		
		if (vis.axes[axis].type == 'log') {
			const log_min = safe_log(min_val);
			const log_max = safe_log(max_val);
			const log_range = log_max - log_min;
			return Math.pow(10, log_max + 0.05 * log_range);
		} else {
			return max_val + 0.05 * range;
		}
	},

	// Placeholders for known column names (useful for forcing quantities to be
	// interpreted as logarithmic
	known_history_names: {},
	known_profile_names: {},
	// functions that generates accessor functions based on the desired data
	// transformation properties. Order of transformations should be thought
	// through more thoroughly. *MUST* be a function that returns a function
	// since transformation properties can and will change after instantiation.

	// Order is
	//   1. rescale: linear (do nothing) log, log(abs), or exponentiate
	//   2. rezero (defaults to doing nothing)
	//   3. take absolute values (optional)
	//   4. normalize (optional)

	// Actually, we don't even do the normalization here, since that would
	// require knowing the maximum value, and these functions only process
	// one datum at a time. Instead, we'll rescale the axis object appropriately
	accessor: axis => {
		let rescale;
		let rezero;
		let modulo;
		let do_abs;
		rescale = d => {
			switch (vis.axes[axis].data_trans.rescale) {
				case 'log':
					return safe_log(d[vis.axes[axis].data_name]);
				case 'logabs':
					return safe_log(Math.abs(d[vis.axes[axis].data_name]));
				case 'exp':
					return Math.pow(10, d[vis.axes[axis].data_name]);
				default:
					return d[vis.axes[axis].data_name];
			}
		};
		rezero = val => val - vis.axes[axis].data_trans.rezero;
		modulo = val => val
		if (vis.axes[axis].data_trans.divisor != 0) {
			modulo = val => val % vis.axes[axis].data_trans.divisor
		}
		do_abs = val => (vis.axes[axis].data_trans.absval ? Math.abs(val) : val);
		return d => do_abs(modulo(rezero(rescale(d))));
	},
	
	// Series-specific accessor that uses the series' own column definitions
	series_accessor: (series, axisType) => {
		const columnName = axisType === 'x' ? series.data_columns.x : series.data_columns.y;
		const axis = axisType === 'x' ? 'x' : series.target_axis;
		
		if (!columnName) {
			return d => 0; // Return default value if no column specified
		}
		
		let rescale;
		let rezero;
		let modulo;
		let do_abs;
		rescale = d => {
			switch (vis.axes[axis].data_trans.rescale) {
				case 'log':
					return safe_log(d[columnName]);
				case 'logabs':
					return safe_log(Math.abs(d[columnName]));
				case 'exp':
					return Math.pow(10, d[columnName]);
				default:
					return d[columnName];
			}
		};
		rezero = val => val - vis.axes[axis].data_trans.rezero;
		modulo = val => val
		if (vis.axes[axis].data_trans.divisor != 0) {
			modulo = val => val % vis.axes[axis].data_trans.divisor
		}
		do_abs = val => (vis.axes[axis].data_trans.absval ? Math.abs(val) : val);
		return d => do_abs(modulo(rezero(rescale(d))));
	},
	// Inverse accessor function. Given an axis, this generates returns a function
	// that maps pixel coordinates on that axis back to data coordinates. This is
	// useful for things like mouseover events, where we want to know the data
	// value at a particular pixel location.
	inverse_accessor: axis => {
		return coord => vis.axes[axis].scale.invert(coord);
	},
	// Stylistic choices; how much padding there is from the outside of the plot
	// area to the axis lines. This depends on the width of the window
	tick_padding: {
		x: {
			xs: 40,
			sm: 35,
			md: 40,
			lg: 40,
			xl: 50,
			xxl: 60,
		},
		y: {
			xs: 60,
			sm: 50,
			md: 60,
			lg: 60,
			xl: 70,
			xxl: 90,
		},
	},
	// Helper functions to check if there are series for each axis
	has_y_series: () => {
		return vis.series_definitions && vis.series_definitions.y && 
			vis.series_definitions.y.some(def => def.column);
	},
	has_yOther_series: () => {
		return vis.series_definitions && vis.series_definitions.yOther && 
			vis.series_definitions.yOther.some(def => def.column) && 
			!d3.select('#yOther-data').classed('d-none');
	},
	// pixel coordinates for left/bottom of data
	min_display: axis => {
		if (axis == 'x') {
			if (vis.has_y_series()) {
				return vis.tick_padding.y[vis.saved_bootstrap_size];
			} else {
				return 10;
			}
		} else {
			return vis.height() - vis.tick_padding.x[vis.saved_bootstrap_size];
		}
	},
	// pixel coordinates for right/top of data
	max_display: axis => {
		if (axis == 'x') {
			if (vis.has_yOther_series()) {
				return vis.width() - vis.tick_padding.y[vis.saved_bootstrap_size];
			} else {
				return vis.width() - 10;
			}
		} else {
			return 10;
		}
	},
	register_new_files: () => {
		vis.files = file_manager.active_files;

		if (vis.files.length === 0) {
			vis.clear_plot();
			vis.show_right_axis_controls(true); // Show controls when no files
			return;
		}

		// Determine if we should show right axis controls (only for single file)
		const isMultiFile = vis.files.length > 1;
		vis.show_right_axis_controls(!isMultiFile);

		// Find intersection of column names across all selected files
		vis.pause = true;
		const allColumnNames = vis.files.map(f => f.data.bulk_names.map(elt => elt.key));
		const commonColumns = allColumnNames.length > 0 ? 
			allColumnNames.reduce((a, b) => a.filter(c => b.includes(c))) : [];
		
		let refresh_plot = true;
		Object.keys(vis.axes).forEach(axis => {
			// For multi-file mode, also reset yOther axis even if columns exist
			if (!commonColumns.includes(vis.axes[axis].data_name) || (isMultiFile && axis === 'yOther')) {
				// Reset axis if current column is not available in all files or if hiding yOther
				if (!(isMultiFile && axis === 'yOther')) {
					// Don't reset yOther data in multi-file mode - preserve the state
					vis.axes[axis].data_name = undefined;
					d3.select(`#${axis}-label`).html(`Select ${vis.axes[axis].generic_html} quantity`);
					d3.select(`#${axis}-axis-label`).property('value', '');
					d3.select(`#${axis}-search`).property('value', '');
					d3.select(`#${axis}-choices`)
						.selectAll('a')
						.classed('d-none', false);
					// Reset axis limits
					if (axis == 'x') {
						d3.select(`#x-axis-left`).property('value', '');
						d3.select(`#x-axis-right`).property('value', '');
					} else {
						d3.select(`#${axis}-axis-bottom`).property('value', '');
						d3.select(`#${axis}-axis-top`).property('value', '');
					}
					vis.axes[axis].min = undefined;
					vis.axes[axis].max = undefined;
				}
				refresh_plot = false;
			}
		});

		// Create series data using multi-series model
		vis.series = [];
		
		// Process series definitions from UI
		['y', 'yOther'].forEach(axis => {
			// Skip yOther if controls are hidden (multi-file mode)
			if (axis === 'yOther' && d3.select('#yOther-data').classed('d-none')) {
				return;
			}
			
			const seriesDefinitions = vis.series_definitions[axis];
			if (seriesDefinitions && seriesDefinitions.length > 0) {
				seriesDefinitions.forEach((seriesDef, seriesIndex) => {
					if (seriesDef.column && commonColumns.includes(seriesDef.column)) {
						// Create series for each file
						vis.files.forEach((file, fileIndex) => {
							const series = vis.create_multi_series(file, fileIndex, axis, seriesDef, seriesIndex);
							if (series) vis.series.push(series);
						});
					}
				});
			}
		});
		
		// Auto-create initial series if none exist
		if (vis.series_definitions.y.length === 0 && vis.files.length > 0) {
			vis.add_series_ui('y');
		}
		// Only auto-create yOther series if it's not hidden
		if (vis.series_definitions.yOther.length === 0 && vis.files.length > 0 && !d3.select('#yOther-data').classed('d-none')) {
			vis.add_series_ui('yOther');
		}

		// Use first file's column structure for interface (since all have same columns due to intersection)
		vis.name_data = vis.files[0].data.bulk_names
			.filter(d => commonColumns.includes(d.key))
			.map(d => {
				let matches = vis.known_names().filter(dk => dk.key == d.key);
				if (matches.length > 0) {
					d.scale = matches[0].scale;
					d.html_name = matches[0].html_name;
					d.html_units = matches[0].html_units;
				}
				return d;
			});

		vis.pause = false;
		if (refresh_plot) {
			vis.update_plot();
		} else {
			vis.clear_plot();
		}

		// Refresh interface to reflect new data
		Object.keys(vis.axes).forEach(axis => vis.update_choices(axis));
		
		// Update series dropdown choices
		['y', 'yOther'].forEach(axis => {
			vis.series_definitions[axis].forEach((seriesDef, index) => {
				const seriesId = `${axis}-series-${index}`;
				vis.update_series_choices(seriesId);
			});
		});
		
		vis.update_plot();
		style_manager.update_style_panel();
	},
	// Show or hide right y-axis controls and manage axis colors
	show_right_axis_controls: (show) => {
		const yOtherElements = [
			'#yOther-data',
			'#yOther-detail', 
			'#yOther-detail-pane'
		];
		
		yOtherElements.forEach(selector => {
			const element = d3.select(selector);
			if (show) {
				element.classed('d-none', false);
			} else {
				element.classed('d-none', true);
			}
		});
		
		// Update axis colors based on mode
		if (show) {
			// Single file mode: restore original colors using current color scheme
			const currentColors = style_manager.styles.color_schemes[style_manager.styles.global.color_scheme];
			vis.axes.y.color = currentColors[0]; // first color (blue in tableau10)
			vis.axes.yOther.color = currentColors[1]; // second color (orange in tableau10)
		} else {
			// Multi-file mode: neutral color for y-axis
			vis.axes.y.color = vis.axes.x.color; // same as x-axis (black)
		}
		
		// Force plot refresh to update axis colors
		if (!vis.pause) {
			vis.update_plot();
		}
	},
	// helper function for grabbing the relevant "known" column name data
	known_names: () => {
		if (vis.files && vis.files.length > 0) {
			const fileType = vis.files[0].type; // All files have same type due to constraints
			if (fileType == 'history') {
				return vis.known_history_names;
			} else if (fileType == 'profile') {
				return vis.known_profile_names;
			}
		}
		return [];
	},
	// Update  column selector dropdown menu
	update_choices: axis => {
		// Clear out existing choices and build from scratch
		// Could make this smarter and detect [lack of] changes in refresh
		// step, but this works for now.
		d3.select(`#${axis}-choices`)
			.selectAll('a')
			.remove();

		// Bind lis to available name data in file, which should be pre-merged
		// with the known values. Set up pretty formatting and click handler, too.
		d3.select(`#${axis}-choices`)
			.selectAll('a')
			.data(vis.name_data)
			.enter()
			.append('a')
			.attr('class', 'dropdown-item')
			.attr('data-name', d => d.key)
			.attr('href', 'javascript: void(0)')
			.html(d => {
				let res = `<samp>${d.key}</samp>`;
				// Used to do fancy stuff with interpreting name and styling it. Lots
				// of work to create this data, and we can't even use html in the svg
				// pane, so skip it for now.
				// if (d.html_name) {
				//   res = d.html_name;
				//   if (d.scale == 'log') {
				//     res = `log ${res}`;
				//   }
				//   if (d.html_units) {
				//     res = `${res} <small class="text-muted">(${d.html_units})</span>`;
				//   }
				// }
				return res;
			})
			.on('click', function(event) {
				event.preventDefault();
				// set the column name and column scale in the data
				let option = d3.select(this);
				d3.select(`#${axis}-choices`)
					.selectAll('.active')
					.classed('active', false);
				option.classed('active', true);
				vis.axes[axis].data_name = option.attr('data-name');
				vis.axes[axis].data_type = option.datum().scale;

				// Update interface: button label (remember what was clicked), default
				// axis label in text field,
				// scale radio buttons and main plot
				vis.pause = true;
				d3.select(`#${axis}-label`).html(option.html());
				d3.select(`#${axis}-axis-label`).property(
					'value',
					option
						.text()
						.replace('log', '')
						.replace('_', ' ')
				);
				// Set scale to correspond with reported data type (log/linear)
				const selector = `#${axis}-scale-${option.datum().scale}`;
				document.querySelector(selector).click();
				// Exponentiate logarithmic data, but preserve linear data
				if (option.datum().scale == 'log') {
					document.querySelector(`#${axis}-data-trans-exp`).click();
				} else {
					document.querySelector(`#${axis}-data-trans-linear`).click();
				}
				vis.pause = false;
				// Recreate series with new axis data, then update plot
				vis.register_new_files();
				return false;
			});
	},
	make_scale: axis => {
		// set up right scaling
		let shouldCreateScale = false;
		
		if (axis === 'x') {
			// X-axis: use traditional data_name approach
			shouldCreateScale = vis.axes[axis].data_name;
		} else {
			// Y-axes: check if any series definitions exist for this axis (not just actual series)
			const seriesDefinitions = vis.series_definitions && vis.series_definitions[axis] ? vis.series_definitions[axis] : [];
			const validSeriesDefinitions = seriesDefinitions.filter(def => def.column);
			shouldCreateScale = validSeriesDefinitions.length > 0;
		}
		
		if (shouldCreateScale) {
			if (vis.axes[axis].type == 'log') {
				vis.axes[axis].scale = d3.scaleLog();
			} else {
				vis.axes[axis].scale = d3.scaleLinear();
			}
			// now set domain and range using helper functions
			vis.axes[axis].scale.domain([vis.min_data(axis), vis.max_data(axis)]).range([vis.min_display(axis), vis.max_display(axis)]);
		}
	},
	make_scales: () => {
		Object.keys(vis.axes).forEach(axis => {
			// Skip yOther if controls are hidden (multi-file mode)
			if (axis === 'yOther' && d3.select('#yOther-data').classed('d-none')) {
				return;
			}
			vis.make_scale(axis);
		});
	},

	make_clipPath: () => {
		vis.svg
			.append('clipPath')
			.attr('id', 'clip') // <-- we need to use the ID of clipPath
			.append('rect')
			.attr('width', vis.max_display('x') - vis.min_display('x'))
			.attr('height', Math.abs(vis.max_display('y') - vis.min_display('y')))
			.attr('fill', 'blue')
			.attr('transform', `translate(${vis.min_display('x')},${vis.max_display('y')})`);
	},
	reduced_data: yAxis => {
		// For backward compatibility, use first series if available
		if (vis.series && vis.series.length > 0) {
			return vis.reduced_data_for_series(yAxis, vis.series[0]);
		}
		return [];
	},
	reduced_data_for_series: (yAxis, series) => {
		const x_min = vis.min_data('x');
		const x_max = vis.max_data('x');
		const y_min = vis.min_data(yAxis);
		const y_max = vis.max_data(yAxis);

		return series.data.filter((d, i) => {
			const x = vis.series_accessor(series, 'x')(d);
			const y = vis.series_accessor(series, 'y')(d);
			let res = i % vis.marker_interval[yAxis] == 0;
			res = res && x >= x_min && x <= x_max;
			res = res && y >= y_min && y <= y_max;
			return res;
		});
	},
	plot_data_scatter: yAxis => {
		if (vis.series) {
			// Filter series to only those targeting this axis
			const axisSpecificSeries = vis.series.filter(s => s.target_axis === yAxis);
			axisSpecificSeries.forEach((series, seriesIndex) => {
				if (!series.style.show_markers) return;
				
				const reducedData = vis.reduced_data_for_series(yAxis, series);
				const symbol = d3.symbol()
					.type(style_manager.styles.marker_shapes[series.style.marker_shape])
					.size(Math.pow(series.style.marker_size, 2));
				
				vis.svg
					.selectAll(`path.marker-${yAxis}-series-${seriesIndex}`)
					.data(reducedData)
					.enter()
					.append('path')
					.classed(`marker-${yAxis} series-${seriesIndex}`, true)
					.attr('d', symbol)
					.attr('transform', d => `translate(${vis.axes.x.scale(vis.series_accessor(series, 'x')(d))}, ${vis.axes[yAxis].scale(vis.series_accessor(series, 'y')(d))})`)
					.attr('fill', series.style.color)
					.attr('opacity', series.style.opacity);
			});
		}
	},
	plot_data_line: yAxis => {
		if (vis.series) {
			// Filter series to only those targeting this axis
			const axisSpecificSeries = vis.series.filter(s => s.target_axis === yAxis);
			axisSpecificSeries.forEach((series, seriesIndex) => {
				if (!series.style.show_line) return;
				
				const x = vis.series_accessor(series, 'x');
				const y = vis.series_accessor(series, 'y');
				const line_maker = d3
					.line()
					.x(d => vis.axes.x.scale(x(d)))
					.y(d => vis.axes[yAxis].scale(y(d)));
				
				vis.svg
					.append('g')
					.classed(`line-series-${seriesIndex}`, true)
					.append('path')
					.attr('fill', 'none')
					.attr('d', line_maker(series.data))
					.attr('stroke', series.style.color)
					.attr('stroke-width', series.style.line_width)
					.attr('stroke-dasharray', style_manager.styles.line_styles[series.style.line_style])
					.attr('opacity', series.style.opacity)
					.attr('clip-path', 'url(#clip)');
			});
		}
	},
	add_axes: (force_light = false) => {
		// axes themselves (spines, ticks, tick labels)
		
		// X-axis
		if (vis.axes.x.data_name && vis.axes.x.scale) {
			vis.svg
				.append('g')
				.call(d3.axisTop(vis.axes.x.scale).tickSizeOuter(0))
				.attr('transform', `translate(0,${vis.min_display('y')})`)
				.selectAll('text')
				.attr('text-anchor', 'top')
				.attr('dominant-baseline', 'hanging')
				.attr('font-size', style_manager.styles.global.font_size)
				.attr('transform', `translate(0, ${vis.tick_offset() + 2})`);
			vis.svg
				.append('g')
				.call(d3.axisBottom(vis.axes.x.scale).tickSizeOuter(0))
				.attr('transform', `translate(0,${vis.max_display('y')})`)
				.selectAll('text')
				.remove();
		}
		
		// Left Y-axis (y)
		const hasYSeries = vis.has_y_series();
		if (hasYSeries && vis.axes.y.scale) {
			vis.svg
				.append('g')
				.call(d3.axisRight(vis.axes.y.scale).tickSizeOuter(0))
				.attr('transform', `translate(${vis.tick_padding.y[vis.saved_bootstrap_size]},0)`)
				.selectAll('text')
				.attr('text-anchor', 'end')
				.attr('font-size', style_manager.styles.global.font_size)
				.attr('transform', `translate(-${vis.tick_offset()}, 0)`);
		}
		
		// Right Y-axis (yOther)
		const hasYOtherSeries = vis.has_yOther_series();
		if (hasYOtherSeries && vis.axes.yOther.scale) {
			vis.svg
				.append('g')
				.call(d3.axisLeft(vis.axes.yOther.scale).tickSizeOuter(0))
				.attr('transform', `translate(${vis.width() - vis.tick_padding.y[vis.saved_bootstrap_size]},0)`)
				.selectAll('text')
				.attr('text-anchor', 'start')
				.attr('font-size', style_manager.styles.global.font_size)
				.attr('transform', `translate(${vis.tick_offset()}, 0)`);
		} else if (hasYSeries && vis.axes.y.scale) {
			// If only left y-axis has data, draw right spine with no labels
			vis.svg
				.append('g')
				.call(d3.axisLeft(vis.axes.y.scale).tickSizeOuter(0))
				.attr('transform', `translate(${vis.max_display('x')},0)`)
				.selectAll('text')
				.remove();
		}

		// add or update axis labels
		if (vis.have_axis_labels) {
			vis.update_axis_labels(force_light);
		} else {
			vis.add_axis_labels(force_light);
		}
	},
	add_axis_labels: (force_light = false) => {
		if (!force_light && document.documentElement.getAttribute('data-bs-theme') == 'dark') {
			vis.axes.x.color = 'rgb(223,226,230)';
		} else {
			vis.axes.x.color = 'Black';
		}
		if (vis.axes.x.data_name) {
			const label = vis.svg
				.append('text')
				.attr('transform', `translate(${vis.min_display('x') + 0.5 * (vis.max_display('x') - vis.min_display('x'))}, ${vis.height() - 10})`)
				.attr('dominant-baseline', 'bottom')
				.attr('text-anchor', 'middle')
				.attr('id', 'svg-x-label')
				.attr('font-family', 'sans-serif')
				.attr('fill', vis.axes.x.color)
				.attr('font-size', style_manager.styles.global.font_size)
				.text(d3.select('#x-axis-label').property('value'));
		}
		if (vis.has_y_series()) {
			vis.svg
				.append('text')
				.attr('transform', `translate(5, ${vis.max_display('y') + 0.5 * (vis.min_display('y') - vis.max_display('y'))}) rotate(-90)`)
				.attr('dominant-baseline', 'hanging')
				.attr('text-anchor', 'middle')
				.attr('id', 'svg-y-label')
				.attr('fill', vis.axes.y.color)
				.attr('font-family', 'sans-serif')
				.attr('font-size', style_manager.styles.global.font_size)
				.text(d3.select('#y-axis-label').property('value'));
		}
		if (vis.has_yOther_series()) {
			vis.svg
				.append('text')
				.attr('transform', `translate(${vis.width() - 5}, ${vis.max_display('yOther') + 0.5 * (vis.min_display('yOther') - vis.max_display('yOther'))}) rotate(90)`)
				.attr('dominant-baseline', 'hanging')
				.attr('text-anchor', 'middle')
				.attr('id', 'svg-yOther-label')
				.attr('fill', vis.axes.yOther.color)
				.attr('font-family', 'sans-serif')
				.attr('font-size', style_manager.styles.global.font_size)
				.text(d3.select('#yOther-axis-label').property('value'));
		}
		vis.have_axis_labels = true;
	},
	// Set axis labels to be whatever is in the input field that controls them.
	// Perhaps this should live in the data model, but it works quite well.
	update_axis_labels: () => {
		// Update x-axis label if it exists
		const xLabel = d3.select('#svg-x-label');
		if (!xLabel.empty()) {
			xLabel.text(d3.select('#x-axis-label').property('value'));
		}
		
		// Update y-axis label if it exists
		const yLabel = d3.select('#svg-y-label');
		if (!yLabel.empty()) {
			yLabel.text(d3.select('#y-axis-label').property('value'));
		}
		
		// Update yOther-axis label if it exists
		const yOtherLabel = d3.select('#svg-yOther-label');
		if (!yOtherLabel.empty()) {
			yOtherLabel.text(d3.select('#yOther-axis-label').property('value'));
		}
	},
	add_legend: () => {
		if (!vis.series || vis.series.length <= 1) return; // No legend needed for single series
		
		const legendData = vis.series.map(series => ({
			name: series.name,
			color: series.color
		}));
		
		// Position legend in top-right corner of plot area
		const lineHeight = 18;
		const legendWidth = 150;
		const legendHeight = legendData.length * lineHeight + 10;
		// Legend rectangle extends leftward from anchor, so anchor should be at right edge
		const legendX = vis.max_display('x');
		// Legend rectangle extends downward from anchor-5, so anchor should account for that
		const legendY = vis.max_display('y') + 5;
		
		const legend = vis.svg.append('g')
			.attr('id', 'legend')
			.attr('transform', `translate(${legendX}, ${legendY})`)
			.style('cursor', 'move');
		
		// Add background rectangle
		legend.append('rect')
			.attr('x', -legendWidth)
			.attr('y', -5)
			.attr('width', legendWidth)
			.attr('height', legendHeight)
			.attr('fill', vis.axes.x.color == 'Black' ? 'white' : 'rgb(34,37,41)')
			.attr('stroke', vis.axes.x.color == 'Black' ? 'black' : 'rgb(223,226,230)')
			.attr('stroke-width', 1)
			.attr('rx', 5);
		
		// Add drag behavior
		const drag = d3.drag()
			.on('start', function() {
				d3.select(this).style('cursor', 'grabbing');
			})
			.on('drag', function(event) {
				// Get current transform
				const currentTransform = d3.select(this).attr('transform');
				const translate = currentTransform.match(/translate\(([^,]+),([^)]+)\)/);
				if (!translate) return;
				
				let currentX = parseFloat(translate[1]);
				let currentY = parseFloat(translate[2]);
				
				// Apply drag delta
				const newX = currentX + event.dx;
				const newY = currentY + event.dy;
				
				// Constrain to plot bounds (within the spine rectangle)
				// Legend rectangle extends from (x-legendWidth, y-5) to (x, y+legendHeight-5)
				const minX = vis.min_display('x') + legendWidth; // Left edge doesn't go past left spine
				const maxX = vis.max_display('x'); // Right edge doesn't go past right spine
				const minY = vis.max_display('y') + 5; // Top edge doesn't go past top spine
				const maxY = vis.min_display('y') - legendHeight + 5; // Bottom edge doesn't go past bottom spine
				
				const constrainedX = Math.max(minX, Math.min(maxX, newX));
				const constrainedY = Math.max(minY, Math.min(maxY, newY));
				
				d3.select(this).attr('transform', `translate(${constrainedX}, ${constrainedY})`);
			})
			.on('end', function() {
				d3.select(this).style('cursor', 'move');
			});
		
		legend.call(drag);
		
		// Add legend entries
		const entries = legend.selectAll('.legend-entry')
			.data(legendData)
			.enter()
			.append('g')
			.attr('class', 'legend-entry')
			.attr('transform', (d, i) => `translate(-${legendWidth - 15}, ${i * lineHeight + 10})`);
		
		// Add colored lines
		entries.append('line')
			.attr('x1', 0)
			.attr('x2', 20)
			.attr('y1', 0)
			.attr('y2', 0)
			.attr('stroke', d => d.color)
			.attr('stroke-width', 2);
		
		// Add text labels
		entries.append('text')
			.attr('x', 25)
			.attr('y', 0)
			.attr('dy', '0.35em')
			.attr('fill', vis.axes.x.color)
			.attr('font-family', 'sans-serif')
			.attr('font-size', Math.max(8, style_manager.styles.global.font_size - 2))
			.text(d => d.name);
	},
	clear_plot: () => {
		vis.svg.selectAll('*').remove();
		vis.have_axis_labels = false;
	},
	update_plot: (force_light = false) => {
		if (vis.pause) {
			return;
		}
		vis.clear_plot();
		
		// Check if we have any valid axes to display
		const hasXAxis = vis.axes.x.data_name;
		const hasYAxis = vis.series_definitions && vis.series_definitions.y && 
			vis.series_definitions.y.some(def => def.column);
		const hasYOtherAxis = vis.series_definitions && vis.series_definitions.yOther && 
			vis.series_definitions.yOther.some(def => def.column) && 
			!d3.select('#yOther-data').classed('d-none');
			
		// Display plot if we have x-axis and at least one y-axis
		if (hasXAxis && (hasYAxis || hasYOtherAxis)) {
			vis.make_scales();
			vis.make_clipPath();
			
			// Plot data for each y-axis that has series
			['y', 'yOther'].forEach(yAxis => {
				// Skip yOther if controls are hidden (multi-file mode)
				if (yAxis === 'yOther' && d3.select('#yOther-data').classed('d-none')) {
					return;
				}
				// Check if there are any series for this axis
				const axisSpecificSeries = vis.series ? vis.series.filter(s => s.target_axis === yAxis) : [];
				if (axisSpecificSeries.length > 0) {
					vis.plot_data_line(yAxis);
					vis.plot_data_scatter(yAxis);
				}
			});

			vis.add_axes(force_light);
			vis.add_legend();
		}
		// Always show x-axis if it's set, even without y-data
		else if (hasXAxis) {
			vis.make_scales();
			vis.add_axes(force_light);
		}
		
		// Sync mini plot if visible
		if (typeof sync_mini_plot === 'function') {
			// Small delay to ensure DOM is updated
			setTimeout(sync_mini_plot, 50);
		}
	},
};

// Downloads an SVG on the webpage, accessed by its class name
// @param {String} svgClassName -- name of the SVG class (e.g. "amazingSVG")
function downloadSVG(svgIDName) {
	var doctype = '<?xml version="1.0" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">';

	window.URL = window.URL || window.webkitURL;

	var body = document.body;

	var prefix = {
		xmlns: 'http://www.w3.org/2000/xmlns/',
		xlink: 'http://www.w3.org/1999/xlink',
		svg: 'http://www.w3.org/2000/svg',
	};

	initialize();

	function initialize() {
		var documents = [window.document],
			SVGSources = [];
		(iframes = document.querySelectorAll('iframe')), (objects = document.querySelectorAll('object'));

		[].forEach.call(iframes, function(el) {
			try {
				if (el.contentDocument) {
					documents.push(el.contentDocument);
				}
			} catch (err) {
				console.log(err);
			}
		});

		[].forEach.call(objects, function(el) {
			try {
				if (el.contentDocument) {
					documents.push(el.contentDocument);
				}
			} catch (err) {
				console.log(err);
			}
		});

		documents.forEach(function(doc) {
			var newSources = getSources(doc);
			// because of prototype on NYT pages
			for (var i = 0; i < newSources.length; i++) {
				SVGSources.push(newSources[i]);
			}
		});
		if (SVGSources.length > 1) {
			console.log('too many options!');
		} else if (SVGSources.length > 0) {
			download(SVGSources[0]);
		} else {
			alert('The Crowbar couldnâ€™t find any SVG nodes.');
		}
	}

	function cleanup() {
		var crowbarElements = document.querySelectorAll('.svg-crowbar');

		[].forEach.call(crowbarElements, function(el) {
			el.parentNode.removeChild(el);
		});
	}

	function getSources(doc) {
		var svgInfo = [],
			svg = doc.querySelector('#' + svgIDName);

		svg.setAttribute('version', '1.1');

		var defsEl = document.createElement('defs');
		svg.insertBefore(defsEl, svg.firstChild); //TODO   .insert("defs", ":first-child")
		// defsEl.setAttribute("class", "svg-crowbar");

		// removing attributes so they aren't doubled up
		svg.removeAttribute('xmlns');
		svg.removeAttribute('xlink');

		// These are needed for the svg
		if (!svg.hasAttributeNS(prefix.xmlns, 'xmlns')) {
			svg.setAttributeNS(prefix.xmlns, 'xmlns', prefix.svg);
		}

		if (!svg.hasAttributeNS(prefix.xmlns, 'xmlns:xlink')) {
			svg.setAttributeNS(prefix.xmlns, 'xmlns:xlink', prefix.xlink);
		}

		var source = new XMLSerializer().serializeToString(svg);
		var rect = svg.getBoundingClientRect();
		svgInfo.push({
			top: rect.top,
			left: rect.left,
			width: vis.width(),
			height: vis.height(),
			class: svg.getAttribute('class'),
			id: svg.getAttribute('id'),
			childElementCount: svg.childElementCount,
			source: [doctype + source],
		});

		return svgInfo;
	}

	function download(source) {
		var filename = 'untitled';

		if (source.id) {
			filename = source.id;
		} else if (source.class) {
			filename = source.class;
		} else if (window.document.title) {
			filename = window.document.title.replace(/[^a-z0-9]/gi, '-').toLowerCase();
		}

		var url = window.URL.createObjectURL(new Blob(source.source, { type: 'text/xml' }));

		var a = document.createElement('a');
		body.appendChild(a);
		a.setAttribute('class', 'svg-crowbar');
		a.setAttribute('download', filename + '.svg');
		a.setAttribute('href', url);
		a.style['display'] = 'none';
		a.click();

		setTimeout(function() {
			window.URL.revokeObjectURL(url);
		}, 10);
	}
}

