# Contributing to MobZilla

Thank you for your interest in contributing to MobZilla! We welcome contributions, bug reports, feature suggestions, and documentation improvements.

---

## 1. Code of Conduct

Please maintain a welcoming, respectful, and inclusive environment. Harassment or discriminatory behavior in any form will not be tolerated.

---

## 2. Getting Started

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- FFmpeg (installed locally or via Docker)
- Git

### Setup
1. Fork the repository and clone your fork:
   ```bash
   git clone https://github.com/<your-username>/MobZilla.git
   cd MobZilla
   ```
2. Start the database and redis services:
   ```bash
   docker compose up -d
   ```
3. Configure environment variables in `Backend/.env`:
   ```bash
   cd Backend
   cp .env.example .env
   # Add your GEMINI_API_KEY and OMDB_API_KEY
   ```
4. Install dependencies:
   ```bash
   npm run install:all
   ```
5. Apply database migrations:
   ```bash
   npm run db:push
   ```
6. Start development servers:
   ```bash
   npm run dev:backend
   npm run dev:frontend
   ```

---

## 3. Pull Request Guidelines

1. **Branch Naming**:
   - `feature/description`
   - `fix/bug-description`
   - `docs/improvement-description`
2. **Commit Messages**:
   - Follow standard semantic commit guidelines: `feat:`, `fix:`, `docs:`, `refactor:`, `perf:`, `chore:`.
3. **Verification**:
   - Run type checks and smoke tests before submitting:
     ```bash
     npm run check
     npm run build
     ```
4. **Submitting**:
   - Open a pull request against the `main` branch with a clear description of the problem and your solution.

---

## 4. Reporting Issues

Please use our GitHub issue templates:
- For bugs, use the **Bug Report** template.
- For enhancements, use the **Feature Request** template.
