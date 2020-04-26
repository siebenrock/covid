let URL = window.location.href.includes("index.html") ? "http://0.0.0.0:4000" : "https://kai7.pythonanywhere.com";

let bundeslaender = [];
let last_update = "";
let selected_type = "cases"
let selected_days = 30

const translate = {
  "cases": "Fälle",
  "deaths": "Todesfälle",
  "age": "Alter",
  "gender": "Geschlecht",
  "M": "Männer",
  "W": "Frauen",
  "unbekannt": "Unbekannt",
};
const split_options = ["age", "gender"]

let current_charts = {};

async function get_last_update() {
  try {
    let path = "/last_update";
    const res = await axios.get(URL + path);
    return res.data;
  } catch (e) {
    console.error(e);
    $("#grid").hide();
  }
}

async function list_bundeslaender() {
  try {
    let path = "/list/bundesland";
    const res = await axios.get(URL + path);
    return res.data;
  } catch (e) {
    error_handling(e)
  }
}

async function get_timeline(params) {
  try {
    let path = "/get_timeline";
    const res = await axios.get(URL + path, {
      params
    });
    return res.data
  } catch (e) {
    error_handling(e)
  }
}

async function get_share(params) {
  try {
    let path = "/get_share";
    const res = await axios.get(URL + path, {
      params
    });
    return res.data
  } catch (e) {
    error_handling(e)
  }
}

function error_handling(e) {
  $("#grid").hide();
  if (e.response.status === 400) {
    console.log(e.response.data)
    $("#status").html("Error: " + e.response.data);
  } else {
    console.log(e.response);
    $("#status").html("Error");
  }
}

async function draw_timeline(update, params) {
  let data = await get_timeline(params);
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
    params.bundesland = "deutschland_time"
  }

  $("#" + params.bundesland).innerHTML = '';
  $("#" + params.bundesland + " > .chart-label").html("Insgesamt " + total_str + " " + translate[params.type]);

  if (update === true) {
    current_charts[params.bundesland].updateOptions(options_line)
  } else {
    current_charts[params.bundesland] = new ApexCharts(document.querySelector("#" + params.bundesland + " > .chart"), options_line);
    current_charts[params.bundesland].render();
  }

}

async function draw_donut(update, params) {
  let data = await get_share(params);
  let values = Object.values(data)

  var options_donut = {
    series: values,
    labels: Object.keys(data),
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

  $("#deutschland_" + params.by).innerHTML = '';

  if (update === true) {
    current_charts["deutschland_" + params.by].updateOptions(options_donut)
  } else {
    current_charts["deutschland_" + params.by] = new ApexCharts(document.querySelector("#deutschland_" + params.by + " > .chart"), options_donut);
    current_charts["deutschland_" + params.by].render();
  }

}

async function init() {

  // Show last update date
  last_update = await get_last_update();
  last_update_str = last_update === undefined ? "Network Error" : "Update " + last_update;
  $("#status").html(last_update_str);

  // Draw aggregated charts
  draw_timeline(update = false, {
    type: selected_type,
    days: selected_days,
  });

  split_options.forEach((element, index) => {
    draw_donut(update = false, {
      type: selected_type,
      by: element,
    });
  });

  // Draw charts
  bundeslaender = await list_bundeslaender();
  bundeslaender.forEach((element, index, array) => {
    const params = {
      bundesland: element,
      type: selected_type,
      days: selected_days,
    };
    draw_timeline(update = false, params);
  });

}

$(document).on('change', 'input:radio[id^="select_"]', function(e) {
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
  }

  // Update aggregated charts
  draw_timeline(update = true, {
    type: selected_type,
    days: selected_days,
  });

  if (changed === "type") {
    split_options.forEach((element, index) => {
      draw_donut(update = true, {
        type: selected_type,
        by: element,
      });
    });
  }

  // Update charts
  bundeslaender.forEach((element, index, array) => {
    const params = {
      bundesland: element,
      type: selected_type,
      days: selected_days,
    };
    draw_timeline(update = true, params);
  });
});


$(document).ready(function() {
  init();
});