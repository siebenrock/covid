# Covid
*Shelter-in-place weekend build project*


- [covid.kaisiebenrock.com](https://covid.kaisiebenrock.com)
- Backend: [py](https://github.com/siebenrock/covid/blob/master/app.py)
- Frontend: [html](https://github.com/siebenrock/covid/blob/master/index.html), [css](https://github.com/siebenrock/covid/blob/master/css/style.css), [js](https://github.com/siebenrock/covid/blob/master/js/script.js)



### API

Update data

```
* URL: /update
* Method: GET
* Success: "Data loaded from RKI", 200
* Error: "Request status code {status_code}", 400
* Error: "Error retrieving file {e}", 400
* Error: "Error while cleaning data {e}", 400
```

Load file

```
* URL: /load_file
* URL: /load_file/<file>
* Method: GET
* Success: "Data loaded from file", 200
* Error: "Error while loading data from file {e}", 400
```

Last update

```
* URL: /last_update
* Method: GET
* Success: "{date}", 200
```

List Bundesländer and Landkreise

```
* URL: /list
* URL: /list/<bundesland>
* Method: GET
* Success: {}, 200
* Error: "No data", 400
```

Get data

```
* URL: /get
* Method: GET
* Params: {bundesland, landkreis, type: cases/deaths, days: <int>}
* Success: {}, 200
* Error: "No data", 400
* Error: "Unknown type parameter", 400
```

Get data for all states

```
* URL: /get_states
* Method: GET
* Params: {type: cases/deaths, days: <number>}
* Success: {}, 200
* Error: "No data", 400
* Error: "Unknown type parameter", 400
```




### Charts

- [ApexCharts](https://apexcharts.com)
- [Google Charts](https://developers.google.com/chart/)

