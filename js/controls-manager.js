// Controls Manager
// Handles all UI input controls, form handlers, and user interactions
// with axis controls, data transformations, plot styling, and search functionality

controls_manager = {
	setup: () => {
		
		// Set up handlers for dropdown search
		Object.keys(vis.axes).forEach(axis => {
			// Clicking on dropdown button should focus on the search field
			d3.select(`#${axis}-label`).on('click', function() {
				d3.select(`#${axis}-search`)
					.node()
					.focus();
				controls_manager.apply_search(axis);
			});
			d3.select(`#${axis}-search`).on('keyup', function(e) {
				// ignore arrow keys; those control the active element via keydown
				if (e.code.slice(0, 3) === 'Arr' || e.code == 'Enter') {
					if (e.code === 'Enter') {
						e.preventDefault(); // Prevent default form submission behavior
						e.stopPropagation(); // Prevent event bubbling
					}
					return;
				}
				controls_manager.apply_search(axis);
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
					e.preventDefault(); // Prevent default form submission behavior
					e.stopPropagation(); // Prevent event bubbling
					// simulate click event on the active element if user hits enter
					d3.select(`#${axis}-choices a.active`).dispatch('click');
				}
			});
		});
		
		// Set up handlers for axis label fields
		d3.selectAll('.axis-label-field').on('input', () => {
			vis.update_axis_labels();
		});
		
		// Set up handlers for X-axis data transformations
		d3.selectAll('.x-data-transformation[type="radio"]').on('change', function() {
			if (this.checked) {
				vis.axes.x.data_trans.rescale = this.value;
				vis.update_plot();
			}
		});
		
		d3.selectAll('.x-data-transformation[type="number"]').on('input', function() {
			vis.axes.x.data_trans.rezero = parseFloat(this.value) || 0;
			vis.update_plot();
		});
		
		d3.selectAll('.x-data-transformation[type="checkbox"]').on('change', function() {
			vis.axes.x.data_trans.absval = this.checked;
			vis.update_plot();
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
				vis.update_plot();
			}
		});

		//  "min" (left/bottom) and "max" (right/top) limits
		d3.selectAll('div.limits input').on('keyup', function() {
			elt = d3.select(this);
			const axis = elt.attr('data-axis');
			vis.axes[axis][elt.attr('data-lim')] = parseFloat(elt.property('value'));
			
			// Update inversion button state after changing limits
			vis.update_inversion_button_state(axis);
			
			vis.update_plot();
		});

		// Set up handlers for axis inversion buttons
		d3.selectAll('[id$="-invert-button"]').on('click', function() {
			const button = d3.select(this);
			const buttonId = button.attr('id');
			// Extract axis name from button ID (e.g., "x-invert-button" -> "x")
			const axis = buttonId.replace('-invert-button', '');
			vis.toggle_axis_inversion(axis);
		});

		d3.select('#redraw').on('click', () => {
			vis.update_plot();
		});
		
		// Set download button handlers
		d3.select('#download-svg').on('click', (event) => {
			event.preventDefault();
			download_manager.handleDarkModeExport(() => {
				download_manager.downloadSVG('plot');
			});
		});

		d3.select('#download-png').on('click', (event) => {
			event.preventDefault();
			download_manager.handleDarkModeExport(() => {
				download_manager.downloadPNG('plot');
			});
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


};