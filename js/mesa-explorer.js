
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

		// Initialize interaction manager
		interaction_manager.setup();
		
		// Initialize controls manager
		if (typeof controls_manager !== 'undefined') {
			controls_manager.setup();
		}
		
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
			inverted: false,
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
			inverted: false,
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
			inverted: false,
		},
	},
	// minimum and maximum data coordinates to display on plot
	// TODO: make automatic margins work with logarithmic data/axes
	// also add some padding to make sure tick labels don't get clipped
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
		return series_manager.series_definitions && series_manager.series_definitions.y && 
			series_manager.series_definitions.y.some(def => def.column);
	},
	has_yOther_series: () => {
		return series_manager.series_definitions && series_manager.series_definitions.yOther && 
			series_manager.series_definitions.yOther.some(def => def.column) && 
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
				// Reset axis if current column is not available in all files 
				// OR if switching to multi-file mode and this is yOther axis (hide it)
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
		const hadExistingSeries = vis.series && vis.series.length > 0;
		vis.series = [];
		
		// Only reset global color counter when files change or no existing series
		// Also reset when switching between single-file and multi-file modes
		const wasSingleFile = !d3.select('#yOther-data').classed('d-none'); // yOther visible = single file mode
		
		if (!hadExistingSeries || (isMultiFile === wasSingleFile)) { // mode changed
			style_manager.reset_global_color_counter();
		}
		
		// Process series definitions from UI
		['y', 'yOther'].forEach(axis => {
			// Skip yOther if controls are hidden (multi-file mode)
			if (axis === 'yOther' && d3.select('#yOther-data').classed('d-none')) {
				return;
			}
			
			const seriesDefinitions = series_manager.series_definitions[axis];
			if (seriesDefinitions && seriesDefinitions.length > 0) {
				seriesDefinitions.forEach((seriesDef, seriesIndex) => {
					if (seriesDef.column && commonColumns.includes(seriesDef.column)) {
						// Create series for each file
						vis.files.forEach((file, fileIndex) => {
							const series = series_manager.create_multi_series(file, fileIndex, axis, seriesDef, seriesIndex);
							if (series) vis.series.push(series);
						});
					}
				});
			}
		});
		
		// Auto-create initial series if none exist
		series_manager.ensure_initial_series();
		
		// Restore axis data_name from existing series definitions if needed
		// This ensures inspector tracking works after mode transitions
		['y', 'yOther'].forEach(axis => {
			const seriesDefinitions = series_manager.series_definitions[axis];
			if (seriesDefinitions && seriesDefinitions.length > 0 && seriesDefinitions[0].column) {
				// Restore data_name from first series if it's not already set
				if (!vis.axes[axis].data_name) {
					vis.axes[axis].data_name = seriesDefinitions[0].column;
					
					// Update axis label if it's empty
					const axisLabelInput = d3.select(`#${axis}-axis-label`);
					if (!axisLabelInput.empty() && !axisLabelInput.property('value').trim()) {
						const cleanedLabel = seriesDefinitions[0].column
							.replace(/^log[_\s]*/i, '')     // Remove "log_" or "log " prefix
							.replace(/^log(?=[A-Z])/i, '')  // Remove "log" before capitals
							.replace(/_/g, ' ');            // Replace underscores with spaces
						axisLabelInput.property('value', cleanedLabel);
					}
				}
			}
		});
		
		// Update axis label colors based on new series configuration
		style_manager.update_axis_label_colors();

		// Use first file's column structure for interface (since all have same columns due to intersection)
		vis.name_data = vis.files[0].data.bulk_names
			.filter(d => commonColumns.includes(d.key));

		vis.pause = false;
		if (refresh_plot) {
			vis.update_plot();
		} else {
			vis.clear_plot();
		}

		// Refresh interface to reflect new data
		Object.keys(vis.axes).forEach(axis => vis.update_choices(axis));
		
		// Update series dropdown choices
		series_manager.refresh_all_series_choices();
		
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
		
		// Update axis colors based on series configuration
		style_manager.update_axis_label_colors();
		
		// Force plot refresh to update axis colors
		if (!vis.pause) {
			vis.update_plot();
		}
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
						.replace(/^log[_\s]*/i, '')     // Remove "log_" or "log " prefix
						.replace(/^log(?=[A-Z])/i, '')  // Remove "log" before capitals  
						.replace(/_/g, ' ')             // Replace underscores with spaces
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

	// Axis inversion functions
	is_axis_inverted: axis => {
		// Check if axis is inverted by comparing min/max values
		// An axis is considered inverted if min > max (i.e., left > right for x-axis, or bottom > top for y-axis)
		const min_val = vis.axes[axis].min;
		const max_val = vis.axes[axis].max;
		
		// If explicit limits are set, check if min > max
		if (min_val !== undefined && max_val !== undefined && !isNaN(min_val) && !isNaN(max_val)) {
			return min_val > max_val;
		}
		
		// If no explicit limits, check the inverted flag
		return vis.axes[axis].inverted;
	},

	toggle_axis_inversion: axis => {
		const min_val = vis.axes[axis].min;
		const max_val = vis.axes[axis].max;
		
		// If explicit limits are set, swap them
		if (min_val !== undefined && max_val !== undefined && !isNaN(min_val) && !isNaN(max_val)) {
			vis.axes[axis].min = max_val;
			vis.axes[axis].max = min_val;
			
			// Update the UI input fields
			const minInput = d3.select(`#${axis}-axis-${axis === 'x' ? 'left' : 'bottom'}`);
			const maxInput = d3.select(`#${axis}-axis-${axis === 'x' ? 'right' : 'top'}`);
			minInput.property('value', max_val);
			maxInput.property('value', min_val);
		} else {
			// If no explicit bounds, toggle the inverted flag (affects auto-calculated bounds)
			vis.axes[axis].inverted = !vis.axes[axis].inverted;
		}
		
		// Update the inversion button state
		vis.update_inversion_button_state(axis);
		
		// Redraw the plot
		vis.update_plot();
	},

	update_inversion_button_state: axis => {
		const button = d3.select(`#${axis}-invert-button`);
		if (!button.empty()) {
			const isInverted = vis.is_axis_inverted(axis);
			button.classed('active', isInverted);
			
			// Update button appearance based on Bootstrap theme
			if (isInverted) {
				button.classed('btn-outline-secondary', false)
					  .classed('btn-secondary', true);
			} else {
				button.classed('btn-secondary', false)
					  .classed('btn-outline-secondary', true);
			}
		}
	},

	make_scale: axis => {
		// set up right scaling
		let shouldCreateScale = false;
		
		if (axis === 'x') {
			// X-axis: use traditional data_name approach
			shouldCreateScale = vis.axes[axis].data_name;
		} else {
			// Y-axes: check if any series definitions exist for this axis (not just actual series)
			const seriesDefinitions = series_manager.series_definitions && series_manager.series_definitions[axis] ? series_manager.series_definitions[axis] : [];
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
			// For inverted axes, we need to handle the domain setting differently
			let min_domain, max_domain;
			
			// Get the actual data bounds (ignoring explicit limits for now)
			const explicit_min = vis.axes[axis].min;
			const explicit_max = vis.axes[axis].max;
			
			// Temporarily clear explicit limits to get auto-calculated bounds
			vis.axes[axis].min = undefined;
			vis.axes[axis].max = undefined;
			const auto_min = data_utils.min_data(axis);
			const auto_max = data_utils.max_data(axis);
			
			// Restore explicit limits
			vis.axes[axis].min = explicit_min;
			vis.axes[axis].max = explicit_max;
			
			// Determine the final domain bounds
			if (explicit_min !== undefined && !isNaN(explicit_min)) {
				min_domain = explicit_min;
			} else {
				min_domain = vis.axes[axis].inverted ? auto_max : auto_min;
			}
			
			if (explicit_max !== undefined && !isNaN(explicit_max)) {
				max_domain = explicit_max;
			} else {
				max_domain = vis.axes[axis].inverted ? auto_min : auto_max;
			}
			
			vis.axes[axis].scale.domain([min_domain, max_domain]).range([vis.min_display(axis), vis.max_display(axis)]);
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
	plot_data_scatter: yAxis => {
		if (vis.series) {
			// Filter series to only those targeting this axis
			const axisSpecificSeries = vis.series.filter(s => s.target_axis === yAxis);
			axisSpecificSeries.forEach((series, seriesIndex) => {
				if (!series.style.show_markers) return;
				
				const reducedData = data_utils.reduced_data_for_series(yAxis, series);
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
					.attr('transform', d => `translate(${vis.axes.x.scale(data_utils.series_accessor(series, 'x')(d))}, ${vis.axes[yAxis].scale(data_utils.series_accessor(series, 'y')(d))})`)
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
				
				const x = data_utils.series_accessor(series, 'x');
				const y = data_utils.series_accessor(series, 'y');
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
			// Create axis with custom formatting for log scales
			let xAxisTop = d3.axisTop(vis.axes.x.scale).tickSizeOuter(0);
			let xAxisBottom = d3.axisBottom(vis.axes.x.scale).tickSizeOuter(0);
			
			if (vis.axes.x.type === 'log') {
				// Custom formatter for major ticks only (powers of 10)
				const superscriptFormat = (d, i, ticks) => {
					const log10 = Math.log10(d);
					// Only format perfect powers of 10, let D3 handle others as empty
					if (Math.abs(log10 - Math.round(log10)) < 0.01) {
						const exponent = Math.round(log10);
						// Convert digits to superscript unicode characters
						const superscriptDigits = {
							'0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
							'5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
							'-': '⁻', '+': '⁺'
						};
						const superscriptExp = exponent.toString().split('').map(char => superscriptDigits[char] || char).join('');
						return `10${superscriptExp}`;
					}
					return ''; // No label for minor ticks
				};
				
				xAxisTop.tickFormat(superscriptFormat);
				xAxisBottom.tickFormat(superscriptFormat);
			}
			
			vis.svg
				.append('g')
				.call(xAxisTop)
				.attr('transform', `translate(0,${vis.min_display('y')})`)
				.selectAll('text')
				.attr('text-anchor', 'top')
				.attr('dominant-baseline', 'hanging')
				.attr('font-size', style_manager.styles.global.font_size)
				.attr('transform', `translate(0, ${vis.tick_offset() + 2})`);
			vis.svg
				.append('g')
				.call(xAxisBottom)
				.attr('transform', `translate(0,${vis.max_display('y')})`)
				.selectAll('text')
				.remove();
		}
		
		// Left Y-axis (y)
		const hasYSeries = vis.has_y_series();
		if (hasYSeries && vis.axes.y.scale) {
			// Create axis with custom formatting for log scales
			let yAxisLeft = d3.axisRight(vis.axes.y.scale).tickSizeOuter(0);
			
			if (vis.axes.y.type === 'log') {
				// Custom formatter for major ticks only (powers of 10)
				const superscriptFormat = (d, i, ticks) => {
					const log10 = Math.log10(d);
					// Only format perfect powers of 10, let D3 handle others as empty
					if (Math.abs(log10 - Math.round(log10)) < 0.01) {
						const exponent = Math.round(log10);
						// Convert digits to superscript unicode characters
						const superscriptDigits = {
							'0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
							'5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
							'-': '⁻', '+': '⁺'
						};
						const superscriptExp = exponent.toString().split('').map(char => superscriptDigits[char] || char).join('');
						return `10${superscriptExp}`;
					}
					return ''; // No label for minor ticks
				};
				
				yAxisLeft.tickFormat(superscriptFormat);
			}
			
			vis.svg
				.append('g')
				.call(yAxisLeft)
				.attr('transform', `translate(${vis.tick_padding.y[vis.saved_bootstrap_size]},0)`)
				.selectAll('text')
				.attr('text-anchor', 'end')
				.attr('font-size', style_manager.styles.global.font_size)
				.attr('transform', `translate(-${vis.tick_offset()}, 0)`);
		}
		
		// Right Y-axis (yOther)
		const hasYOtherSeries = vis.has_yOther_series();
		if (hasYOtherSeries && vis.axes.yOther.scale) {
			// Create axis with custom formatting for log scales
			let yAxisRight = d3.axisLeft(vis.axes.yOther.scale).tickSizeOuter(0);
			
			if (vis.axes.yOther.type === 'log') {
				// Custom formatter for major ticks only (powers of 10)
				const superscriptFormat = (d, i, ticks) => {
					const log10 = Math.log10(d);
					// Only format perfect powers of 10, let D3 handle others as empty
					if (Math.abs(log10 - Math.round(log10)) < 0.01) {
						const exponent = Math.round(log10);
						// Convert digits to superscript unicode characters
						const superscriptDigits = {
							'0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
							'5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
							'-': '⁻', '+': '⁺'
						};
						const superscriptExp = exponent.toString().split('').map(char => superscriptDigits[char] || char).join('');
						return `10${superscriptExp}`;
					}
					return ''; // No label for minor ticks
				};
				
				yAxisRight.tickFormat(superscriptFormat);
			}
			
			vis.svg
				.append('g')
				.call(yAxisRight)
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
		vis.axes.x.color = style_manager.get_theme_text_color(force_light);
		if (vis.axes.x.data_name) {
			const label = vis.svg
				.append('text')
				.attr('transform', `translate(${vis.min_display('x') + 0.5 * (vis.max_display('x') - vis.min_display('x'))}, ${vis.height() - 20})`)
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
		
		// Calculate legend dimensions based on content
		const fontSize = style_manager.styles.global.font_size;
		const lineHeight = fontSize + 6; // Add some padding between lines
		const leftPadding = 15; // Space before line starts
		const rightPadding = 15; // Space after text ends (matching left padding)
		const lineLength = 20;
		const lineToTextGap = 5; // Space between line end and text start
		const textStartX = lineLength + lineToTextGap; // Text position relative to line start
		
		// Calculate maximum text width to determine legend width
		const canvas = document.createElement('canvas');
		const context = canvas.getContext('2d');
		context.font = `${fontSize}px sans-serif`;
		
		const maxTextWidth = Math.max(...legendData.map(d => context.measureText(d.name).width));
		const legendWidth = leftPadding + lineLength + lineToTextGap + maxTextWidth + rightPadding;
		const legendHeight = legendData.length * lineHeight + 10;
		// Legend rectangle extends leftward from anchor, so anchor should be at right edge
		// Add 15px margin from right spine
		const legendX = vis.max_display('x') - 15;
		// Legend rectangle extends downward from anchor-5, so anchor should account for that
		// Add 15px margin from top spine
		const legendY = vis.max_display('y') + 5 + 15;
		
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
		
		// Add legend entries (positioned so line starts at leftPadding from left edge)
		const entries = legend.selectAll('.legend-entry')
			.data(legendData)
			.enter()
			.append('g')
			.attr('class', 'legend-entry')
			.attr('transform', (d, i) => `translate(${leftPadding - legendWidth}, ${i * lineHeight + 10})`);
		
		// Add colored lines
		entries.append('line')
			.attr('x1', 0)
			.attr('x2', lineLength)
			.attr('y1', 0)
			.attr('y2', 0)
			.attr('stroke', d => d.color)
			.attr('stroke-width', 2);
		
		// Add text labels
		entries.append('text')
			.attr('x', textStartX)
			.attr('y', 0)
			.attr('dy', '0.35em')
			.attr('fill', vis.axes.x.color)
			.attr('font-family', 'sans-serif')
			.attr('font-size', fontSize)
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
		
		// Update axis label colors to match current theme
		if (typeof style_manager !== 'undefined' && style_manager.update_axis_label_colors) {
			style_manager.update_axis_label_colors(force_light);
		}
		
		// Check if we have any valid axes to display
		const hasXAxis = vis.axes.x.data_name;
		const hasYAxis = series_manager.series_definitions && series_manager.series_definitions.y && 
			series_manager.series_definitions.y.some(def => def.column);
		const hasYOtherAxis = series_manager.series_definitions && series_manager.series_definitions.yOther && 
			series_manager.series_definitions.yOther.some(def => def.column) && 
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
		
		// Update inversion button states for all axes
		Object.keys(vis.axes).forEach(axis => {
			vis.update_inversion_button_state(axis);
		});
		
		// Sync mini plot if visible
		if (typeof sync_mini_plot === 'function') {
			// Small delay to ensure DOM is updated
			setTimeout(sync_mini_plot, 50);
		}
	},
};

// Initialize the application after all scripts are loaded
if (typeof window.initialize_application === 'function') {
	window.initialize_application().catch(error => {
		console.error('Failed to initialize Mesa Explorer:', error);
		// Show user-friendly error message
		document.body.innerHTML = `
			<div class="container mt-5">
				<div class="alert alert-danger" role="alert">
					<h4 class="alert-heading">Initialization Error</h4>
					<p>Mesa Explorer failed to initialize properly. Please refresh the page and try again.</p>
					<hr>
					<p class="mb-0">Check the browser console for technical details.</p>
				</div>
			</div>
		`;
	});
}

