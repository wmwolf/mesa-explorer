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
      file_manager.files.unshift(
        {
          name: file.name,
          type: type,
          id: file_manager.files_added,
          data: data
        }
      );
      file_manager.files_added += 1
      file_manager.render_file_to_list(file_manager.files[0])
      // automatically select this new file if it is the first one
      if (file_manager.files_added == 1) {
        document.querySelector('a[data-file-id="0"]').click()
      }
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
          .split(/\s+/)
          [i].replace(/"/g, "");
      });

    // extract bulk data into a list of objects
    const bulkNames = lines[bulkNamesLine].trim().split(/\s+/);
    lines.slice(bulkValsStart).forEach((line, k) => {
      let line_data = {};
      line
        .trim()
        .split(/\s+/)
        .forEach((datum, i) => {
          line_data[bulkNames[i]] = parseFloat(datum);
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
    visualization.svg = d3.select('#plot')
  },
  height: () => visualization.svg.attr('height'),
  width: () => visualization.svg.attr('width'),
  x_margin: () => visualization.width() * visualization.margin_frac,
  y_margin: () => visualization.height() * visualization.margin_frac,
  abscissa_name: undefined,
  ordinate_name: undefined,
  x_scale: undefined,
  y_scale: undefined,
  x_scale_type: 'linear',
  y_scale_type: 'linear',
  margin_frac: 0.1,
  register_new_file: () => {
    visualization.file = file_manager.active_file;
    const names = visualization.file.data.bulk_names;
    if (!names.includes(visualization.abscissa_name))  {
      visualization.abscissa_name = undefined;
      d3.select('#abscissa-label').text('Select Abscissa Quantity ');
    }
    if (!names.includes(visualization.ordinate_name))  {
      visualization.ordinate_name = undefined;
      d3.select('#ordinate-label').text('Select Ordinate Quantity ');
    }
    visualization.update_choices(names);
    visualization.update_plot();
  },
  update_choices: (names) => {
    d3.select('#abscissa-choices').selectAll('li').remove()
    d3.select('#abscissa-choices').selectAll('li').data(names).enter()
      .append("li").append("a")
      .attr("class", "dropdown-item")
      .attr("data-name", d => d)
      .text(d => d)
      .on('click', function() {
        visualization.abscissa_name = d3.select(this).attr('data-name');
        d3.select('#abscissa-label').text(d3.select(this).text());
        visualization.update_plot();
      });

    d3.select('#ordinate-choices').selectAll('li').remove()
    d3.select('#ordinate-choices').selectAll('li').data(names).enter()
      .append("li").append("a")
      .attr("class", "dropdown-item")
      .attr("data-name", d => d)
      .text(d => d)
      .on('click', function() {
        visualization.ordinate_name = d3.select(this).attr('data-name');
        d3.select('#ordinate-label').text(d3.select(this).text());
        visualization.update_plot();
      });

  },


  make_scales: (data) => {
    visualization.x_scale = d3.scaleLinear();
    if (visualization.x_scale_type == 'logarithmic') {
      visualization.x_scale = d3.scaleLogarithmic();
    }
    visualization.x_scale
      .domain(d3.extent(data, d => d[visualization.abscissa_name]))
      .range([visualization.x_margin(), visualization.width() - visualization.x_margin()]).nice();

    visualization.y_scale = d3.scaleLinear();
    if (visualization.y_scale_type == 'logarithmic') {
      visualization.y_scale = d3.scaleLogarithmic();
    }
    visualization.y_scale
      .domain(d3.extent(data, d => d[visualization.ordinate_name]))
      .range([visualization.height() - visualization.y_margin(), visualization.y_margin()]).nice();
  },
  plot_data_scatter: (data) => {
    visualization.svg.selectAll('circle').data(data).enter()
      .append('circle')
      .attr('r', 5)
      .attr('cx', d => visualization.x_scale(d[visualization.abscissa_name]))
      .attr('cy', d => visualization.y_scale(d[visualization.ordinate_name]))
      .attr('fill', 'blue');
  },
  add_axes: () => {
    visualization.svg.append("g").call(d3.axisBottom(visualization.x_scale))
      .attr("transform", `translate(0,${visualization.height() - visualization.y_margin() * 3 / 4})`);
    visualization.svg.append("g").call(d3.axisLeft(visualization.y_scale))
      .attr("transform", `translate(${visualization.x_margin() * 3 / 4},0)`);
  },
  clear_plot: () => {visualization.svg.selectAll("*").remove()},
  update_plot: () => {
    visualization.clear_plot();
    if (visualization.file && visualization.ordinate_name && visualization.abscissa_name) {
      const data = visualization.file.data.bulk;
      visualization.make_scales(data);
      visualization.plot_data_scatter(data);
      visualization.add_axes(data)
    }
  },

}

setup = () => {
  file_manager.setup();
  visualization.setup();
}