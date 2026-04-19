# TD Operator: /project1/ctrl_exec (chopexecuteDAT)
# Watches: lag1 (lagCHOP) ← parm1 (parameterCHOP) ← artjog_params (baseCOMP)
# Purpose: On any parameter change, serialize all 8 lighting params to JSON
#          and broadcast to all connected browser clients via ws_server.
#
# Parameter mapping (artjog_params custom params → JSON keys):
#   Preset        (menu 0-3)  → preset         "PRESET 1"–"PRESET 4"
#   Brightness    (0–1)       → roomBrightness  float
#   Animspeed     (0.5–10)    → animSpeed       float
#   Beamwidth     (0.1–0.8)   → beamWidth       float
#   Seqchase      (toggle)    → seqChase        bool
#   Bloomstrength (0–3)       → bloomStrength   float
#   Chaseinterval (0.05–1.0)  → chaseInterval   float
#   Beamcolorr/g/b (0–1 each) → beamColor       "#rrggbb"

import json

PRESET_NAMES = ['PRESET 1', 'PRESET 2', 'PRESET 3', 'PRESET 4']

def onValueChange(channel, sampleIndex, val, prev):
    root = op('/project1')
    p = op('/project1/artjog_params').par
    data = {
        'preset':         PRESET_NAMES[min(int(p.Preset), 3)],
        'roomBrightness': float(p.Brightness),
        'animSpeed':      float(p.Animspeed),
        'beamWidth':      float(p.Beamwidth),
        'seqChase':       bool(int(p.Seqchase)),
        'bloomStrength':  float(p.Bloomstrength),
        'chaseInterval':  float(p.Chaseinterval),
        'beamColor': '#{:02x}{:02x}{:02x}'.format(
            int(p.Beamcolorr * 255),
            int(p.Beamcolorg * 255),
            int(p.Beamcolorb * 255)
        )
    }
    msg = json.dumps(data)
    ws = op('/project1/ws_server')
    clients = root.fetch('ws_clients', [])
    for client in clients:
        ws.webSocketSendText(client, msg)
