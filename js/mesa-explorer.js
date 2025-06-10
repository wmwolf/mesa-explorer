// Helper functions
safe_log = val => {
	if (val <= 0) {
		return -99;
	} else {
		return Math.log10(val);
	}
};
// File manager object handles loading files, parsing data into javascript
// objects, rendering the files to the file picker.

// Right now, it also stores the current "active" file that is being plotted
// This will need to rethought if we want to allow multiple series to be
// plotted from multiple files. At that point, perhaps just exposing the
// list of available files to the vis pane in the form of
// dropdowns would work better
file_manager = {
	setup: () => {
		document.querySelector('#mesa-input').addEventListener('change', event => {
			file_manager.load_all_files(event.target);
		});
	},
	// Starts empty, but newest files are always added to the beginning when
	// the user selects a new file
	files: [],
	// Keeps track of how many files have been added, so each file can have a
	// unique id, even if they get deleted later.
	files_added: 0,
	// The files that should be read from to do any plotting (array for multi-selection)
	active_files: [],
	load_all_files: async function(input) {
		// grab all file data, but do not impact DOM
		Promise.all(
			[...input.files].map(file => {
				// let type = 'unknown';
				// if (file.name[0] == 'h') {
				// type = 'history';
				// } else if (file.name.slice(0, 7) == 'profile' && file.name.slice(file.name.length - 5, file.name.length) != 'index') {
				// type = 'profile';
				// }
				let file_obj = {
					name: file.name,
					local_name: file.name.replace(/\.[^/.]+$/, ""), // Remove extension for default local name
					selected: false,
					// type: type,
				};
				return file_manager.load_file(file, file_obj);
			})
		).then(new_files => {
			// once data from the files have been ingested into each file object,
			// save them to the global file manager object
			// merge new files into existing files
			file_manager.files = file_manager.files.concat(new_files);

			// order files appropriately (histories, then profiles, then gyre, and
			// then other junk)
			file_manager.files.sort((d1, d2) => {
				if (d1.type == 'history' && d2.type != 'history') {
					return -1;
				} else if (d1.type != 'history' && d2.type == 'history') {
					return 1;
				} else if (d1.type == 'profile' && d2.type != 'profile') {
					return -1;
				} else if (d1.type != 'profile' && d2.type == 'profile') {
					return 1;
				} else if (d1.type == 'profile' && d2.type == 'profile') {
					// sort profiles by increasing *model* number, not profile number
					return parseInt(d1.data.header.model_number) - parseInt(d2.data.header.model_number);
				} else if (d1.type == 'gyre' && d2.type != 'gyre') {
					return -1;
				} else if (d1.type != 'gyre' && d2.type == 'gyre') {
					return 1;
				} else {
					return d1.name < d2.name ? -1 : 1;
				}
			});

			// Remove any existing files from picker and rebuild with new multi-select structure
			d3.select('#file-list')
				.selectAll('.file-item')
				.remove();
			
			// Create file items with checkboxes and editable names
			const fileItems = d3
				.select('#file-list')
				.selectAll('.file-item')
				.data(file_manager.files)
				.enter()
				.append('div')
				.attr('class', f => {
					if (f.type == 'unknown') {
						return 'list-group-item file-item list-group-item-warning';
					} else {
						return 'list-group-item file-item';
					}
				});

			// Add checkbox for each file
			fileItems.append('input')
				.attr('type', 'checkbox')
				.attr('class', 'form-check-input me-2')
				.property('checked', f => f.selected)
				.property('disabled', f => f.type == 'unknown')
				.on('change', function(event, d) {
					d.selected = this.checked;
					file_manager.handle_file_selection(d);
				});

			// Add file type icon
			fileItems.append('i')
				.attr('class', file_manager.file_icon_class);

			// Add editable local name input
			fileItems.append('input')
				.attr('type', 'text')
				.attr('class', 'form-control form-control-sm d-inline-block ms-2 me-2 file-name-input')
				.style('width', '200px')
				.property('value', f => f.local_name)
				.property('disabled', f => f.type == 'unknown')
				.on('input', function(event, d) {
					d.local_name = this.value;
				});

			// Add original filename as small text
			fileItems.append('small')
				.attr('class', 'text-muted ms-2')
				.text(f => f.name != f.local_name ? `(${f.name})` : '');

			d3.select('#file-prompt').classed('d-none', true);

			// Auto-select the first valid file if none are selected
			if (file_manager.active_files.length === 0) {
				const firstValidFile = file_manager.files.find(f => f.type !== 'unknown');
				if (firstValidFile) {
					firstValidFile.selected = true;
					file_manager.handle_file_selection(firstValidFile);
					// Update checkbox state in DOM
					d3.selectAll('.file-item input[type="checkbox"]')
						.property('checked', f => f.selected);
				}
			}
		});
	},
	// determine file type from contents rather than just name
	get_file_type: lines => {
		// read file contents into an array
		if (lines.length < 7) {
			return 'unknown';
		} else {
			const column_nums = lines[4].trim().split(/\s+/);
			const columns = lines[5].trim().split(/\s+/);
			if (lines[0].trim() === '') {
				if (column_nums[0] === '1' && column_nums[1] === '2') {
					return 'gyre';
				} else return 'unknown';
			} else {
				if (columns.includes('model_number')) {
					return 'history';
				} else if (columns.includes('zone')) {
					return 'profile';
				} else return 'unknown';
			}
		}
		return unknown;
	},
	// function called when a new file is to be handled. Loads all data into an
	// existing (and provided) file object and returns it
	load_file: async function(file, file_obj) {
		return new Promise((resolve, reject) => {
			let fileReader = new FileReader();
			fileReader.readAsText(file);
			fileReader.onerror = () => {
				reject(fileReader.error);
			};
			// handles data once the file reader has finished loading the data
			fileReader.onload = () => {
				const lines = fileReader.result.replace(/\s+$/, '').split('\n');
				file_obj.type = file_manager.get_file_type(lines);
				if (file_obj.type != 'unknown') {
					file_obj.data = file_manager.process_data(lines);
				}
				resolve(file_obj);
			};
		});
	},
	process_data: lines => {
		const headerNamesLine = 1;
		const headerValsLine = 2;
		const bulkNamesLine = 5;
		const bulkValsStart = bulkNamesLine + 1;
		let headerData = {};
		let bulkData = [];

		// extract header data
		lines[headerNamesLine]
			.trim()
			.split(/\s+/)
			.forEach((key, i) => {
				headerData[key] = lines[headerValsLine]
					.trim()
					.split(/\s+/)
					[i].replace(/"/g, '');
			});

		// extract bulk names into a list of objects that have a key (their name)
		// and a good guess as to whether or not they are implicitly log
		const bulkNames = lines[bulkNamesLine]
			.trim()
			.split(/\s+/)
			.map(name => {
				let scale = 'linear';
				if (name.slice(0, 3) == 'log' || name.slice(0, 2) == 'lg' || name.includes('_log')) {
					scale = 'log';
				}
				return { key: name, scale: scale };
			});

		// extract bulk data into a list of objects. Keys are the corresponding
		// keys in `bulkNames` (the column names) and values are the actual floating
		// point values in that row/column.
		lines.slice(bulkValsStart).forEach((line, k) => {
			let line_data = {};
			line
				.trim()
				.split(/\s+/)
				.forEach((datum, i) => {
					line_data[bulkNames[i].key] = parseFloat(datum);
				});
			bulkData.push(line_data);
		});

		// if "model_number" is a column, ensure that the value decreases
		// monotonically as we go back in time (i.e., from the end of the list to
		// the beginning). As we encounter lines that violate this condition, we
		// remove them from the data.
		if (bulkNames.map(d => d.key).includes('model_number')) {
			let model_numbers = bulkData.map(d => d.model_number);
			let last = model_numbers[model_numbers.length - 1];
			for (let i = model_numbers.length - 2; i >= 0; i--) {
				if (model_numbers[i] >= last) {
					bulkData.splice(i, 1);
				} else {
					last = model_numbers[i];
				}
			}
		}

		return { header: headerData, bulk: bulkData, bulk_names: bulkNames };
	},
	file_icon_class: file => {
		let icon_class = 'bi bi-patch-question-fill';
		if (file.type == 'history') {
			icon_class = 'bi bi-clock-fill';
		} else if (file.type == 'profile') {
			icon_class = 'bi bi-star-half';
		} else if (file.type == 'gyre') {
			icon_class = 'bi bi-broadcast';
		}
		return icon_class;
	},
	// Handle file selection with type constraints
	handle_file_selection: function(changedFile) {
		if (changedFile.selected) {
			// If selecting a file, check type constraints
			const selectedFiles = file_manager.files.filter(f => f.selected);
			const selectedTypes = [...new Set(selectedFiles.map(f => f.type))];
			
			// If we have mixed types, unselect files that don't match the changed file's type
			if (selectedTypes.length > 1) {
				file_manager.files.forEach(f => {
					if (f !== changedFile && f.type !== changedFile.type) {
						f.selected = false;
					}
				});
				// Update checkboxes in DOM
				d3.selectAll('.file-item input[type="checkbox"]')
					.property('checked', f => f.selected);
			}
		}
		
		// Update active files array
		file_manager.active_files = file_manager.files.filter(f => f.selected);
		
		// Notify visualization
		vis.register_new_files();
	},
};

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

		// In-plot mouse controls
		vis.svg.mouse_x_pixel = null;
		vis.svg.mouse_y_pixel = null;
		Object.keys(vis.axes).forEach(axis => {
			vis.axes[axis].mouse_val = null;
		});

		vis.svg.attr('cursor', 'crosshair')
			.on('mousemove', function(event) {
			[vis.svg.mouse_x_pixel, vis.svg.mouse_y_pixel] = d3.pointer(event, vis.svg.node());
			// console.log(`x: ${vis.svg.mouse_x_pixel}, y: ${vis.svg.mouse_y_pixel}`)
			label_data = []
			Object.keys(vis.axes).forEach(axis => {
				if (vis.axes[axis].data_name && vis.svg[`mouse_${axis[0]}_pixel`] != null) {
					vis.axes[axis].mouse_val = vis.axes[axis].scale.invert(vis.svg[`mouse_${axis[0]}_pixel`]);
					label_data.push({axis: vis.axes[axis], val: vis.axes[axis].mouse_val});
					if (vis.axes[axis].mouse_val >= 10000 || vis.axes[axis].mouse_val <= 0.001) {
						// Use exponential notation with 3 decimal places
						label_data[label_data.length - 1].val = label_data[label_data.length - 1].val.toExponential(3);
					} else {
						// Convert number to string with 4 significant digits
						const str = label_data[label_data.length - 1].val.toPrecision(4);
		
						// Remove trailing zeros after decimal point
						const formatted = parseFloat(str).toString();
		
						label_data[label_data.length - 1].val = formatted;
				}					
					// console.log(`${vis.axes[axis].data_name}: ${vis.axes[axis].mouse_val}`)
				} else {
					vis.axes[axis].mouse_val = null;
				}
				// create text element for data from mouseover in lower left of vis.svg
			});
			if (label_data.length > 0) {
				// create or update text element with this text. element is a member of vis.svg,
				// has id "mouse-text", and text is left and bottom justifed at 10px from the
				// bottom and left edges of the plot.
				let mouse_text = vis.svg.select('#mouse-text');
				if (mouse_text.empty()) {
					mouse_text = vis.svg.append('text')
						.attr('id', 'mouse-text')
						.attr('x', vis.svg.mouse_x_pixel + 20)
						.attr('y', vis.svg.mouse_y_pixel + 35)
						.attr('text-anchor', 'start')
						.attr('dominant-baseline', 'baseline')
						.attr('fill', vis.axes.x.color)
						.attr('font-size', vis.font_size[vis.saved_bootstrap_size]);
				}
				// add tspans for each text/val pair
				mouse_text.selectAll('tspan').remove();
				mouse_text.selectAll('tspan')
					.data(label_data)
					.enter()
					.append('tspan')
					.attr('x', vis.svg.mouse_x_pixel + 20)
					.attr('y', vis.svg.mouse_y_pixel + 35)
					.attr('dy', (d, i) => (i * 1.2).toString() + 'em')
					.attr('fill', (d) => d.axis.color)
					.text(d => `${d['axis'].data_name.replace('_', ' ').replace(/log\s*/g, '')}: ${d['val']}`);
				// Calculate the bounding box of the text, then adjust for margin
				let bbox = mouse_text.node().getBBox();
				let margin = 5;
				let rect = vis.svg.select('#mouse-text-bg');
				if (rect.empty()) {
					rect = vis.svg.insert('rect', () => mouse_text.node())
						.attr('id', 'mouse-text-bg');;
				}

				rect.attr('x', bbox.x - margin)
						.attr('y', bbox.y - margin)
						.attr('width', bbox.width + 2 * margin)
						.attr('height', bbox.height + 2 * margin)
						.attr('fill', vis.axes.x.color == 'Black' ? 'white' : 'rgb(34,37,41)')
						.attr('stroke', vis.axes.x.color == 'Black' ? 'black' : 'rgb(223,226,230)')
						.attr('stroke-width', 2)
						.attr('rx', 10);
			}
		});
		// destroy #mouse-text upon leaving plot area
		vis.svg.on('mouseleave', function() {
			vis.svg.select('#mouse-text').remove();
			vis.svg.select('#mouse-text-bg').remove();
		});
		
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
			color: d3.schemeCategory10[0],
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
			color: d3.schemeCategory10[1],
		},
	},
	// minimum and maximum data coordinates to display on plot
	// TODO: make automatic margins work with logarithmic data/axes
	// also add some padding to make sure tick labels don't get clipped
	// Get combined data from all series for extent calculations
	get_all_data: () => {
		if (!vis.series || vis.series.length === 0) return [];
		return vis.series.flatMap(series => series.data);
	},
	width_data: axis => {
		const allData = vis.get_all_data();
		const max = vis.axes[axis].max || d3.max(allData, vis.accessor(axis));
		const min = vis.axes[axis].min || d3.min(allData, vis.accessor(axis));
		return max - min;
	},
	width_log_data: axis => {
		const allData = vis.get_all_data();
		const max = vis.axes[axis].max || d3.max(allData, vis.accessor(axis));
		const min = vis.axes[axis].min || d3.min(allData, vis.accessor(axis));
		return safe_log(max) - safe_log(min);
	},
	min_data: axis => {
		if (vis.axes[axis].min) {
			return vis.axes[axis].min;
		} else if (vis.axes[axis].type == 'log') {
			const allData = vis.get_all_data();
			const log_min = safe_log(d3.min(allData, vis.accessor(axis)));
			return Math.pow(10, log_min - 0.05 * vis.width_log_data(axis));
		} else {
			const allData = vis.get_all_data();
			return d3.min(allData, vis.accessor(axis)) - 0.05 * vis.width_data(axis);
		}
	},
	max_data: axis => {
		if (vis.axes[axis].max) {
			return vis.axes[axis].max;
		} else if (vis.axes[axis].type == 'log') {
			const allData = vis.get_all_data();
			const log_max = safe_log(d3.max(allData, vis.accessor(axis)));
			return Math.pow(10, log_max + 0.05 * vis.width_log_data(axis));
		} else {
			const allData = vis.get_all_data();
			return d3.max(allData, vis.accessor(axis)) + 0.05 * vis.width_data(axis);
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
	// pixel coordinates for left/bottom of data
	min_display: axis => {
		if (axis == 'x') {
			if (vis.axes.y.data_name) {
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
			if (vis.axes.yOther.data_name) {
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
			return;
		}

		// Find intersection of column names across all selected files
		vis.pause = true;
		const allColumnNames = vis.files.map(f => f.data.bulk_names.map(elt => elt.key));
		const commonColumns = allColumnNames.length > 0 ? 
			allColumnNames.reduce((a, b) => a.filter(c => b.includes(c))) : [];
		
		let refresh_plot = true;
		Object.keys(vis.axes).forEach(axis => {
			if (!commonColumns.includes(vis.axes[axis].data_name)) {
				// Reset axis if current column is not available in all files
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
				refresh_plot = false;
			}
		});

		// Create series data for each file
		vis.series = vis.files.map((file, index) => ({
			file: file,
			data: file.data.bulk,
			color: d3.schemeCategory10[index % d3.schemeCategory10.length],
			name: file.local_name
		}));

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
		vis.update_plot();
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
				vis.update_plot();
				return false;
			});
	},
	make_scale: axis => {
		// set up right scaling
		if (vis.axes[axis].data_name) {
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
		Object.keys(vis.axes).forEach(axis => vis.make_scale(axis));
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
			const x = vis.accessor('x')(d);
			const y = vis.accessor(yAxis)(d);
			let res = i % vis.marker_interval[yAxis] == 0;
			res = res && x >= x_min && x <= x_max;
			res = res && y >= y_min && y <= y_max;
			return res;
		});
	},
	plot_data_scatter: yAxis => {
		if (vis.axes[yAxis].data_name && vis.series) {
			vis.series.forEach((series, seriesIndex) => {
				const reducedData = vis.reduced_data_for_series(yAxis, series);
				vis.svg
					.selectAll(`circle.${yAxis}-series-${seriesIndex}`)
					.data(reducedData)
					.enter()
					.append('circle')
					.classed(`${yAxis} series-${seriesIndex}`, true)
					.attr('r', 2)
					.attr('cx', d => vis.axes.x.scale(vis.accessor('x')(d)))
					.attr('cy', d => vis.axes[yAxis].scale(vis.accessor(yAxis)(d)))
					.attr('fill', series.color);
			});
		}
	},
	plot_data_line: yAxis => {
		if (vis.axes[yAxis].data_name && vis.series) {
			vis.series.forEach((series, seriesIndex) => {
				const x = vis.accessor('x');
				const y = vis.accessor(yAxis);
				const line_maker = d3
					.line()
					.x(d => vis.axes.x.scale(x(d)))
					.y(d => vis.axes[yAxis].scale(y(d)));
				vis.svg
					.append('g')
					.classed(`series-${seriesIndex}`, true)
					.append('path')
					.attr('fill', 'none')
					.attr('d', line_maker(series.data))
					.attr('stroke', series.color)
					.attr('stroke-width', '2.0')
					.attr('clip-path', 'url(#clip)');
			});
		}
	},
	add_axes: (force_light = false) => {
		// axes themselves (spines, ticks, tick labels)
		if (vis.axes.x.data_name) {
			vis.svg
				.append('g')
				.call(d3.axisTop(vis.axes.x.scale).tickSizeOuter(0))
				.attr('transform', `translate(0,${vis.min_display('y')})`)
				.selectAll('text')
				.attr('text-anchor', 'top')
				.attr('dominant-baseline', 'hanging')
				.attr('font-size', vis.font_size[vis.saved_bootstrap_size])
				.attr('transform', `translate(0, ${vis.tick_offset() + 2})`);
			vis.svg
				.append('g')
				.call(d3.axisBottom(vis.axes.x.scale).tickSizeOuter(0))
				.attr('transform', `translate(0,${vis.max_display('y')})`)
				.selectAll('text')
				.remove();
		}
		if (vis.axes.y.data_name) {
			vis.svg
				.append('g')
				.call(d3.axisRight(vis.axes.y.scale).tickSizeOuter(0))
				.attr('transform', `translate(${vis.tick_padding.y[vis.saved_bootstrap_size]},0)`)
				.selectAll('text')
				.attr('text-anchor', 'end')
				.attr('font-size', vis.font_size[vis.saved_bootstrap_size])
				.attr('transform', `translate(-${vis.tick_offset()}, 0)`);
			if (vis.axes.yOther.data_name === undefined) {
				vis.svg
					.append('g')
					.call(d3.axisLeft(vis.axes.y.scale).tickSizeOuter(0))
					.attr('transform', `translate(${vis.width() - 10},0)`)
					.selectAll('text')
					.remove();
			}
		}
		if (vis.axes.yOther.data_name) {
			vis.svg
				.append('g')
				.call(d3.axisLeft(vis.axes.yOther.scale).tickSizeOuter(0))
				.attr('transform', `translate(${vis.max_display('x')},0)`)
				.selectAll('text')
				.attr('text-anchor', 'start')
				.attr('font-size', vis.font_size[vis.saved_bootstrap_size])
				.attr('transform', `translate(${vis.tick_offset()}, 0)`);
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
				.attr('font-size', vis.font_size[vis.saved_bootstrap_size])
				.text(d3.select('#x-axis-label').property('value'));
		}
		if (vis.axes.y.data_name) {
			vis.svg
				.append('text')
				.attr('transform', `translate(5, ${vis.max_display('y') + 0.5 * (vis.min_display('y') - vis.max_display('y'))}) rotate(-90)`)
				.attr('dominant-baseline', 'hanging')
				.attr('text-anchor', 'middle')
				.attr('id', 'svg-y-label')
				.attr('fill', vis.axes.y.color)
				.attr('font-family', 'sans-serif')
				.attr('font-size', vis.font_size[vis.saved_bootstrap_size])
				.text(d3.select('#y-axis-label').property('value'));
		}
		if (vis.axes.yOther.data_name) {
			vis.svg
				.append('text')
				.attr('transform', `translate(${vis.width() - 5}, ${vis.max_display('yOther') + 0.5 * (vis.min_display('yOther') - vis.max_display('yOther'))}) rotate(90)`)
				.attr('dominant-baseline', 'hanging')
				.attr('text-anchor', 'middle')
				.attr('id', 'svg-yOther-label')
				.attr('fill', vis.axes.yOther.color)
				.attr('font-family', 'sans-serif')
				.attr('font-size', vis.font_size[vis.saved_bootstrap_size])
				.text(d3.select('#yOther-axis-label').property('value'));
		}
		// Set up handlers for axis label fields (should this live here?)
		d3.selectAll('.axis-label-field').on('keyup', () => {
			vis.update_axis_labels();
		});
		vis.have_axis_labels = true;
	},
	// Set axis labels to be whatever is in the input field that controls them.
	// Perhaps this should live in the data model, but it works quite well.
	update_axis_labels: () => {
		d3.select('#svg-x-label').text(d3.select('#x-axis-label').property('value'));
		d3.select('#svg-y-label').text(d3.select('#y-axis-label').property('value'));
		d3.select('#svg-yOther-label').text(d3.select('#yOther-axis-label').property('value'));
	},
	add_legend: () => {
		if (!vis.series || vis.series.length <= 1) return; // No legend needed for single series
		
		const legendData = vis.series.map(series => ({
			name: series.name,
			color: series.color
		}));
		
		// Position legend in top-right corner
		const legendX = vis.max_display('x') - 20;
		const legendY = vis.max_display('y') + 20;
		const lineHeight = 18;
		
		const legend = vis.svg.append('g')
			.attr('id', 'legend')
			.attr('transform', `translate(${legendX}, ${legendY})`);
		
		// Add background rectangle
		const legendHeight = legendData.length * lineHeight + 10;
		const legendWidth = 150;
		
		legend.append('rect')
			.attr('x', -legendWidth)
			.attr('y', -5)
			.attr('width', legendWidth)
			.attr('height', legendHeight)
			.attr('fill', vis.axes.x.color == 'Black' ? 'white' : 'rgb(34,37,41)')
			.attr('stroke', vis.axes.x.color == 'Black' ? 'black' : 'rgb(223,226,230)')
			.attr('stroke-width', 1)
			.attr('rx', 5);
		
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
			.attr('font-size', vis.font_size[vis.saved_bootstrap_size] - 2)
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
		if (vis.series && vis.series.length > 0 && vis.axes.x.data_name) {
			vis.make_scales();
			vis.make_clipPath();
			['y', 'yOther'].forEach(yAxis => {
				if (vis.axes[yAxis].data_name) {
					if (vis.do_line_plot[yAxis]) vis.plot_data_line(yAxis);
					if (vis.do_scatter_plot[yAxis]) vis.plot_data_scatter(yAxis);
				}
			});

			vis.add_axes(force_light);
			vis.add_legend();
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

setup = () => {
	// shut off form submission upon enter key
	window.addEventListener(
		'keydown',
		function(e) {
			if (e.keyIdentifier == 'U+000A' || e.keyIdentifier == 'Enter' || e.keyCode == 13) {
				if (e.target.nodeName == 'INPUT' && e.target.type == 'text') {
					e.preventDefault();

					return false;
				}
			}
		},
		true
	);

	file_manager.setup();
	vis.setup();
};
