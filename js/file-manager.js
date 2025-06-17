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
	// Callback system for cross-module communication
	file_change_callbacks: [],
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

	// Helper function to ensure unique local names
	ensure_unique_local_name: (new_file, existing_files) => {
		const original_local_name = new_file.local_name;
		
		// Check if local_name conflicts with any existing file
		if (existing_files.some(f => f.local_name === new_file.local_name)) {
			let counter = 1;
			let candidate = `${original_local_name} (${counter})`;
			
			// Keep incrementing until we find a unique name
			while (existing_files.some(f => f.local_name === candidate)) {
				counter++;
				candidate = `${original_local_name} (${counter})`;
			}
			
			new_file.local_name = candidate;
			console.log(`Renamed duplicate file "${original_local_name}" to "${new_file.local_name}"`);
		}
		
		return new_file;
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
			// ensure unique local names before merging
			new_files.forEach((new_file, index) => {
				// Check against existing files AND previously processed new files
				const all_existing = file_manager.files.concat(new_files.slice(0, index));
				file_manager.ensure_unique_local_name(new_file, all_existing);
			});
			
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
		
		// Notify visualization via callback system
		file_manager.invoke_file_change_callbacks();
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
		
		// Notify visualization via callback system
		file_manager.invoke_file_change_callbacks();
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
		file_manager.invoke_file_change_callbacks();
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
		file_manager.invoke_file_change_callbacks();
		
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
		file_manager.invoke_file_change_callbacks();
		
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
		
		// Notify visualization via callback system
		file_manager.invoke_file_change_callbacks();
		
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
	
	// Callback system for cross-module communication
	register_file_change_callback: function(callback) {
		if (typeof callback === 'function') {
			file_manager.file_change_callbacks.push(callback);
		}
	},
	
	invoke_file_change_callbacks: function() {
		file_manager.file_change_callbacks.forEach(callback => {
			try {
				callback();
			} catch (error) {
				console.error('Error in file change callback:', error);
			}
		});
	},
};