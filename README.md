# DotAgent Frontend

Next.js frontend application for managing AI agents with Neo Brutalism design style.

## Features

- **Create Agents**: Full form with LLM configuration, capabilities, tools, and custom API tools
- **List Agents**: View all agents with edit, delete, and execute actions
- **Edit Agents**: Update agent configurations inline
- **Execute Agents**: Test agents with custom tasks, parameters, and context
- **Custom API Tools**: Add and test custom API tools before adding to agents

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- FastAPI backend running on `https://aistudio-workflow-v2-dev.sangria.tech/api`

### Installation

```bash
cd frontend
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

## Configuration

Set the API base URL in `lib/constants.js` or via environment variable:

```bash
NEXT_PUBLIC_API_BASE_URL=https://aistudio-workflow-v2-dev.sangria.tech/api npm run dev
```

## Design System

The application uses Neo Brutalism design principles:

- **Colors**: Light green, blue, red, orange, and pink
- **Borders**: Thick black borders (4px)
- **Shadows**: Offset box shadows for 3D effect
- **Typography**: Bold, high-contrast fonts
- **Sharp Corners**: Minimal border radius

## Pages

- `/` - Home page with overview
- `/create` - Create new agent
- `/agents` - List and manage agents
- `/execute` - Execute agent tasks
