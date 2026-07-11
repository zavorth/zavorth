# Zavorth Dashboard - Product Requirements Document

## Overview
Zavorth is a local-first governed AI agent runtime. The Dashboard is the main web gateway for daily use, providing a chat interface, status monitoring, and approval workflows.

## Core Features

### 1. Chat Interface
- Natural language input for requests
- Message history and session management
- Suggestion chips for common actions
- Real-time response streaming

### 2. Navigation
- Sidebar with sections: Chat, Channels, Skills, Agents, Settings
- Mobile-responsive hamburger menu
- Breadcrumb navigation (Zavorth > Section)

### 3. Status Monitoring
- Core Online/Pulse indicator
- Runtime status display
- Telemetry bar with system metrics

### 4. Theme Support
- Light/Dark mode toggle
- Theme persistence

### 5. Search
- Ctrl+K search trigger
- Search overlay

## User Journeys

### Journey 1: First-time User
1. Open dashboard
2. See greeting: "Hello, Operator"
3. View suggestion chips
4. Type a request or click a suggestion
5. Receive response

### Journey 2: Daily Use
1. Open dashboard
2. Check Core Online status
3. Navigate to desired section
4. Interact with AI agent
5. Review approvals/artifacts

### Journey 3: Settings Management
1. Open Settings
2. Configure channels
3. Manage skills
4. Review agent status

## Technical Requirements
- Responsive design (mobile + desktop)
- WebSocket for real-time updates
- Local-first architecture
- No external dependencies for core functionality

## Success Metrics
- Dashboard loads in < 2 seconds
- All navigation sections accessible
- Theme toggle works correctly
- Chat interface responsive
- Mobile layout functional
