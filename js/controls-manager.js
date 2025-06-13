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
				if (e.code.slice(0, 3) === 'Arr' || e.code == 'Enter') return;
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
			controls_manager.downloadSVG('plot');

			// restore x-axis color if needed
			if (dark_mode) {
				vis.axes.x.color = x_color;
				vis.update_plot();
			}
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


	// Downloads an SVG on the webpage, accessed by its class name
	// @param {String} svgClassName -- name of the SVG class (e.g. "amazingSVG")
	downloadSVG: function(svgIDName) {
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
				alert('The Crowbar could not find any SVG nodes.');
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
};