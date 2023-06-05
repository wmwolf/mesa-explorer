// Helper functions
safe_log = (val) => {
  if (val <= 0) {
    return -99
  } else {
    return Math.log10(val)
  }
}
// File manager object handles loading files, parsing data into javascript
// objects, rendering the files to the file picker.

// Right now, it also stores the current "active" file that is being plotted
// This will need to rethought if we want to allow multiple series to be
// plotted from multiple files. At that point, perhaps just exposing the
// list of available files to the vis pane in the form of
// dropdowns would work better
file_manager = {
  setup: () => {
    // for (file of file_manager.files) {
    //   file_manager.render_file_to_list(file);
    // }
    document.querySelector("#mesa-input").addEventListener("change", (event) => {
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
    Promise.all([...input.files].map( (file) => {
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
    })).then((new_files) => {
      // once data from the files have been ingested into each file object,
      // save them to the global file manager object
      // merge new files into existing files
      file_manager.files = file_manager.files.concat(new_files);
      
      // order files appropriately (histories, then profiels, then other junk)
      file_manager.files.sort( (d1, d2) => {
        if (d1.type == "history" && d2.type != "history") {
          return -1;
        } else if (d1.type != "history" && d2.type == "history") {
          return 1;
        } else if (d1.type == 'profile' && d2.type == 'profile') {
          // sort profiles by increasing *model* number, not profile number
          return parseInt(d1.data.header.model_number) - parseInt(d2.data.header.model_number);
        } else if (d1.type == "profile" && !['history', 'profile'].includes(d2.type)) {
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
      d3.select('#file-list').selectAll('a').remove();
      // insert data into DOM
      const as = d3.select('#file-list')
        .selectAll('a')
        .data(file_manager.files)
        .enter().append('a')
        .attr("class", (f) => {
          if (file_manager.active_file == f) {
            return "list-group-item list-group-item-action active";
          } else {
            return "list-group-item list-group-item-action";
          }
        })
        // add click handler. Strips other files of active class, adds it to
        // this one, and then sets the active files and phones over to the
        // visualization side to pick up the new data
        .on('click', function() {
          d3.selectAll("#file-list a").attr("class", "list-group-item list-group-item-action");
          d3.select(this).attr("class", "list-group-item list-group-item-action active");
          file_manager.active_file = d3.select(this).datum();
          vis.register_new_file();
        });
        
      // Add in content to the file entries (icon and name of file)
      as.append("i").attr("class", file_manager.file_icon_class);
      as.append("span").attr("class", "ms-2").text(f => f.name);
      
      // Auto-select the first file if none are selected
      if (!file_manager.active_file) {
        d3.select('#file-list > a').dispatch("click");
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
  process_data: (file_contents) => {
    const headerNamesLine = 1;
    const headerValsLine = 2;
    const bulkNamesLine = 5;
    const bulkValsStart = bulkNamesLine + 1;
    let headerData = {};
    let bulkData = [];

    // read file contents into an array
    contents = file_contents.trim();
    lines = contents.trim().split("\n");

    // extract header data
    lines[headerNamesLine]
      .trim()
      .split(/\s+/)
      .forEach((key, i) => {
        headerData[key] = lines[headerValsLine]
          .trim()
          .split(/\s+/)[i].replace(/"/g, "");
      });

    // extract bulk names into a list of objects that have a key (their name)
    // and a good guess as to whether or not they are implicitly log
    const bulkNames = lines[bulkNamesLine].trim().split(/\s+/).map((name) => {
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
  file_icon_class: (file) => {
    let icon_class = "bi bi-patch-question-fill";
    if (file.type == 'history') {
      icon_class = "bi bi-clock-fill";
    } else if (file.type == 'profile') {
      icon_class = "bi bi-star-half";
    }
    return icon_class;
  },
  render_file_to_list: (file) => {
    // create an anchor tag and add it to the list group.
    // inside will be an h4 that has an icon that depends on the file type
    // and the name of the file rendered in monospace
    const a = d3.select('#file-list').append('a')
      .attr("class", "list-group-item list-group-item-action")
      .attr("data-file-id", file.id);
    // bind file data to list item
    a.datum(file);
    const h5 = a.append('h5');
    h5.append("i").attr("class", `${file_manager.file_icon_class(file)} me-2`);
    h5.append("span").attr('class', 'font-monospace').text(file.name);

    a.on('click', function() {
      // strip active status from other files
      d3.select('#file-list')
        .selectAll('a')
        .attr("class", "list-group-item list-group-item-action");
      // make this one appear active and update the active file
      d3.select(this)
        .attr("class", "list-group-item list-group-item-action active");
      file_manager.active_file = file;
      vis.register_new_file();
    });
  }
}

vis = {
  setup: () => {
    vis.svg = d3.select('#plot');
    vis.svg.style('height', vis.width() / 1.618);
    window.onresize = function() {
      vis.svg.style('height', vis.width() / 1.618);
      vis.update_plot();
    };
    
    // load knwon history and profile columns
    vis.load_known_columns()

    // Set up handlers for data transformations
    //   Data rescaling
    d3.selectAll('.data-rescale input').on('click', function() {
      elt = d3.select(this);
      vis.data_trans[elt.attr('data-axis')]['rescale'] = elt.attr('value')
      vis.update_plot();
    });
    //   Rezeroing
    d3.selectAll('.data-rezero input').on('keyup', function() {
      elt = d3.select(this);
      vis.data_trans[elt.attr('data-axis')]['rezero'] = parseFloat(elt.property("value"));
      vis.update_plot();
    });
    //   Absolute Value
    d3.selectAll('.data-absval input').on('click', function() {
      elt = d3.select(this);
      vis.data_trans[elt.attr('data-axis')]['absval'] = elt.property("checked");
      vis.update_plot();
    });
    //   Normalization
    d3.selectAll('.data-normalize input').on('click', function() {
      elt = d3.select(this);
      vis.data_trans[elt.attr('data-axis')]['normalize'] = elt.property("checked");
      vis.update_plot();
    });

    // Set up handlers for axis transformations
    //   linear/logarithmic radio toggles
    d3.selectAll("div.axis-rescale input")
      .on("click", function() {
        btn = d3.select(this);
        if (btn.property("checked")) {
          if (btn.attr('data-scale') == 'x') {
            vis.axes.x.type = btn.attr('data-scale-type');
          } else if (btn.attr('data-scale') == 'y') {
            vis.axes.y.type = btn.attr('data-scale-type');
          }
          vis.update_plot();
        }
      });
    //  "min" (left/bottom) and "max" (right/top) limits
    d3.selectAll("div.limits input").on('keyup', function() {
      elt = d3.select(this);
      vis.axes[elt.attr('data-axis')][elt.attr('data-lim')] = parseFloat(elt.property('value'));
      vis.update_plot();
    });
  },
  load_known_columns: () => {
    // Load data for known history/profile columns
    d3.csv('data/history_columns.csv')
      .then(data => vis.known_history_names = data);
    d3.csv('data/profile_columns.csv')
      .then(data => vis.known_profile_names = data);
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
      scale: undefined,
      type: 'linear',
      min: undefined,
      max: undefined
    },
    y: {
      scale: undefined,
      type: 'linear',
      min: undefined,
      max: undefined
    }
  },

  // These variables and methods deal with the data that can/will be plotted
  names: { x: undefined, y: undefined },
  data_trans: {
    x: { rescale: 'linear', rezero: 0, absval: false, normalize: false },
    y: { rescale: 'linear', rezero: 0, absval: false, normalize: false }
  },
  // TODO: refactor this (and probably other functions) to allow flipping the
  // axis. Right now this aggressively fixes the minimum. Need to do similar for y-axis.
  min_data: (axis) => {
    if (typeof(vis.axes[axis].max) == 'undefined') {
      if (typeof(vis.axes[axis].min == 'undefined') || vis.axes[axis].min == '') {
        return d3.min(vis.data, vis.accessor(axis));
      } else {
        return vis.axes[axis].min;
      }
    } else {
      return Math.min(vis.axes[axis].min, vis.axes[axis].max);
    }
  },
  max_data: (axis) => vis.axes[axis].max || d3.max(vis.data, vis.accessor(axis)),
  known_history_names: {},
  known_profile_names: {},
  data_type: { x: 'linear', y: 'linear' },
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
  accessor: (axis) => {
    let rescale;
    let rezero;
    let do_abs;
    rescale = (d) => {
      switch (vis.data_trans[axis].rescale) {
        case 'log':
          return safe_log(d[vis.names[axis]]);
        case 'logabs':
          return safe_log(Math.abs(d[vis.names[axis]]));
        case 'exp':
          return Math.pow(10, d[vis.names[axis]]);
        default:
          return d[vis.names[axis]]
      }
    }
    rezero = val => val - vis.data_trans[axis].rezero
    do_abs = val => vis.data_trans[axis].absval ? Math.abs(val) : val
    return d => do_abs(rezero(rescale(d)))
  },
  tick_padding: {x: 40, y: 60},
  data_padding: 20,
  // pixel coordinates for left/bottom of data
  min_display: (axis) => {
    if (axis == 'x') {
      return vis.tick_padding.y + vis.data_padding;
    } else {
      return vis.height() - vis.tick_padding.x - vis.data_padding;
    }
  },
  // pixel coordinates for right/top of data
  max_display: (axis) => {
    if (axis == 'x') {
      return vis.width() - vis.data_padding;
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
    const axes = ['x', 'y'];
    let refresh_plot = true;
    axes.forEach(axis => {
      if (!names.includes(vis[`${axis}_name`])) {
        vis[`${axis}_name`] = undefined;
        d3.select(`#${axis}-label`).html(`Select <var>${axis}</var> quantity `);
        d3.select(`#${axis}-axis-label`).property('value', '');
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
    vis.data = vis.file.data.bulk

    // merge name data with more complete "known" data. Names are the columns
    // of data files, but also the keys to each datum in `vis.data`.
    vis.name_data = vis.file.data.bulk_names.map((d) => {
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
    axes.forEach(axis => vis.update_choices(axis));
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
  update_choices: (axis) => {
    // Clear out existing choices and build from scratch
    // Could make this smarter and detect [lack of] changes in refresh
    // step, but this works for now.
    d3.select(`#${axis}-choices`).selectAll('li').remove()

    // Bind lis to available name data in file, which should be pre-merged
    // with the known values. Set up pretty formatting and click handler, too.
    d3.select(`#${axis}-choices`).selectAll('li')
      .data(vis.name_data).enter()
      .append("li").append("a")
      .attr("class", "dropdown-item")
      .attr("data-name", d => d.key)
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
        option = d3.select(this)
        vis.names[axis] = option.attr('data-name');
        vis.data_type[axis] = option.datum().scale

        // Update interface: button label (remember what was clicked), default
        // axis label in text field,
        // scale radio buttons and main plot
        vis.pause = true
        d3.select(`#${axis}-label`).html(option.html());
        d3.select(`#${axis}-axis-label`).property("value", option.text().replace('log', '').replace('_', ' '));
        // Set scale to correspond with reported data type (log/linear)
        const selector = `#${axis}-scale-${option.datum().scale}`
        document.querySelector(selector).click()
        // Exponentiate logarithmic data, but preserve linear data
        if (option.datum().scale == 'log') {
          document.querySelector(`#${axis}-data-trans-exp`).click();
        } else {
          document.querySelector(`#${axis}-data-trans-linear`).click();
        }
        vis.pause = false
        vis.update_plot();
        window.scrollTo(0, 0);
      });
  },
  make_scale: (axis) => {
    // set up right scaling
    if (vis.axes[axis].type == 'log') {
      vis.axes[axis].scale = d3.scaleLog();
    } else {
      vis.axes[axis].scale = d3.scaleLinear();
    }
    // console.log(`Created ${axis} axis`);
    // now set domain and range using helper functions
    vis.axes[axis].scale
      .domain([vis.min_data(axis), vis.max_data(axis)])
      .range([vis.min_display(axis), vis.max_display(axis)]);
    // console.log(`Calibrated ${axis} axis with domain of ${[vis.min_data(axis), vis.max_data(axis)]} and a range of ${}`);
  },
  make_scales: () => {
    ['x', 'y'].forEach( axis => vis.make_scale(axis));
  },
  make_clipPath: () => {
    vis.svg.append("clipPath")
      .attr("id", "clip")  // <-- we need to use the ID of clipPath
      .append("rect")
      .attr("width", vis.max_display('x') - vis.min_display('x'))
      .attr("height", Math.abs(vis.max_display('y') - vis.min_display('y')))
      .attr("fill", "blue")
      .attr("transform", `translate(${vis.data_padding + vis.tick_padding.y},${vis.data_padding})`);
  },
  plot_data_scatter: () => {
    vis.svg.selectAll('circle').data(vis.data).enter()
      .append('circle')
      .attr('r', 2)
      .attr('cx', d => vis.axes.x.scale(vis.accessor('x')(d)))
      .attr('cy', d => vis.axes.y.scale(vis.accessor('y')(d)))
      .attr('fill', 'DodgerBlue');
  },
  plot_data_line: () => {
    const x = vis.accessor('x');
    const y = vis.accessor('y');
    const line_maker = d3.line()
      // .defined(d => {
      //   return x(d) >= vis.min_data('x') && x(d) <= vis.max_data('x') && y(d) >= vis.min_data('y') && y(d) <= vis.max_data('y');
      // })
      .x(d => vis.axes.x.scale(x(d)))
      .y(d => vis.axes.y.scale(y(d)));
    vis.svg.append("g")
      .append("path")
      .attr("fill", "none")
      .attr("d", line_maker(vis.data))
      .attr("stroke", "DodgerBlue")
      .attr("stroke-width", "2.0")
      .attr("clip-path", "url(#clip)");
  },
  add_axes: () => {
    // axes themselves (spines, ticks, tick labels)
    vis.svg.append("g").call(d3.axisBottom(vis.axes.x.scale))
      .attr("transform", `translate(0,${vis.min_display('y') + vis.data_padding})`);
    vis.svg.append("g").call(d3.axisLeft(vis.axes.y.scale))
      .attr("transform", `translate(${vis.tick_padding.y},0)`);
      
    // add or update axis labels
    if (vis.have_axis_labels) {
        vis.update_axis_labels();
    } else {
      vis.add_axis_labels();
    }
  },
  add_axis_labels: () => {
    vis.svg.append("text")
      .attr("transform", `translate(${vis.min_display("x") + 0.5 * (vis.max_display("x") - vis.min_display("x"))}, ${vis.height() - 5})`)
      .attr("dominant-baseline", "bottom")
      .attr("text-anchor", "middle")
      .attr("id", "svg-x-label")
      .text(d3.select("#x-axis-label").property("value"));
    vis.svg.append("text")
      .attr("transform", `translate(5, ${vis.max_display('y') + 0.5 * (vis.min_display('y') - vis.max_display('y'))}) rotate(-90)`)
      .attr("dominant-baseline", "hanging")
      .attr("text-anchor", "middle")
      .attr("id", "svg-y-label")
      .text(d3.select("#y-axis-label").property("value"));
    // Set up handlers for axis label fields (should this live here?)
    d3.selectAll(".axis-label-field").on('keyup', () => {
      vis.update_axis_labels();
    });
    vis.have_axis_labels = true;
  },
  update_axis_labels: () => {
    d3.select("#svg-x-label")
      .text(d3.select("#x-axis-label").property("value"));
    d3.select("#svg-y-label")
      .text(d3.select("#y-axis-label").property("value"));
  },
  clear_plot: () => { 
    vis.svg.selectAll("*").remove();
    vis.have_axis_labels = false;
   },
  update_plot: () => {
    if (vis.pause) {
        return
    }
    vis.clear_plot();
    if (vis.file && vis.names.y && vis.names.x) {
      vis.make_scales();
      vis.make_clipPath();
      vis.plot_data_line();
      // vis.plot_data_scatter();
      vis.add_axes()
    }
  }
};

setup = () => {
  file_manager.setup();
  vis.setup();
};