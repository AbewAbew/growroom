# Cultivation Control Log

A dependency-free browser app for medicinal cultivation recordkeeping. Run through `serve.js`, data is shared across devices via a JSON file on disk (`data/growdata.json`); opened standalone, it falls back to browser localStorage. JSON export/import works either way for backups or transfer.

## Run

Double-click `start.bat`, or:

```powershell
node serve.js
```

Then open `http://localhost:4173`. The console also prints a LAN address like `http://192.168.x.x:4173` — open that on a phone connected to the same Wi-Fi to log readings from inside the tent. (Windows may show a firewall prompt the first time; allow access on private networks.)

Without Node, any static server still works (`python -m http.server 4173`), but data stays in that browser's localStorage only — no cross-device sync.

## Shared Data & Sync

- `serve.js` exposes `GET/PUT /api/state`, stored atomically in `data/growdata.json`. Back up that file (or use Export) and you have everything.
- The browser keeps a localStorage copy for instant startup and offline edits; it pushes changes to the server about half a second after each save and polls every 15 seconds for changes from other devices.
- Conflicts resolve last-write-wins by the state's `updatedAt` timestamp, with one override: a client with no records always defers to a server that has data, so a new device or empty browser can never wipe the shared file. (This also means "Clear all data" only clears that browser — other devices will re-push their copy.)
- The server keeps the previous version as `data/growdata.prev.json` on every write — copy it over `growdata.json` (with the server stopped) to undo a bad save.
- Note: each browser origin has its own localStorage cache, so `http://localhost:4173` and `http://192.168.x.x:4173` on the same PC are different clients — both sync through the same server file.
- There is no authentication: anyone on your Wi-Fi can reach the app and its data. Keep it on a trusted home network, or bind it to localhost only (`$env:PORT` stays the same, change the listen address in `serve.js`) if that's a concern.

## Included Tracking Areas

- Rooms and zones with stage, lighting, medium, area, and plant limit
- Batches/lots with cultivar, stage, room, plant count, medium, and license reference
- Plant registry with tag, batch, room, stage, and lifecycle status
- Environment logs: air temp in F or C, humidity, CO2, VPD, leaf temp, fan speed, airflow
- Light logs: fixture, PPFD, DLI, photoperiod, dimmer, canopy distance
- Irrigation/feed logs: volume, pH, EC, water temp, runoff pH/EC, recipe
- Watering/pot-weight logs with dry-back % tracking and water-today/wait advice (soil vs coco thresholds)
- Ripeness/trichome logs (clear/cloudy/amber %, pistils, aroma) with a projected harvest window from the amber trend
- Medium/root-zone logs: moisture, medium temp, substrate pH/EC, amendments
- Plant health/IPM logs: plant or batch, canopy, pests, disease, severity, actions
- Work/compliance logs: sanitation, pruning, training, IPM, compliance, maintenance
- Harvest logs: wet weight, dry weight, waste weight, testing sample, crew
- Tasks and inventory with low-stock alerts; the week's playbook actions auto-generate a checkable task list per batch
- Grower's glossary: ? tooltips on metric labels and form fields across the app, full list in Settings
- Environmental setpoints by stage for dashboard alerts
- Room/tent equipment advisories for metric dimensions, fan size/capacity/speed, target air exchange, and mixed light color temperature
- JSON backup/restore and CSV log export

## Scenario Support

For a 1.2 m x 1.2 m x 2 m tent with an 8 inch inline fan, enter the dimensions, fan capacity in CFM, fan speed, and target air changes per minute in the room setup. The dashboard calculates tent volume, required airflow, recommended fan speed, and alerts if the configured fan speed is far above or below the calculated target.

For mixed LED floodlights, enter warm light count/Kelvin and white/cool light count/Kelvin. The dashboard calculates the average color temperature and compares it with the stage setpoints in Settings.

## Notes

This is an operational logbook, not a regulatory compliance guarantee. Real licensed operations should align fields, retention, and access controls with their jurisdiction and seed-to-sale tracking requirements.
