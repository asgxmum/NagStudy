// Shared mock data ported from the NagStudy.html prototype seeds.
// W5 pattern: build screens against mocks now; swap to the api/ services when the backend is ready.

export const currentUser = {
  nickname: "Snoozebun",
  email: "snoozebun@xmu.edu.my",
  school: "XMU Malaysia",
  role: "User",
};

export const categories = [
  { id: 1, name: "Algorithms", color: "#2C3E63" },
  { id: 2, name: ".NET Project", color: "#BE9E54" },
  { id: 3, name: "English", color: "#D98C97" },
  { id: 4, name: "Database", color: "#6FA07A" },
];

// Task — when: 'now'|'later' · status: 'inbox'|'scheduled'|'done' · startMin/endMin = minutes 0..1440 (today)
export const tasks = [
  { id: 100, title: "Read 3 chapters of the textbook", imp: false, when: "now", status: "done", startMin: 510, endMin: 570, color: "#6FA07A" },
  { id: 101, title: "Memorize 100 English words", imp: false, when: "now", status: "scheduled", startMin: 570, endMin: 630, color: "#D98C97" },
  { id: 102, title: "Review the OS quiz", imp: false, when: "now", status: "scheduled", startMin: 600, endMin: 690, color: "#6E89BE" },
  { id: 103, title: "Algorithms assignment Q3", imp: true, when: "now", status: "scheduled", startMin: 840, endMin: 960, color: "#2C3E63" },
  { id: 104, title: "Code the .NET team API", imp: true, when: "now", status: "scheduled", startMin: 1020, endMin: 1170, color: "#BE9E54" },
  { id: 105, title: "DB report draft", imp: false, when: "now", status: "scheduled", startMin: 1230, endMin: 1320, color: "#6FA07A" },
  { id: 106, title: "Reply to the professor's email", imp: true, when: "now", status: "inbox", startMin: null, endMin: null, color: "#9AA0B0" },
  { id: 107, title: "Move lecture notes into Notion", imp: false, when: "later", status: "inbox", startMin: null, endMin: null, color: "#9AA0B0" },
  { id: 108, title: "Outline the final project report", imp: false, when: "later", status: "inbox", startMin: null, endMin: null, color: "#9AA0B0" },
  { id: 109, title: "Organize reference papers", imp: false, when: "later", status: "inbox", startMin: null, endMin: null, color: "#9AA0B0" },
];

export const yesterdayTasks = [
  { id: 900, title: "Finish the chemistry lab report", done: true },
  { id: 901, title: "Watch 2 recorded lectures", done: true },
  { id: 902, title: "Read the seminar paper", done: true },
  { id: 903, title: "Solve 20 calculus problems", done: false },
  { id: 904, title: "Email the TA about the grade", done: false },
];

export const sessions = [
  { name: "Algorithms assignment", cat: { name: "Algorithms", color: "#2C3E63" }, start: "09:10", min: 50 },
  { name: "Memorize words", cat: { name: "English", color: "#D98C97" }, start: "11:00", min: 25 },
  { name: "DB report draft", cat: { name: "Database", color: "#6FA07A" }, start: "14:30", min: 80 },
];

export const weekly = [
  { day: "Mon", min: 150 }, { day: "Tue", min: 95 }, { day: "Wed", min: 210 },
  { day: "Thu", min: 0 }, { day: "Fri", min: 180 }, { day: "Sat", min: 135 }, { day: "Sun", min: 120 },
];

export const ranking = [
  { name: "4AM Scholar", emoji: "🦉", min: 1265 },
  { name: "Library NPC", emoji: "📚", min: 1180 },
  { name: "CaffeineIV", emoji: "☕", min: 1102 },
  { name: "ProductivityWho", emoji: "🛌", min: 1078 },
  { name: "NightBeforeExam", emoji: "🕯️", min: 1005 },
  { name: "5AM Club", emoji: "🌅", min: 980 },
  { name: "JustLetMeGraduate", emoji: "🎓", min: 958 },
  { name: "Zoom University", emoji: "💻", min: 930 },
];
export const myRank = { rank: 12, name: "Snoozebun", emoji: "🐰", min: 155 };

// AI coach personas (tone key matches backend AiTone)
export const personas = [
  { key: "Soft", face: "🌷", name: "The Healer", color: "#3f9a5e", tint: "rgba(126,196,142,.18)", profile: "/Profile_Healer_3D.png", blink: "/Profile_Healer_Blink.png", desc: "Cheers you on no matter what — gently asks to do it together." },
  { key: "Normal", face: "📋", name: "The Secretary", color: "#2C3E63", tint: "rgba(110,137,190,.16)", profile: "/Profile_Secretary_3D.png", blink: "/Profile_Secretary_Blink.png", desc: "Facts only, zero feelings. Reports your numbers." },
  { key: "Harsh", face: "👑", name: "The Elite", color: "#BE9E54", tint: "rgba(194,160,91,.2)", profile: "/Elite_3D.png", blink: "/Profile_Elite_Blink.png", desc: "An elegantly sarcastic critic. For the strong-willed." },
];

export const adminUsers = [
  { id: 1, nick: "Snoozebun", status: "Active" },
  { id: 2, nick: "4AM Scholar", status: "Active" },
  { id: 3, nick: "CaffeineIV", status: "Active" },
  { id: 4, nick: "NightOwl", status: "Banned" },
  { id: 5, nick: "GhostStudent", status: "Active" },
];

export const todayMin = 155;

// minutes → "2h 35m" / "45m"
export const fmtDur = (min) => {
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
};
// minutes 0..1440 → "08:30"
export const fmtTime = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
