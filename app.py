import atexit
import io
import os

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
first_case = None
data = None

QUERY_DATE_FORM = "%Y-%m-%d"
UPDATE_DATE_FORM = "%d.%m.%Y, %H:%M Uhr"

DATE_COLUMNS = ["Meldedatum", "Refdatum", "Datenstand"]
SPLIT_OPTIONS = dict.fromkeys(["age", "gender"])
UMLAUTS = {'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'Ã¼': 'ue', 'ß': 'ss'}
TRANSLATE = {'age': 'Altersgruppe', 'gender': 'Geschlecht', 'time': 'Refdatum'}

# Setup pushover notifications
PushoverClient = Client("udy7tnmyfckqpwgos1cucuu723526x",
                        api_token="apv2jsrcmdjfowj2xa3anwgbgac8mm")

# Endpoint to download RKI file, clean, and save
@app.route("/update", methods=["GET"])
def update():
    global last_updated, first_case
    error = {"status": False, "message": ""}

    # Request .csv file
    def request_file():
        URL = "https://www.arcgis.com/sharing/rest/content/items/f10774f1c63e40168479a1feb6c7ca74/data"

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
        try:
            encoding = "utf-8"
            df = pd.read_csv(io.StringIO(r.content.decode(
                encoding)), parse_dates=DATE_COLUMNS)
        except UnicodeDecodeError:
            encoding = "windows-1252"
            df = pd.read_csv(io.StringIO(r.content.decode(
                encoding)), parse_dates=DATE_COLUMNS)

        # Set index
        assert pd.Series(df["FID"]).is_unique == True
        df.set_index("FID", inplace=True)

        # Date formatting
        df["Datenstand"] = pd.to_datetime(
            df["Datenstand"], format=UPDATE_DATE_FORM)

        # Localize
        for c in DATE_COLUMNS:
            df[c] = df[c].dt.tz_localize(None)

        # Encode regions
        for c in ["Bundesland", "Landkreis"]:
            df[c].replace(UMLAUTS, regex=True, inplace=True)
            df[c] = df[c].str.replace(' ', '-')
            df[c] = df[c].str.lower()

        # Clean age range
        df["Altersgruppe"] = df["Altersgruppe"].str.replace("A", "")

        global data, last_updated
        data = df
        last_updated = pd.to_datetime(
            data["Datenstand"].max(), format=QUERY_DATE_FORM)
        first_case = pd.to_datetime(data["Refdatum"].min(), format="%Y-%m-%d")

        # Save file
        data.to_csv("data/" + last_updated.strftime(QUERY_DATE_FORM) + ".csv")

        # Clean up old files
        files = sorted(os.listdir(os.getcwd() + "/data"), reverse=True)
        for file in files[7:]:
            file = os.getcwd() + "/data/" + file
            if os.path.exists(file):
                os.remove(file)
            else:
                print("Tried to delete file that does not exist")

        for split_option in list(SPLIT_OPTIONS.keys()):
            SPLIT_OPTIONS[split_option] = data[TRANSLATE[split_option]]

    except Exception as e:
        error = {"status": True, "message": "Error while cleaning data"}
        PushoverClient.send_message(f"{error['message']} + {e}", title="Covid")
        return jsonify(f"{error['message']} + {e}"), 400

    message = f"Data loaded from RKI (encoded: {encoding}, last update: {last_updated.strftime(QUERY_DATE_FORM)})"
    PushoverClient.send_message(message, title="Covid")
    return jsonify(message), 200

# Endpoint to load local data file
@app.route("/load_file", defaults={"file": None}, methods=["GET"])
@app.route("/load_file/<file>", methods=["GET"])
def load_file(file):
    global data, last_updated, first_case

    if not file:
        file = sorted(os.listdir(os.getcwd() + "/data"))[-1]
        file = file.replace(".csv", "")

    try:
        # Read file
        data = pd.read_csv("data/" + file + ".csv", parse_dates=DATE_COLUMNS)

        # Clean up old files
        files = sorted(os.listdir(os.getcwd() + "/data"), reverse=True)
        for file in files[7:]:
            file = os.getcwd() + "/data/" + file
            if os.path.exists(file):
                os.remove(file)
            else:
                print("Tried to delete file that does not exist")

        last_updated = pd.to_datetime(
            data["Datenstand"].max(), format="%Y-%m-%d")
        first_case = pd.to_datetime(data["Refdatum"].min(), format="%Y-%m-%d")
        for split_option in list(SPLIT_OPTIONS.keys()):
            SPLIT_OPTIONS[split_option] = data[TRANSLATE[split_option]]

        message = f"Data loaded from file (last update: {last_updated.strftime(QUERY_DATE_FORM)})"
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
@app.route("/list", defaults={"bundesland": None}, methods=["GET"])
@app.route("/list/<bundesland>", methods=["GET"])
def list_column(bundesland):

    # Check if data exists
    if data is None:
        return jsonify("No data"), 400

    if not bundesland:
        bundeslaender = data["Bundesland"].unique()
        return jsonify(sorted(bundeslaender)), 200

    bundesland = clean_string(bundesland)
    landkreise = data[data["Bundesland"] == bundesland]["Landkreis"].unique()
    return jsonify(sorted(landkreise)), 200

# Endpoint to return timelines
@app.route("/get", methods=["GET"])
def get():
    global data, last_updated, first_case

    # Check if data exists
    if data is None:
        return jsonify("No data"), 400
    df = data

    # Set query type
    query_type = "cases" if "type" not in request.args else request.args.get(
        "type")

    df, query_column = adjust_numbers(df, query_type)

    # Bundesland and Landkreis given
    if "bundesland" in request.args and "landkreis" in request.args:
        bundesland = clean_string(request.args.get("bundesland"))
        landkreis = clean_string(request.args.get("landkreis"))

        query = df[(df["Bundesland"] == bundesland)
                   & (df["Landkreis"] == landkreis)]

    # Bundesland but no Landkreis given
    elif "bundesland" in request.args and "landkreis" not in request.args:
        bundesland = clean_string(request.args.get("bundesland"))

        query = df[(df["Bundesland"] == bundesland)]

    # Bundesland but no Landkreis given
    elif "bundesland" not in request.args and "landkreis" in request.args:
        landkreis = clean_string(request.args.get("landkreis"))

        query = df[(df["Landkreis"] == landkreis)]

    # No Bundesland and no Landkreis given
    else:
        query = df

    # Calculate total
    total = query[query_column].sum()

    # Calculate shares
    shares = {}
    for option in SPLIT_OPTIONS:
        share = query.groupby(TRANSLATE[option])[query_column].sum()
        share = share.reindex(SPLIT_OPTIONS[option], fill_value=0)
        share.sort_index(inplace=True)
        shares[option] = share.to_dict()

    df, index_filled = filter_time(df, request.args)

    timeline = query.groupby("Refdatum")[query_column].sum()
    timeline = timeline.reindex(index_filled, fill_value=0)
    timeline.sort_index(inplace=True)
    timeline.index = pd.to_datetime(
        timeline.index).strftime(QUERY_DATE_FORM)
    timeline = timeline.to_dict()

    query_dict = {
        "total": int(total),
        "timeline": timeline,
        "shares": shares,
    }

    return jsonify(query_dict), 200

# Endpoint to return data for Bundesländer grid
@app.route("/get_all", methods=["GET"])
def get_all():
    global data, last_updated, first_case

    # Check if data exists
    if data is None:
        return jsonify("No data"), 400
    df = data

    # Set query type
    query_type = "cases" if "type" not in request.args else request.args.get(
        "type")

    df, query_column = adjust_numbers(df, query_type)

    if "bundesland" in request.args:
        bundesland = request.args.get("bundesland")
        level = "Landkreis"
        df = df[df["Bundesland"] == bundesland]
    else:
        level = "Bundesland"

    # Calculate totals
    totals = df.groupby([level])[query_column].sum()

    df, index_filled = filter_time(df, request.args)

    query = df.groupby([level, "Refdatum"])[query_column].sum()

    timelines = {}
    for geo in df[level].unique():
        timeline = query[geo]
        timeline = timeline.reindex(index_filled, fill_value=0)
        timeline.sort_index(inplace=True)
        timeline.index = pd.to_datetime(
            timeline.index).strftime(QUERY_DATE_FORM)
        timelines[geo] = {
            "total": int(totals[geo]),
            "timeline": timeline.to_dict(),
        }

    return jsonify(timelines), 200


def clean_string(s):
    s = s.lower()
    for new, initial in UMLAUTS.items():
        s = s.replace(new, initial)
    return s


def filter_time(df, args):
    if "days" in args:
        start_date = max(
            last_updated - pd.DateOffset(int(args.get("days"))), first_case)
    else:
        start_date = first_case

    # Filter dataframe
    df = df[pd.to_datetime(
        df["Refdatum"], format=QUERY_DATE_FORM) >= start_date]
    index_filled = pd.date_range(
        start_date, last_updated - pd.DateOffset(1))
    return df, index_filled


def adjust_numbers(df, query_type):
    if query_type == "cases":
        df = df[df["NeuerFall"].isin([0, 1])]
        query_column = "AnzahlFall"
    elif query_type == "deaths":
        df = df[df["NeuerTodesfall"].isin([0, 1])]
        query_column = "AnzahlTodesfall"
    return df, query_column


def init_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(func=update, trigger="interval", minutes=60 * 4)
    scheduler.start()
    PushoverClient.send_message("Schedule started", title="Covid")

    # Shut down the scheduler when exiting app
    atexit.register(lambda: scheduler.shutdown())


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=4000, threaded=True, debug=True)
