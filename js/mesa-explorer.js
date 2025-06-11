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
	// Track current mode: 'single' or 'multi'
	current_mode: 'multi',
	// Track active file in single mode
	active_file: null,
	setup: () => {
		document.querySelector('#mesa-input').addEventListener('change', event => {
			file_manager.load_all_files(event.target);
		});
		document.querySelector('#select-all-files').addEventListener('change', event => {
			file_manager.handle_select_all(event.target);
		});
		document.querySelector('#single-file-mode').addEventListener('click', () => {
			file_manager.switch_to_single_mode();
		});
		document.querySelector('#multi-file-mode').addEventListener('click', () => {
			file_manager.switch_to_multi_mode();
		});
		// Hide select all checkbox initially
		file_manager.update_select_all_state();
		// Setup keyboard navigation
		file_manager.setup_keyboard_navigation();
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
				})
				.on('click', function(event, d) {
					// Handle clicks based on current mode
					if (file_manager.current_mode === 'single') {
						// Don't trigger if clicking on checkbox, input, or button
						if (event.target.type === 'checkbox' || 
							event.target.type === 'text' || 
							event.target.type === 'button' ||
							event.target.tagName === 'BUTTON' ||
							event.target.tagName === 'I') {
							return;
						}
						file_manager.handle_single_file_click(d);
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
				.style('width', '150px')
				.property('value', f => f.local_name)
				.property('disabled', f => f.type == 'unknown')
				.on('input', function(event, d) {
					d.local_name = this.value;
					
					// Update files summary if panel is hidden and this is the active file
					if (files_panel_hidden && typeof update_files_summary === 'function' && 
						file_manager.current_mode === 'single' && d === file_manager.active_file) {
						update_files_summary();
					}
				});

			// Add original filename as small text
			fileItems.append('small')
				.attr('class', 'text-muted ms-2')
				.text(f => f.name != f.local_name ? `(${f.name})` : '');

			// Add remove button
			fileItems.append('button')
				.attr('type', 'button')
				.attr('class', 'btn btn-outline-danger btn-sm ms-auto')
				.style('float', 'right')
				.html('<i class="bi bi-trash"></i>')
				.attr('title', 'Remove file')
				.on('click', function(event, d) {
					file_manager.remove_file(d);
				});

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
			
			// Auto-detect default mode based on file count
			const validFiles = file_manager.files.filter(f => f.type !== 'unknown');
			if (validFiles.length === 1) {
				// Single file - switch to single mode
				file_manager.switch_to_single_mode();
			} else if (validFiles.length > 1) {
				// Multiple files - ensure we're in multi mode and update UI
				file_manager.update_ui_for_mode();
			}
			
			// Update select all checkbox state
			file_manager.update_select_all_state();
			
			// Update files summary if panel is hidden
			if (files_panel_hidden && typeof update_files_summary === 'function') {
				update_files_summary();
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
		
		// Update select all checkbox state
		file_manager.update_select_all_state();
		
		// Notify visualization
		vis.register_new_files();
	},
	// Handle select all checkbox
	handle_select_all: function(selectAllCheckbox) {
		const selectableFiles = file_manager.files.filter(f => f.type !== 'unknown');
		
		if (selectAllCheckbox.checked) {
			// Get the type of currently selected files
			const currentlySelected = file_manager.files.filter(f => f.selected);
			let targetType = null;
			
			if (currentlySelected.length > 0) {
				// Use the type of the currently selected files
				targetType = currentlySelected[0].type;
			} else if (selectableFiles.length > 0) {
				// If no files are selected, use the first selectable file type
				targetType = selectableFiles[0].type;
			}
			
			if (targetType) {
				selectableFiles.forEach(f => {
					if (f.type === targetType) {
						f.selected = true;
					}
				});
			}
		} else {
			// Deselect all files
			file_manager.files.forEach(f => {
				f.selected = false;
			});
		}
		
		// Update checkboxes in DOM
		d3.selectAll('.file-item input[type="checkbox"]')
			.property('checked', f => f.selected);
		
		// Update active files array
		file_manager.active_files = file_manager.files.filter(f => f.selected);
		
		// Notify visualization
		vis.register_new_files();
	},
	// Update the select all checkbox state based on current selections
	update_select_all_state: function() {
		const selectAllCheckbox = document.querySelector('#select-all-files');
		const selectAllContainer = selectAllCheckbox.closest('.mb-2');
		const selectableFiles = file_manager.files.filter(f => f.type !== 'unknown');
		
		// Hide checkbox if no files are uploaded or in single file mode
		if (selectableFiles.length === 0 || file_manager.current_mode === 'single') {
			selectAllContainer.style.display = 'none';
			return;
		} else {
			selectAllContainer.style.display = 'block';
		}
		
		const selectedFiles = selectableFiles.filter(f => f.selected);
		
		if (selectedFiles.length === 0) {
			// No files selected - unchecked state
			selectAllCheckbox.checked = false;
			selectAllCheckbox.indeterminate = false;
		} else {
			// Get the type of currently selected files to determine what "all" means
			const selectedType = selectedFiles[0].type;
			const filesOfSameType = selectableFiles.filter(f => f.type === selectedType);
			const selectedFilesOfSameType = selectedFiles.filter(f => f.type === selectedType);
			
			if (selectedFilesOfSameType.length === filesOfSameType.length) {
				// All files of the same type are selected - checked state
				selectAllCheckbox.checked = true;
				selectAllCheckbox.indeterminate = false;
			} else {
				// Some files of the same type selected - indeterminate state
				selectAllCheckbox.checked = false;
				selectAllCheckbox.indeterminate = true;
			}
		}
		
		// Update files summary if panel is hidden
		if (files_panel_hidden && typeof update_files_summary === 'function') {
			update_files_summary();
		}
	},
	// Remove a file from the files array and update UI
	remove_file: function(fileToRemove) {
		// Remove from files array
		const fileIndex = file_manager.files.findIndex(f => f === fileToRemove);
		if (fileIndex !== -1) {
			file_manager.files.splice(fileIndex, 1);
		}
		
		// Update active files array to remove this file if it was selected
		file_manager.active_files = file_manager.active_files.filter(f => f !== fileToRemove);
		
		// Remove the DOM element
		d3.selectAll('.file-item')
			.filter(d => d === fileToRemove)
			.remove();
		
		// Show the "no files" prompt if no files remain
		if (file_manager.files.length === 0) {
			d3.select('#file-prompt').classed('d-none', false);
		}
		
		// Update select all checkbox state
		file_manager.update_select_all_state();
		
		// Update files summary if panel is hidden
		if (files_panel_hidden && typeof update_files_summary === 'function') {
			update_files_summary();
		}
		
		// If we removed the last selected file, auto-select the first available file
		if (file_manager.active_files.length === 0 && file_manager.files.length > 0) {
			const firstValidFile = file_manager.files.find(f => f.type !== 'unknown');
			if (firstValidFile) {
				firstValidFile.selected = true;
				file_manager.handle_file_selection(firstValidFile);
				// Update checkbox state in DOM
				d3.selectAll('.file-item input[type="checkbox"]')
					.property('checked', f => f.selected);
			}
		}
		
		// Notify visualization to update
		vis.register_new_files();
	},
	// Switch to single file mode
	switch_to_single_mode: function() {
		file_manager.current_mode = 'single';
		
		// Update button states
		document.querySelector('#single-file-mode').classList.add('active');
		document.querySelector('#multi-file-mode').classList.remove('active');
		
		// Hide checkboxes and select all
		file_manager.update_ui_for_mode();
		
		// Convert from multi-file selection to single file
		const selectedFiles = file_manager.files.filter(f => f.selected);
		if (selectedFiles.length > 0) {
			// Keep the topmost (first) selected file
			file_manager.active_file = selectedFiles[0];
			// Clear all selections
			file_manager.files.forEach(f => f.selected = false);
		} else if (file_manager.files.length > 0) {
			// No files selected, pick first valid file
			file_manager.active_file = file_manager.files.find(f => f.type !== 'unknown');
		}
		
		// Update active files for visualization
		file_manager.active_files = file_manager.active_file ? [file_manager.active_file] : [];
		
		// Update UI and visualization
		file_manager.update_ui_for_mode();
		vis.register_new_files();
		
		// Update files summary if panel is hidden
		if (files_panel_hidden && typeof update_files_summary === 'function') {
			update_files_summary();
		}
	},
	// Switch to multi-file mode
	switch_to_multi_mode: function() {
		file_manager.current_mode = 'multi';
		
		// Update button states
		document.querySelector('#multi-file-mode').classList.add('active');
		document.querySelector('#single-file-mode').classList.remove('active');
		
		// Convert from single file to multi-file selection
		if (file_manager.active_file) {
			file_manager.active_file.selected = true;
		}
		
		// Update active files
		file_manager.active_files = file_manager.files.filter(f => f.selected);
		
		// Update UI and visualization
		file_manager.update_ui_for_mode();
		vis.register_new_files();
		
		// Update files summary if panel is hidden
		if (files_panel_hidden && typeof update_files_summary === 'function') {
			update_files_summary();
		}
	},
	// Update UI elements based on current mode
	update_ui_for_mode: function() {
		const selectAllContainer = document.querySelector('#select-all-files').closest('.mb-2');
		
		if (file_manager.current_mode === 'single') {
			// Hide select all checkbox and checkboxes
			selectAllContainer.style.display = 'none';
			d3.selectAll('.file-item input[type="checkbox"]').style('display', 'none');
			
			// Hide delete button only on the currently active file
			d3.selectAll('.file-item button')
				.style('display', d => d === file_manager.active_file ? 'none' : 'inline-block');
			
			// Update active states on list items and fix text visibility
			d3.selectAll('.file-item')
				.classed('active', d => d === file_manager.active_file);
			
			// Make original filename text white when active in light mode for better visibility
			d3.selectAll('.file-item')
				.selectAll('small')
				.classed('text-white', d => d === file_manager.active_file);
		} else {
			// Show select all checkbox and checkboxes if there are files
			if (file_manager.files.length > 0) {
				selectAllContainer.style.display = 'block';
			}
			d3.selectAll('.file-item input[type="checkbox"]').style('display', 'inline-block');
			
			// Show all delete buttons in multi mode
			d3.selectAll('.file-item button').style('display', 'inline-block');
			
			// Clear active states and update checkbox states
			d3.selectAll('.file-item')
				.classed('active', false);
			d3.selectAll('.file-item input[type="checkbox"]')
				.property('checked', f => f.selected);
			
			// Remove white text class from all small elements
			d3.selectAll('.file-item small')
				.classed('text-white', false);
		}
		
		// Update select all state
		file_manager.update_select_all_state();
	},
	// Handle file click in single mode
	handle_single_file_click: function(file) {
		if (file.type === 'unknown') return;
		
		file_manager.active_file = file;
		file_manager.active_files = [file];
		
		// Update UI
		d3.selectAll('.file-item')
			.classed('active', d => d === file);
		
		// Update text visibility for active state
		d3.selectAll('.file-item')
			.selectAll('small')
			.classed('text-white', d => d === file);
		
		// Hide delete button only on the currently active file
		d3.selectAll('.file-item button')
			.style('display', d => d === file ? 'none' : 'inline-block');
		
		// Notify visualization
		vis.register_new_files();
		
		// Update files summary if panel is hidden
		if (files_panel_hidden && typeof update_files_summary === 'function') {
			update_files_summary();
		}
	},
	// Setup keyboard navigation
	setup_keyboard_navigation: function() {
		document.addEventListener('keydown', function(event) {
			// Only handle arrow keys in single file mode
			if (file_manager.current_mode !== 'single') return;
			
			// Check if user is interacting with an input or dropdown
			const activeElement = document.activeElement;
			const isInputFocused = activeElement && (
				activeElement.tagName === 'INPUT' ||
				activeElement.tagName === 'TEXTAREA' ||
				activeElement.tagName === 'SELECT' ||
				activeElement.isContentEditable
			);
			
			// Check if any Bootstrap dropdown is open
			const isDropdownOpen = document.querySelector('.dropdown-menu.show');
			
			// If input is focused or dropdown is open, let default behavior handle it
			if (isInputFocused || isDropdownOpen) return;
			
			// Handle arrow keys for file navigation
			if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
				event.preventDefault();
				file_manager.navigate_files(event.key === 'ArrowUp' ? -1 : 1);
			}
		});
	},
	// Navigate through files with arrow keys
	navigate_files: function(direction) {
		const selectableFiles = file_manager.files.filter(f => f.type !== 'unknown');
		if (selectableFiles.length === 0) return;
		
		let currentIndex = selectableFiles.findIndex(f => f === file_manager.active_file);
		if (currentIndex === -1) currentIndex = 0;
		
		// Calculate new index with wrapping
		let newIndex = currentIndex + direction;
		if (newIndex < 0) newIndex = selectableFiles.length - 1;
		if (newIndex >= selectableFiles.length) newIndex = 0;
		
		// Switch to new file
		file_manager.handle_single_file_click(selectableFiles[newIndex]);
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
						.attr('font-size', vis.styles.global.font_size);
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
	// Style management system
	styles: {
		// Persistent style storage by series ID
		persistent_styles: {},
		
		// Global style settings
		global: {
			color_scheme: 'tableau10',
			default_line_width: 2.0,
			default_marker_size: 4,
			default_opacity: 1.0,
			font_size: 12
		},
		
		// Available color schemes
		color_schemes: {
			tableau10: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'],
			set1: ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33', '#a65628', '#f781bf', '#999999'],
			set2: ['#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f', '#e5c494', '#b3b3b3'],
			dark2: ['#1b9e77', '#d95f02', '#7570b3', '#e7298a', '#66a61e', '#e6ab02', '#a6761d', '#666666'],
			viridis: ['#440154', '#482777', '#3f4a8a', '#31678e', '#26838f', '#1f9d8a', '#6cce5a', '#b6de2b', '#fee825'],
			magma: ['#000004', '#180f3d', '#440f76', '#721f81', '#9f2f7f', '#cd4071', '#f1605d', '#fd9668', '#fcfdbf'],
			plasma: ['#0d0887', '#5302a3', '#8b0aa5', '#b83289', '#db5c68', '#f48849', '#febd2a', '#f0f921'],
			inferno: ['#000004', '#1b0c41', '#4a0c6b', '#781c6d', '#a52c60', '#cf4446', '#ed6925', '#fb9b06', '#fcffa4']
		},
		
		// Line style options
		line_styles: {
			solid: 'none',
			dashed: '5,5',
			dotted: '2,3',
			dashdot: '5,5,2,5'
		},
		
		// Marker shapes with D3 symbols
		marker_shapes: {
			circle: d3.symbolCircle,
			square: d3.symbolSquare,
			triangle_up: d3.symbolTriangle,
			triangle_down: d3.symbolTriangle2,
			diamond: d3.symbolDiamond,
			star: d3.symbolStar,
			cross: d3.symbolCross,
			pentagon: d3.symbolWye,
			hexagon: d3.symbolSquare // D3 doesn't have hexagon, using square as placeholder
		}
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

		// Create series data for each file with persistent styling
		vis.series = vis.files.map((file, index) => {
			const series_id = vis.get_series_id(file, index);
			const style = vis.get_series_style(series_id, index);
			
			return {
				file: file,
				data: file.data.bulk,
				name: file.local_name,
				series_id: series_id,
				style: style,
				// Keep legacy color for compatibility
				color: style.color
			};
		});

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
		vis.update_style_panel();
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
			// Single file mode: restore original colors
			vis.axes.y.color = d3.schemeCategory10[0]; // blue
			vis.axes.yOther.color = d3.schemeCategory10[1]; // orange
		} else {
			// Multi-file mode: neutral color for y-axis
			vis.axes.y.color = vis.axes.x.color; // same as x-axis (black)
		}
		
		// Force plot refresh to update axis colors
		if (!vis.pause) {
			vis.update_plot();
		}
	},
	// Style management functions
	get_series_id: (file, index) => {
		return `${file.local_name}_${index}`;
	},
	get_series_style: (series_id, color_index) => {
		// Check if we have a persistent style for this series
		if (vis.styles.persistent_styles[series_id]) {
			return vis.styles.persistent_styles[series_id];
		}
		
		// Create default style from color scheme
		const colors = vis.styles.color_schemes[vis.styles.global.color_scheme];
		const color = colors[color_index % colors.length];
		
		const default_style = {
			color: color,
			show_line: true,
			show_markers: false,
			line_width: vis.styles.global.default_line_width,
			line_style: 'solid',
			marker_shape: 'circle',
			marker_size: vis.styles.global.default_marker_size,
			opacity: vis.styles.global.default_opacity
		};
		
		// Store it for persistence
		vis.styles.persistent_styles[series_id] = default_style;
		return default_style;
	},
	update_series_style: (series_id, style_updates) => {
		if (!vis.styles.persistent_styles[series_id]) {
			vis.styles.persistent_styles[series_id] = {};
		}
		Object.assign(vis.styles.persistent_styles[series_id], style_updates);
		vis.update_plot();
	},
	apply_global_style_changes: () => {
		// Apply global settings to all currently displayed series
		const colors = vis.styles.color_schemes[vis.styles.global.color_scheme];
		
		if (vis.series && vis.series.length > 0) {
			// Update current series with new global settings
			vis.series.forEach((series, index) => {
				const new_color = colors[index % colors.length];
				
				// Update series style
				series.style.color = new_color;
				series.style.line_width = vis.styles.global.default_line_width;
				series.style.marker_size = vis.styles.global.default_marker_size;
				series.style.opacity = vis.styles.global.default_opacity;
				
				// Update legacy color for compatibility
				series.color = new_color;
				
				// Update persistent storage
				vis.styles.persistent_styles[series.series_id] = { ...series.style };
			});
		}
		
		// Also update any other persistent styles not currently displayed
		Object.keys(vis.styles.persistent_styles).forEach((series_id, index) => {
			const style = vis.styles.persistent_styles[series_id];
			const new_color = colors[index % colors.length];
			
			style.color = new_color;
			style.line_width = vis.styles.global.default_line_width;
			style.marker_size = vis.styles.global.default_marker_size;
			style.opacity = vis.styles.global.default_opacity;
		});
		
		vis.update_plot();
		vis.update_style_panel();
	},
	// Style panel UI functions
	setup_style_handlers: () => {
		// Global style handlers
		d3.select('#colorSchemeSelect').on('change', function() {
			vis.styles.global.color_scheme = this.value;
			vis.apply_global_style_changes();
		});
		
		d3.select('#defaultLineWidth').on('input', function() {
			vis.styles.global.default_line_width = parseFloat(this.value);
			// Auto-apply to current series
			if (vis.series) {
				vis.series.forEach(series => {
					series.style.line_width = vis.styles.global.default_line_width;
					vis.styles.persistent_styles[series.series_id].line_width = vis.styles.global.default_line_width;
				});
				vis.update_plot();
				vis.update_style_panel();
			}
		});
		
		d3.select('#defaultMarkerSize').on('input', function() {
			vis.styles.global.default_marker_size = parseInt(this.value);
			// Auto-apply to current series
			if (vis.series) {
				vis.series.forEach(series => {
					series.style.marker_size = vis.styles.global.default_marker_size;
					vis.styles.persistent_styles[series.series_id].marker_size = vis.styles.global.default_marker_size;
				});
				vis.update_plot();
				vis.update_style_panel();
			}
		});
		
		d3.select('#defaultOpacity').on('input', function() {
			vis.styles.global.default_opacity = parseFloat(this.value);
			d3.select('#defaultOpacityValue').text(this.value);
			// Auto-apply to current series
			if (vis.series) {
				vis.series.forEach(series => {
					series.style.opacity = vis.styles.global.default_opacity;
					vis.styles.persistent_styles[series.series_id].opacity = vis.styles.global.default_opacity;
				});
				vis.update_plot();
				vis.update_style_panel();
			}
		});
		
		d3.select('#globalFontSize').on('input', function() {
			vis.styles.global.font_size = parseInt(this.value);
			d3.select('#globalFontSizeValue').text(this.value + 'px');
			// Apply immediately to plot
			vis.update_plot();
		});
		
		d3.select('#applyGlobalStyles').on('click', () => {
			vis.apply_global_style_changes();
		});
		
		d3.select('#resetAllStyles').on('click', () => {
			vis.styles.persistent_styles = {};
			vis.apply_global_style_changes();
		});
		
		// Preset handlers
		d3.select('#saveStylePreset').on('click', () => {
			localStorage.setItem('mesa_explorer_style_preset', JSON.stringify(vis.styles));
			alert('Style preset saved!');
		});
		
		d3.select('#loadStylePreset').on('click', () => {
			const saved = localStorage.getItem('mesa_explorer_style_preset');
			if (saved) {
				Object.assign(vis.styles, JSON.parse(saved));
				vis.update_style_panel();
				vis.update_plot();
				alert('Style preset loaded!');
			} else {
				alert('No saved preset found.');
			}
		});
	},
	update_style_panel: () => {
		if (!vis.series || vis.series.length === 0) return;
		
		// Update global settings
		d3.select('#colorSchemeSelect').property('value', vis.styles.global.color_scheme);
		d3.select('#defaultLineWidth').property('value', vis.styles.global.default_line_width);
		d3.select('#defaultMarkerSize').property('value', vis.styles.global.default_marker_size);
		d3.select('#defaultOpacity').property('value', vis.styles.global.default_opacity);
		d3.select('#defaultOpacityValue').text(vis.styles.global.default_opacity.toFixed(1));
		d3.select('#globalFontSize').property('value', vis.styles.global.font_size);
		d3.select('#globalFontSizeValue').text(vis.styles.global.font_size + 'px');
		
		// Generate individual series controls
		const container = d3.select('#seriesStylesList');
		container.selectAll('.series-style-item').remove();
		
		const seriesItems = container.selectAll('.series-style-item')
			.data(vis.series)
			.enter()
			.append('div')
			.attr('class', 'series-style-item border rounded p-3 mb-3');
		
		// Series name header
		seriesItems.append('h6')
			.style('color', d => d.style.color)
			.text(d => d.name);
		
		// Plot type controls
		const plotTypeRow = seriesItems.append('div')
			.attr('class', 'row mb-3');
		
		const lineCol = plotTypeRow.append('div')
			.attr('class', 'col-6');
		
		lineCol.append('div')
			.attr('class', 'form-check')
			.each(function(d) {
				const div = d3.select(this);
				div.append('input')
					.attr('class', 'form-check-input')
					.attr('type', 'checkbox')
					.attr('id', `line-${d.series_id}`)
					.property('checked', d.style.show_line)
					.on('change', function() {
						vis.update_series_style(d.series_id, { show_line: this.checked });
					});
				
				div.append('label')
					.attr('class', 'form-check-label')
					.attr('for', `line-${d.series_id}`)
					.text('Line');
			});
		
		const markerCol = plotTypeRow.append('div')
			.attr('class', 'col-6');
		
		markerCol.append('div')
			.attr('class', 'form-check')
			.each(function(d) {
				const div = d3.select(this);
				div.append('input')
					.attr('class', 'form-check-input')
					.attr('type', 'checkbox')
					.attr('id', `marker-${d.series_id}`)
					.property('checked', d.style.show_markers)
					.on('change', function() {
						vis.update_series_style(d.series_id, { show_markers: this.checked });
					});
				
				div.append('label')
					.attr('class', 'form-check-label')
					.attr('for', `marker-${d.series_id}`)
					.text('Markers');
			});
		
		// Color picker
		seriesItems.append('div')
			.attr('class', 'mb-3')
			.each(function(d) {
				const div = d3.select(this);
				div.append('label')
					.attr('class', 'form-label')
					.text('Color');
				
				div.append('input')
					.attr('type', 'color')
					.attr('class', 'form-control form-control-color')
					.property('value', d.style.color)
					.on('change', function() {
						vis.update_series_style(d.series_id, { color: this.value });
					});
			});
		
		// Line settings
		const lineSettingsRow = seriesItems.append('div')
			.attr('class', 'row mb-3');
		
		// Line width
		lineSettingsRow.append('div')
			.attr('class', 'col-4')
			.each(function(d) {
				const div = d3.select(this);
				div.append('label')
					.attr('class', 'form-label small')
					.text('Width');
				
				div.append('input')
					.attr('type', 'number')
					.attr('class', 'form-control form-control-sm')
					.attr('min', '0.5')
					.attr('max', '10')
					.attr('step', '0.5')
					.property('value', d.style.line_width)
					.on('change', function() {
						vis.update_series_style(d.series_id, { line_width: parseFloat(this.value) });
					});
			});
		
		// Line style
		lineSettingsRow.append('div')
			.attr('class', 'col-4')
			.each(function(d) {
				const div = d3.select(this);
				div.append('label')
					.attr('class', 'form-label small')
					.text('Style');
				
				const select = div.append('select')
					.attr('class', 'form-select form-select-sm')
					.property('value', d.style.line_style)
					.on('change', function() {
						vis.update_series_style(d.series_id, { line_style: this.value });
					});
				
				select.selectAll('option')
					.data(Object.keys(vis.styles.line_styles))
					.enter()
					.append('option')
					.attr('value', d => d)
					.property('selected', style => style === d.style.line_style)
					.text(d => d.charAt(0).toUpperCase() + d.slice(1));
			});
		
		// Opacity
		lineSettingsRow.append('div')
			.attr('class', 'col-4')
			.each(function(d) {
				const div = d3.select(this);
				div.append('label')
					.attr('class', 'form-label small')
					.text('Opacity');
				
				div.append('input')
					.attr('type', 'range')
					.attr('class', 'form-range')
					.attr('min', '0.1')
					.attr('max', '1')
					.attr('step', '0.1')
					.property('value', d.style.opacity)
					.on('input', function() {
						vis.update_series_style(d.series_id, { opacity: parseFloat(this.value) });
					});
			});
		
		// Marker settings
		const markerSettingsRow = seriesItems.append('div')
			.attr('class', 'row mb-3');
		
		// Marker shape
		markerSettingsRow.append('div')
			.attr('class', 'col-6')
			.each(function(d) {
				const div = d3.select(this);
				div.append('label')
					.attr('class', 'form-label small')
					.text('Shape');
				
				const select = div.append('select')
					.attr('class', 'form-select form-select-sm')
					.property('value', d.style.marker_shape)
					.on('change', function() {
						vis.update_series_style(d.series_id, { marker_shape: this.value });
					});
				
				select.selectAll('option')
					.data(Object.keys(vis.styles.marker_shapes))
					.enter()
					.append('option')
					.attr('value', d => d)
					.property('selected', shape => shape === d.style.marker_shape)
					.text(d => d.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()));
			});
		
		// Marker size
		markerSettingsRow.append('div')
			.attr('class', 'col-6')
			.each(function(d) {
				const div = d3.select(this);
				div.append('label')
					.attr('class', 'form-label small')
					.text('Size');
				
				div.append('input')
					.attr('type', 'number')
					.attr('class', 'form-control form-control-sm')
					.attr('min', '1')
					.attr('max', '20')
					.attr('step', '1')
					.property('value', d.style.marker_size)
					.on('change', function() {
						vis.update_series_style(d.series_id, { marker_size: parseInt(this.value) });
					});
			});
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
				if (!series.style.show_markers) return;
				
				const reducedData = vis.reduced_data_for_series(yAxis, series);
				const symbol = d3.symbol()
					.type(vis.styles.marker_shapes[series.style.marker_shape])
					.size(Math.pow(series.style.marker_size, 2));
				
				vis.svg
					.selectAll(`path.marker-${yAxis}-series-${seriesIndex}`)
					.data(reducedData)
					.enter()
					.append('path')
					.classed(`marker-${yAxis} series-${seriesIndex}`, true)
					.attr('d', symbol)
					.attr('transform', d => `translate(${vis.axes.x.scale(vis.accessor('x')(d))}, ${vis.axes[yAxis].scale(vis.accessor(yAxis)(d))})`)
					.attr('fill', series.style.color)
					.attr('opacity', series.style.opacity);
			});
		}
	},
	plot_data_line: yAxis => {
		if (vis.axes[yAxis].data_name && vis.series) {
			vis.series.forEach((series, seriesIndex) => {
				if (!series.style.show_line) return;
				
				const x = vis.accessor('x');
				const y = vis.accessor(yAxis);
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
					.attr('stroke-dasharray', vis.styles.line_styles[series.style.line_style])
					.attr('opacity', series.style.opacity)
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
				.attr('font-size', vis.styles.global.font_size)
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
				.attr('font-size', vis.styles.global.font_size)
				.attr('transform', `translate(-${vis.tick_offset()}, 0)`);
			// Always draw right spine - either with yOther scale or y scale
			if (vis.axes.yOther.data_name && !d3.select('#yOther-data').classed('d-none')) {
				// yOther is active: this will be handled below
			} else {
				// yOther is hidden or undefined: draw right spine with y scale, no labels
				vis.svg
					.append('g')
					.call(d3.axisLeft(vis.axes.y.scale).tickSizeOuter(0))
					.attr('transform', `translate(${vis.max_display('x')},0)`)
					.selectAll('text')
					.remove();
			}
		}
		if (vis.axes.yOther.data_name && !d3.select('#yOther-data').classed('d-none')) {
			vis.svg
				.append('g')
				.call(d3.axisLeft(vis.axes.yOther.scale).tickSizeOuter(0))
				.attr('transform', `translate(${vis.max_display('x')},0)`)
				.selectAll('text')
				.attr('text-anchor', 'start')
				.attr('font-size', vis.styles.global.font_size)
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
				.attr('font-size', vis.styles.global.font_size)
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
				.attr('font-size', vis.styles.global.font_size)
				.text(d3.select('#y-axis-label').property('value'));
		}
		if (vis.axes.yOther.data_name && !d3.select('#yOther-data').classed('d-none')) {
			vis.svg
				.append('text')
				.attr('transform', `translate(${vis.width() - 5}, ${vis.max_display('yOther') + 0.5 * (vis.min_display('yOther') - vis.max_display('yOther'))}) rotate(90)`)
				.attr('dominant-baseline', 'hanging')
				.attr('text-anchor', 'middle')
				.attr('id', 'svg-yOther-label')
				.attr('fill', vis.axes.yOther.color)
				.attr('font-family', 'sans-serif')
				.attr('font-size', vis.styles.global.font_size)
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
			.attr('font-size', Math.max(8, vis.styles.global.font_size - 2))
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
				// Skip yOther if controls are hidden (multi-file mode)
				if (yAxis === 'yOther' && d3.select('#yOther-data').classed('d-none')) {
					return;
				}
				if (vis.axes[yAxis].data_name) {
					vis.plot_data_line(yAxis);
					vis.plot_data_scatter(yAxis);
				}
			});

			vis.add_axes(force_light);
			vis.add_legend();
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
	vis.setup_style_handlers();
	
	// Setup files panel hide/show toggle
	setup_files_panel_toggle();
	
	// Setup miniature plot functionality
	setup_mini_plot();
	
	// Setup responsive plot resizing
	setup_plot_resize_observer();
};

// Track if files panel is hidden
let files_panel_hidden = false;

// Setup files panel toggle functionality
setup_files_panel_toggle = () => {
	const hideToggle = document.getElementById('files-hide-toggle');
	const showToggle = document.getElementById('files-show-toggle');
	
	hideToggle.addEventListener('click', hide_files_panel);
	showToggle.addEventListener('click', show_files_panel);
};

// Hide the files panel and expand visualization
hide_files_panel = () => {
	const filesColumn = document.getElementById('files-column');
	const vizColumn = document.getElementById('visualization-column');
	const summaryBar = document.getElementById('files-summary-bar');
	
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
	
	// Show files column
	filesColumn.style.display = 'block';
	
	// Restore visualization column width
	vizColumn.classList.remove('col-12');
	vizColumn.classList.add('col-sm-8');
	
	// Hide summary bar
	summaryBar.classList.add('d-none');
	
	files_panel_hidden = false;
	
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
