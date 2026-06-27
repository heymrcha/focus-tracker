from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime, timedelta
import json
import os

app = Flask(__name__)
CORS(app)

DATA_FILE = "data.json"


def load_data():
    if not os.path.exists(DATA_FILE):
        return {"subjects": [], "sessions": []}

    with open(DATA_FILE, "r", encoding="utf-8") as file:
        return json.load(file)


def save_data(data):
    with open(DATA_FILE, "w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)


def next_id(items):
    if not items:
        return 1
    return max(item["id"] for item in items) + 1


@app.route("/subjects", methods=["GET"])
def get_subjects():
    data = load_data()
    return jsonify(data["subjects"])


@app.route("/subjects", methods=["POST"])
def create_subject():
    data = load_data()
    body = request.get_json()

    name = body.get("name", "").strip()

    if not name:
        return jsonify({"error": "Subject name is required"}), 400

    subject = {
        "id": next_id(data["subjects"]),
        "name": name
    }

    data["subjects"].append(subject)
    save_data(data)

    return jsonify(subject), 201


@app.route("/subjects/<int:subject_id>", methods=["DELETE"])
def delete_subject(subject_id):
    data = load_data()

    data["subjects"] = [
        subject for subject in data["subjects"]
        if subject["id"] != subject_id
    ]

    data["sessions"] = [
        session for session in data["sessions"]
        if session["subject_id"] != subject_id
    ]

    save_data(data)

    return jsonify({"success": True})


@app.route("/sessions", methods=["GET"])
def get_sessions():
    data = load_data()

    subject_id = request.args.get("subject_id")
    date_range = request.args.get("range", "all")

    sessions = data["sessions"]

    if subject_id:
        sessions = [
            session for session in sessions
            if session["subject_id"] == int(subject_id)
        ]

    now = datetime.now()

    if date_range == "week":
        start_date = now - timedelta(days=7)
        sessions = [
            session for session in sessions
            if datetime.fromisoformat(session["created_at"]) >= start_date
        ]

    elif date_range == "month":
        start_date = now - timedelta(days=30)
        sessions = [
            session for session in sessions
            if datetime.fromisoformat(session["created_at"]) >= start_date
        ]

    subjects = {subject["id"]: subject["name"] for subject in data["subjects"]}

    result = []
    for session in sessions:
        result.append({
            **session,
            "subject_name": subjects.get(session["subject_id"], "Deleted Subject")
        })

    result.sort(key=lambda x: x["created_at"], reverse=True)

    return jsonify(result)


@app.route("/sessions", methods=["POST"])
def create_session():
    data = load_data()
    body = request.get_json()

    subject_id = body.get("subject_id")
    duration = body.get("duration", 25)

    if not subject_id:
        return jsonify({"error": "subject_id is required"}), 400

    session = {
        "id": next_id(data["sessions"]),
        "subject_id": int(subject_id),
        "duration": int(duration),
        "created_at": datetime.now().isoformat(timespec="seconds")
    }

    data["sessions"].append(session)
    save_data(data)

    return jsonify(session), 201


@app.route("/sessions/<int:session_id>", methods=["DELETE"])
def delete_session(session_id):
    data = load_data()

    data["sessions"] = [
        session for session in data["sessions"]
        if session["id"] != session_id
    ]

    save_data(data)

    return jsonify({"success": True})


@app.route("/stats", methods=["GET"])
def get_stats():
    data = load_data()

    sessions = data["sessions"]
    subjects = {subject["id"]: subject["name"] for subject in data["subjects"]}

    total_minutes = sum(session["duration"] for session in sessions)
    total_hours = round(total_minutes / 60, 1)

    now = datetime.now()
    week_start = now - timedelta(days=7)

    sessions_this_week = len([
        session for session in sessions
        if datetime.fromisoformat(session["created_at"]) >= week_start
    ])

    by_subject_map = {}

    for session in sessions:
        name = subjects.get(session["subject_id"], "Deleted Subject")
        by_subject_map[name] = by_subject_map.get(name, 0) + session["duration"]

    by_subject = [
        {"name": name, "minutes": minutes}
        for name, minutes in by_subject_map.items()
    ]

    weekday_labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    by_weekday = {day: 0 for day in weekday_labels}

    for session in sessions:
        created_at = datetime.fromisoformat(session["created_at"])
        day = weekday_labels[created_at.weekday()]
        by_weekday[day] += session["duration"]

    focus_dates = sorted(set(
        datetime.fromisoformat(session["created_at"]).date()
        for session in sessions
    ), reverse=True)

    streak = 0
    today = datetime.now().date()

    for i in range(len(focus_dates)):
        expected_date = today - timedelta(days=i)

        if expected_date in focus_dates:
            streak += 1
        else:
            break

    return jsonify({
        "streak": streak,
        "total_hours": total_hours,
        "sessions_this_week": sessions_this_week,
        "by_subject": by_subject,
        "by_weekday": by_weekday
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000)