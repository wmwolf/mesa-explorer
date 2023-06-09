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
	// The file that should be read from to do any plotting
	active_file: undefined,
	load_all_files: async function(input) {
		// grab all file data, but do not impact DOM
		Promise.all(
			[...input.files].map(file => {
				let type = 'unknown';
				if (file.name[0] == 'h') {
					type = 'history';
				} else if (file.name[0] == 'p') {
					type = 'profile';
				}
				let file_obj = {
					name: file.name,
					type: type,
				};
				return file_manager.load_file(file, file_obj);
			})
		).then(new_files => {
			// once data from the files have been ingested into each file object,
			// save them to the global file manager object
			// merge new files into existing files
			file_manager.files = file_manager.files.concat(new_files);

			// order files appropriately (histories, then profiles, then other junk)
			file_manager.files.sort((d1, d2) => {
				if (d1.type == 'history' && d2.type != 'history') {
					return -1;
				} else if (d1.type != 'history' && d2.type == 'history') {
					return 1;
				} else if (d1.type == 'profile' && d2.type == 'profile') {
					// sort profiles by increasing *model* number, not profile number
					return parseInt(d1.data.header.model_number) - parseInt(d2.data.header.model_number);
				} else if (d1.type == 'profile' && !['history', 'profile'].includes(d2.type)) {
					// This and the next should make sure that profiles come before randos
					return -1;
				} else if (!['history', 'profile'].includes(d1.type) && d2.type == 'profile') {
					return 1;
				} else {
					// multiple histories or multiple other files can have arbitrary order
					return 0;
				}
			});

			// Remove any existing files from picker (sorting them in place was just
			// not working for some reason), and then build them back up, restoring
			// any active state for pre-selected files
			d3.select('#file-list')
				.selectAll('a')
				.remove();
			// insert data into DOM
			const as = d3
				.select('#file-list')
				.selectAll('a')
				.data(file_manager.files)
				.enter()
				.append('a')
				.attr('class', f => {
					if (file_manager.active_file == f) {
						return 'list-group-item list-group-item-action active';
					} else {
						return 'list-group-item list-group-item-action';
					}
				})
				// add click handler. Strips other files of active class, adds it to
				// this one, and then sets the active files and phones over to the
				// visualization side to pick up the new data
				.on('click', function() {
					d3.selectAll('#file-list a').attr('class', 'list-group-item list-group-item-action');
					d3.select(this).attr('class', 'list-group-item list-group-item-action active');
					file_manager.active_file = d3.select(this).datum();
					vis.register_new_file();
				});

			// Add in content to the file entries (icon and name of file)
			as.append('i').attr('class', file_manager.file_icon_class);
			as.append('span')
				.attr('class', 'ms-2')
				.text(f => f.name);

			// Auto-select the first file if none are selected
			if (!file_manager.active_file) {
				d3.select('#file-list > a').dispatch('click');
			}
		});
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
				const contents = fileReader.result;
				if (file_obj.type != 'unkonwn') {
					file_obj.data = file_manager.process_data(contents);
				}
				resolve(file_obj);
			};
		});
	},
	process_data: file_contents => {
		const headerNamesLine = 1;
		const headerValsLine = 2;
		const bulkNamesLine = 5;
		const bulkValsStart = bulkNamesLine + 1;
		let headerData = {};
		let bulkData = [];

		// read file contents into an array
		contents = file_contents.trim();
		lines = contents.trim().split('\n');

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

		return { header: headerData, bulk: bulkData, bulk_names: bulkNames };
	},
	file_icon_class: file => {
		let icon_class = 'bi bi-patch-question-fill';
		if (file.type == 'history') {
			icon_class = 'bi bi-clock-fill';
		} else if (file.type == 'profile') {
			icon_class = 'bi bi-star-half';
		}
		return icon_class;
	},
};

