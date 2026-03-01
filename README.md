# DeskFlow

A lightweight helpdesk ticketing system built for small teams that need to track customer support requests without the overhead of enterprise tools. Customers submit tickets through a simple form, and support agents manage everything from a central dashboard.

No frameworks. No backend. Just open the file and it works.

![App Screenshot](./screenshot.png)

## Features

- Customer-facing ticket submission form with field validation and character limits
- Unique ticket ID generation (TKT-XXXXX format)
- Agent dashboard with real-time metric cards (total, open, in progress, resolved, urgent, avg resolution time)
- Filterable ticket table with search by name, email, or subject
- Sort tickets by date, priority, or SLA deadline
- Ticket detail modal with inline editing for status, priority, and assigned agent
- Internal notes field visible only to agents
- Resolution notes for documenting how issues were closed
- SLA deadline calculation based on ticket priority (Urgent: 8h, High: 24h, Medium: 48h, Low: 72h)
- Overdue ticket highlighting with visual indicators
- Ticket deletion with confirmation prompt
- Toast notifications for user feedback
- Data persistence via localStorage
- Responsive layout with breakpoints at 1100px, 900px, and 640px
- Keyboard shortcut: Escape to close modal
- Sample seed data for demonstration

## Tech Stack

- HTML5
- CSS3 (custom properties, grid, flexbox, backdrop-filter, media queries)
- Vanilla JavaScript (ES6+, IIFE module pattern, localStorage API)
- Google Fonts (Sora, DM Sans, DM Mono)

## How to Run

Clone the repository and open `index.html` in your browser. There is no build step, no server, and no dependencies to install.

```
git clone https://github.com/btcbarbie/DeskFlow.git
cd DeskFlow
open index.html
```

On Linux, use `xdg-open index.html` instead of `open`.

Alternatively, visit the live version on GitHub Pages:
https://btcbarbie.github.io/DeskFlow/

## Project Structure

```
DeskFlow/
  index.html    — markup for both customer and agent views
  styles.css    — design system, layout, responsive breakpoints
  app.js        — application logic (modules: Utils, TicketStore, App, Dashboard, Modal, Toast)
  README.md
```

## Architecture

The JavaScript is organized into six IIFE modules:

| Module | Responsibility |
|--------|---------------|
| Utils | ID generation, date formatting, SLA calculation, HTML escaping, email validation |
| TicketStore | CRUD operations over localStorage |
| App | Role switching, form validation, ticket submission |
| Dashboard | Table rendering, filtering, sorting, metric computation |
| Modal | Ticket detail view, inline field updates, deletion |
| Toast | Notification display with auto-dismiss |

## License

MIT
