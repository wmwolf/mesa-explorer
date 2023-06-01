// File manager object handles loading files, parsing data into javascript
// objects, rendering the files to the file picker.

// Right now, it also stores the current "active" file that is being plotted
// This will need to rethought if we want to allow multiple series to be
// plotted from multiple files. At that point, perhaps just exposing the
// list of available files to the visualization pane in the form of
// dropdowns would work better
file_manager = {
  setup: () => {
    for (file of file_manager.files) {
      file_manager.render_file_to_list(file);
    }
    document.querySelector("#mesa-input").addEventListener("change", (event) => {
      file_manager.load_file(event.target);
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
  // function called when a new file is selected. Loads all data into a file
  // object and adds an entry to the file picker
  load_file: async function(input) {
    let file = input.files[0];
    let fileReader = new FileReader();
    fileReader.readAsText(file);
    fileReader.onload = () => {
      const contents = fileReader.result;
      // TODO: should determine if file is an index or not here,
      // but we'll get to that later. For now ,just look at beginning of file
      const data = file_manager.process_data(contents);
      let type = 'unknown';
      if (file.name[0] == 'h') {
        type = 'history';
      } else if (file.name[0] == 'p') {
        type = 'profile';
      }
      file_manager.files.unshift({
        name: file.name,
        type: type,
        id: file_manager.files_added,
        data: data
      });
      file_manager.files_added += 1
      file_manager.render_file_to_list(file_manager.files[0])
      // automatically select this new file if it is the first one
      if (file_manager.files_added == 1) {
        document.querySelector('a[data-file-id="0"]').click()
      }
      d3.select('#file-prompt').remove();
    };
    fileReader.onerror = () => {
      alert(fileReader.error);
    };
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
      visualization.register_new_file();
    });
  }
}

visualization = {
    setup: () => {
      visualization.svg = d3.select('#plot');
      visualization.svg.style('height', visualization.width() / 1.618);
      window.onresize = function() {
        visualization.svg.style('height', visualization.width() / 1.618);
        visualization.update_plot();
      };
      // Load data for known history/profile columns
      d3.csv('data/history_columns.csv')
        .then(data => visualization.known_history_names = data);
      d3.csv('data/profile_columns.csv')
        .then(data => visualization.known_profile_names = data);
      // Turn on handlers for linear/logarithmic radio toggles
      d3.selectAll("div.form-check input.form-check-input")
        .on("change", function() {
          btn = d3.select(this);
          if (btn.property("checked")) {
            if (btn.attr('data-scale') == 'x') {
              visualization.x_scale_type = btn.attr('data-scale-type');
            } else if (btn.attr('data-scale') == 'y') {
              visualization.y_scale_type = btn.attr('data-scale-type');
            }
            visualization.update_plot();
          }
        });
    },
    height: () => parseFloat(visualization.svg.style('height')),
    width: () => parseFloat(visualization.svg.style('width')),
    x_margin: () => visualization.width() * visualization.margin_frac,
    y_margin: () => visualization.height() * visualization.margin_frac,
    x_name: undefined,
    y_name: undefined,
    known_history_names: {},
    known_profile_names: {},
    x_scale: undefined,
    y_scale: undefined,
    x_scale_type: 'linear',
    y_scale_type: 'linear',
    x_data_type:'linear',
    y_data_type:'linear',
    x_accessor: () => {
      if (visualization.x_data_type == 'log') {
        return d => 10 ** d[visualization.x_name]
      }
      return d => d[visualization.x_name];
    },
    y_accessor: () => {
      if (visualization.y_data_type == 'log') {
        return d => 10 ** d[visualization.y_name]
      }
      return d => d[visualization.y_name];
    },
    margin_frac: 0.1,
    register_new_file: () => {
      visualization.file = file_manager.active_file;

      // Reset selections for abscissa and ordinate axes columns if they
      // are no longer present in this file
      const names = visualization.file.data.bulk_names.map(elt => elt.key);
      const axes = ['x', 'y']
      axes.forEach(axis => {
        if (!names.includes(visualization[`${axis}_name`])) {
          visualization[`${axis}_name`] = undefined;
          d3.select(`#${axis}-label`).html(`Select <var>${axis}</var> quantity `);
        }
      });

      // Set up the actual data that will be plotted
      visualization.data = visualization.file.data.bulk

      // merge name data with more complete "known" data. Names are the columns
      // of data files, but also the keys to each datum in `visualization.data`.
      visualization.name_data = visualization.file.data.bulk_names.map((d) => {
        let matches = visualization.known_names().filter(dk => dk.key == d.key);
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
      axes.forEach(axis => visualization.update_choices(axis));
      visualization.update_plot();
    },
    // helper function for grabbing the relevant "known" column name data
    known_names: () => {
      if (visualization.file.type == 'history') {
        return visualization.known_history_names;
      } else if (visualization.file.type == 'profile') {
        return visualization.known_profile_names;
      }
    },
    // Update  column selector dropdown menu
    update_choices: (axis) => {
      // Clear out existing choices and build from scratch
      // Could make this smarter and detect [lack of] changes in refresh
      // step, bu this works for now.
      d3.select(`#${axis}-choices`).selectAll('li').remove()

      // Bind lis to available name data in file, which should be pre-merged
      // with the known values. Set up pretty formatting and click handler, too.
      d3.select(`#${axis}-choices`).selectAll('li')
        .data(visualization.name_data).enter()
        .append("li").append("a")
        .attr("class", "dropdown-item")
        .attr("data-name", d => d.key)
        .html(d => {
          let res = `<samp>${d.key}</samp>`;
          if (d.html_name) {
            res = d.html_name;
            if (d.html_units) {
              res = `${res} <small class="text-muted">(${d.html_units})</span>`;
            }
          }
          return res;
        })
        .on('click', function() {
          // set the column name and column scale in the data
          option = d3.select(this)
          visualization[`${axis}_name`] = option.attr('data-name');
          visualization[`${axis}_data_type`] = option.datum().scale

          // Update interface: button label (remember what was clicked),
          // scale radio buttons and main plot
          d3.select(`#${axis}-label`).html(option.html());
          const selector = `#${axis}-scale-${option.datum().scale}`
          console.log(`attempting to click ${selector}`);
          document.querySelector(selector).click()
          // d3.select(selector).dispatch('click');
          visualization.update_plot();
        });
    },
    make_scales: () => {
      // First select axis type, then set up some reasonable default values
      // for domain and range
      visualization.x_scale = d3.scaleLinear();
      if (visualization.x_scale_type == 'log') {
        visualization.x_scale = d3.scaleLog();
      }
      visualization.x_scale
        .domain(d3.extent(visualization.data, visualization.x_accessor()))
        .range([visualization.x_margin(), visualization.width() - visualization.x_margin()]).nice();

      visualization.y_scale = d3.scaleLinear();
      if (visualization.y_scale_type == 'log') {
        visualization.y_scale = d3.scaleLog();
      }
      visualization.y_scale
        .domain(d3.extent(visualization.data, visualization.y_accessor()))
        .range([visualization.height() - visualization.y_margin(), visualization.y_margin()]).nice();
    },
    plot_data_scatter: () => {
      visualization.svg.selectAll('circle').data(visualization.data).enter()
        .append('circle')
        .attr('r', 5)
        .attr('cx', d => visualization.x_scale(visualization.x_accessor()(d)))
        .attr('cy', d => visualization.y_scale(visualization.y_accessor()(d)))
        .attr('fill', 'DodgerBlue');
    },
    plot_data_line: () => {
      const line_maker = d3.line()
        .x(d => visualization.x_scale(visualization.x_accessor()(d)))
        .y(d => visualization.y_scale(visualization.y_accessor()(d)))
      visualization.svg.append("g")
        .append("path")
        .attr("fill", "none")
        .attr("d", line_maker(visualization.data))
          .attr("stroke", "DodgerBlue")
          .attr("stroke-width", "2.0");
        },
        add_axes: () => {
          visualization.svg.append("g").call(d3.axisBottom(visualization.x_scale))
            .attr("transform", `translate(0,${visualization.height() - visualization.y_margin() * 3 / 4})`);
          visualization.svg.append("g").call(d3.axisLeft(visualization.y_scale))
            .attr("transform", `translate(${visualization.x_margin() * 3 / 4},0)`);
        },
        clear_plot: () => { visualization.svg.selectAll("*").remove() },
        update_plot: () => {
          visualization.clear_plot();
          if (visualization.file && visualization.y_name && visualization.x_name) {
            visualization.make_scales();
            visualization.plot_data_line();
            visualization.add_axes()
          }
        }
    };

    setup = () => {
      file_manager.setup();
      visualization.setup();
    };