from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)

subjects = [
    {"id": 1, "name": "Work"},
    {"id": 2, "name": "Reading"},
    {"id": 3, "name": "Study"},
]

sessions = []
next_subject_id = 4
next_session_id = 1


def get_subject_name(subject_id):
    subject = next((s for s in subjects if s["id"] == subject_id), None)
    return subject["name"] if subject else "Unknown"


def filter_sessions(subject_id=None, range_value="all"):
    result = sessions[:]
    now = datetime.now()

    if subject_id:
        result = [s for s in result if s["subject_id"] == int(subject_id)]

    if range_value == "week":
        start = now - timedelta(days=now.weekday())
        start = start.replace(hour=0, minute=0, second=0, microsecond=0)
        result = [s for s in result if datetime.fromisoformat(s["created_at"]) >= start]

    elif range_value == "month":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        result = [s for s in result if datetime.fromisoformat(s["created_at"]) >= start]

    return result


@app.route("/subjects", methods=["GET"])
def get_subjects():
    return jsonify(subjects)


@app.route("/subjects", methods=["POST"])
def create_subject():
    global next_subject_id

    data = request.get_json()
    name = data.get("name", "").strip()

    if not name:
        return jsonify({"error": "Subject name is required"}), 400

    subject = {
        "id": next_subject_id,
        "name": name
    }

    subjects.append(subject)
    next_subject_id += 1

    return jsonify(subject), 201


@app.route("/subjects/<int:subject_id>", methods=["DELETE"])
def delete_subject(subject_id):
    global subjects

    subjects = [s for s in subjects if s["id"] != subject_id]

    return jsonify({"success": True})


@app.route("/sessions", methods=["GET"])
def get_sessions():
    subject_id = request.args.get("subject_id")
    range_value = request.args.get("range", "all")

    result = filter_sessions(subject_id, range_value)

    response = [
        {
            **s,
            "subject_name": get_subject_name(s["subject_id"])
        }
        for s in result
    ]

    return jsonify(response)


@app.route("/sessions", methods=["POST"])
def create_session():
    global next_session_id

    data = request.get_json()

    subject_id = data.get("subject_id")
    duration = data.get("duration", 25)

    if not subject_id:
        return jsonify({"error": "subject_id is required"}), 400

    session = {
        "id": next_session_id,
        "subject_id": int(subject_id),
        "duration": int(duration),
        "created_at": datetime.now().isoformat(timespec="seconds")
    }

    sessions.append(session)
    next_session_id += 1

    return jsonify(session), 201


@app.route("/sessions/<int:session_id>", methods=["DELETE"])
def delete_session(session_id):
    global sessions

    sessions = [s for s in sessions if s["id"] != session_id]

    return jsonify({"success": True})


@app.route("/stats", methods=["GET"])
def get_stats():
    now = datetime.now()

    total_minutes = sum(s["duration"] for s in sessions)

    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)

    sessions_this_week = [
        s for s in sessions
        if datetime.fromisoformat(s["created_at"]) >= week_start
    ]

    by_subject_map = {}
    for s in sessions:
        name = get_subject_name(s["subject_id"])
        by_subject_map[name] = by_subject_map.get(name, 0) + s["duration"]

    by_subject = [
        {"name": name, "minutes": minutes}
        for name, minutes in by_subject_map.items()
    ]

    weekday_labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    by_weekday = {day: 0 for day in weekday_labels}

    for s in sessions:
        dt = datetime.fromisoformat(s["created_at"])
        by_weekday[weekday_labels[dt.weekday()]] += s["duration"]

    completed_dates = {
        datetime.fromisoformat(s["created_at"]).date()
        for s in sessions
    }

    streak = 0
    current_date = now.date()

    while current_date in completed_dates:
        streak += 1
        current_date -= timedelta(days=1)

    return jsonify({
        "streak": streak,
        "total_hours": round(total_minutes / 60, 1),
        "sessions_this_week": len(sessions_this_week),
        "by_subject": by_subject,
        "by_weekday": by_weekday
    })


if __name__ == "__main__":
    app.run(debug=True)