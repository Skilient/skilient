/**
 * Probe 10 (COP, H02, H04, MOT): copy audit over strings.json. Spell-check with cspell (allow-list of product and
 * skill names), sentences over 20 words, product terms and where each first appears with or without an explanation,
 * one term per concept and one label per action, 'you' voice, recruiter or portal mentions while portals are off,
 * the same empty copy reused for different things, and shame or pressure wording. Raw results under "copy".
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { save } from "./lib.ts";
const S: Record<string, string[]> = JSON.parse(readFileSync("docs/ux-pilot/heuristics/strings.json", "utf8"));
const all = Object.entries(S).flatMap(([route, xs]) => xs.map((t) => ({ route, t })));
const uniq = [...new Set(all.map((x) => x.t))];
// Spelling.
const allow = ["Skilient", "NUTECH", "FAST", "NUCES", "HEC", "JazzCash", "Easypaisa", "IBAN", "Ctrl", "Spectral", "Luminary", "Radiant", "Shine", "Flare", "Spark", "uxp", "Ayesha", "Bushra", "Chaudhry", "Danish", "Fatima", "Hamza", "Iqra", "Kashif", "Nida", "Rabia", "Omar", "Sana", "Zara", "Kamran", "Bilal", "venture", "ventures", "Openings", "Ed25519", "SHA", "PKT", "PKR", "Figma", "Credly", "Coursera", "HackerRank", "Udemy", "Arbisoft", "TypeScript", "JavaScript", "PostgreSQL", "NestJS", "Redux", "Tailwind", "Vitest", "Playwright", "Kotlin", "Jetpack", "SwiftUI", "Expo", "Pydantic", "pytest", "NumPy", "SciPy", "Matplotlib", "seaborn", "Keras", "PyTorch", "OpenCV", "NLTK", "spaCy", "Nuxt", "Gin", "Celery", "Drizzle", "Fastify", "Hibernate", "Sequelize", "SQLAlchemy", "Socket", "Solidity", "Godot", "Laravel", "LangChain", "Mongoose", "Netlify", "Nginx", "Prisma", "Retrofit", "Streamlit", "Blazor", "CMake", "CodeIgniter", "Axios", "Astro", "Ansible", "Arduino", "Elasticsearch", "Heroku", "Plotly", "Selenium", "Jupyter", "pandas", "Qt", "tsx", "PDFs", "ATS", "QR", "TOTP", "lookingFor", "ux", "SKL", "BSCS", "FYP", "NEIC", "IJP", "Pvt", "ResumeLab", "SHRM", "ProPakistani", "Gallup", "Superseded", "onboarding", "Unmute", "Unpin", "Unfriend", "Unfollow", "unfollow", "Resync", "resync", "checkbox", "Hackathon", "hackathon", "hackathons", "Inductions", "inductions", "Mechatronics", "Leaderb"];
mkdirSync("/tmp/claude-0/uxp/copy", { recursive: true });
writeFileSync("/tmp/claude-0/uxp/copy/strings.txt", uniq.join("\n"));
writeFileSync("/tmp/claude-0/uxp/copy/cspell.json", JSON.stringify({ version: "0.2", language: "en-GB,en", words: allow, ignoreRegExpList: ["/[A-Z0-9]{5}-?[A-Z0-9]{5}/", "/@\\w+/", "/https?:\\S+/", "/\\b[0-9a-f]{8,}\\b/"] }));
let spelling: string[] = [];
try { execFileSync("pnpm", ["dlx", "cspell@8.15.4", "--no-progress", "--no-summary", "--words-only", "--unique", "-c", "/tmp/claude-0/uxp/copy/cspell.json", "/tmp/claude-0/uxp/copy/strings.txt"], { encoding: "utf8", timeout: 240_000, cwd: "/tmp/claude-0/uxp/copy" }); }
catch (e: any) { spelling = String(e.stdout ?? "").split("\n").map((s) => s.trim()).filter(Boolean); if (!spelling.length) spelling = ["(cspell failed: " + String(e.message).slice(0, 120) + ")"]; }
const whereWord = (w: string) => [...new Set(all.filter((x) => new RegExp(`\\b${w}\\b`).test(x.t)).map((x) => x.route))].slice(0, 3);
const typos = spelling.filter((w) => !/^[A-Z]{2,}$/.test(w)).map((w) => ({ word: w, where: whereWord(w) }));
// Long sentences.
const long = [...new Set(uniq.flatMap((t) => t.split(/(?<=[.!?])\s+/)).filter((s) => s.split(/\s+/).length > 20))].map((s) => ({ words: s.split(/\s+/).length, s: s.slice(0, 200), where: all.find((x) => x.t.includes(s.slice(0, 40)))?.route }));
// Product terms and first explanation.
const TERMS = ["venture", "Record", "sealed", "superseded", "L1", "L2", "L3", "L4", "claimed", "induction", "corroborated", "Raw", "Spark", "Flare", "Shine", "Radiant", "Luminary", "peer-verified", "self-reported", "proof task", "skill swap", "Openings", "tier", "Momentum", "Taught", "Office bearer"];
const terms = TERMS.map((term) => { const hits = all.filter((x) => new RegExp(`\\b${term}\\b`, "i").test(x.t)); const explained = hits.filter((x) => new RegExp(`\\b${term}\\b[^.]{0,4}(is|are|means|:|—|=)|${term}\\w* (comes|shows|counts)`, "i").test(x.t) || x.t.length > 60); return { term, routes: [...new Set(hits.map((x) => x.route))].length, firstRoutes: [...new Set(hits.map((x) => x.route))].slice(0, 4), explainedSomewhere: explained.length > 0, example: explained[0]?.t.slice(0, 140) ?? "" }; });
// One term per concept, one label per action.
const PAIRS: [string, RegExp, RegExp][] = [["batch", /\bClass of 20\d\d\b/, /\bBatch (of )?20\d\d\b/], ["Openings / Opportunities", /\bOpenings\b/, /\bOpportunities\b/], ["Home / Feed", /^Home$/, /^Feed$/], ["sign out / log out", /Sign out/i, /Log out/i], ["Me / Profile", /^Me$/, /^My profile$/], ["Skill swap / swaps", /^Skill swap$/, /^Skill swaps$/], ["remove / delete (own content)", /^Delete$/, /^Remove$/], ["Following / Unfollow", /^Following$/, /^Unfollow$/]];
const terminology = PAIRS.map(([concept, a, b]) => ({ concept, a: all.filter((x) => a.test(x.t)).length, b: all.filter((x) => b.test(x.t)).length, aEx: all.find((x) => a.test(x.t))?.route, bEx: all.find((x) => b.test(x.t))?.route })).filter((x) => x.a && x.b);
// Voice, portal mentions, empty copy reuse, pressure wording.
const thirdPerson = uniq.filter((t) => /\b(their own|they own|they've|the student's own)\b/i.test(t) && t.length > 30).slice(0, 10);
const portal = all.filter((x) => /\brecruiter|employer|compan(y|ies) names|universit(y|ies) portal|hiring\b/i.test(x.t) && !/^\/(recruiters|universities|faculty|features|about|terms|privacy|signup\/recruiter|ui)$/.test(x.route) && x.route !== "/").map((x) => ({ route: x.route, t: x.t.slice(0, 140) }));
const emptyCopy = Object.entries(all.filter((x) => /^(No |Nothing |Be the first)/.test(x.t)).reduce((m: Record<string, Set<string>>, x) => ((m[x.t] ??= new Set()).add(x.route), m), {})).filter(([, r]) => r.size > 2).map(([t, r]) => ({ t, routes: [...r].slice(0, 6) }));
const pressure = all.filter((x) => /\b(only \d+ left|hurry|don't miss|you're falling|behind your (peers|classmates)|bottom|lowest|last chance|fail(ed|ing) to)\b/i.test(x.t)).map((x) => ({ route: x.route, t: x.t.slice(0, 140) }));
const r = { strings: uniq.length, routes: Object.keys(S).length, typos, long: long.sort((a, b) => b.words - a.words), terms, terminology, thirdPerson, portalMentions: [...new Map(portal.map((p) => [p.t, p])).values()], emptyCopyReused: emptyCopy, pressure };
save("copy", r);
console.log(JSON.stringify({ typos: typos.length, long: long.length, portal: r.portalMentions.length, terminology: terminology.length, emptyCopy: emptyCopy.length, pressure: pressure.length }));
