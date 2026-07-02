# Contract: Syncthing REST API Client

This contract defines the REST API endpoints and payload formats used by the Wrriter app to connect to the remote Syncthing client over the local network.

---

## 1. Request Headers

All requests sent to the Syncthing daemon API must include the API key header:

```http
X-API-Key: [USER_CONFIGURED_API_KEY]
Accept: application/json
```

---

## 2. Endpoints

### GET `/rest/system/status`
Fetches connection and sync status of the daemon.

* **Response Status**: `200 OK`
* **Response Body JSON**:
  ```json
  {
    "uptime": 12345,
    "myID": "DEVICE-ID-STRING-HERE",
    "status": "idle" | "syncing" | "error"
  }
  ```

---

### GET `/rest/config/devices`
Lists all active/connected sync client devices registered with the daemon.

* **Response Status**: `200 OK`
* **Response Body JSON**:
  ```json
  [
    {
      "deviceID": "DEVICE-ID-1",
      "name": "Desktop PC",
      "connected": true,
      "paused": false
    },
    {
      "deviceID": "DEVICE-ID-2",
      "name": "Laptop",
      "connected": false,
      "paused": false
    }
  ]
  ```

---

### POST `/rest/db/scan`
Triggers a folder scan on the daemon to check the filesystem for new or modified files.

* **Query Parameters**:
  - `folder`: The Syncthing folder ID (e.g. `default`).
* **Request Body**: Empty
* **Response Status**: `200 OK` (or `202 Accepted`)
* **Response Body**: Empty
