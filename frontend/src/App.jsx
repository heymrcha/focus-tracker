import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link
} from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";

const API_URL = "http://127.0.0.1:5000";

function TimerPage() {
  const FOCUS_SECONDS = 25 * 60;
  const BREAK_SECONDS = 5 * 60;

  const savedTimer = JSON.parse(localStorage.getItem("timerState")) || null;

  const [secondsLeft, setSecondsLeft] = useState(
    savedTimer?.secondsLeft || FOCUS_SECONDS
  );
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState(savedTimer?.mode || "focus");
  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [message, setMessage] = useState("");

  const totalSeconds = mode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS;
  const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100;

  useEffect(() => {
    fetchSubjects();
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "timerState",
      JSON.stringify({
        secondsLeft,
        mode
      })
    );
  }, [secondsLeft, mode]);

  useEffect(() => {
    if (!isRunning) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleTimerComplete();
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, mode, selectedSubjectId]);

  const fetchSubjects = async () => {
    const response = await fetch(`${API_URL}/subjects`);
    const data = await response.json();
    setSubjects(data);

    if (data.length > 0 && !selectedSubjectId) {
      setSelectedSubjectId(data[0].id);
    }
  };

  const handleTimerComplete = async () => {
    setIsRunning(false);

    if (mode === "focus") {
      await fetch(`${API_URL}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          subject_id: selectedSubjectId,
          duration: 25
        })
      });

      setMessage("Focus session completed! Break timer started.");
      setMode("break");
      setSecondsLeft(BREAK_SECONDS);
      setIsRunning(true);
    } else {
      setMessage("Break finished! Ready for another focus session.");
      setMode("focus");
      setSecondsLeft(FOCUS_SECONDS);
    }
  };

  const startTimer = () => {
    if (mode === "focus" && !selectedSubjectId) {
      alert("Please select a subject first.");
      return;
    }

    setMessage("");
    setIsRunning(true);
  };

  const pauseTimer = () => {
    setIsRunning(false);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setMode("focus");
    setSecondsLeft(FOCUS_SECONDS);
    setMessage("");
  };

  const addSubject = async () => {
    if (!newSubject.trim()) return;

    await fetch(`${API_URL}/subjects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: newSubject
      })
    });

    setNewSubject("");
    fetchSubjects();
  };

  const deleteSubject = async (id) => {
    await fetch(`${API_URL}/subjects/${id}`, {
      method: "DELETE"
    });

    fetchSubjects();
  };

  const formatTime = () => {
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  return (
    <div className="page">
      <h1>Pomodoro Timer</h1>

      <div className="timer-card">
        <p className="mode">{mode === "focus" ? "Focus Time" : "Break Time"}</p>

        <div className="progress-wrapper">
          <div
            className="progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="timer-text">{formatTime()}</div>

        {mode === "focus" && (
          <select
            value={selectedSubjectId}
            onChange={(event) => setSelectedSubjectId(event.target.value)}
            disabled={isRunning}
          >
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        )}

        <div className="button-group">
          {!isRunning ? (
            <button onClick={startTimer}>Start</button>
          ) : (
            <button onClick={pauseTimer}>Pause</button>
          )}

          <button onClick={resetTimer} className="secondary">
            Reset
          </button>
        </div>

        {message && <p className="message">{message}</p>}
      </div>

      <div className="subject-card">
        <h2>Subjects</h2>

        <div className="subject-input">
          <input
            value={newSubject}
            onChange={(event) => setNewSubject(event.target.value)}
            placeholder="New subject"
          />
          <button onClick={addSubject}>Add</button>
        </div>

        <ul>
          {subjects.map((subject) => (
            <li key={subject.id}>
              {subject.name}
              <button
                className="delete"
                onClick={() => deleteSubject(subject.id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function HistoryPage() {
  const [sessions, setSessions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [range, setRange] = useState("all");

  useEffect(() => {
    fetchSubjects();
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [subjectId, range]);

  const fetchSubjects = async () => {
    const response = await fetch(`${API_URL}/subjects`);
    const data = await response.json();
    setSubjects(data);
  };

  const fetchSessions = async () => {
    const params = new URLSearchParams();

    if (subjectId) params.append("subject_id", subjectId);
    params.append("range", range);

    const response = await fetch(`${API_URL}/sessions?${params.toString()}`);
    const data = await response.json();

    setSessions(data);
  };

  const deleteSession = async (id) => {
    await fetch(`${API_URL}/sessions/${id}`, {
      method: "DELETE"
    });

    fetchSessions();
  };

  return (
    <div className="page">
      <h1>History</h1>

      <div className="filters">
        <select
          value={subjectId}
          onChange={(event) => setSubjectId(event.target.value)}
        >
          <option value="">All Subjects</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>

        <select
          value={range}
          onChange={(event) => setRange(event.target.value)}
        >
          <option value="all">All</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
      </div>

      <div className="list">
        {sessions.map((session) => (
          <div className="session-item" key={session.id}>
            <div>
              <strong>{session.subject_name}</strong>
              <p>{session.duration} minutes</p>
              <small>{new Date(session.created_at).toLocaleString()}</small>
            </div>

            <button
              className="delete"
              onClick={() => deleteSession(session.id)}
            >
              Delete
            </button>
          </div>
        ))}

        {sessions.length === 0 && <p>No sessions found.</p>}
      </div>
    </div>
  );
}

function DashboardPage() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const response = await fetch(`${API_URL}/stats`);
    const data = await response.json();
    setStats(data);
  };

  if (!stats) {
    return <div className="page">Loading...</div>;
  }

  const weekdayData = Object.entries(stats.by_weekday).map(([day, minutes]) => ({
    day,
    minutes
  }));

  return (
    <div className="page">
      <h1>Dashboard</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <p>Current Streak</p>
          <strong>{stats.streak} days</strong>
        </div>

        <div className="stat-card">
          <p>Total Focus Time</p>
          <strong>{stats.total_hours} hours</strong>
        </div>

        <div className="stat-card">
          <p>Sessions This Week</p>
          <strong>{stats.sessions_this_week}</strong>
        </div>
      </div>

      <div className="chart-card">
        <h2>Focus Time by Subject</h2>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={stats.by_subject}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="minutes" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h2>Weekly Pattern</h2>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={weekdayData}>
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="minutes" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/">Timer</Link>
        <Link to="/history">History</Link>
        <Link to="/dashboard">Dashboard</Link>
      </nav>

      <Routes>
        <Route path="/" element={<TimerPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;