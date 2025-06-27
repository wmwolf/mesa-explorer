// interaction-manager.js
// Handles mouse interactions, tool palette, pan/zoom, and inspector functionality for Mesa Explorer

const interaction_manager = {
	// Tool state management
	interaction: {
		current_tool: 'inspector',
		is_dragging: false,
		drag_start: null,
		drag_end: null
	},

	// Initialize all interaction handlers
	setup: () => {
		interaction_manager.setup_tool_handlers();
		interaction_manager.setup_mouse_handlers();
		interaction_manager.update_tool_ui();
	},

	// Set up tool selection button handlers
	setup_tool_handlers: () => {
		d3.select('#inspector-tool').on('click', () => {
			interaction_manager.interaction.current_tool = 'inspector';
			interaction_manager.update_tool_ui();
		});

		d3.select('#pan-tool').on('click', () => {
			interaction_manager.interaction.current_tool = 'pan';
			interaction_manager.update_tool_ui();
		});

		d3.select('#box-zoom-tool').on('click', () => {
			interaction_manager.interaction.current_tool = 'box-zoom';
			interaction_manager.update_tool_ui();
		});

		d3.select('#reset-view-tool').on('click', () => {
			interaction_manager.interaction.current_tool = 'reset-view';
			interaction_manager.reset_view();
		});
	},

	// Set up mouse event handlers for the plot area
	setup_mouse_handlers: () => {
		// Initialize mouse tracking variables
		vis.svg.mouse_x_pixel = null;
		vis.svg.mouse_y_pixel = null;
		Object.keys(vis.axes).forEach(axis => {
			vis.axes[axis].mouse_val = null;
		});

		// Set up tool-aware mouse event handlers
		vis.svg.attr('cursor', 'crosshair')
			.on('mousedown', function(event) {
				const [x, y] = d3.pointer(event, vis.svg.node());
				if (interaction_manager.interaction.current_tool === 'pan' || interaction_manager.interaction.current_tool === 'box-zoom') {
					interaction_manager.interaction.is_dragging = true;
					interaction_manager.interaction.drag_start = {x, y};
					interaction_manager.interaction.drag_end = {x, y};
					
					// Create zoom rectangle for box-zoom tool
					if (interaction_manager.interaction.current_tool === 'box-zoom') {
						vis.svg.select('#zoom-rect').remove();
						vis.svg.append('rect')
							.attr('id', 'zoom-rect')
							.attr('x', x)
							.attr('y', y)
							.attr('width', 0)
							.attr('height', 0)
							.attr('fill', 'none')
							.attr('stroke', 'blue')
							.attr('stroke-width', 2)
							.attr('stroke-dasharray', '5,5');
					}
				}
			})
			.on('mousemove', function(event) {
				const [x, y] = d3.pointer(event, vis.svg.node());
				vis.svg.mouse_x_pixel = x;
				vis.svg.mouse_y_pixel = y;
				
				if (interaction_manager.interaction.is_dragging) {
					interaction_manager.interaction.drag_end = {x, y};
					
					// Real-time pan feedback
					if (interaction_manager.interaction.current_tool === 'pan') {
						const dx = x - interaction_manager.interaction.drag_start.x;
						const dy = y - interaction_manager.interaction.drag_start.y;
						interaction_manager.apply_pan_transform(dx, dy);
					}
					// Update zoom rectangle for box-zoom tool
					if (interaction_manager.interaction.current_tool === 'box-zoom') {
						const rect = vis.svg.select('#zoom-rect');
						const startX = Math.min(interaction_manager.interaction.drag_start.x, x);
						const startY = Math.min(interaction_manager.interaction.drag_start.y, y);
						const width = Math.abs(x - interaction_manager.interaction.drag_start.x);
						const height = Math.abs(y - interaction_manager.interaction.drag_start.y);
						
						rect.attr('x', startX)
							.attr('y', startY)
							.attr('width', width)
							.attr('height', height);
					}
				} else if (interaction_manager.interaction.current_tool === 'inspector') {
					// Show inspector tooltips only when inspector tool is active
					interaction_manager.show_inspector_tooltip(x, y);
				}
			})
			.on('mouseup', function(event) {
				if (interaction_manager.interaction.is_dragging) {
					interaction_manager.interaction.is_dragging = false;
					
					if (interaction_manager.interaction.current_tool === 'pan') {
						interaction_manager.execute_pan();
					} else if (interaction_manager.interaction.current_tool === 'box-zoom') {
						interaction_manager.execute_box_zoom();
						vis.svg.select('#zoom-rect').remove();
					}
				}
			})
			.on('mouseleave', function() {
				vis.svg.select('#mouse-text').remove();
				vis.svg.select('#mouse-text-bg').remove();
				vis.svg.select('#zoom-rect').remove();
				
				// If we were panning, execute the pan operation
				if (interaction_manager.interaction.is_dragging && interaction_manager.interaction.current_tool === 'pan') {
					interaction_manager.execute_pan();
				}
				
				interaction_manager.interaction.is_dragging = false;
			});
	},

	// Update tool UI (button states and cursor)
	update_tool_ui: () => {
		// Update button active states
		d3.selectAll('#plot-tools button').classed('active', false);
		d3.select(`#${interaction_manager.interaction.current_tool}-tool`).classed('active', true);
		
		// Update cursor style
		const plotContainer = d3.select('#main-plot-container');
		plotContainer.style('cursor', () => {
			switch(interaction_manager.interaction.current_tool) {
				case 'inspector': return 'crosshair';
				case 'pan': return 'move';
				case 'box-zoom': return 'crosshair';
				case 'reset-view': return 'pointer';
				default: return 'default';
			}
		});
	},

	// Reset view by clearing all axis limits
	reset_view: () => {
		// Clear all axis limit input fields
		const limitFields = ['x-axis-left', 'x-axis-right', 'y-axis-bottom', 'y-axis-top', 'yOther-axis-bottom', 'yOther-axis-top'];
		limitFields.forEach(fieldId => {
			const field = d3.select(`#${fieldId}`);
			if (!field.empty()) {
				field.property('value', '');
			}
		});
		
		// Reset axis limits in vis object
		Object.keys(vis.axes).forEach(axis => {
			vis.axes[axis].min = undefined;
			vis.axes[axis].max = undefined;
		});
		
		// Trigger redraw to auto-scale all axes
		vis.update_plot();
	},

	// Show inspector tooltip with axis values
	show_inspector_tooltip: (x, y) => {
		let label_data = [];
		Object.keys(vis.axes).forEach(axis => {
			if (vis.axes[axis].data_name && vis.svg[`mouse_${axis[0]}_pixel`] != null) {
				vis.axes[axis].mouse_val = vis.axes[axis].scale.invert(vis.svg[`mouse_${axis[0]}_pixel`]);
				
				// Get the cleaned axis label from the input field instead of using raw data_name
				let axisLabel;
				const axisLabelInput = d3.select(`#${axis}-axis-label`);
				if (!axisLabelInput.empty() && axisLabelInput.property('value').trim() !== '') {
					axisLabel = axisLabelInput.property('value').trim();
				} else {
					// Fallback: clean the data_name if no label is set
					axisLabel = vis.axes[axis].data_name
						.replace(/^log[_\s]*/i, '')     // Remove "log_" or "log " prefix
						.replace(/^log(?=[A-Z])/i, '')  // Remove "log" before capitals  
						.replace(/_/g, ' ');            // Replace underscores with spaces
				}
				
				label_data.push({
					axis: vis.axes[axis], 
					val: vis.axes[axis].mouse_val,
					label: axisLabel
				});
				
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
			} else {
				vis.axes[axis].mouse_val = null;
			}
		});
		
		if (label_data.length > 0) {
			let mouse_text = vis.svg.select('#mouse-text');
			if (mouse_text.empty()) {
				mouse_text = vis.svg.append('text')
					.attr('id', 'mouse-text')
					.attr('x', x + 20)
					.attr('y', y + 35)
					.attr('text-anchor', 'start')
					.attr('dominant-baseline', 'baseline')
					.attr('fill', vis.axes.x.color)
					.attr('font-size', style_manager.styles.global.font_size);
			}
			
			// Update position and clear existing content
			mouse_text.attr('x', x + 20).attr('y', y + 35);
			mouse_text.selectAll('tspan').remove();
			
			// Create multi-line inspector tooltip with proper markup rendering
			label_data.forEach((d, i) => {
				// Create container tspan for this line
				const lineSpan = mouse_text.append('tspan')
					.attr('x', x + 20)
					.attr('y', y + 35)
					.attr('dy', (i * 1.2).toString() + 'em')
					.attr('fill', d.axis.color)
					.attr('dominant-baseline', 'baseline'); // Consistent with axis labels
				
				// Apply markup rendering to the label part
				const labelWithValue = `${d.label}: ${d.val}`;
				text_markup.apply_inline_markup(lineSpan, labelWithValue, {
					fontSize: style_manager.styles.global.font_size,
					fill: d.axis.color
				});
			});
			
			// Update background rectangle
			let bbox = mouse_text.node().getBBox();
			let margin = 5;
			let rect = vis.svg.select('#mouse-text-bg');
			if (rect.empty()) {
				rect = vis.svg.insert('rect', () => mouse_text.node())
					.attr('id', 'mouse-text-bg');
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
	},

	// Execute pan operation and update axis limits
	execute_pan: () => {
		// Calculate visual movement for consistent dual y-axis behavior
		const pixelDy = interaction_manager.interaction.drag_end.y - interaction_manager.interaction.drag_start.y;
		
		// Calculate data coordinate changes
		Object.keys(vis.axes).forEach(axis => {
			if (vis.axes[axis].scale && vis.axes[axis].data_name) {
				let deltaData;
				if (axis === 'x') {
					deltaData = vis.axes[axis].scale.invert(interaction_manager.interaction.drag_start.x) - 
					           vis.axes[axis].scale.invert(interaction_manager.interaction.drag_end.x);
				} else {
					// For y-axes, calculate the visual percentage movement and apply to each axis's range
					const currentMin = vis.axes[axis].min || vis.axes[axis].scale.domain()[0];
					const currentMax = vis.axes[axis].max || vis.axes[axis].scale.domain()[1];
					const currentRange = currentMax - currentMin;
					
					// Calculate what percentage of the visual height we moved
					const plotHeight = vis.axes[axis].scale.range()[0] - vis.axes[axis].scale.range()[1]; // range is [bottom, top]
					const visualPercent = -pixelDy / plotHeight; // negative because SVG y is inverted
					
					// Apply this percentage to the current data range
					deltaData = visualPercent * currentRange;
				}
				
				// Validate deltaData to prevent invalid values
				if (!isFinite(deltaData) || isNaN(deltaData)) {
					console.warn(`Invalid deltaData for axis ${axis}:`, deltaData);
					return;
				}
				
				// Update axis limits
				const currentMin = vis.axes[axis].min || vis.axes[axis].scale.domain()[0];
				const currentMax = vis.axes[axis].max || vis.axes[axis].scale.domain()[1];
				
				// Validate current limits
				if (!isFinite(currentMin) || !isFinite(currentMax) || isNaN(currentMin) || isNaN(currentMax)) {
					console.warn(`Invalid current limits for axis ${axis}:`, currentMin, currentMax);
					return;
				}
				
				const newMin = currentMin + deltaData;
				const newMax = currentMax + deltaData;
				
				// Special validation for logarithmic axes
				if (vis.axes[axis].type === 'log') {
					if (newMin <= 0 || newMax <= 0) {
						console.warn(`Log axis ${axis} pan would create non-positive limits:`, newMin, newMax);
						return; // Skip this axis - can't have non-positive values on log scale
					}
				}
				
				// Validate new limits
				if (!isFinite(newMin) || !isFinite(newMax) || isNaN(newMin) || isNaN(newMax)) {
					console.warn(`Invalid new limits for axis ${axis}:`, newMin, newMax);
					return;
				}
				
				vis.axes[axis].min = newMin;
				vis.axes[axis].max = newMax;
				
				// Update input fields with correct field IDs
				let minFieldId, maxFieldId;
				if (axis === 'x') {
					minFieldId = 'x-axis-left';
					maxFieldId = 'x-axis-right';
				} else if (axis === 'y') {
					minFieldId = 'y-axis-bottom';
					maxFieldId = 'y-axis-top';
				} else if (axis === 'yOther') {
					minFieldId = 'yOther-axis-bottom';
					maxFieldId = 'yOther-axis-top';
				}
				
				const minField = d3.select(`#${minFieldId}`);
				const maxField = d3.select(`#${maxFieldId}`);
				
				if (!minField.empty()) minField.property('value', vis.axes[axis].min);
				if (!maxField.empty()) maxField.property('value', vis.axes[axis].max);
			}
		});
		
		vis.update_plot();
	},

	// Execute box zoom operation
	execute_box_zoom: () => {
		const startX = Math.min(interaction_manager.interaction.drag_start.x, interaction_manager.interaction.drag_end.x);
		const endX = Math.max(interaction_manager.interaction.drag_start.x, interaction_manager.interaction.drag_end.x);
		const startY = Math.min(interaction_manager.interaction.drag_start.y, interaction_manager.interaction.drag_end.y);
		const endY = Math.max(interaction_manager.interaction.drag_start.y, interaction_manager.interaction.drag_end.y);
		
		// Only zoom if the rectangle is large enough
		if (Math.abs(endX - startX) > 10 && Math.abs(endY - startY) > 10) {
			// Update x-axis limits
			if (vis.axes.x.scale && vis.axes.x.data_name) {
				vis.axes.x.min = vis.axes.x.scale.invert(startX);
				vis.axes.x.max = vis.axes.x.scale.invert(endX);
				
				d3.select('#x-axis-left').property('value', vis.axes.x.min);
				d3.select('#x-axis-right').property('value', vis.axes.x.max);
			}
			
			// Update y-axis limits (y coordinates are inverted in SVG)
			// Both y-axes use the same pixel coordinates for visual consistency
			if (vis.axes.y.scale && vis.axes.y.data_name) {
				vis.axes.y.min = vis.axes.y.scale.invert(endY);
				vis.axes.y.max = vis.axes.y.scale.invert(startY);
				
				d3.select('#y-axis-bottom').property('value', vis.axes.y.min);
				d3.select('#y-axis-top').property('value', vis.axes.y.max);
			}
			
			// Update yOther-axis limits using same pixel coordinates for visual consistency
			if (vis.axes.yOther.scale && vis.axes.yOther.data_name) {
				vis.axes.yOther.min = vis.axes.yOther.scale.invert(endY);
				vis.axes.yOther.max = vis.axes.yOther.scale.invert(startY);
				
				d3.select('#yOther-axis-bottom').property('value', vis.axes.yOther.min);
				d3.select('#yOther-axis-top').property('value', vis.axes.yOther.max);
			}
			
			vis.update_plot();
		}
	},

	// Apply temporary transform for real-time pan feedback
	apply_pan_transform: (dx, dy) => {
		// Apply temporary transform to data elements for real-time feedback
		// Transform all plot data elements (line groups and marker paths)
		const dataElements = vis.svg.selectAll('g[class*="line-series-"], path[class*="marker-"]');
		
		// Apply CSS transform - use transform attribute for better SVG compatibility
		dataElements.attr('transform', function() {
			const existing = d3.select(this).attr('transform') || '';
			// Remove any existing translate and add the new one
			const cleaned = existing.replace(/translate\([^)]*\)/g, '').trim();
			return `translate(${dx}, ${dy}) ${cleaned}`.trim();
		});
	},

	// Finalize pan by removing transforms and executing
	finalize_pan: () => {
		// Remove transform from data elements
		const dataElements = vis.svg.selectAll('g[class*="line-series-"], path[class*="marker-"]');
		
		dataElements.attr('transform', function() {
			const existing = d3.select(this).attr('transform') || '';
			// Remove any translate transform, keeping other transforms
			return existing.replace(/translate\([^)]*\)/g, '').trim() || null;
		});
		
		// Execute the pan operation to update axis limits and redraw
		interaction_manager.execute_pan();
	}
};