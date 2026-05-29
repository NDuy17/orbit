# Contributing

## Local Setup

```bash
npm install
npm start
```

Create `.env` from `.env.example` and add local Supabase values. Use an anon or publishable key only.

## Branch Naming

- `feat/<short-description>` for new features.
- `fix/<short-description>` for bug fixes.
- `docs/<short-description>` for documentation-only changes.

## Commit Messages

Use short, imperative commit messages:

```text
feat: add nearby radius filter
fix: handle missing location permission
docs: document Supabase schema
```

## Testing Guidelines

- Check auth flows after changing Supabase or navigation code.
- Check Ghost Mode and approximate location before changing location logic.
- Check friend request send, accept, reject, and remove flows after changing social graph code.
- Check realtime chat on two accounts after changing `messages` queries or subscriptions.
- Run `npm run lint` and `npm run format:check` before opening a pull request when lint dependencies are installed.
