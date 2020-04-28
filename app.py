import atexit
import io

import pandas as pd
import requests
from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask, jsonify, request
from flask_cors import CORS
from pushover import Client

# Initiate app
app = Flask(__name__)
app.config['JSONIFY_PRETTYPRINT_REGULAR'] = True
app.config['JSON_SORT_KEYS'] = False

# For development
CORS(app)

last_updated = None
data = None

main_date_f = "%d-%m-%Y"
query_date_f = "%Y-%m-%d"

date_columns = ["Meldedatum", "Refdatum", "Datenstand"]
split_options = dict.fromkeys(["age", "gender"])
umlauts = {'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss'}
translate = {'age': 'Altersgruppe', 'gender': 'Geschlecht', 'time': 'Refdatum'}

# Setup pushover notifications
PushoverClient = Client("udy7tnmyfckqpwgos1cucuu723526x",
                        api_token="apv2jsrcmdjfowj2xa3anwgbgac8mm")


def clean_string(s):
    s = s.lower()
    for new, initial in umlauts.items():
        s = s.replace(new, initial)
    return s

# Endpoint to download RKI file, clean, and save
@app.route("/update", methods=["GET"])
def update():

    error = {"status": False, "message": ""}

    # Request .csv file
    def request_file():
        URL = "https://www.arcgis.com/sharing/rest/content/items/f10774f1c63e40168479a1feb6c7ca74/data"
        global last_updated

        try:
            r = requests.get(URL)

            # Check status status_code
            print("Request status code", r.status_code)
            if r.status_code != requests.codes.ok:
                error = {"status": True,
                         "message": f"Request status code {r.status_code}."}
                return r, error

            error = {"status": False, "message": "File retrieved"}
            return r, error
        except Exception as e:
            error = {"status": True, "message": "Error retrieving file"}
            PushoverClient.send_message(
                f"{error['message']} + {e}", title="Covid")
            print(f"{error['message']} + {e}")
            return False, error

    r, error = request_file()

    # Return on error
    if error["status"]:
        return jsonify(error["message"]), 400

    try:
        # Convert to dataframe
        df = pd.read_csv(io.StringIO(r.content.decode('utf-8')),
                         parse_dates=date_columns)

        # Set set_index
        assert pd.Series(df["ObjectId"]).is_unique == True
        df.set_index("ObjectId", inplace=True)

        # Date formatting
        date_f = "%d.%m.%Y, %H:%M Uhr"
        df["Datenstand"] = pd.to_datetime(df["Datenstand"], format=date_f)

        # Localize
        for c in date_columns:
            df[c] = df[c].dt.tz_localize(None)

        # Encode regions
        for c in ["Bundesland", "Landkreis"]:
            df[c].replace(umlauts, regex=True, inplace=True)
            df[c] = df[c].str.replace(' ', '-')
            df[c] = df[c].str.lower()

        # Clean age range
        df["Altersgruppe"] = df["Altersgruppe"].str.replace("A", "")

        global data, last_updated
        data = df
        data.to_csv("data.csv")
        last_updated = pd.to_datetime(
            data["Datenstand"].max(), format="%Y-%m-%d")
        for split_option in list(split_options.keys()):
            split_options[split_option] = data[translate[split_option]]

    except Exception as e:
        error = {"status": True, "message": "Error while cleaning data"}
        PushoverClient.send_message(f"{error['message']} + {e}", title="Covid")
        return jsonify(f"{error['message']} + {e}"), 400

    message = f"Data loaded from RKI (last update: {last_updated.strftime(query_date_f)})"
    PushoverClient.send_message(message, title="Covid")
    return jsonify(message), 200

# Endpoint to load local data file
@app.route("/load_file", methods=["GET"])
def load_file():

    try:
        global data, last_updated
        data = pd.read_csv("data.csv", parse_dates=date_columns)
        last_updated = pd.to_datetime(
            data["Datenstand"].max(), format="%Y-%m-%d")
        for split_option in list(split_options.keys()):
            split_options[split_option] = data[translate[split_option]]

        message = f"Data loaded from file (last update: {last_updated.strftime(query_date_f)})"
        PushoverClient.send_message(message, title="Covid")
        return jsonify(message), 200

    except Exception as e:
        PushoverClient.send_message(
            f"Error while loading data from file {e}", title="Covid")
        return jsonify(f"Error while loading data from file {e}"), 400

# Endpoint to return last updated date
@app.route("/last_update", methods=["GET"])
def last_update():
    last_updated_date = last_updated.strftime(
        "%d. %B %Y") if last_updated else "No data"
    return jsonify(last_updated_date), 200

