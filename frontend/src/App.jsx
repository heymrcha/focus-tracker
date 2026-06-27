import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { apiGet, apiPost, apiDelete } from "./api";
import "./App.css";

const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

function TimerPage() {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [newSubject, setNewSubject] = useState("");

  const saved = JSON.parse(localStorage.getItem("timerState") || "{}");

  const [mode, setMode] = useState(saved.mode || "focus");
  const [secondsLeft, setSecondsLeft] = useState(
    saved.secondsLeft || FOCUS_SECONDS
  );
  const [isRunning, setIsRunning] = useState(saved.isRunning || false);

  const totalSeconds = mode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS;
  const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100;

  useEffect(() => {
    loadSubjects();
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "timerState",
      JSON.stringify({
        mode,
        secondsLeft,
        isRunning,
      })
    );
  }, [mode, secondsLeft, isRunning]);

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          handleTimerComplete();
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, mode, selectedSubjectId]);

  async function loadSubjects() {
    const data = await apiGet("/subjects");
    setSubjects(data);

    if (data.length > 0 && !selectedSubjectId) {
      setSelectedSubjectId(data[0].id);
    }
  }

  async function addSubject() {
    if (!newSubject.trim()) return;

    await apiPost("/subjects", {
      name: newSubject,
    });

    setNewSubject("");
    loadSubjects();
  }

  async function removeSubject(id) {
    await apiDelete(`/subjects/${id}`);
    loadSubjects();
  }

  async function handleTimerComplete() {
    setIsRunning(false);

    if (mode === "focus") {
      await apiPost("/sessions", {
        subject_id: Number(selectedSubjectId),
        duration: 25,
      });

      alert("Focus session completed. Break time starts now.");
      setMode("break");
      setSecondsLeft(BREAK_SECONDS);
      setIsRunning(true);
    } else {
      alert("Break finished.");
      setMode("focus");
      setSecondsLeft(FOCUS_SECONDS);
    }
  }

  function resetTimer() {
    setIsRunning(false);
    setSecondsLeft(mode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS);
  }

  function formatTime(seconds) {
    const min = String(Math.floor(seconds / 60)).padStart(2, "0");
    const sec = String(seconds % 60).padStart(2, "0");

    return `${min}:${sec}`;
  }

  return (
    <main className="page">
      <h1>Pomodoro Timer</h1>

      <section className="card timer-card">
        <p className="mode-label">{mode === "focus" ? "Focus" : "Break"}</p>

        <div className="progress-ring">
          <div
            className="progress-fill"
            style={{
              background: `conic-gradient(#4f46e5 ${progress}%, #e5e7eb ${progress}%)`,
            }}
          >
            <div className="timer-inner">{formatTime(secondsLeft)}</div>
          </div>
        </div>

        <label>
          Subject
          <select
            value={selectedSubjectId}
            disabled={isRunning || mode === "break"}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
          >
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </label>

        <div className="button-row">
          <button
            onClick={() => setIsRunning(true)}
            disabled={isRunning || !selectedSubjectId}
          >
            Start
          </button>

          <button onClick={() => setIsRunning(false)} disabled={!isRunning}>
            Pause
          </button>

          <button onClick={() => setIsRunning(true)} disabled={isRunning}>
            Resume
          </button>

          <button className="secondary" onClick={resetTimer}>
            Reset
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Manage Subjects</h2>

        <div className="input-row">
          <input
            value={newSubject}
            placeholder="New subject"
            onChange={(e) => setNewSubject(e.target.value)}
          />
          <button onClick={addSubject}>Add</button>
        </div>

        <ul className="subject-list">
          {subjects.map((subject) => (
            <li key={subject.id}>
              <span>{subject.name}</span>
              <button className="danger" onClick={() => removeSubject(subject.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function HistoryPage() {
  const [sessions, setSessions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [range, setRange] = useState("all");

  useEffect(() => {
    loadSubjects();
  }, []);

  useEffect(() => {
    loadSessions();
  }, [subjectId, range]);

  async function loadSubjects() {
    const data = await apiGet("/subjects");
    setSubjects(data);
  }

  async function loadSessions() {
    const params = new URLSearchParams();

    if (subjectId) params.append("subject_id", subjectId);
    params.append("range", range);

    const data = await apiGet(`/sessions?${params.toString()}`);
    setSessions(data);
  }

  async function deleteSession(id) {
    await apiDelete(`/sessions/${id}`);
    loadSessions();
  }

  return (
    <main className="page">
      <h1>History</h1>

      <section className="card filters">
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">All Subjects</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>

        <select value={range} onChange={(e) => setRange(e.target.value)}>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="all">All</option>
        </select>
      </section>

      <section className="card">
        {sessions.length === 0 ? (
          <p>No sessions found.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Duration</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {sessions.map((session) => (
                <tr key={session.id}>
                  <td>{session.subject_name}</td>
                  <td>{session.duration} min</td>
                  <td>{new Date(session.created_at).toLocaleString()}</td>
                  <td>
                    <button
                      className="danger"
                      onClick={() => deleteSession(session.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

function DashboardPage() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const data = await apiGet("/stats");
    setStats(data);
  }

  if (!stats) return <main className="page">Loading...</main>;

  const weekdayData = Object.entries(stats.by_weekday).map(([name, minutes]) => ({
    name,
    minutes,
  }));

  return (
    <main className="page">
      <h1>Dashboard</h1>

      <section className="stats-grid">
        <div className="card stat">
          <span>Current Streak</span>
          <strong>{stats.streak} days</strong>
        </div>

        <div className="card stat">
          <span>Total Focus Time</span>
          <strong>{stats.total_hours} hours</strong>
        </div>

        <div className="card stat">
          <span>This Week</span>
          <strong>{stats.sessions_this_week} sessions</strong>
        </div>
      </section>

      <section className="card chart-card">
        <h2>Focus Time by Subject</h2>

        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={stats.by_subject}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="minutes" fill="#4f46e5" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="card chart-card">
        <h2>Weekly Pattern</h2>

        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={weekdayData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="minutes" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </section>
    </main>
  );
}

function App() {
  return (
    <BrowserRouter>
      <nav className="nav">
        <NavLink to="/">Timer</NavLink>
        <NavLink to="/history">History</NavLink>
        <NavLink to="/dashboard">Dashboard</NavLink>
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