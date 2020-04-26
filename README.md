# Covid
*Shelter-in-place one day build project*


- https://kaisiebenrock.com/covid/
- Backend: [py](https://github.com/siebenrock/covid/blob/master/app.py)
- Frontend: [html](https://github.com/siebenrock/covid/blob/master/index.html), [css](https://github.com/siebenrock/covid/blob/master/css/style.css), [js](https://github.com/siebenrock/covid/blob/master/js/script.js)




#### API

- Download new dataset: `http://kai7.pythonanywhere.com/update`
- Load dataset from local: `http://kai7.pythonanywhere.com/load_file`
- Last updated: `http://kai7.pythonanywhere.com/last_update`
- Get cases over last 5 days: `http://kai7.pythonanywhere.com/get_timeline?days=5&type=cases`
- Get cases in Munich over last 30 days: `http://kai7.pythonanywhere.com/get_timeline?bundesland=bayern&landkreis=sk-muenchen&days=30&type=cases`
- Get deaths per age groups: `http://kai7.pythonanywhere.com/get_share?type=deaths&by=age`
- Get cases per gender: `http://kai7.pythonanywhere.com/get_share?type=cases&by=gender`
- Get list of Bundesländer/Landkreise: `http://kai7.pythonanywhere.com/list/bundesland`




#### Charts

- [ApexCharts](https://apexcharts.com)
- [Google Charts](https://developers.google.com/chart/)