vis = {
	setup: () => {
		vis.svg = d3.select('#plot');
		vis.svg.style('height', vis.width() / 1.618);
		window.onresize = function() {
			vis.svg.style('height', vis.width() / 1.618);
			vis.update_plot();
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

		// Set up handlers for data transformations
		//   Data rescaling
		d3.selectAll('.data-rescale input').on('click', function() {
			elt = d3.select(this);
			vis.axes[elt.attr('data-axis')].data_trans.rescale = elt.property('value');
			vis.update_plot();
		});
		//   Rezeroing
		d3.selectAll('.data-rezero input').on('keyup', function() {
			elt = d3.select(this);
			vis.axes[elt.attr('data-axis')].data_trans.rezero = parseFloat(elt.property('value'));
			vis.update_plot();
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
	axes: {
		x: {
			generic_html: '<var>x</var>',
			data_name: undefined,
			data_type: 'linear',
			data_trans: { rescale: 'linear', rezero: 0, absval: false },
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
			data_trans: { rescale: 'linear', rezero: 0, absval: false },
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
			data_trans: { rescale: 'linear', rezero: 0, absval: false },
			scale: undefined,
			type: 'linear',
			min: undefined,
			max: undefined,
			color: d3.schemeCategory10[1],
		},
	},
	// minimum and maximum data coordinates to display on plot
	min_data: axis => vis.axes[axis].min || d3.min(vis.data, vis.accessor(axis)),
	max_data: axis => vis.axes[axis].max || d3.max(vis.data, vis.accessor(axis)),

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
		do_abs = val => (vis.axes[axis].data_trans.absval ? Math.abs(val) : val);
		return d => do_abs(rezero(rescale(d)));
	},
	// Stylistic choices; how much padding there is from the outside of the plot
	// area to the axis lines (tick_padding) and from the axis lines to the data
	// (data_padding)
	tick_padding: { x: 40, y: 60 },
	data_padding: 20,
	// pixel coordinates for left/bottom of data
	min_display: axis => {
		if (axis == 'x') {
			if (vis.axes.y.data_name) {
				return vis.tick_padding.y + vis.data_padding;
			} else {
				return vis.data_padding;
			}
		} else {
			return vis.height() - vis.tick_padding.x - vis.data_padding;
		}
	},
	// pixel coordinates for right/top of data
	max_display: axis => {
		if (axis == 'x') {
			if (vis.axes.yOther.data_name) {
				return vis.width() - (vis.tick_padding.y + vis.data_padding);
			} else {
				return vis.width() - vis.data_padding;
			}
		} else {
			return vis.data_padding;
		}
	},
	register_new_file: () => {
		vis.file = file_manager.active_file;

		// Reset selections for abscissa and ordinate axes columns if they
		// are no longer present in this file
		vis.pause = true;
		const names = vis.file.data.bulk_names.map(elt => elt.key);
		let refresh_plot = true;
		Object.keys(vis.axes).forEach(axis => {
			if (!names.includes(vis.axes[axis].data_name)) {
				// this file doesn't have the same columns; reset the plot, axis
				// labels, axis/data settings, and search field
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
			vis.pause = false;
			if (refresh_plot) {
				vis.update_plot();
			} else {
				vis.clear_plot();
			}
		});

		// Set up the actual data that will be plotted
		vis.data = vis.file.data.bulk;

		// merge name data with more complete "known" data. Names are the columns
		// of data files, but also the keys to each datum in `vis.data`.
		vis.name_data = vis.file.data.bulk_names.map(d => {
			let matches = vis.known_names().filter(dk => dk.key == d.key);
			// If we found this name, overwrite with "known" values. Should probably
			// do this with destructuring so it is less brittle.
			if (matches.length > 0) {
				d.scale = matches[0].scale;
				d.html_name = matches[0].html_name;
				d.html_units = matches[0].html_units;
			}
			return d;
		});

		// Refresh interface to reflect new data
		Object.keys(vis.axes).forEach(axis => vis.update_choices(axis));
		vis.update_plot();
	},
	// helper function for grabbing the relevant "known" column name data
	known_names: () => {
		if (vis.file.type == 'history') {
			return vis.known_history_names;
		} else if (vis.file.type == 'profile') {
			return vis.known_profile_names;
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
			.attr('href', '#')
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
			.on('click', function() {
				// set the column name and column scale in the data
				let option = d3.select(this);
				let active_old = d3.select(`${axis}-choices`).selectAll('.active');
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
				window.scrollTo(0, 0);
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
			.attr('width', vis.max_display('x') - vis.min_display('x') + 2)
			.attr('height', Math.abs(vis.max_display('y') - vis.min_display('y')) + 2)
			.attr('fill', 'blue')
			.attr('transform', `translate(${vis.min_display('x') - 1},${vis.data_padding - 1})`);
	},
	plot_data_scatter: yAxis => {
		vis.svg
			.selectAll('circle')
			.data(vis.data)
			.enter()
			.append('circle')
			.attr('r', 2)
			.attr('cx', d => vis.axes.x.scale(vis.accessor('x')(d)))
			.attr('cy', d => vis.axes[yAxis].scale(vis.accessor('y')(d)))
			.attr('fill', vis.axes[yAxis].color);
	},
	plot_data_line: yAxis => {
		if (vis.axes[yAxis].data_name) {
			const x = vis.accessor('x');
			const y = vis.accessor(yAxis);
			const line_maker = d3
				.line()
				.x(d => vis.axes.x.scale(x(d)))
				.y(d => vis.axes[yAxis].scale(y(d)));
			vis.svg
				.append('g')
				.append('path')
				.attr('fill', 'none')
				.attr('d', line_maker(vis.data))
				.attr('stroke', vis.axes[yAxis].color)
				.attr('stroke-width', '2.0')
				.attr('clip-path', 'url(#clip)');
		}
	},
	add_axes: () => {
		// axes themselves (spines, ticks, tick labels)
		if (vis.axes.x.data_name) {
			vis.svg
				.append('g')
				.call(d3.axisBottom(vis.axes.x.scale).tickSizeInner(3))
				.attr('transform', `translate(0,${vis.min_display('y') + vis.data_padding})`)
				.selectAll('text')
				.attr('font-size', 14);
		}
		if (vis.axes.y.data_name) {
			vis.svg
				.append('g')
				.call(d3.axisLeft(vis.axes.y.scale).tickSizeInner(3))
				.attr('transform', `translate(${vis.tick_padding.y},0)`)
				.selectAll('text')
				.attr('font-size', 14);
		}
		if (vis.axes.yOther.data_name) {
			vis.svg
				.append('g')
				.call(d3.axisRight(vis.axes.yOther.scale).tickSizeInner(3))
				.attr('transform', `translate(${vis.max_display('x') + vis.data_padding},0)`)
				.selectAll('text')
				.attr('font-size', 14);
		}

		// add or update axis labels
		if (vis.have_axis_labels) {
			vis.update_axis_labels();
		} else {
			vis.add_axis_labels();
		}
	},
	add_axis_labels: () => {
		if (vis.axes.x.data_name) {
			vis.svg
				.append('text')
				.attr('transform', `translate(${vis.min_display('x') + 0.5 * (vis.max_display('x') - vis.min_display('x'))}, ${vis.height() - 5})`)
				.attr('dominant-baseline', 'bottom')
				.attr('text-anchor', 'middle')
				.attr('id', 'svg-x-label')
				.attr('fill', vis.axes.x.color)
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
	clear_plot: () => {
		vis.svg.selectAll('*').remove();
		vis.have_axis_labels = false;
	},
	update_plot: () => {
		if (vis.pause) {
			return;
		}
		vis.clear_plot();
		if (vis.file && vis.axes.x.data_name) {
			vis.make_scales();
			vis.make_clipPath();
			['y', 'yOther'].forEach(yAxis => {
				if (vis.axes[yAxis].data_name) {
					vis.plot_data_line(yAxis);
				}
			});
			// vis.plot_data_scatter();
			vis.add_axes();
		}
	},
};

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
