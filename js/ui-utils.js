// Helper functions
safe_log = val => {
	if (val <= 0) {
		return -99;
	} else {
		return Math.log10(val);
	}
};

// Main application setup coordinator
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
	style_manager.setup_style_handlers();
	series_manager.setup();
	
	// Setup files panel hide/show toggle
	setup_files_panel_toggle();
	
	// Setup miniature plot functionality
	setup_mini_plot();
	
	// Setup responsive plot resizing
	setup_plot_resize_observer();
	
	// Setup collapsible axis settings
	setup_axis_settings_collapse();
};

// Track if files panel is hidden
let files_panel_hidden = false;

// Setup files panel toggle functionality
setup_files_panel_toggle = () => {
	const hideToggle = document.getElementById('files-hide-toggle');
	const showToggle = document.getElementById('files-show-toggle');
	
	if (hideToggle) {
		hideToggle.addEventListener('click', hide_files_panel);
	}
	
	if (showToggle) {
		showToggle.addEventListener('click', show_files_panel);
	}
};

// Hide the files panel and expand visualization
hide_files_panel = () => {
	const filesColumn = document.getElementById('files-column');
	const vizColumn = document.getElementById('visualization-column');
	const summaryBar = document.getElementById('files-summary-bar');
	
	if (!filesColumn || !vizColumn || !summaryBar) {
		return;
	}
	
	// Hide files column
	filesColumn.style.display = 'none';
	
	// Expand visualization column to full width
	vizColumn.classList.remove('col-sm-8');
	vizColumn.classList.add('col-12');
	
	// Show summary bar
	summaryBar.classList.remove('d-none');
	
	// Update summary text
	update_files_summary();
	
	files_panel_hidden = true;
	
	// Update axis controls layout
	update_axis_controls_layout();
	
	// Trigger plot resize after layout change
	setTimeout(() => {
		if (typeof vis !== 'undefined' && vis.update_plot) {
			vis.update_plot();
		}
	}, 100);
};

// Show the files panel and restore layout
show_files_panel = () => {
	const filesColumn = document.getElementById('files-column');
	const vizColumn = document.getElementById('visualization-column');
	const summaryBar = document.getElementById('files-summary-bar');
	
	if (!filesColumn || !vizColumn || !summaryBar) {
		return;
	}
	
	// Show files column
	filesColumn.style.display = 'block';
	
	// Restore visualization column width
	vizColumn.classList.remove('col-12');
	vizColumn.classList.add('col-sm-8');
	
	// Hide summary bar
	summaryBar.classList.add('d-none');
	
	files_panel_hidden = false;
	
	// Update axis controls layout
	update_axis_controls_layout();
	
	// Trigger plot resize after layout change
	setTimeout(() => {
		if (typeof vis !== 'undefined' && vis.update_plot) {
			vis.update_plot();
		}
	}, 100);
};

// Update the files summary text
update_files_summary = () => {
	const summaryText = document.getElementById('files-summary-text');
	
	if (file_manager.files.length === 0) {
		summaryText.textContent = 'No files loaded';
		return;
	}
	
	if (file_manager.current_mode === 'single') {
		if (file_manager.active_file) {
			// Use local_name (user-editable display name without extension)
			const displayName = file_manager.active_file.local_name || file_manager.active_file.name || 'Unknown file';
			summaryText.textContent = `Plotting: ${displayName}`;
		} else {
			summaryText.textContent = `${file_manager.files.length} file(s) available`;
		}
	} else {
		// Multi-file mode
		const selectedCount = file_manager.active_files.length;
		if (selectedCount === 0) {
			summaryText.textContent = `${file_manager.files.length} files available (none selected)`;
		} else if (selectedCount === 1) {
			const selectedFile = file_manager.active_files[0];
			const displayName = selectedFile.local_name || selectedFile.name;
			summaryText.textContent = `Plotting: ${displayName}`;
		} else {
			summaryText.textContent = `Plotting ${selectedCount} files`;
		}
	}
};

// Miniature plot functionality
let mini_plot_visible = false;

setup_mini_plot = () => {
	const mainPlotContainer = document.getElementById('main-plot-container');
	const miniPlotContainer = document.getElementById('mini-plot-container');
	
	// Add click handler to mini plot to scroll back to main plot
	miniPlotContainer.addEventListener('click', () => {
		mainPlotContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
	});
	
	// Enable pointer events when visible
	const observer = new IntersectionObserver((entries) => {
		const entry = entries[0];
		const visiblePercentage = entry.intersectionRatio;
		
		// Show mini plot when main plot is less than 50% visible
		if (visiblePercentage < 0.5 && !mini_plot_visible) {
			show_mini_plot();
		} else if (visiblePercentage >= 0.5 && mini_plot_visible) {
			hide_mini_plot();
		}
	}, {
		threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
	});
	
	observer.observe(mainPlotContainer);
};

