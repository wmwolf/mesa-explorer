/**
 * Download Manager
 * Handles SVG and PNG export functionality for Mesa Explorer plots
 */

const download_manager = {
	/**
	 * Downloads an SVG from the webpage by its ID
	 * @param {String} svgIDName - ID of the SVG element (e.g. "plot")
	 */
	downloadSVG: function(svgIDName) {
		const doctype = '<?xml version="1.0" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">';

		window.URL = window.URL || window.webkitURL;

		const body = document.body;

		const prefix = {
			xmlns: 'http://www.w3.org/2000/xmlns/',
			xlink: 'http://www.w3.org/1999/xlink',
			svg: 'http://www.w3.org/2000/svg',
		};

		initialize();

		function initialize() {
			const documents = [window.document];
			const SVGSources = [];
			const iframes = document.querySelectorAll('iframe');
			const objects = document.querySelectorAll('object');

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
				const newSources = getSources(doc);
				for (let i = 0; i < newSources.length; i++) {
					SVGSources.push(newSources[i]);
				}
			});

			if (SVGSources.length > 1) {
				console.log('Multiple SVG sources found, using first one');
				downloadSVGFile(SVGSources[0]);
			} else if (SVGSources.length > 0) {
				downloadSVGFile(SVGSources[0]);
			} else {
				alert('Could not find any SVG elements to download.');
			}
		}

		function getSources(doc) {
			const svgInfo = [];
			const originalSvg = doc.querySelector('#' + svgIDName);

			if (!originalSvg) {
				console.error(`SVG element with ID "${svgIDName}" not found`);
				return svgInfo;
			}

			// Clone the SVG to avoid modifying the original
			const svg = originalSvg.cloneNode(true);

			// Get actual dimensions from vis object
			const width = vis.width();
			const height = vis.height();

			// Set proper SVG attributes for export
			svg.setAttribute('version', '1.1');
			svg.setAttribute('width', width);
			svg.setAttribute('height', height);
			svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

			const defsEl = document.createElement('defs');
			svg.insertBefore(defsEl, svg.firstChild);

			// Remove attributes so they aren't doubled up
			svg.removeAttribute('xmlns');
			svg.removeAttribute('xlink');

			// These are needed for the SVG
			if (!svg.hasAttributeNS(prefix.xmlns, 'xmlns')) {
				svg.setAttributeNS(prefix.xmlns, 'xmlns', prefix.svg);
			}

			if (!svg.hasAttributeNS(prefix.xmlns, 'xmlns:xlink')) {
				svg.setAttributeNS(prefix.xmlns, 'xmlns:xlink', prefix.xlink);
			}

			const source = new XMLSerializer().serializeToString(svg);
			const rect = originalSvg.getBoundingClientRect();
			
			svgInfo.push({
				top: rect.top,
				left: rect.left,
				width: width,
				height: height,
				class: originalSvg.getAttribute('class'),
				id: originalSvg.getAttribute('id'),
				childElementCount: originalSvg.childElementCount,
				source: [doctype + source],
			});

			return svgInfo;
		}

		function downloadSVGFile(source) {
			const filename = download_manager.generateFilename(source);
			const url = window.URL.createObjectURL(new Blob(source.source, { type: 'text/xml' }));

			const a = document.createElement('a');
			body.appendChild(a);
			a.setAttribute('class', 'svg-crowbar');
			a.setAttribute('download', filename + '.svg');
			a.setAttribute('href', url);
			a.style.display = 'none';
			a.click();

			setTimeout(function() {
				window.URL.revokeObjectURL(url);
				body.removeChild(a);
			}, 10);
		}
	},

	/**
	 * Downloads a PNG version of the SVG by converting it via Canvas
	 * @param {String} svgIDName - ID of the SVG element (e.g. "plot")  
	 * @param {Number} scale - Scale factor for PNG resolution (default: 2 for high-DPI)
	 */
	downloadPNG: function(svgIDName, scale = 2) {
		const svg = document.querySelector('#' + svgIDName);
		
		if (!svg) {
			alert(`SVG element with ID "${svgIDName}" not found`);
			return;
		}

		try {
			// Clone the SVG to avoid modifying the original
			const svgClone = svg.cloneNode(true);
			
			// Ensure proper SVG attributes for rendering
			svgClone.setAttribute('version', '1.1');
			svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
			svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

			// Get dimensions
			const rect = svg.getBoundingClientRect();
			const width = vis.width();
			const height = vis.height();

			// Set explicit dimensions on the clone
			svgClone.setAttribute('width', width);
			svgClone.setAttribute('height', height);

			// Convert SVG to data URL
			const svgData = new XMLSerializer().serializeToString(svgClone);
			const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
			const svgUrl = URL.createObjectURL(svgBlob);

			// Create image and canvas
			const img = new Image();
			img.onload = function() {
				const canvas = document.createElement('canvas');
				const ctx = canvas.getContext('2d');

				// Set canvas dimensions with scaling
				canvas.width = width * scale;
				canvas.height = height * scale;

				// Scale the context to maintain aspect ratio
				ctx.scale(scale, scale);

				// Set white background for PNG (SVG transparency becomes white)
				ctx.fillStyle = 'white';
				ctx.fillRect(0, 0, width, height);

				// Draw the SVG image onto canvas
				ctx.drawImage(img, 0, 0, width, height);

				// Convert canvas to PNG blob and download
				canvas.toBlob(function(blob) {
					const filename = download_manager.generateFilename({ id: svgIDName });
					download_manager.downloadBlob(blob, filename + '.png');
					
					// Cleanup
					URL.revokeObjectURL(svgUrl);
				}, 'image/png');
			};

			img.onerror = function() {
				alert('Failed to convert SVG to PNG. Please try SVG download instead.');
				URL.revokeObjectURL(svgUrl);
			};

			img.src = svgUrl;

		} catch (error) {
			console.error('PNG conversion error:', error);
			alert('Failed to convert SVG to PNG. Please try SVG download instead.');
		}
	},

	/**
	 * Downloads a blob with the given filename
	 * @param {Blob} blob - The blob to download
	 * @param {String} filename - The filename for the download
	 */
	downloadBlob: function(blob, filename) {
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		
		document.body.appendChild(a);
		a.style.display = 'none';
		a.href = url;
		a.download = filename;
		a.click();
		
		// Cleanup
		setTimeout(() => {
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		}, 10);
	},

	/**
	 * Generates a filename based on the SVG source or document title
	 * @param {Object} source - Object with id, class, or other identifying properties
	 * @returns {String} Generated filename
	 */
	generateFilename: function(source) {
		let filename = 'mesa-explorer-plot';

		if (source.id) {
			filename = source.id;
		} else if (source.class) {
			filename = source.class;
		} else if (window.document.title) {
			filename = window.document.title.replace(/[^a-z0-9]/gi, '-').toLowerCase();
		}

		return filename;
	},

	/**
	 * Handles dark mode adjustments for export
	 * @param {Function} exportFunction - The export function to call
	 */
	handleDarkModeExport: function(exportFunction) {
		// Get current x-axis color, conditionally change and redraw if needed
		let dark_mode = false;
		let x_color = vis.axes.x.color;
		
		if (x_color !== 'Black') {
			dark_mode = true;
			vis.axes.x.color = 'Black';
			vis.update_plot(true); // force_light = true
		}

		// Execute the export function
		exportFunction();

		// Restore x-axis color if needed
		if (dark_mode) {
			vis.axes.x.color = x_color;
			vis.update_plot();
		}
	}
};