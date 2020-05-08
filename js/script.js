const URI = window.location.search.replace(/"|'|`|{|}|;|:|<|>|,/gi, "");
let URLParams = new URLSearchParams(URI);

let selected = {
  type: "cases",
  days: 30,
  bundesland: null,
  landkreis: null,
}

const TRANSLATE = {
  "cases": "Fälle",
  "deaths": "Todesfälle",
  "age": "Alter",
  "gender": "Geschlecht",
  "M": "Männer",
  "W": "Frauen",
  "unbekannt": "Unbekannt",
};

const UMLAUTS = {
  "ae": "ä",
  "oe": "ö",
  "ue": "ü",
};

const splitOptions = ["age", "gender"];

let currentCharts = {};

function display_region(name) {
  name = name.toLowerCase().split("-").map((str) => str.charAt(0).toUpperCase() + str.substring(1)).join("-");
  name = name.replace(/ae|oe|ue/gi, (str) => {
    return UMLAUTS[str];
  });
  name = name.replace(/(S|L)k-/gi, (str) => {
    return str.substr(3);
  });
  return name;
};

async function get(path = "/get", params = null) {
  try {
    let URL = window.location.href.includes("file:") ? "http://0.0.0.0:4000" : "https://kai7.pythonanywhere.com";
    const res = await axios.get(URL + path, {
      params
    });
    return res.data;
  } catch (e) {
    error_handling(e);
  };
};

function error_handling(e) {
  $("#dashboard").hide();
  if (e.response && e.response.status === 400) {
    console.log("Error response data", e.response.data)
    $("#status").html(`Error: ${e.response.data}`);
  } else {
    console.log("Error response", e, e.response);
    $("#status").html("Error");
  };
};

function draw_timeline(data, params, mainChart = false) {
  let totalStr = data.total.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  var optionsLine = {
    series: [{
      name: TRANSLATE[params.type],
      data: Object.values(data.timeline),
    }],
    chart: {
      width: "100%",
      height: !mainChart ? 240 : 300,
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
          valueFormat = value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
          return valueFormat + ' ' + TRANSLATE[params.type];
        },
      },
      theme: 'light',
    },
    theme: {
      mode: 'light',
      palette: (params.type == "cases") ? "palette2" : "palette7",
    },
  };

  mainChart ? chart = "main_time" : chart = params.bundesland;

  $("#" + chart + " > .chart-label").html(`Insgesamt ${totalStr} ${TRANSLATE[params.type]}`);

  // Create or update chart
  if (chart in currentCharts) {
    currentCharts[chart].updateOptions(optionsLine);
  } else {
    currentCharts[chart] = new ApexCharts(document.querySelector("#" + chart + " > .chart"), optionsLine);
    currentCharts[chart].render();
  };

  // Update chart heading
  if (mainChart) {
    let label = params.bundesland ? display_region(params.bundesland) : "";
    label += params.landkreis ? ", " + display_region(params.landkreis) : "";

    $("#main_time h5").html((label.length > 0) ? label : "Deutschland");
  };

};

