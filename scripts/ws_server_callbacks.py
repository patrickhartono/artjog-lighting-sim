# TD Operator: /project1/ws_callbacks (textDAT)
# Linked to: ws_server (webserverDAT, port 9980)
# Purpose: Handle WebSocket client connections from the browser sim.
#          Maintains a list of connected clients in /project1 storage.

def onWebSocketOpen(webServerDAT, client, message):
    root = op('/project1')
    clients = root.fetch('ws_clients', [])
    clients.append(client)
    root.store('ws_clients', clients)
    print(f'[artjog] Browser connected ({len(clients)} client(s))')

def onWebSocketReceiveText(webServerDAT, client, message):
    print(f'[artjog] Browser says: {message}')

def onWebSocketReceiveBinary(webServerDAT, client, contents):
    pass

def onWebSocketClose(webServerDAT, client):
    root = op('/project1')
    clients = root.fetch('ws_clients', [])
    if client in clients:
        clients.remove(client)
    root.store('ws_clients', clients)
    print(f'[artjog] Browser disconnected ({len(clients)} client(s))')