# Endpoint to list all unique column values, e.g. Landkreis
@app.route("/list/<column>", methods=["GET"])
def list_column(column):

    # Check if data exists
    if data is None:
        return jsonify("No data"), 400

    column = clean_string(column)

    # Get unique column
    index = [c.lower() for c in data.columns].index(column)
    column_list = list(data.iloc[:, index].unique())
    return jsonify(sorted(column_list)), 200

# Endpoint to return timelines
@app.route("/get_timeline", methods=["GET"])
def get_timeline():
    global data, last_updated

    # Check if data exists
    if data is None:
        return jsonify("No data"), 400
    df = data

    # Set query type
    query_type = "cases" if "type" not in request.args else request.args.get(
        "type")

    # Adjust data to case
    if query_type == "cases":
        df = df[df["NeuerFall"].isin([0, 1])]
        query_column = "AnzahlFall"
    elif query_type == "deaths":
        df = df[df["NeuerTodesfall"].isin([0, 1])]
        query_column = "AnzahlTodesfall"
    else:
        return jsonify("Unknown type parameter"), 400

    # Bundesland and Landkreis given
    if "bundesland" in request.args and "landkreis" in request.args:
        bundesland = clean_string(request.args.get("bundesland"))
        landkreis = clean_string(request.args.get("landkreis"))

        # Filter df by Bundesland and Landkreis, group, and sum
        query = df[(df["Bundesland"] == bundesland)
                   & (df["Landkreis"] == landkreis)]

    # Bundesland but no Landkreis given
    elif "bundesland" in request.args and "landkreis" not in request.args:
        bundesland = clean_string(request.args.get("bundesland"))

        # Filter df by Bundesland, group, and sum
        query = df[(df["Bundesland"] == bundesland)]

    # No Bundesland and no Landkreis given
    elif "bundesland" not in request.args and "landkreis" not in request.args:
        query = df

    if len(query) == 0:
        return jsonify("No data found, check parameter"), 400

    # Calculate total
    total = query[query_column].sum()

    # Calculate shares
    shares = {}
    for option in split_options:
        share = query.groupby(translate[option])[query_column].sum()
        share = share.reindex(split_options[option], fill_value=0)
        share.sort_index(inplace=True)
        shares[option] = share.to_dict()

    # Calculate timeline
    query_len = 30 if "days" not in request.args else int(
        request.args.get("days"))
    first_case = pd.to_datetime(df["Refdatum"].min(), format="%Y-%m-%d")
    start_date = max(last_updated - pd.DateOffset(query_len), first_case)
    df = df[pd.to_datetime(
        df["Refdatum"], format=query_date_f) >= start_date]
    index_filled = pd.date_range(
        start_date, last_updated - pd.DateOffset(1))

    timeline = query.groupby("Refdatum")[query_column].sum()
    timeline = timeline.reindex(index_filled, fill_value=0)
    timeline.sort_index(inplace=True)
    timeline.index = pd.to_datetime(
        timeline.index).strftime(query_date_f)
    timeline = timeline.to_dict()

    query_dict = {
        "total": int(total),
        "timeline": timeline,
        "shares": shares,
    }

    return jsonify(query_dict), 200

# Endpoint to shares
@app.route("/get_share", methods=["GET"])
def get_share():
    global data, last_updated

    # Check if data exists
    if data is None:
        return jsonify("No data"), 400
    df = data

    # Check share parameter
    if "by" not in request.args or not request.args.get("by") in split_options.keys():
        return jsonify("False by parameter"), 400
    by = request.args.get("by")

    # Set query type
    query_type = "cases" if "type" not in request.args else request.args.get(
        "type")

    # Adjust data to case
    if query_type == "cases":
        df = df[df["NeuerFall"].isin([0, 1])]
        query_column = "AnzahlFall"
    elif query_type == "deaths":
        df = df[df["NeuerTodesfall"].isin([0, 1])]
        query_column = "AnzahlTodesfall"
    else:
        return jsonify("Unknown type parameter"), 400

    shares = df.groupby(translate[by])[query_column].sum()
    shares = shares.reindex(split_options[by], fill_value=0)
    shares.sort_index(inplace=True)
    query_dict = shares.to_dict()

    return jsonify(query_dict), 200


def init_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(func=update, trigger="interval", minutes=60 * 4)
    scheduler.start()
    PushoverClient.send_message("Schedule started", title="Covid")

    # Shut down the scheduler when exiting app
    atexit.register(lambda: scheduler.shutdown())


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=4000, threaded=True, debug=True)
