Live preview: [top-g-rust.vercel.app](https://top-g-rust.vercel.app/)

Welcome to Top-G : Productivity Suite

Top-G is a focused productivity coach that helps you plan your day, track your lifts, and keep your momentum without distractions.

🌟 What You Can Do

🏠 Dashboard
Your personal command center.
See today’s tasks, check progress, and keep all your wins in one place.

🎯 Focus
Enter Focus Mode to work without interruptions.
Stay ruthless with your attention and finish what matters.

💪 Strength Logging
Record every set and rep—bench press, squat, deadlift, and more.
Track progressive overload and spot plateaus in your training.

📈 Streaks & Velocity
Watch your daily streaks and momentum.
Celebrate wins and quickly see where you’re slipping.

🤝 Reach Out
Connect or get in touch with the team when you need support or want to share feedback.

🚀 How to Get Started
Open the app: top-g-rust.vercel.app
Create an account or sign in if you already have one.
Add your tasks for today and start logging your lifts.
Switch to Focus Mode when it’s time to work.
Check your streaks at the end of the day and plan for tomorrow.

That’s it—you’re ready to move the needle.

💡 Tips for Best Results
Keep your task list short and clear—focus on what truly matters.
Log your strength training after every workout to track gains accurately.
Check your streaks daily; consistency beats intensity.

📬 Need Help?
Questions or feedback?
Use the Reach Out tab in the app or contact us via the support link on the site.


## 🚀 Tech Stack

- [Next.js](https://nextjs.org/) – React framework for fast, scalable web apps.
- [React](https://react.dev/) – UI library.
- [Tailwind CSS](https://tailwindcss.com/) – Utility-first styling.
- [Vercel](https://vercel.com/) – Zero-config deployment platform.

## SMTP Email Setup

To forward feedback submissions to your inbox, configure the following environment variables:

- `SMTP_HOST` � SMTP server hostname (for example, `smtp.gmail.com`).
- `SMTP_PORT` � SMTP port (usually `587` for STARTTLS or `465` for SSL).
- `SMTP_USER` / `SMTP_PASS` � credentials or app password for the SMTP account.
- `SMTP_SECURE` � set to `true` when using port 465, otherwise leave `false` for STARTTLS.
- `FEEDBACK_FROM` � optional display identity for outgoing messages (defaults to `SMTP_USER`).
- `FEEDBACK_TO` � address that should receive feedback notifications (defaults to `SMTP_USER`).

Restart the dev server after updating `.env` so Next.js can pick up the new configuration.

