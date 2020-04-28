let URL = window.location.href.includes("index.html") ? "http://0.0.0.0:4000" : "https://kai7.pythonanywhere.com";

let bundeslaender = [];
let last_update = "";
let selected_type = "cases";
let selected_days = 30;

const translate = {
  "cases": "Fälle",
  "deaths": "Todesfälle",
  "age": "Alter",
  "gender": "Geschlecht",
  "M": "Männer",
  "W": "Frauen",
  "unbekannt": "Unbekannt",
};
const umlauts = {
  'ae': 'ä',
  'oe': 'ö',
  'ue': 'ü',
  'ss': 'ß'
};
const split_options = ["age", "gender"];

let current_charts = {};

async function get_last_update() {
  try {
    let path = "/last_update";
    const res = await axios.get(URL + path);
    return res.data;
  } catch (e) {
    console.error(e);
    $("#grid").hide();
  };
};

async function list_bundeslaender() {
  try {
    let path = "/list/bundesland";
    const res = await axios.get(URL + path);
    return res.data;
  } catch (e) {
    error_handling(e)
  };
};

async function build_dropdown(list) {

  // Insert Bundesländer
  list.forEach((item) => {
    let bundesland = item.toLowerCase().split("-").map((str) => str.charAt(0).toUpperCase() + str.substring(1)).join(" ");
    bundesland = bundesland.replace(/ae|oe|ue|ss/gi, (str) => {
      return umlauts[str];
    });
    $("#dropdown_bundesland").append("<li><p class='dropdown-item' id='select_state_" + item + "' href='#'>" + bundesland + "</p></li>");
  });

  // Enable dropdown
  $(".dropdown-submenu").on("click", (e) => {
    $(this).next("ul").toggle();
    e.stopPropagation();
    e.preventDefault();
  });

  // Setup dropdown listener
  $(document).on("click", 'p[id^="select_state_"]', function(e) {
    bundesland = this.id.slice(13);
    console.log("selected", bundesland);
  });
};

async function get_timeline(params) {
  try {
    let path = "/get_timeline";
    const res = await axios.get(URL + path, {
      params
    });
    return res.data
  } catch (e) {
    error_handling(e)
  };
};

async function get_share(params) {
  try {
    let path = "/get_share";
    const res = await axios.get(URL + path, {
      params
    });
    return res.data
  } catch (e) {
    error_handling(e)
  };
};

function error_handling(e) {
  $("#grid").hide();
  if (e.response.status === 400) {
    console.log(e.response.data)
    $("#status").html("Error: " + e.response.data);
  } else {
    console.log(e.response);
    $("#status").html("Error");
  };
};

function draw_timeline(data, params, update) {
  console.log(data);
  let total_str = data.total.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  var options_line = {
    series: [{
      name: translate[params.type],
      data: Object.values(data.timeline),
    }],
    chart: {
      width: "100%",
      height: params.bundesland ? 240 : 300,
      background: '#191a24',
      type: 'area',
      fontFamily: 'sans-serif',
      foreColor: '#77788A',
      toolbar: {
        show: false,
      },
      zoom: {
        enabled: false,
      }
    },
    grid: {
      show: true,
      borderColor: '#292A37',
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      curve: 'smooth',
    },
    xaxis: {
      type: 'datetime',
      categories: Object.keys(data.timeline),
      axisBorder: {
        show: true,
        color: '#292A37',
      },
      axisTicks: {
        color: '#292A37',
      },
    },
    tooltip: {
      x: {
        format: 'dd. MMM yyyy',
      },
      y: {
        formatter: function(value) {
          value_format = value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
          return value_format + ' ' + translate[params.type];
        },
      },
      theme: 'light',
    },
    theme: {
      mode: 'light',
      palette: (params.type == "cases") ? "palette2" : "palette7",
    },
  };

  if (!params.bundesland) {
    params.bundesland = "top_time"
  }

  $("#" + params.bundesland).innerHTML = '';
  $("#" + params.bundesland + " > .chart-label").html("Insgesamt " + total_str + " " + translate[params.type]);

  if (update === true) {
    current_charts[params.bundesland].updateOptions(options_line)
  } else {
    current_charts[params.bundesland] = new ApexCharts(document.querySelector("#" + params.bundesland + " > .chart"), options_line);
    current_charts[params.bundesland].render();
  };

};

