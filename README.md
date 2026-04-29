# BotPanel (Lokal)

Dieses Projekt besteht aus:

- React + Vite Frontend (Port 8080)
- Express Backend API mit Session-Auth (Port 3001)
- Lokaler JSON-Speicher unter `server/data/db.json`

## Starten

1. Frontend und Backend zusammen starten

```bash
npm run dev:all
```

Alternativ getrennt:

- Frontend starten

```bash
npm run dev
```

- Backend starten (zweites Terminal)

```bash
npm run dev:api
```

Danach ist das Dashboard unter `http://localhost:8080` erreichbar.

## Umgebung

`.env` enthält die lokale Konfiguration:

- `VITE_API_BASE_URL` (Standard: `/api`)
- `API_PORT` (Standard: `3001`)
- `FRONTEND_ORIGIN` (Standard: `http://localhost:8080`)
- `SESSION_SECRET` (fuer Sessions)
- `DISCORD_BOT_TOKEN` (optional fuer echte Discord-Nachrichten)

## Hinweise

- Alle Daten bleiben lokal auf deinem Geraet.
- Login erfolgt mit Benutzername + Passwort.
- Beim ersten Start ist der Default-Admin: Benutzername `admin`, Passwort `admin`.
- Nach dem ersten Login musst du Benutzername und Passwort sofort neu setzen.
- Unter Einstellungen -> Account kannst du Benutzername und Passwort jederzeit aendern.
- Wenn `DISCORD_BOT_TOKEN` leer ist, wird das Senden an Discord mit einer klaren Fehlermeldung abgebrochen.
