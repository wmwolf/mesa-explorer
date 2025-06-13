// Data Utilities - Data processing, transformations, and accessor functions
// Handles data extent calculations, transformations (log, abs, modulo, re-zeroing), and accessor generation

const data_utils = {
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
		const values = data_utils.get_axis_data_values(axis);
		if (values.length === 0) return 1;
		
		const max = vis.axes[axis].max || d3.max(values);
		const min = vis.axes[axis].min || d3.min(values);
		return max - min;
	},
	
	width_log_data: axis => {
		const values = data_utils.get_axis_data_values(axis);
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
				const allData = data_utils.get_all_data();
				values.push(...allData.map(data_utils.accessor(axis)));
			}
		} else {
			// Y-axes: collect from series definitions and their corresponding data
			const seriesDefinitions = series_manager.series_definitions && series_manager.series_definitions[axis] ? series_manager.series_definitions[axis] : [];
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
		
		const values = data_utils.get_axis_data_values(axis);
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
		
		const values = data_utils.get_axis_data_values(axis);
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

	// Functions that generate accessor functions based on the desired data
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
	
	// Data reduction for rendering - filters data based on current view and marker intervals
	reduced_data: yAxis => {
		// For backward compatibility, use first series if available
		if (vis.series && vis.series.length > 0) {
			return data_utils.reduced_data_for_series(yAxis, vis.series[0]);
		}
		return [];
	},
	
	reduced_data_for_series: (yAxis, series) => {
		const x_min = data_utils.min_data('x');
		const x_max = data_utils.max_data('x');
		const y_min = data_utils.min_data(yAxis);
		const y_max = data_utils.max_data(yAxis);

		return series.data.filter((d, i) => {
			const x = data_utils.series_accessor(series, 'x')(d);
			const y = data_utils.series_accessor(series, 'y')(d);
			let res = i % vis.marker_interval[yAxis] == 0;
			res = res && x >= x_min && x <= x_max;
			res = res && y >= y_min && y <= y_max;
			return res;
		});
	}
};