function draw_donut(data, params, update) {
  let values = Object.values(data)
  let labels = [];
  Object.keys(data).forEach(function(label, index) {
    labels.push(label in translate ? translate[label] : label);
  });

  var options_donut = {
    series: values,
    labels,
    chart: {
      type: 'donut',
      width: $(window).width() > 1700 ? '75%' : '100%'
    },
    pie: {
      expandOnClick: false,
    },
    dataLabels: {
      formatter: function(value, opts) {
        value_format = values[opts.seriesIndex].toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        return opts.w.globals.seriesNames[opts.seriesIndex] + ": " + value_format;
      },
      style: {
        fontSize: '12px',
        fontWeight: 300,
        colors: ['gainsboro']
      },
    },
    legend: {
      show: false
    },
    plotOptions: {
      pie: {
        expandOnClick: false
      },
    },
    tooltip: {
      y: {
        formatter: function(value) {
          value_format = value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
          return value_format + ' ' + translate[params.type];
        },
        title: {
          formatter: function(seriesName) {
            return seriesName
          },
        },
      },
    },
    stroke: {
      colors: ['#00000000']
    },
    states: {
      hover: {
        filter: {
          type: 'darken',
          value: 0.2,
        },
      },
    },
    theme: {
      mode: 'light',
      palette: (params.by === "age") ? 'palette10' : 'palette6',
    },
    fill: {
      opacity: 0.85,
    },
  };

  $("#top_" + params.by).innerHTML = '';

  if (update === true) {
    current_charts["top_" + params.by].updateOptions(options_donut)
  } else {
    current_charts["top_" + params.by] = new ApexCharts(document.querySelector("#top_" + params.by + " > .chart"), options_donut);
    current_charts["top_" + params.by].render();
  };

};

function draw_top_row(params, update = false) {

  // Draw timeline
  get_timeline(params).then(response => {
    draw_timeline(response, params, update);
  });;

  // Draw donut
  split_options.forEach((split_option) => {
    get_share({
      ...params,
      by: split_option
    }).then(response => {
      draw_donut(response, {
        ...params,
        by: split_option
      }, update);
    });
  });

};

function draw_grid(params, update = false) {

  // Draw timelines
  bundeslaender.forEach((bundesland) => {
    get_timeline({
      ...params,
      bundesland: bundesland
    }).then(res => {
      console.log(res);
      draw_timeline(res, {
        ...params,
        bundesland: bundesland
      }, update);
    })

  });

};


async function init() {

  // Show last update date
  last_update = await get_last_update();
  last_update_str = last_update === undefined ? "Network Error" : "Update " + last_update;
  $("#status").html(last_update_str);

  draw_top_row({
    type: selected_type,
    days: selected_days,
  });

  // Get Bundesländer
  list_bundeslaender().then(response => {
    bundeslaender = response;

    draw_grid({
      type: selected_type,
      days: selected_days,
    });

    build_dropdown(bundeslaender);
  });

};

$(document).on("change", 'input:radio[id^="select_"]', (e) => {
  let changed = this.id.slice(7, 11);
  let selected = this.id.slice(12);

  switch (changed) {
    case "type":
      selected_type = selected
      break;
    case "days":
      selected_days = selected
      break;
    default:
      break;
  };

  draw_top_row({
    type: selected_type,
    days: selected_days,
  }, update = true)

  draw_grid({
    bundesland: element,
    type: selected_type,
    days: selected_days,
  }, update = true);

});


$(document).ready(function() {
  init();
});