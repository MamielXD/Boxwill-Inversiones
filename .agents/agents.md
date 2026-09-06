# Boxwill Inversiones — Development Guidelines

## Language & Communication
- Communicate in Spanish. Be concise and direct.

## Architecture
- **Frontend:** Astro + React (JSX). Components live in `src/components/`.
- **Backend:** Custom PHP REST API located in `public/api/`. Always edit files in `public/api/`, never in `dist/api/`.
- **Database:** MySQL via PDO. All tables are auto-created via `ensureTables()` in each endpoint.
- **Auth:** Session-based with optional system token bypass (`X-System-Secret`). User preferences are stored server-side in the `usuarios` table.

## Code Standards
- Follow the existing **BW Design System** (`--color-bw-*`, `--font-bw-*`, `--tracking-bw-*`, etc.) for all UI work. Never introduce ad-hoc colors or fonts.
- Use `import.meta.env.PUBLIC_API_URL` for any API call. Never hardcode URLs.
- Sensitive credentials (`DB_HOST`, `DB_NAME`, tokens, etc.) must live in `.env` and be loaded via `parse_ini_file()` in PHP. Never commit secrets.
- Keep components focused: one responsibility per file, reusable where possible.

## Patterns to Follow
- **State management:** Props/context flow from `AdminAuth → AdminPanel → Section`. Avoid global state libraries unless justified.
- **Preferences:** User panel settings are persisted in the database (`usuarios.preferencias` column), not in `localStorage`.
- **API conventions:** Each PHP endpoint handles `GET`, `POST`, `PUT`, `DELETE` via a `$method` switch. Always validate input and return JSON.
- **Error handling:** PHP endpoints must return structured JSON errors with appropriate HTTP status codes. Frontend must catch and display errors gracefully.

## Scalability Considerations
- Database schema changes should use `ALTER TABLE ... ADD COLUMN` wrapped in a try/catch to be idempotent.
- New features should be added as independent accordion sections in `AdminPanel`, registered in `SECTION_DEFS` inside `PanelSettings.jsx`.
- The seed/demo system (`seedDemoData()`) should be extended when new data models are added, to keep the demo account functional.