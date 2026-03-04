# Simulation
Cross road project

## Traffic light visualization (JavaScript)

This project includes a browser-based traffic simulation with:
- Controlled 4-way intersection (North/South vs East/West)
- Custom lane count per approach
- Separate bicycle paths and footpaths around the roads
- Bike and pedestrian movement aligned with signal phases
- Configurable phase timings (green/yellow/all-red)
- Mixed traffic animation with cars, trucks, and bikes
- Vehicles stop at red/yellow and move only on their direction's green

### Defaults

- Cars / lane / min default: `5`
- Cars / lane / min allowed range: `5` to `120`

### Run

1. Open `index.html` in a browser, or run a local server.
2. Update controls and click **Apply**.

Optional local server (Python):

```bash
python -m http.server 8000
```

Then open: `http://localhost:8000`
