// Metadata Manager - Column metadata loading and management system
// Loads and provides lookup functionality for MESA column metadata from CSV files

const metadata_manager = {
    // Metadata storage
    history_metadata: new Map(),
    profile_metadata: new Map(),
    loading_promise: null,
    
    // Loading state
    is_loaded: false,
    load_errors: [],
    
    // Initialize metadata loading system
    setup: async function() {
        console.log('Metadata Manager: Initializing metadata loading system');
        
        // Start loading metadata files
        metadata_manager.loading_promise = metadata_manager.load_metadata();
        
        try {
            await metadata_manager.loading_promise;
            console.log('Metadata Manager: Successfully loaded all metadata');
        } catch (error) {
            console.warn('Metadata Manager: Error loading metadata:', error);
            // Continue with graceful degradation - metadata will fallback to defaults
        }
    },
    
    // Load metadata from CSV files
    load_metadata: async function() {
        console.log('Metadata Manager: Starting metadata load from CSV files');
        
        const loadPromises = [
            metadata_manager.load_history_metadata(),
            metadata_manager.load_profile_metadata()
        ];
        
        const results = await Promise.allSettled(loadPromises);
        
        // Check for any failures
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                const filename = index === 0 ? 'history_columns.csv' : 'profile_columns.csv';
                const error = `Failed to load ${filename}: ${result.reason}`;
                metadata_manager.load_errors.push(error);
                console.warn('Metadata Manager:', error);
            }
        });
        
        metadata_manager.is_loaded = true;
        console.log(`Metadata Manager: Loaded ${metadata_manager.history_metadata.size} history columns and ${metadata_manager.profile_metadata.size} profile columns`);
        
        if (metadata_manager.load_errors.length > 0) {
            console.warn('Metadata Manager: Some metadata files failed to load. Using fallback behavior for unknown columns.');
        }
    },
    
    // Load history metadata from CSV
    load_history_metadata: async function() {
        return new Promise((resolve, reject) => {
            d3.csv('/data/history_columns.csv')
                .then(data => {
                    data.forEach(row => {
                        const columnData = {
                            data_logarithmic: row.data_logarithmic === 'true',
                            display_logarithmic: row.display_logarithmic === 'true',
                            series_name: row.series_name || row.column_name,
                            units: row.units || '',
                            axis_name: row.axis_name || ''
                        };
                        metadata_manager.history_metadata.set(row.column_name, columnData);
                    });
                    console.log(`Metadata Manager: Loaded ${data.length} history column definitions`);
                    resolve();
                })
                .catch(error => {
                    console.error('Metadata Manager: Failed to load history metadata:', error);
                    reject(error);
                });
        });
    },
    
    // Load profile metadata from CSV
    load_profile_metadata: async function() {
        return new Promise((resolve, reject) => {
            d3.csv('/data/profile_columns.csv')
                .then(data => {
                    data.forEach(row => {
                        const columnData = {
                            data_logarithmic: row.data_logarithmic === 'true',
                            display_logarithmic: row.display_logarithmic === 'true',
                            series_name: row.series_name || row.column_name,
                            units: row.units || '',
                            axis_name: row.axis_name || ''
                        };
                        metadata_manager.profile_metadata.set(row.column_name, columnData);
                    });
                    console.log(`Metadata Manager: Loaded ${data.length} profile column definitions`);
                    resolve();
                })
                .catch(error => {
                    console.error('Metadata Manager: Failed to load profile metadata:', error);
                    reject(error);
                });
        });
    },
    
    // Wait for metadata to be loaded
    ensure_loaded: async function() {
        if (metadata_manager.loading_promise) {
            await metadata_manager.loading_promise;
        }
    },
    
    // Get metadata for a column (with file type detection fallback)
    get_metadata: function(column_name, file_type = null) {
        // If file type is specified, use it directly
        if (file_type === 'history') {
            return metadata_manager.history_metadata.get(column_name) || metadata_manager.generate_fallback_metadata(column_name);
        } else if (file_type === 'profile') {
            return metadata_manager.profile_metadata.get(column_name) || metadata_manager.generate_fallback_metadata(column_name);
        }
        
        // Try to find in either metadata store
        let metadata = metadata_manager.history_metadata.get(column_name);
        if (!metadata) {
            metadata = metadata_manager.profile_metadata.get(column_name);
        }
        
        return metadata || metadata_manager.generate_fallback_metadata(column_name);
    },
    
    // Generate fallback metadata for unknown columns
    generate_fallback_metadata: function(column_name) {
        // console.log(`Metadata Manager: Generating fallback metadata for unknown column: ${column_name}`);
        
        // Check for isotope pattern (h1, he4, c12, ni56, etc.)
        const isotopeMatch = column_name.match(/^([a-z]{1,2})([0-9]+)$/);
        if (isotopeMatch) {
            return metadata_manager.generate_isotope_metadata(column_name, isotopeMatch[1], isotopeMatch[2]);
        }
        
        // Check for log prefix
        const isLogColumn = /^log[_\s]*/.test(column_name);
        
        // Generate cleaned series name
        const series_name = metadata_manager.clean_column_name(column_name);
        
        return {
            data_logarithmic: isLogColumn,
            display_logarithmic: isLogColumn,
            series_name: series_name,
            units: '',
            axis_name: isotopeMatch ? 'Mass Fraction' : ''
        };
    },
    
    // Generate isotope-specific metadata
    generate_isotope_metadata: function(column_name, element, mass_number) {
        console.log(`Metadata Manager: Generating isotope metadata for ${column_name} (${element}${mass_number})`);
        
        // Convert element to proper case and add LaTeX-style superscript
        const formatted_element = element.charAt(0).toUpperCase() + element.slice(1);
        
        return {
            data_logarithmic: false,
            display_logarithmic: false,
            series_name: `^{${mass_number}}${formatted_element}`,
            units: '',
            axis_name: 'Mass Fraction'
        };
    },
    
    // Convert numbers to superscript characters
    to_superscript: function(number) {
        const superscriptMap = {
            '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
            '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹'
        };
        return number.toString().split('').map(digit => superscriptMap[digit] || digit).join('');
    },
    
    // Clean column names for display
    clean_column_name: function(column_name) {
        return column_name
            .replace(/^log[_\s]*/i, '')     // Remove "log_" or "log " prefix
            .replace(/^log(?=[A-Z])/i, '')  // Remove "log" before capitals
            .replace(/_/g, ' ')             // Replace underscores with spaces
            .replace(/\b\w/g, l => l.toUpperCase()); // Title case
    },
    
    // Get all available columns for a file type
    get_available_columns: function(file_type = null) {
        const columns = [];
        
        if (file_type === 'history' || file_type === null) {
            columns.push(...Array.from(metadata_manager.history_metadata.keys()));
        }
        
        if (file_type === 'profile' || file_type === null) {
            columns.push(...Array.from(metadata_manager.profile_metadata.keys()));
        }
        
        return [...new Set(columns)].sort(); // Remove duplicates and sort
    },
    
    // Check if metadata system is ready
    is_ready: function() {
        return metadata_manager.is_loaded;
    },
    
    // Get loading status and errors
    get_status: function() {
        return {
            loaded: metadata_manager.is_loaded,
            errors: metadata_manager.load_errors,
            history_count: metadata_manager.history_metadata.size,
            profile_count: metadata_manager.profile_metadata.size
        };
    }
};