function draw_donut(data, params, update) {
  let values = Object.values(data.shares[params.by])
  let labels = [];
  Object.keys(data.shares[params.by]).forEach(function(label, index) {
    labels.push(label in TRANSLATE ? TRANSLATE[label] : label);
  });

  var optionsDonut = {
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
        valueFormat = values[opts.seriesIndex].toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        return `${opts.w.globals.seriesNames[opts.seriesIndex]}: ${valueFormat}`;
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
          valueFormat = value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
          return valueFormat + ' ' + TRANSLATE[params.type];
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

  // Create or update chart
  if ("main_" + params.by in currentCharts) {
    currentCharts["main_" + params.by].updateOptions(optionsDonut)
  } else {
    currentCharts["main_" + params.by] = new ApexCharts(document.querySelector("#main_" + params.by + " > .chart"), optionsDonut);
    currentCharts["main_" + params.by].render();
  };

};

async function draw_main(params) {

  // Draw timeline
  $("#main").show()
  let timeline = await get(path = "/get", params);
  draw_timeline(timeline, params, mainChart = true);

  // Draw donuts
  splitOptions.forEach((splitOption) => {
    draw_donut(timeline, {
      ...params,
      by: splitOption
    });
  });

};

async function draw_states_grid(params) {

  // Draw timelines
  let timelines = await get(path = "/get_all", params);
  $("#main, #grid").show()
  Object.keys(timelines).forEach(bundesland => {
    draw_timeline(timelines[bundesland], {
      ...params,
      bundesland: bundesland
    });
  });

};

function get_URL_parameter() {
  selected = {
    ...selected,
    bundesland: URLParams.get("bundesland"),
    landkreis: URLParams.get("landkreis"),
  };

  if (selected.bundesland || selected.landkreis) {
    $("#grid").hide();
    $("#dropdown_lk").parent().show();
    $("#dropdown_lk_toggle").html((selected.landkreis === null) ? "Alle Landkreise" : display_region(selected.landkreis));
    if (selected.bundesland) {
      $("#dropdown_bl_toggle").html(display_region(selected.bundesland));
      build_dropdown(selected.bundesland);
    }
  }
};

function build_dropdown(bundesland = null) {
  path = "/list"
  let dropdownType = "bl"
  if (bundesland) {
    path += ("/" + bundesland)
    dropdownType = "lk"
  };

  get(path = path).then(res => {
    // Insert Bundesländer
    Object.values(res).forEach((item) => {
      $("#dropdown_" + dropdownType).append("<li id='select_" + dropdownType + "_" + item + "'><p class='dropdown-item' href='#'>" + display_region(item) + "</p></li>");
    });

    // Enable dropdown
    $(".dropdown-submenu").on("click", (e) => {
      $(this).next("ul").toggle();
      e.stopPropagation();
      e.preventDefault();
    });
  });
};

function setup_listener() {

  // Listener for type and case
  $(document).on("change", 'input:radio[id^="select_"]', function(e) {
    let changed = this.id.slice(7, 11);
    let option = this.id.slice(12);

    switch (changed) {
      case "type":
        selected.type = option;
        break;
      case "days":
        selected.days = option;
        break;
      default:
        break;
    };
  });

  // Listener for Bundesland and Landkreis dropdown
  $(document).on("click", 'li[id^="select_"]', function(e) {
    let option = this.id.slice(10);
    let level = {
      "bl": "bundesland",
      "lk": "landkreis",
    } [this.id.slice(7, 9)];

    selected[level] = (option === "all") ? null : option;
  });

  // Listener on grid chart insight
  $(document).on("click", 'h5[class^="h-clickable"]', function(e) {
    selected.bundesland = $(this).parent().attr('id');
  });
};

async function init() {

  // Show last update date
  lastUpdate = await get(path = "/last_update");
  lastUpdateStr = lastUpdate === null ? "Network Error" : "Update " + lastUpdate;
  $("#status").html(lastUpdateStr);

  get_URL_parameter()

  var proxyHandler = {
    set: function(target, key, value) {
      if (key) {
        target[key] = value;
      };
      console.log(`Proxy change ${key} set to ${value}`, selected);

      if (key === "bundesland" || key === "landkreis") {
        URLParams.set("bundesland", selected.bundesland);
        if (key === "bundesland") {
          $("#dropdown_bl_toggle").html((value === null) ? "Alle Bundesländer" : display_region(value));
          $("#dropdown_lk_toggle").html("Alle Landkreise");
          $('#dropdown_lk').children().slice(2).remove();
          target["landkreis"] = null;
          if (value === null) {
            $("#dropdown_lk").parent().hide();
            URLParams.delete("bundesland");
          };
          build_dropdown(value);
          URLParams.delete("landkreis");
        } else if (key === "landkreis") {
          $("#dropdown_lk_toggle").html((value === null) ? "Alle Landkreise" : display_region(value));
          if (value === null) {
            URLParams.delete("landkreis");
          };
          URLParams.set("landkreis", selected.landkreis);
        };
        let newPath = (window.location.pathname + "?" + URLParams.toString()).replace(/\?$/, '');
        history.pushState(null, "", newPath);
      };

      // Update charts
      draw_main({
        ...selected
      });

      // Handle states grid
      if (!selected.bundesland && !selected.landkreis) {
        $("#grid").show();
        $("#dropdown_lk").parent().hide();
        $('#dropdown_lk').children().slice(2).remove();
        draw_states_grid({
          ...selected
        });
      } else {
        $("#grid").hide();
        $("#dropdown_lk").parent().show();
      };

      return true;
    }
  }

  selected = new Proxy(selected, proxyHandler);
  proxyHandler.set();

  build_dropdown();
  setup_listener();

  if (!window.location.href.includes("file:")) {
    res = get(path = "/visit")
  };
};

$(document).ready(function() {
  init();
});