show_mini_plot = () => {
	const miniPlotContainer = document.getElementById('mini-plot-container');
	miniPlotContainer.style.opacity = '0.9';
	miniPlotContainer.style.pointerEvents = 'auto';
	
	// Adjust position based on whether files panel is hidden
	if (files_panel_hidden) {
		miniPlotContainer.style.right = '20px';
	} else {
		miniPlotContainer.style.right = '20px';
	}
	
	mini_plot_visible = true;
	
	// Copy current plot to mini plot
	sync_mini_plot();
};

hide_mini_plot = () => {
	const miniPlotContainer = document.getElementById('mini-plot-container');
	miniPlotContainer.style.opacity = '0';
	miniPlotContainer.style.pointerEvents = 'none';
	mini_plot_visible = false;
};

sync_mini_plot = () => {
	if (!mini_plot_visible) return;
	
	const mainSvg = document.getElementById('plot');
	const miniSvg = document.getElementById('mini-plot');
	
	// Clone the main SVG content to mini SVG
	try {
		// Clear mini plot
		miniSvg.innerHTML = '';
		
		// Get the dimensions of both SVGs
		const mainRect = mainSvg.getBoundingClientRect();
		const miniRect = miniSvg.getBoundingClientRect();
		
		// Calculate scale to fit entire main plot in mini plot
		const scaleX = miniRect.width / mainRect.width;
		const scaleY = miniRect.height / mainRect.height;
		const scale = Math.min(scaleX, scaleY) * 0.9; // 0.9 for some padding
		
		// Copy all children from main plot
		const mainContent = mainSvg.cloneNode(true);
		
		// Create a scaled group that will contain everything
		const scaleGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
		
		// Calculate center offset to center the scaled content
		const offsetX = (miniRect.width - (mainRect.width * scale)) / 2;
		const offsetY = (miniRect.height - (mainRect.height * scale)) / 2;
		
		scaleGroup.setAttribute('transform', `translate(${offsetX}, ${offsetY}) scale(${scale})`);
		
		// Move all children to scaled group
		while (mainContent.firstChild) {
			scaleGroup.appendChild(mainContent.firstChild);
		}
		
		miniSvg.appendChild(scaleGroup);
		
		// Adjust text sizes for readability in mini plot
		const texts = miniSvg.querySelectorAll('text');
		texts.forEach(text => {
			const currentSize = parseFloat(text.getAttribute('font-size') || '12');
			text.setAttribute('font-size', Math.max(6, currentSize * scale * 1.2));
		});
		
	} catch (error) {
		console.warn('Could not sync mini plot:', error);
	}
};

// Setup responsive plot resizing
setup_plot_resize_observer = () => {
	const plotContainer = document.getElementById('main-plot-container');
	
	if (!plotContainer || !window.ResizeObserver) {
		return; // ResizeObserver not supported
	}
	
	let resizeTimeout;
	const resizeObserver = new ResizeObserver(() => {
		// Debounce resize events to avoid excessive updates
		clearTimeout(resizeTimeout);
		resizeTimeout = setTimeout(() => {
			if (typeof vis !== 'undefined' && vis.update_plot) {
				vis.update_plot();
			}
		}, 150);
	});
	
	resizeObserver.observe(plotContainer);
};

// Setup collapsible axis settings with chevron rotation
setup_axis_settings_collapse = () => {
	const collapseElements = ['x-axis-settings-collapse', 'y-axis-settings-collapse', 'yOther-axis-settings-collapse'];
	const chevronIds = ['x-axis-chevron', 'y-axis-chevron', 'yOther-axis-chevron'];
	
	collapseElements.forEach((collapseId, index) => {
		const collapseElement = document.getElementById(collapseId);
		const chevronElement = document.getElementById(chevronIds[index]);
		
		if (collapseElement && chevronElement) {
			collapseElement.addEventListener('show.bs.collapse', () => {
				chevronElement.classList.remove('bi-chevron-right');
				chevronElement.classList.add('bi-chevron-down');
			});
			
			collapseElement.addEventListener('hide.bs.collapse', () => {
				chevronElement.classList.remove('bi-chevron-down');
				chevronElement.classList.add('bi-chevron-right');
			});
		}
	});
};

// Update axis controls layout based on files panel state
update_axis_controls_layout = () => {
	const xAxisContainer = document.querySelector('#x-axis-container');
	const yAxesContainer = document.querySelector('#y-axes-container');
	
	if (files_panel_hidden) {
		// When files panel is hidden, use column layout
		xAxisContainer.className = 'col-12 col-xl-6';
		yAxesContainer.className = 'col-12 col-xl-6';
	} else {
		// When files panel is visible, stack vertically
		xAxisContainer.className = 'col-12';
		yAxesContainer.className = 'col-12';
	}
};