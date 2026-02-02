# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is currently not compatible with SWC. See [this issue](https://github.com/vitejs/vite-plugin-react/issues/428) for tracking the progress.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
The is a Final Year Project for UST 26

Overview
LLM-Powered Virtual Personal Coach with real-time, text-based fitness coaching using wearable data. The coach reminds users about workout intensity based on heart rate and past training history.

Real-time Training: Live LLM chat coaching during workouts, adjusting intensity reminders from heart rate zones and previous sessions.

Report: Post‑workout summary with metrics (time in zone, pace, HR trends) plus LLM insights like “Your warm‑up was too short, try adding 5 minutes next time.”

Leaderboard: Social layer where friends compare activity via weekly points, time in target zone, and consistency instead of just raw steps.

Tech Stack / Project Structure
Frontend: React.js SPA (web).

Backend: Node.js REST API server.

LLM Model: To be decided (placeholder).

Wearable Devices Integration: To be decided (placeholder).

Database: To be decided (placeholder).