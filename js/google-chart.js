const URL = "https://kai7.pythonanywhere.com/get_timeline";
google.charts.load('current', {'packages':['corechart']});
google.charts.setOnLoadCallback(drawChart);

async function get_bundesland() {
  try {
    let path = "?bundesland=bayern&landkreis=sk-muenchen";
    const res = await axios.get(URL + path);
    let data_array = Object.entries(res.data);
    data_array.unshift(["Date", "Cases"]);
    return data_array
  } catch (e) {
   console.error(e);
 }
}

async function drawChart() {
  let data_array = await get_bundesland();
  let chart_data = google.visualization.arrayToDataTable(data_array);
  var options = {
    title: "Cases",
    curveType: "function",
    legend: { position: "bottom" },
    backgroundColor: '#E4E4E4',
  };
  var chart = new google.visualization.LineChart(document.getElementById("chart"));
  chart.draw(chart_data, options);
}
